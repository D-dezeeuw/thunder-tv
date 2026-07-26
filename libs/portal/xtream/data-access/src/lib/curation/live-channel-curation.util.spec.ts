import {
    groupLiveChannelVariants,
    parseLiveChannelName,
} from './live-channel-curation.util';

describe('parseLiveChannelName', () => {
    it('strips the country prefix and quality tokens', () => {
        const parsed = parseLiveChannelName('┃NL┃ NPO 1 FHD 50FPS');
        expect(parsed.prefix).toBe('NL');
        expect(parsed.displayName).toBe('NPO 1');
        expect(parsed.key).toBe('npo1');
        expect(parsed.qualityLabel).toBe('FHD 50FPS');
        expect(parsed.qualityTier).toBe('fhd');
    });

    it('normalizes spacing differences into the same key', () => {
        expect(parseLiveChannelName('┃NL┃ NPO1 HD').key).toBe(
            parseLiveChannelName('┃NL┃ NPO 1  8K+ UHD').key
        );
    });

    it('groups slash and space separated names together', () => {
        expect(parseLiveChannelName('┃NL┃ VERONICA/DISNEY XD FHD 50FPS').key).toBe(
            parseLiveChannelName('┃NL┃ VERONICA DISNEY XD HD').key
        );
    });

    it('ranks 1080p before HD before 4K before SD', () => {
        const fhd = parseLiveChannelName('NPO 1 FHD');
        const hd = parseLiveChannelName('NPO 1 HD');
        const plain = parseLiveChannelName('NPO 1');
        const uhd = parseLiveChannelName('NPO 1 4K');
        const sd = parseLiveChannelName('NPO 1 SD');

        expect(fhd.qualityRank).toBeLessThan(hd.qualityRank);
        expect(hd.qualityRank).toBeLessThan(plain.qualityRank);
        expect(plain.qualityRank).toBeLessThan(uhd.qualityRank);
        expect(uhd.qualityRank).toBeLessThan(sd.qualityRank);
    });

    it('treats 8K and 8K+ UHD marketing labels as the UHD tier', () => {
        expect(parseLiveChannelName('┃NL┃ RTL 4 8K').qualityTier).toBe('uhd');
        expect(parseLiveChannelName('┃NL┃ RTL 4 8K+ UHD').qualityTier).toBe(
            'uhd'
        );
    });

    it('detects replay markers and strips them from the name', () => {
        const parsed = parseLiveChannelName('┃NL┃ NPO 1 HD  ⏺ʳᵉᶜ');
        expect(parsed.hasReplayMarker).toBe(true);
        expect(parsed.displayName).toBe('NPO 1');
        expect(parsed.key).toBe('npo1');
    });

    it('flags provider notice rows as junk', () => {
        expect(
            parseLiveChannelName('☰☰☰☰ UPDATE YOUR PLAYLIST ☰☰☰☰').isJunk
        ).toBe(true);
        expect(parseLiveChannelName('┃NL┃ NPO 1 HD').isJunk).toBe(false);
    });

    it('trims trailing separators left by token removal', () => {
        expect(
            parseLiveChannelName('┃NL┃ VIAPLAY FORMULE 2 HD |').displayName
        ).toBe('VIAPLAY FORMULE 2');
    });

    it('keeps distinct channel numbers distinct', () => {
        expect(parseLiveChannelName('ESPN 1 8K').key).not.toBe(
            parseLiveChannelName('ESPN 2 8K').key
        );
        expect(parseLiveChannelName('ESPN 8K UHD').key).not.toBe(
            parseLiveChannelName('ESPN 1 8K').key
        );
    });
});

describe('groupLiveChannelVariants', () => {
    const stream = (
        xtreamId: number,
        name: string,
        categoryId: string,
        tvArchive = 0
    ) => ({
        xtream_id: xtreamId,
        name,
        category_id: categoryId,
        tv_archive: tvArchive,
    });

    it('groups quality variants and prefers 1080p over 4K and HD', () => {
        const groups = groupLiveChannelVariants([
            stream(1, '┃NL┃ NPO 1 8K', '497'),
            stream(2, '┃NL┃ NPO 1  8K+ UHD', '622'),
            stream(3, '┃NL┃ NPO 1 FHD 50FPS', '3038'),
            stream(4, '┃NL┃ NPO1 HD', '3039'),
            stream(5, '┃NL┃ NPO 1 4K', '820'),
            stream(6, '┃NL┃ RTL 4 HD', '3039'),
        ]);

        expect(groups).toHaveLength(2);
        const npo1 = groups[0];
        expect(npo1.displayName).toBe('NPO 1');
        expect(npo1.variants).toHaveLength(5);
        // FHD 50FPS wins as the default (bandwidth-aware preference).
        expect(npo1.primary.xtream_id).toBe(3);
        expect(npo1.primary.name).toBe('NPO 1');
        expect(npo1.variants.map((v) => v.stream.xtream_id)).toEqual([
            3, 4, 1, 2, 5,
        ]);
    });

    it('keeps first-appearance (server) order for groups', () => {
        const groups = groupLiveChannelVariants([
            stream(1, '┃NL┃ RTL 4 HD', '1'),
            stream(2, '┃NL┃ NPO 1 HD', '1'),
            stream(3, '┃NL┃ RTL 4 FHD', '2'),
        ]);

        expect(groups.map((g) => g.displayName)).toEqual(['RTL 4', 'NPO 1']);
    });

    it('drops junk notice rows', () => {
        const groups = groupLiveChannelVariants([
            stream(1, '☰☰☰☰ UPDATE YOUR PLAYLIST ☰☰☰☰', '292'),
            stream(2, '┃NL┃ VIAPLAY FORMULE 1 FHD', '292'),
        ]);

        expect(groups).toHaveLength(1);
        expect(groups[0].displayName).toBe('VIAPLAY FORMULE 1');
    });

    it('marks replay variants via name marker or tv_archive flag', () => {
        const groups = groupLiveChannelVariants([
            stream(1, '┃NL┃ NPO 1 FHD 50FPS', '3038'),
            stream(2, '┃NL┃ NPO 1 HD  ⏺ʳᵉᶜ', '26'),
            stream(3, '┃NL┃ RTL 4 HD', '3039', 1),
        ]);

        const npo1 = groups.find((g) => g.displayName === 'NPO 1')!;
        expect(npo1.variants[0].hasArchive).toBe(false);
        expect(npo1.variants[1].hasArchive).toBe(true);
        const rtl4 = groups.find((g) => g.displayName === 'RTL 4')!;
        expect(rtl4.variants[0].hasArchive).toBe(true);
    });

    it('ties within a quality tier resolve by original order', () => {
        const groups = groupLiveChannelVariants([
            stream(1, 'Ziggo Sport HD', '36'),
            stream(2, 'ZIGGO SPORT HD', '622'),
        ]);

        expect(groups).toHaveLength(1);
        expect(groups[0].primary.xtream_id).toBe(1);
    });
});
