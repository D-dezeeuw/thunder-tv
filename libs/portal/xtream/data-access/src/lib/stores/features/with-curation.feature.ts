import { computed } from '@angular/core';
import {
    patchState,
    signalStoreFeature,
    withComputed,
    withMethods,
    withState,
} from '@ngrx/signals';
import { XtreamLiveStream } from '@iptvnator/shared/interfaces';
import {
    buildCuratedLiveCategorization,
    CuratedLiveCategory,
    groupLiveChannelVariants,
    isCuratedLiveCategoryId,
    LiveCategoryLike,
    LiveChannelGroup,
} from '../../curation';
import { ContentType } from '../../xtream-state';

const LIVE_CURATION_STORAGE_KEY = 'xtream-live-curation-enabled';

export type XtreamLiveChannelGroup = LiveChannelGroup<XtreamLiveStream>;

export interface CurationState {
    /** Curated live view: merged categories + deduped channel variants. */
    liveCurationEnabled: boolean;
}

interface CuratedLiveView {
    readonly categories: (CuratedLiveCategory | LiveCategoryLike)[];
    readonly counts: Map<number, number>;
    readonly curatedById: Map<number, CuratedLiveCategory>;
    readonly groupsByCategoryId: Map<number, XtreamLiveChannelGroup[]>;
}

const EMPTY_CURATED_VIEW: CuratedLiveView = {
    categories: [],
    counts: new Map(),
    curatedById: new Map(),
    groupsByCategoryId: new Map(),
};

type ParentCurationStoreLike = {
    liveCategories?: () => LiveCategoryLike[];
    liveStreams?: () => XtreamLiveStream[];
    selectedCategoryId?: () => number | null;
    selectedContentType?: () => ContentType;
};

function restoreLiveCurationEnabled(): boolean {
    try {
        // Default ON: curation is a no-op passthrough for providers
        // without recognizable country-prefixed categories.
        return localStorage.getItem(LIVE_CURATION_STORAGE_KEY) !== 'false';
    } catch {
        return true;
    }
}

function persistLiveCurationEnabled(enabled: boolean): void {
    try {
        localStorage.setItem(LIVE_CURATION_STORAGE_KEY, String(enabled));
    } catch {
        // Runtime state still carries the preference for this session.
    }
}

/**
 * Curation feature: presentation-layer merging of live categories and
 * grouping of duplicate quality variants. Non-destructive — raw categories
 * and streams in `withContent` stay untouched, so toggling the curated
 * view never refetches or rewrites anything.
 */
export function withCuration() {
    return signalStoreFeature(
        withState<CurationState>({
            liveCurationEnabled: restoreLiveCurationEnabled(),
        }),

        withComputed((store) => {
            const parent = store as ParentCurationStoreLike;

            const curatedLiveView = computed<CuratedLiveView>(() => {
                if (!store.liveCurationEnabled()) {
                    return EMPTY_CURATED_VIEW;
                }

                const categories = parent.liveCategories?.() ?? [];
                if (categories.length === 0) {
                    return EMPTY_CURATED_VIEW;
                }

                const categorization =
                    buildCuratedLiveCategorization(categories);
                const streams = parent.liveStreams?.() ?? [];

                const streamsByCuratedId = new Map<
                    number,
                    XtreamLiveStream[]
                >();
                const passThroughCounts = new Map<number, number>();
                for (const stream of streams) {
                    const realCategoryId = Number(stream.category_id);
                    const curatedId =
                        categorization.memberToCurated.get(realCategoryId);
                    if (curatedId === undefined) {
                        passThroughCounts.set(
                            realCategoryId,
                            (passThroughCounts.get(realCategoryId) ?? 0) + 1
                        );
                        continue;
                    }

                    const bucket = streamsByCuratedId.get(curatedId);
                    if (bucket) {
                        bucket.push(stream);
                    } else {
                        streamsByCuratedId.set(curatedId, [stream]);
                    }
                }

                const counts = new Map<number, number>(passThroughCounts);
                const groupsByCategoryId = new Map<
                    number,
                    XtreamLiveChannelGroup[]
                >();
                for (const [curatedId, bucketStreams] of streamsByCuratedId) {
                    const groups = groupLiveChannelVariants(bucketStreams);
                    groupsByCategoryId.set(curatedId, groups);
                    counts.set(curatedId, groups.length);
                }

                return {
                    categories: categorization.categories,
                    counts,
                    curatedById: categorization.curatedById,
                    groupsByCategoryId,
                };
            });

            return {
                /** Curated live categories (buckets + pass-through). */
                curatedLiveCategories: computed(
                    () => curatedLiveView().categories
                ),

                /** Deduped channel counts per curated/pass-through id. */
                curatedLiveCategoryCounts: computed(
                    () => curatedLiveView().counts
                ),

                /** Synthetic id → curated bucket (name + member ids). */
                curatedLiveCategoryLookup: computed(
                    () => curatedLiveView().curatedById
                ),

                /**
                 * Variant groups for the selected curated live category, or
                 * null when the curated view does not apply (disabled,
                 * non-live content, raw provider category selected).
                 */
                curatedSelectedLiveGroups: computed<
                    XtreamLiveChannelGroup[] | null
                >(() => {
                    if (
                        !store.liveCurationEnabled() ||
                        parent.selectedContentType?.() !== 'live'
                    ) {
                        return null;
                    }

                    const categoryId = parent.selectedCategoryId?.();
                    if (!isCuratedLiveCategoryId(categoryId)) {
                        return null;
                    }

                    return (
                        curatedLiveView().groupsByCategoryId.get(
                            categoryId as number
                        ) ?? null
                    );
                }),
            };
        }),

        withMethods((store) => ({
            setLiveCurationEnabled(enabled: boolean): void {
                persistLiveCurationEnabled(enabled);
                patchState(store, { liveCurationEnabled: enabled });
            },
        }))
    );
}
