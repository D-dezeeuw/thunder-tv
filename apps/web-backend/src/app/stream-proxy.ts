/**
 * Stream relay for browser (PWA) playback.
 *
 * IPTV providers frequently omit CORS headers on their stream edges (or
 * only on some of the load-balanced edges), which blocks hls.js/mpegts.js
 * playback in the browser even though the desktop app plays fine. This
 * endpoint fetches streams server-side and re-serves them with the app's
 * CORS policy, rewriting HLS playlists so segment requests also flow
 * through the relay.
 *
 * Security model — this is NOT an open proxy:
 * - Entry requests (`/stream?u=<b64url>`) are only served when the target
 *   URL's origin matches a provider target previously registered and
 *   validated through `/provider-targets`.
 * - Playlist rewrites emit sibling URLs signed with a per-process HMAC
 *   (`/stream?u=..&sig=..`), so redirected CDN/segment hosts chosen by the
 *   provider work while clients cannot forge arbitrary targets.
 * - Every upstream URL additionally passes the same private-network policy
 *   used for provider registration (verdicts cached per origin).
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Readable } from 'node:stream';
import axios from 'axios';
import type { Express, Request, RequestHandler, Response } from 'express';

const STREAM_CLIENT_USER_AGENT = 'VLC/3.0.18 LibVLC/3.0.18';
const PLAYLIST_MAX_BYTES = 4 * 1024 * 1024;
const UPSTREAM_HEADER_TIMEOUT_MS = 25_000;

export interface StreamProxyUpstreamResponse {
    readonly contentType: string;
    readonly finalUrl: string;
    readonly headers: Readonly<Record<string, string | undefined>>;
    readonly status: number;
    readonly stream: Readable;
}

export type StreamProxyFetch = (
    url: string,
    options: {
        readonly headers: Record<string, string>;
        readonly signal: AbortSignal;
    }
) => Promise<StreamProxyUpstreamResponse>;

export interface StreamProxyDeps {
    readonly corsMiddleware: RequestHandler;
    readonly fetchUpstream?: StreamProxyFetch;
    /** Origins registered (and validated) via /provider-targets. */
    readonly getRegisteredOrigins: () => ReadonlySet<string>;
    /** Same private-network policy used for provider registration. */
    readonly isUrlAllowed: (url: URL) => Promise<boolean>;
    readonly secret?: Buffer;
}

const HLS_TAGS_WITH_URI = /^#(EXT-X-KEY|EXT-X-SESSION-KEY|EXT-X-MAP|EXT-X-MEDIA|EXT-X-I-FRAME-STREAM-INF|EXT-X-PART|EXT-X-PRELOAD-HINT|EXT-X-RENDITION-REPORT)/;

export function signStreamUrl(secret: Buffer, encodedUrl: string): string {
    return createHmac('sha256', secret).update(encodedUrl).digest('base64url');
}

function verifySignature(
    secret: Buffer,
    encodedUrl: string,
    signature: string
): boolean {
    const expected = Buffer.from(signStreamUrl(secret, encodedUrl));
    const provided = Buffer.from(signature);
    return (
        expected.length === provided.length &&
        timingSafeEqual(expected, provided)
    );
}

export function encodeStreamUrl(url: string): string {
    return Buffer.from(url, 'utf8').toString('base64url');
}

function decodeStreamUrl(encoded: string): URL | null {
    try {
        const decoded = Buffer.from(encoded, 'base64url').toString('utf8');
        const url = new URL(decoded);
        return url.protocol === 'http:' || url.protocol === 'https:'
            ? url
            : null;
    } catch {
        return null;
    }
}

/**
 * Rewrites every URI in an HLS playlist to a signed, relative
 * `stream?u=..&sig=..` sibling URL. Relative form keeps the rewrite
 * correct behind any mount prefix (`/stream` and `/api/stream` alike).
 */
export function rewriteHlsPlaylist(
    body: string,
    playlistUrl: string,
    toProxyUri: (absoluteUrl: string) => string
): string {
    const rewriteUri = (uri: string): string => {
        try {
            return toProxyUri(new URL(uri, playlistUrl).href);
        } catch {
            return uri;
        }
    };

    return body
        .split(/\r?\n/)
        .map((line) => {
            const trimmed = line.trim();
            if (!trimmed) {
                return line;
            }
            if (trimmed.startsWith('#')) {
                if (!HLS_TAGS_WITH_URI.test(trimmed)) {
                    return line;
                }
                return line.replace(
                    /URI="([^"]+)"/g,
                    (_match, uri: string) => `URI="${rewriteUri(uri)}"`
                );
            }
            return rewriteUri(trimmed);
        })
        .join('\n');
}

function isHlsPlaylistResponse(contentType: string, url: string): boolean {
    const normalizedType = contentType.toLowerCase();
    if (normalizedType.includes('mpegurl')) {
        return true;
    }

    try {
        return new URL(url).pathname.toLowerCase().endsWith('.m3u8');
    } catch {
        return false;
    }
}

