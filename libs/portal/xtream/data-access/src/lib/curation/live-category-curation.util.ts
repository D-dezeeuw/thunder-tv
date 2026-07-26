/**
 * Rule-based merging of provider live categories into a compact curated
 * set. Dutch (`┃NL┃`) categories collapse into semantic buckets (Nederland,
 * Sport, Formule 1, …); every other country prefix collapses into a single
 * per-country bucket. Categories without a recognizable prefix pass through
 * unchanged.
 *
 * Rules are name-based on purpose — provider category ids differ per
 * account, names are the stable contract.
 */
import {
    extractCountryPrefix,
    stripCountryPrefix,
} from './live-channel-curation.util';

export interface CuratedLiveCategory {
    /** Synthetic negative id — never collides with provider ids. */
    readonly category_id: number;
    readonly category_name: string;
    readonly curated: true;
    readonly memberCategoryIds: number[];
}

export interface LiveCategoryLike {
    readonly [key: string]: unknown;
    readonly category_id?: string | number;
    readonly category_name?: string;
    readonly id?: string | number;
    readonly name?: string;
}

export interface CuratedLiveCategorization {
    /** Curated buckets first (NL, then countries), pass-through last. */
    readonly categories: (CuratedLiveCategory | LiveCategoryLike)[];
    /** Provider category id → synthetic curated bucket id. */
    readonly memberToCurated: Map<number, number>;
    /** Synthetic curated id → bucket definition. */
    readonly curatedById: Map<number, CuratedLiveCategory>;
}

/** The focus country whose categories get semantic (not 1:1) buckets. */
export const CURATED_FOCUS_PREFIX = 'NL';

interface FocusBucketRule {
    readonly id: number;
    readonly name: string;
    readonly pattern: RegExp;
}

/**
 * Ordered — first match wins. Ids are fixed so `live/:categoryId` routes
 * stay stable across sessions and provider catalog updates.
 */
const FOCUS_BUCKET_RULES: readonly FocusBucketRule[] = [
    { id: -1006, name: 'Jeugd', pattern: /JEUGD|KIDS|BABY|JUNIOR|TELEKIDS/i },
    {
        id: -1003,
        name: 'Formule 1',
        pattern: /\bF1\b|FORMULE|VRO{2,}M|GRAND PRIX/i,
    },
    {
        id: -1004,
        name: 'Voetbal',
        pattern:
            /PREMIER LEAGUE|BUNDESLIGA|LIGUE 1|EREDIVISIE|SERIE A|LA LIGA|VOETBAL|UEFA|CHAMPIONS|FEYENOORD|AJAX|\bPSV\b/i,
    },
    {
        id: -1002,
        name: 'Sport',
        pattern: /SPORT|ESPN|DAZN|\bPDC\b|DARTS|\bPPV\b|8TKO|HOCKEY|\bWK\b|\bEK\b/i,
    },
    {
        id: -1005,
        name: 'Films & Series',
        pattern: /MOVIE|SERIES|FILM|CINEMA/i,
    },
    {
        id: -1007,
        name: 'Amusement & Muziek',
        pattern: /AMUSEMENT|MUZIEK|MUSIC|ENTERTAINMENT/i,
    },
    {
        id: -1008,
        name: 'Natuur & Lifestyle',
        pattern: /NATUUR|LIFESTYLE|DOCU/i,
    },
    { id: -1009, name: 'Regionaal', pattern: /REGIONAAL|REGIO|BUITENLAND/i },
    { id: -1011, name: 'On Demand', pattern: /^OD\s|ON DEMAND/i },
    {
        id: -1010,
        name: 'Streaming',
        pattern: /VIDEOLAND|NLZIET|CANAL\+/i,
    },
    {
        id: -1001,
        name: 'Nederland',
        pattern:
            /NEDERLAND|BASIS|KABEL|ZIGGO|ODIDO|\bKPN\b|TERUGKIJKEN|TV\+|4K|FHD|\bHD\b/i,
    },
];

const FOCUS_FALLBACK_BUCKET = { id: -1012, name: 'Overig (NL)' } as const;

/** Country buckets get ids below this base, assigned alphabetically. */
const COUNTRY_BUCKET_ID_BASE = -2000;

export function getLiveCategoryId(category: LiveCategoryLike): number {
    return Number(category.category_id ?? category.id ?? NaN);
}

export function getLiveCategoryName(category: LiveCategoryLike): string {
    return String(category.category_name ?? category.name ?? '');
}

function classifyFocusCategory(nameWithoutPrefix: string): {
    id: number;
    name: string;
} {
    for (const rule of FOCUS_BUCKET_RULES) {
        if (rule.pattern.test(nameWithoutPrefix)) {
            return { id: rule.id, name: rule.name };
        }
    }
    return FOCUS_FALLBACK_BUCKET;
}

/**
 * Builds the curated live category set. Ordering: NL semantic buckets
 * (fixed order below), then per-country buckets alphabetically, then
 * unprefixed provider categories unchanged.
 */
export function buildCuratedLiveCategorization(
    categories: readonly LiveCategoryLike[]
): CuratedLiveCategorization {
    const focusBuckets = new Map<number, CuratedLiveCategory>();
    const countryBuckets = new Map<string, number[]>();
    const passThrough: LiveCategoryLike[] = [];
    const memberToCurated = new Map<number, number>();

    for (const category of categories) {
        const categoryId = getLiveCategoryId(category);
        const name = getLiveCategoryName(category);
        const prefix = extractCountryPrefix(name);

        if (!Number.isFinite(categoryId) || !prefix) {
            passThrough.push(category);
            continue;
        }

        if (prefix.toUpperCase() === CURATED_FOCUS_PREFIX) {
            const bucket = classifyFocusCategory(stripCountryPrefix(name));
            const existing = focusBuckets.get(bucket.id);
            if (existing) {
                existing.memberCategoryIds.push(categoryId);
            } else {
                focusBuckets.set(bucket.id, {
                    category_id: bucket.id,
                    category_name: bucket.name,
                    curated: true,
                    memberCategoryIds: [categoryId],
                });
            }
            continue;
        }

        const members = countryBuckets.get(prefix);
        if (members) {
            members.push(categoryId);
        } else {
            countryBuckets.set(prefix, [categoryId]);
        }
    }

    // NL buckets in a fixed presentation order: Nederland first.
    const focusOrder = [
        -1001, -1002, -1003, -1004, -1005, -1006, -1007, -1008, -1009, -1010,
        -1011, -1012,
    ];
    const orderedFocus = focusOrder
        .map((id) => focusBuckets.get(id))
        .filter((bucket): bucket is CuratedLiveCategory => !!bucket);

    const orderedCountries = [...countryBuckets.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([prefix, memberCategoryIds], index): CuratedLiveCategory => {
            return {
                category_id: COUNTRY_BUCKET_ID_BASE - index,
                category_name: prefix,
                curated: true,
                memberCategoryIds,
            };
        });

    const curated = [...orderedFocus, ...orderedCountries];
    const curatedById = new Map<number, CuratedLiveCategory>();
    for (const bucket of curated) {
        curatedById.set(bucket.category_id, bucket);
        for (const memberId of bucket.memberCategoryIds) {
            memberToCurated.set(memberId, bucket.category_id);
        }
    }

    return {
        categories: [...curated, ...passThrough],
        memberToCurated,
        curatedById,
    };
}

export function isCuratedLiveCategoryId(
    categoryId: number | null | undefined
): boolean {
    return typeof categoryId === 'number' && categoryId < 0;
}
