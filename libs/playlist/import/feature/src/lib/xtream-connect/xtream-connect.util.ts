import { normalizeXtreamServerUrl } from '@iptvnator/shared/interfaces';

/** Sections a connect deep-link may open directly. */
export type XtreamConnectSection = 'live' | 'vod' | 'series';

export interface XtreamConnectParams {
    readonly serverUrl: string;
    readonly username: string;
    readonly password: string;
    readonly title: string;
    readonly section: XtreamConnectSection | null;
}

export type XtreamConnectParseResult =
    | { readonly ok: true; readonly params: XtreamConnectParams }
    | { readonly ok: false; readonly reason: 'missing-fields' | 'invalid-url' };

/** Minimal shape of Angular's ParamMap so this stays framework-agnostic. */
export interface QueryParamLookup {
    get(key: string): string | null;
}

// Accept a few friendly aliases so hand-written bookmarks are forgiving.
const SERVER_KEYS = ['serverUrl', 'server', 'url'] as const;
const USERNAME_KEYS = ['username', 'user'] as const;
const PASSWORD_KEYS = ['password', 'pass'] as const;
const TITLE_KEYS = ['title', 'name'] as const;

function firstValue(
    query: QueryParamLookup,
    keys: readonly string[]
): string {
    for (const key of keys) {
        const value = query.get(key);
        if (value && value.trim()) {
            return value.trim();
        }
    }
    return '';
}

function safeNormalizeServerUrl(value: string): string {
    try {
        return normalizeXtreamServerUrl(value);
    } catch {
        return value.trim();
    }
}

function hostLabel(serverUrl: string): string {
    try {
        return new URL(serverUrl).host;
    } catch {
        return 'Xtream portal';
    }
}

/**
 * Parses the query parameters of a `/connect` bookmark into normalized
 * Xtream connection details. Returns a typed failure when required fields
 * are missing or the server URL is not a valid http(s) portal URL.
 */
export function parseXtreamConnectParams(
    query: QueryParamLookup
): XtreamConnectParseResult {
    const rawServer = firstValue(query, SERVER_KEYS);
    const username = firstValue(query, USERNAME_KEYS);
    const password = firstValue(query, PASSWORD_KEYS);

    if (!rawServer || !username || !password) {
        return { ok: false, reason: 'missing-fields' };
    }

    let serverUrl: string;
    try {
        serverUrl = normalizeXtreamServerUrl(rawServer);
    } catch {
        return { ok: false, reason: 'invalid-url' };
    }

    const sectionRaw = (query.get('section') ?? '').trim().toLowerCase();
    const section =
        sectionRaw === 'live' ||
        sectionRaw === 'vod' ||
        sectionRaw === 'series'
            ? sectionRaw
            : null;

    return {
        ok: true,
        params: {
            serverUrl,
            username,
            password,
            title: firstValue(query, TITLE_KEYS) || hostLabel(serverUrl),
            section,
        },
    };
}

export interface XtreamPlaylistLike {
    readonly _id?: string;
    readonly serverUrl?: string;
    readonly username?: string;
}

/**
 * Finds an already-imported Xtream portal matching the connect details.
 * Identity is the normalized server URL plus the (trimmed) username — the
 * account identity — so re-opening a bookmark reuses the existing portal
 * instead of importing a duplicate. The password is intentionally not part
 * of the match so a rotated password still resolves to the same portal.
 */
export function findMatchingXtreamPlaylist<T extends XtreamPlaylistLike>(
    playlists: readonly T[],
    serverUrl: string,
    username: string
): T | null {
    const normalizedServer = safeNormalizeServerUrl(serverUrl);
    const normalizedUsername = username.trim();

    return (
        playlists.find((playlist) => {
            if (!playlist.serverUrl || !playlist.username) {
                return false;
            }
            return (
                safeNormalizeServerUrl(playlist.serverUrl) ===
                    normalizedServer &&
                playlist.username.trim() === normalizedUsername
            );
        }) ?? null
    );
}