async function readStreamToString(
    stream: Readable,
    maxBytes: number
): Promise<string> {
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of stream) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buffer.length;
        if (total > maxBytes) {
            stream.destroy();
            throw new Error('Playlist exceeds maximum allowed size');
        }
        chunks.push(buffer);
    }
    return Buffer.concat(chunks).toString('utf8');
}

const defaultFetchUpstream: StreamProxyFetch = async (url, options) => {
    const response = await axios.get<Readable>(url, {
        headers: options.headers,
        maxRedirects: 5,
        responseType: 'stream',
        signal: options.signal,
        timeout: UPSTREAM_HEADER_TIMEOUT_MS,
        validateStatus: (status) => status < 400,
    });

    const request = response.request as {
        res?: { responseUrl?: string };
    } | null;

    return {
        contentType: String(response.headers['content-type'] ?? ''),
        finalUrl: request?.res?.responseUrl ?? url,
        headers: response.headers as Record<string, string | undefined>,
        status: response.status,
        stream: response.data,
    };
};

export function registerStreamProxyRoutes(
    app: Express,
    deps: StreamProxyDeps
): void {
    const secret = deps.secret ?? randomBytes(32);
    const fetchUpstream = deps.fetchUpstream ?? defaultFetchUpstream;
    const originVerdicts = new Map<string, Promise<boolean>>();

    const isOriginAllowedByPolicy = (url: URL): Promise<boolean> => {
        const cached = originVerdicts.get(url.origin);
        if (cached) {
            return cached;
        }
        const verdict = deps.isUrlAllowed(url).catch(() => false);
        originVerdicts.set(url.origin, verdict);
        return verdict;
    };

    const toProxyUri = (absoluteUrl: string): string => {
        const encoded = encodeStreamUrl(absoluteUrl);
        return `stream?u=${encoded}&sig=${signStreamUrl(secret, encoded)}`;
    };

    app.options('/stream', deps.corsMiddleware);
    app.get('/stream', deps.corsMiddleware, async (req: Request, res: Response) => {
        const encoded = getQueryValue(req, 'u');
        if (!encoded) {
            res.status(400).json({ message: 'Missing u', status: 400 });
            return;
        }

        const url = decodeStreamUrl(encoded);
        if (!url) {
            res.status(400).json({ message: 'Invalid stream URL', status: 400 });
            return;
        }

        const signature = getQueryValue(req, 'sig');
        if (signature) {
            if (!verifySignature(secret, encoded, signature)) {
                res.status(403).json({
                    message: 'Invalid stream signature',
                    status: 403,
                });
                return;
            }
        } else if (!deps.getRegisteredOrigins().has(url.origin)) {
            res.status(403).json({
                message:
                    'Stream origin is not a registered provider target',
                status: 403,
            });
            return;
        }

        if (!(await isOriginAllowedByPolicy(url))) {
            res.status(400).json({
                message: 'Stream URL is not allowed',
                status: 400,
            });
            return;
        }

        const abortController = new AbortController();
        res.on('close', () => abortController.abort());

        const headers: Record<string, string> = {
            Accept: '*/*',
            'User-Agent': STREAM_CLIENT_USER_AGENT,
        };
        const range = req.headers.range;
        if (typeof range === 'string') {
            headers.Range = range;
        }

        let upstream: StreamProxyUpstreamResponse;
        try {
            upstream = await fetchUpstream(url.href, {
                headers,
                signal: abortController.signal,
            });
        } catch (error) {
            if (!res.headersSent) {
                const status = axios.isAxiosError(error)
                    ? (error.response?.status ?? 502)
                    : 502;
                res.status(status >= 400 ? status : 502).json({
                    message: 'Failed to fetch stream from provider',
                    status: status >= 400 ? status : 502,
                });
            }
            return;
        }

        try {
            if (isHlsPlaylistResponse(upstream.contentType, upstream.finalUrl)) {
                const body = await readStreamToString(
                    upstream.stream,
                    PLAYLIST_MAX_BYTES
                );
                res.status(upstream.status)
                    .type('application/vnd.apple.mpegurl')
                    .send(rewriteHlsPlaylist(body, upstream.finalUrl, toProxyUri));
                return;
            }

            res.status(upstream.status);
            for (const header of [
                'content-type',
                'content-length',
                'accept-ranges',
                'content-range',
            ]) {
                const value = upstream.headers[header];
                if (value) {
                    res.setHeader(header, value);
                }
            }
            upstream.stream.on('error', () => {
                res.destroy();
            });
            upstream.stream.pipe(res);
        } catch {
            upstream.stream.destroy();
            if (!res.headersSent) {
                res.status(502).json({
                    message: 'Failed to relay stream from provider',
                    status: 502,
                });
            }
        }
    });
}

function getQueryValue(req: Request, key: string): string | undefined {
    const value = req.query[key];
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first !== 'string') {
        return undefined;
    }
    const normalized = first.trim();
    return normalized.length > 0 ? normalized : undefined;
}
