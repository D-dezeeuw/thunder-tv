import {
    findMatchingXtreamPlaylist,
    parseXtreamConnectParams,
    QueryParamLookup,
} from './xtream-connect.util';

function query(params: Record<string, string>): QueryParamLookup {
    return { get: (key: string) => params[key] ?? null };
}

describe('parseXtreamConnectParams', () => {
    it('parses full connect details and normalizes the server URL', () => {
        const result = parseXtreamConnectParams(
            query({
                serverUrl: 'http://example.com:8080/player_api.php',
                username: 'user1',
                password: 'pass1',
                title: 'My TV',
            })
        );

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.params.serverUrl).toBe('http://example.com:8080');
        expect(result.params.username).toBe('user1');
        expect(result.params.password).toBe('pass1');
        expect(result.params.title).toBe('My TV');
        expect(result.params.section).toBeNull();
    });

    it('accepts friendly aliases and trims values', () => {
        const result = parseXtreamConnectParams(
            query({
                server: 'http://example.com:8080',
                user: '  user1  ',
                pass: '  pass1  ',
            })
        );

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.params.username).toBe('user1');
        expect(result.params.password).toBe('pass1');
    });

    it('defaults the title to the server host when none is provided', () => {
        const result = parseXtreamConnectParams(
            query({
                serverUrl: 'http://example.com:8080',
                username: 'user1',
                password: 'pass1',
            })
        );

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.params.title).toBe('example.com:8080');
    });

    it('accepts a valid section and ignores unknown sections', () => {
        const live = parseXtreamConnectParams(
            query({
                serverUrl: 'http://example.com',
                username: 'u',
                password: 'p',
                section: 'LIVE',
            })
        );
        expect(live.ok && live.params.section).toBe('live');

        const bogus = parseXtreamConnectParams(
            query({
                serverUrl: 'http://example.com',
                username: 'u',
                password: 'p',
                section: 'sports',
            })
        );
        expect(bogus.ok && bogus.params.section).toBeNull();
    });

    it('fails when required fields are missing', () => {
        const result = parseXtreamConnectParams(
            query({ serverUrl: 'http://example.com', username: 'user1' })
        );
        expect(result).toEqual({ ok: false, reason: 'missing-fields' });
    });

    it('fails when the server URL is not a valid http(s) URL', () => {
        const result = parseXtreamConnectParams(
            query({
                serverUrl: 'ftp://example.com',
                username: 'user1',
                password: 'pass1',
            })
        );
        expect(result).toEqual({ ok: false, reason: 'invalid-url' });
    });
});

describe('findMatchingXtreamPlaylist', () => {
    const playlists = [
        { _id: 'a', serverUrl: 'http://example.com:8080', username: 'user1' },
        { _id: 'b', serverUrl: 'http://other.com', username: 'user2' },
    ];

    it('matches on normalized server URL and username', () => {
        const match = findMatchingXtreamPlaylist(
            playlists,
            'http://example.com:8080/player_api.php',
            'user1'
        );
        expect(match?._id).toBe('a');
    });

    it('does not match a different username on the same server', () => {
        const match = findMatchingXtreamPlaylist(
            playlists,
            'http://example.com:8080',
            'someoneelse'
        );
        expect(match).toBeNull();
    });

    it('ignores playlists without Xtream credentials', () => {
        const match = findMatchingXtreamPlaylist(
            [{ _id: 'm3u', serverUrl: undefined, username: undefined }],
            'http://example.com',
            'user1'
        );
        expect(match).toBeNull();
    });
});
