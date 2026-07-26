/**
 * Pure helpers for the curated live view: parse provider channel names
 * (country prefix, quality markers, replay markers) and group duplicate
 * quality variants of the same channel behind one entry.
 *
 * Quality preference is bandwidth-aware: 1080p/FHD first, then HD, then
 * unlabeled feeds, then 4K/UHD/8K (too heavy as a default), then SD.
 */

/** `┃NL┃`, `|NL|`, `[NL]`, `(NL)` style country/provider prefixes. */
const COUNTRY_PREFIX_PATTERN = /^\s*[┃|[(]\s*([^┃|\])]*?)\s*[┃|\])]\s*/u;

/** Record/replay markers seen on catch-up channels (`⏺ʳᵉᶜ`). */
const REPLAY_MARKER_PATTERN = /[⏺]|ʳᵉᶜ/giu;

/** Channels that are provider notices, not content. */
const JUNK_NAME_PATTERN = /UPDATE\s+YOUR\s+PLAYLIST/i;

const FHD_TOKENS = new Set(['FHD', 'FULLHD', '1080', '1080P', '1080I']);
const HD_TOKENS = new Set(['HD', '720', '720P']);
const UHD_TOKENS = new Set(['4K', 'UHD', '8K', '8K+', '2160', '2160P']);
const SD_TOKENS = new Set(['SD']);
const FPS_TOKEN_PATTERN = /^\d{2,3}FPS$/;

export type LiveQualityTier = 'fhd' | 'hd' | 'unknown' | 'uhd' | 'sd';

/** Lower rank = preferred default (1080p before 4K — bandwidth). */
export const LIVE_QUALITY_RANK: Record<LiveQualityTier, number> = {
    fhd: 0,
    hd: 1,
    unknown: 2,
    uhd: 3,
    sd: 4,
};

export interface ParsedLiveChannelName {
    /** Prefix token, e.g. `NL` for `┃NL┃ NPO 1 HD`. Empty when absent. */
    readonly prefix: string;
    /** Normalized grouping key: no prefix/quality/replay markers. */
    readonly key: string;
    /** Clean human-readable name (`NPO 1` for `┃NL┃ NPO 1 FHD 50FPS`). */
    readonly displayName: string;
    /** Quality tokens as written, e.g. `FHD 50FPS`, `8K+ UHD`, `` (none). */
    readonly qualityLabel: string;
    readonly qualityTier: LiveQualityTier;
    readonly qualityRank: number;
    readonly hasReplayMarker: boolean;
    /** Provider notice rows (`☰☰ UPDATE YOUR PLAYLIST ☰☰`) — hidden. */
    readonly isJunk: boolean;
}

export function extractCountryPrefix(rawName: string): string {
    const match = COUNTRY_PREFIX_PATTERN.exec(rawName ?? '');
    return match?.[1]?.trim() ?? '';
}

/** Returns the name with its `┃NL┃`-style prefix removed, if present. */
export function stripCountryPrefix(rawName: string): string {
    const match = COUNTRY_PREFIX_PATTERN.exec(rawName ?? '');
    return (rawName ?? '').slice(match?.[0]?.length ?? 0);
}

export function parseLiveChannelName(rawName: string): ParsedLiveChannelName {
    const prefixMatch = COUNTRY_PREFIX_PATTERN.exec(rawName ?? '');
    const prefix = prefixMatch?.[1]?.trim() ?? '';
    let rest = (rawName ?? '').slice(prefixMatch?.[0]?.length ?? 0);

    const hasReplayMarker = REPLAY_MARKER_PATTERN.test(rest);
    REPLAY_MARKER_PATTERN.lastIndex = 0;
    rest = rest.replace(REPLAY_MARKER_PATTERN, ' ');

    const isJunk =
        JUNK_NAME_PATTERN.test(rest) || !/[\p{L}\p{N}]/u.test(rest);

    // "FULL HD" spans two tokens — normalize before tokenizing.
    const tokens = rest
        .replace(/\bFULL\s+HD\b/gi, 'FHD')
        .split(/\s+/)
        .filter(Boolean);

    const nameTokens: string[] = [];
    const qualityTokens: string[] = [];
    const tiers = new Set<LiveQualityTier>();

    for (const token of tokens) {
        const upper = token.toUpperCase();
        if (FHD_TOKENS.has(upper)) {
            tiers.add('fhd');
            qualityTokens.push(upper);
        } else if (UHD_TOKENS.has(upper)) {
            tiers.add('uhd');
            qualityTokens.push(upper);
        } else if (HD_TOKENS.has(upper)) {
            tiers.add('hd');
            qualityTokens.push(upper);
        } else if (SD_TOKENS.has(upper)) {
            tiers.add('sd');
            qualityTokens.push(upper);
        } else if (FPS_TOKEN_PATTERN.test(upper)) {
            qualityTokens.push(upper);
        } else {
            nameTokens.push(token);
        }
    }

    const qualityTier = resolveQualityTier(tiers);
    const displayName = trimSeparators(nameTokens.join(' '));
    const key = toGroupingKey(displayName) || toGroupingKey(rest);

    return {
        prefix,
        key,
        displayName: displayName || trimSeparators(rest),
        qualityLabel: qualityTokens.join(' '),
        qualityTier,
        qualityRank: LIVE_QUALITY_RANK[qualityTier],
        hasReplayMarker,
        isJunk,
    };
}

