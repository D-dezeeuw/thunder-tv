import { AddressInfo } from 'node:net';
import { Server } from 'node:http';
import { Readable } from 'node:stream';
import {
    encodeStreamUrl,
    rewriteHlsPlaylist,
    signStreamUrl,
    StreamProxyFetch,
    StreamProxyUpstreamResponse,
} from './stream-proxy';
import { createWebBackendApp } from './web-backend-app';

const SECRET = Buffer.from('stream-proxy-test-secret-32-bytes!!');

function upstreamResponse(
    overrides: Partial<StreamProxyUpstreamResponse> & { body: string }
): StreamProxyUpstreamResponse {
    return {
        contentType: overrides.contentType ?? 'video/mp2t',
        finalUrl: overrides.finalUrl ?? 'http://provider.example/live/x.ts',
        headers: overrides.headers ?? {
            'content-type': overrides.contentType ?? 'video/mp2t',
        },
        status: overrides.status ?? 200,
        stream: Readable.from([Buffer.from(overrides.body, 'utf8')]),
    };
}

describe('rewriteHlsPlaylist', () => {
    const toProxyUri = (absolute: string) =>
        `stream?u=${encodeStreamUrl(absolute)}&sig=test`;

    it('rewrites segment lines against the final playlist URL', () => {
        const body = [
            '#EXTM3U',
            '#EXTINF:10.0,',
            '/hls/token/933084_151.ts',
            '#EXTINF:10.0,',
            'relative_152.ts',
        ].join('\n');

        const rewritten = rewriteHlsPlaylist(
            body,
            'http://edge.example:80/live/play/abc/933084',
            toProxyUri
        );

        const lines = rewritten.split('\n');
        expect(lines[2]).toBe(
            toProxyUri('http://edge.example/hls/token/933084_151.ts')
        );
        expect(lines[4]).toBe(
            toProxyUri('http://edge.example/live/play/abc/relative_152.ts')
        );
    });

    it('rewrites URI attributes on key/map tags but leaves other tags alone', () => {
        const body = [
            '#EXTM3U',
            '#EXT-X-TARGETDURATION:10',
            '#EXT-X-KEY:METHOD=AES-128,URI="keys/k1.bin",IV=0xabc',
            'seg1.ts',
        ].join('\n');

        const rewritten = rewriteHlsPlaylist(
            body,
            'http://edge.example/live/index.m3u8',
            toProxyUri
        );

        expect(rewritten).toContain('#EXT-X-TARGETDURATION:10');
        expect(rewritten).toContain(
            `URI="${toProxyUri('http://edge.example/live/keys/k1.bin')}"`
        );
    });
});

