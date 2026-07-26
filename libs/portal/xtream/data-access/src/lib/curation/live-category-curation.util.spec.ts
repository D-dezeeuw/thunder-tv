import {
    buildCuratedLiveCategorization,
    CuratedLiveCategory,
    isCuratedLiveCategoryId,
} from './live-category-curation.util';

const category = (id: number, name: string) => ({
    category_id: String(id),
    category_name: name,
});

describe('buildCuratedLiveCategorization', () => {
    it('merges NL categories into semantic buckets', () => {
        const result = buildCuratedLiveCategorization([
            category(497, '┃NL┃ BASIS TV+'),
            category(622, '┃NL┃ ZIGGO KABEL'),
            category(3038, '┃NL┃ ODIDO FHD 50FPS'),
            category(3039, '┃NL┃ ODIDO HD'),
            category(820, '┃NL┃ NEDERLAND 4K ULTRA'),
            category(26, '┃NL┃ NEDERLAND HD | TERUGKIJKEN ⏺'),
            category(36, '┃NL┃ SPORT TV+'),
            category(7, '┃NL┃ F1 TV PRO'),
            category(292, '┃NL┃ VIAPLAY F1'),
            category(3298, '┃NL┃ VIAPLAY VROOOOOM'),
            category(821, '┃NL┃ VIAPLAY PREMIER LEAGUE'),
            category(2965, '┃NL┃ FEYENOORD ONE'),
            category(498, '┃NL┃ JEUGD | BABY'),
            category(587, '┃NL┃ OD ZONE+ KIDS'),
            category(503, '┃NL┃ MOVIES | SERIES XL'),
            category(3290, '┃NL┃ OD NETFLIX'),
            category(3260, '┃NL┃ NLZIET LIVE'),
            category(2959, '┃NL┃ INDIA EU'),
        ]);

        const buckets = result.categories.filter(
            (c): c is CuratedLiveCategory => 'curated' in c
        );
        const byName = new Map(
            buckets.map((b) => [b.category_name, b.memberCategoryIds])
        );

        expect(byName.get('Nederland')).toEqual([497, 622, 3038, 3039, 820, 26]);
        expect(byName.get('Sport')).toEqual([36]);
        expect(byName.get('Formule 1')).toEqual([7, 292, 3298]);
        expect(byName.get('Voetbal')).toEqual([821, 2965]);
        expect(byName.get('Jeugd')).toEqual([498, 587]);
        expect(byName.get('Films & Series')).toEqual([503]);
        expect(byName.get('On Demand')).toEqual([3290]);
        expect(byName.get('Streaming')).toEqual([3260]);
        expect(byName.get('Overig (NL)')).toEqual([2959]);
    });

    it('collapses other countries into one bucket per prefix, sorted', () => {
        const result = buildCuratedLiveCategorization([
            category(1, '┃UK┃ ENTERTAINMENT'),
            category(2, '┃DE┃ SPORT'),
            category(3, '┃UK┃ SPORTS'),
            category(4, '┃NL┃ BASIS TV+'),
        ]);

        const buckets = result.categories.filter(
            (c): c is CuratedLiveCategory => 'curated' in c
        );
        expect(buckets.map((b) => b.category_name)).toEqual([
            'Nederland',
            'DE',
            'UK',
        ]);
        const uk = buckets.find((b) => b.category_name === 'UK')!;
        expect(uk.memberCategoryIds).toEqual([1, 3]);
    });

    it('keeps NL buckets ahead of country buckets', () => {
        const result = buildCuratedLiveCategorization([
            category(1, '┃AR┃ GENERAL'),
            category(2, '┃NL┃ SPORT TV+'),
        ]);

        const names = result.categories.map((c) =>
            'curated' in c ? c.category_name : ''
        );
        expect(names).toEqual(['Sport', 'AR']);
    });

    it('passes categories without a recognizable prefix through unchanged', () => {
        const raw = category(999, 'FORMULA 1 SPECIALS');
        const result = buildCuratedLiveCategorization([
            raw,
            category(1, '┃NL┃ BASIS TV+'),
        ]);

        expect(result.categories).toContain(raw);
        expect(result.memberToCurated.has(999)).toBe(false);
    });

    it('maps every member id back to its curated bucket', () => {
        const result = buildCuratedLiveCategorization([
            category(497, '┃NL┃ BASIS TV+'),
            category(36, '┃NL┃ SPORT TV+'),
            category(50, '┃DE┃ SPORT'),
        ]);

        const nederland = result.memberToCurated.get(497)!;
        expect(result.curatedById.get(nederland)?.category_name).toBe(
            'Nederland'
        );
        expect(result.memberToCurated.get(36)).not.toBe(nederland);
        expect(
            result.curatedById.get(result.memberToCurated.get(50)!)
                ?.category_name
        ).toBe('DE');
    });

    it('assigns stable synthetic ids for NL buckets', () => {
        const first = buildCuratedLiveCategorization([
            category(1, '┃NL┃ SPORT TV+'),
            category(2, '┃NL┃ BASIS TV+'),
        ]);
        const second = buildCuratedLiveCategorization([
            category(2, '┃NL┃ BASIS TV+'),
            category(1, '┃NL┃ SPORT TV+'),
        ]);

        const idOf = (
            result: typeof first,
            name: string
        ): number | undefined =>
            result.categories
                .filter((c): c is CuratedLiveCategory => 'curated' in c)
                .find((c) => c.category_name === name)?.category_id;

        expect(idOf(first, 'Sport')).toBe(idOf(second, 'Sport'));
        expect(idOf(first, 'Nederland')).toBe(idOf(second, 'Nederland'));
    });
});

describe('isCuratedLiveCategoryId', () => {
    it('treats negative ids as curated, provider ids as raw', () => {
        expect(isCuratedLiveCategoryId(-1001)).toBe(true);
        expect(isCuratedLiveCategoryId(497)).toBe(false);
        expect(isCuratedLiveCategoryId(null)).toBe(false);
        expect(isCuratedLiveCategoryId(undefined)).toBe(false);
    });
});