/** A tier set can mix markers (`8K+ UHD`); FHD wins, then HD, UHD, SD. */
function resolveQualityTier(tiers: ReadonlySet<LiveQualityTier>): LiveQualityTier {
    if (tiers.has('fhd')) return 'fhd';
    if (tiers.has('hd')) return 'hd';
    if (tiers.has('uhd')) return 'uhd';
    if (tiers.has('sd')) return 'sd';
    return 'unknown';
}

function trimSeparators(value: string): string {
    return value
        .replace(/\s+/g, ' ')
        .replace(/^[\s|•·:\-–—]+/, '')
        .replace(/[\s|•·:\-–—]+$/, '')
        .trim();
}

function toGroupingKey(value: string): string {
    return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

export interface CurableLiveStreamLike {
    readonly category_id?: string | number;
    readonly name?: string;
    readonly stream_id?: number;
    readonly title?: string;
    readonly tv_archive?: number | null;
    readonly xtream_id?: number;
}

export interface LiveChannelVariant<T extends CurableLiveStreamLike> {
    readonly stream: T;
    /** Original provider name, shown in the variant picker. */
    readonly originalName: string;
    readonly qualityLabel: string;
    readonly qualityTier: LiveQualityTier;
    readonly qualityRank: number;
    readonly hasArchive: boolean;
}

export interface LiveChannelGroup<T extends CurableLiveStreamLike> {
    readonly key: string;
    readonly displayName: string;
    /**
     * Best variant's stream with `name`/`title` replaced by the clean
     * display name, so lists and the player show `NPO 1` instead of
     * `┃NL┃ NPO 1 FHD 50FPS`. Ids and stream fields stay untouched.
     */
    readonly primary: T;
    /** All variants, preferred first (FHD → HD → unlabeled → 4K → SD). */
    readonly variants: LiveChannelVariant<T>[];
}

export function getLiveStreamId(stream: CurableLiveStreamLike): number {
    return Number(stream.xtream_id ?? stream.stream_id ?? NaN);
}

/**
 * Groups duplicate quality variants of the same channel. Junk/notice rows
 * are dropped. Group order follows first appearance (server order); variant
 * order within a group follows the bandwidth-aware quality ranking.
 */
export function groupLiveChannelVariants<T extends CurableLiveStreamLike>(
    streams: readonly T[]
): LiveChannelGroup<T>[] {
    const groupsByKey = new Map<
        string,
        { displayName: string; variants: [LiveChannelVariant<T>, number][] }
    >();
    const order: string[] = [];

    streams.forEach((stream, index) => {
        const rawName = stream.title ?? stream.name ?? '';
        const parsed = parseLiveChannelName(rawName);
        if (parsed.isJunk) {
            return;
        }

        const variant: LiveChannelVariant<T> = {
            stream,
            originalName: rawName,
            qualityLabel: parsed.qualityLabel,
            qualityTier: parsed.qualityTier,
            qualityRank: parsed.qualityRank,
            hasArchive:
                parsed.hasReplayMarker || Number(stream.tv_archive) === 1,
        };

        const existing = groupsByKey.get(parsed.key);
        if (existing) {
            existing.variants.push([variant, index]);
            return;
        }

        groupsByKey.set(parsed.key, {
            displayName: parsed.displayName,
            variants: [[variant, index]],
        });
        order.push(parsed.key);
    });

    return order.map((key) => {
        const entry = groupsByKey.get(key)!;
        const variants = entry.variants
            .sort(
                ([a, aIndex], [b, bIndex]) =>
                    a.qualityRank - b.qualityRank || aIndex - bIndex
            )
            .map(([variant]) => variant);

        const best = variants[0].stream;
        const primary: T = {
            ...best,
            name: entry.displayName,
            title: entry.displayName,
        };

        return { key, displayName: entry.displayName, primary, variants };
    });
}