describe('/stream endpoint', () => {
    let server: Server;
    let baseUrl: string;
    let upstreamRequests: { url: string; headers: Record<string, string> }[];
    let queuedResponses: StreamProxyUpstreamResponse[];

    const fetchUpstream: StreamProxyFetch = async (url, options) => {
        upstreamRequests.push({ url, headers: options.headers });
        const next = queuedResponses.shift();
        if (!next) {
            throw new Error(`No queued upstream response for ${url}`);
        }
        return next;
    };

    beforeEach(async () => {
        upstreamRequests = [];
        queuedResponses = [];
        const app = createWebBackendApp({
            allowPrivateNetworkTargets: true,
            clientOrigins: ['*'],
            streamProxyFetch: fetchUpstream,
            streamProxySecret: SECRET,
        });
        server = await new Promise<Server>((resolve) => {
            const started = app.listen(0, '127.0.0.1', () =>
                resolve(started)
            );
        });
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
    });

    afterEach(async () => {
        await new Promise((resolve) => server.close(resolve));
    });

    async function registerProvider(url: string): Promise<void> {
        const response = await fetch(`${baseUrl}/provider-targets`, {
            body: JSON.stringify({ url }),
            headers: { 'content-type': 'application/json' },
            method: 'POST',
        });
        expect(response.status).toBe(200);
    }

    it('rejects requests without a stream URL', async () => {
        const response = await fetch(`${baseUrl}/stream`);
        expect(response.status).toBe(400);
    });

    it('rejects unsigned requests for unregistered origins', async () => {
        const encoded = encodeStreamUrl('http://unregistered.example/live/1.ts');
        const response = await fetch(`${baseUrl}/stream?u=${encoded}`);
        expect(response.status).toBe(403);
        expect(upstreamRequests).toHaveLength(0);
    });

    it('rejects tampered segment signatures', async () => {
        const encoded = encodeStreamUrl('http://edge.example/seg1.ts');
        const response = await fetch(
            `${baseUrl}/stream?u=${encoded}&sig=forged`
        );
        expect(response.status).toBe(403);
        expect(upstreamRequests).toHaveLength(0);
    });

    it('relays raw streams for registered origins with CORS headers', async () => {
        await registerProvider('http://provider.example');
        queuedResponses.push(upstreamResponse({ body: 'TS-DATA' }));

        const encoded = encodeStreamUrl(
            'http://provider.example/live/user/pass/1.ts'
        );
        const response = await fetch(`${baseUrl}/stream?u=${encoded}`, {
            headers: { origin: 'http://localhost:4200' },
        });

        expect(response.status).toBe(200);
        expect(response.headers.get('access-control-allow-origin')).toBe(
            'http://localhost:4200'
        );
        expect(await response.text()).toBe('TS-DATA');
        expect(upstreamRequests[0].url).toBe(
            'http://provider.example/live/user/pass/1.ts'
        );
        expect(upstreamRequests[0].headers['User-Agent']).toContain('VLC');
    });

    it('rewrites HLS playlists to signed proxy URIs and relays segments', async () => {
        await registerProvider('http://provider.example');
        queuedResponses.push(
            upstreamResponse({
                body: '#EXTM3U\n#EXTINF:10.0,\n/hls/tok/1_1.ts\n',
                contentType: 'application/x-mpegURL',
                finalUrl: 'http://edge.example/live/play/tok/1',
            })
        );

        const encoded = encodeStreamUrl(
            'http://provider.example/live/user/pass/1.m3u8'
        );
        const playlistResponse = await fetch(`${baseUrl}/stream?u=${encoded}`);
        expect(playlistResponse.status).toBe(200);
        expect(playlistResponse.headers.get('content-type')).toContain(
            'mpegurl'
        );

        const body = await playlistResponse.text();
        const segmentUri = body
            .split('\n')
            .find((line) => line.startsWith('stream?u='));
        expect(segmentUri).toBeDefined();

        const segmentQuery = new URLSearchParams(
            segmentUri!.slice('stream?'.length)
        );
        const segmentEncoded = segmentQuery.get('u')!;
        expect(
            Buffer.from(segmentEncoded, 'base64url').toString('utf8')
        ).toBe('http://edge.example/hls/tok/1_1.ts');
        expect(segmentQuery.get('sig')).toBe(
            signStreamUrl(SECRET, segmentEncoded)
        );

        // Segment host differs from the registered origin — allowed only
        // because the URL carries a valid server-produced signature.
        queuedResponses.push(upstreamResponse({ body: 'SEGMENT' }));
        const segmentResponse = await fetch(`${baseUrl}/${segmentUri}`);
        expect(segmentResponse.status).toBe(200);
        expect(await segmentResponse.text()).toBe('SEGMENT');
    });

    it('forwards Range headers for VOD requests', async () => {
        await registerProvider('http://provider.example');
        queuedResponses.push(
            upstreamResponse({
                body: 'PARTIAL',
                contentType: 'video/mp4',
                headers: {
                    'content-range': 'bytes 0-6/100',
                    'content-type': 'video/mp4',
                },
                status: 206,
            })
        );

        const encoded = encodeStreamUrl(
            'http://provider.example/movie/user/pass/9.mp4'
        );
        const response = await fetch(`${baseUrl}/stream?u=${encoded}`, {
            headers: { range: 'bytes=0-6' },
        });

        expect(response.status).toBe(206);
        expect(response.headers.get('content-range')).toBe('bytes 0-6/100');
        expect(upstreamRequests[0].headers['Range']).toBe('bytes=0-6');
    });
});
