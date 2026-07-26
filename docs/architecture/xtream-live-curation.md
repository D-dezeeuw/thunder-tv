# Xtream Curated Live View

The curated live view collapses provider category sprawl (700+ raw
categories, duplicate quality feeds per channel) into a compact,
Dutch-focused browsing experience. It is a **presentation-layer transform**:
raw categories and streams in `withContent` are never modified, so toggling
the view never refetches or rewrites anything, and it works identically in
Electron (DB-first) and PWA (API-only) modes.

## What it does

1. **Category merging** (`live-category-curation.util.ts`)
    - `┃NL┃`-prefixed categories are classified into semantic buckets by
      ordered name rules: Nederland, Sport, Formule 1, Voetbal,
      Films & Series, Jeugd, Amusement & Muziek, Natuur & Lifestyle,
      Regionaal, Streaming, On Demand, Overig (NL).
    - Every other country prefix (`┃DE┃`, `┃UK┃`, …) collapses into a single
      per-country bucket, sorted alphabetically after the NL buckets.
    - Categories without a recognizable prefix pass through unchanged.
    - Buckets get stable synthetic negative `category_id`s (NL buckets have
      fixed ids; country buckets are assigned from `-2000` down in
      alphabetical order), so `live/:categoryId` deep links keep working.
      Provider ids are always positive, so there is no collision, and
      `isCuratedLiveCategoryId()` (`id < 0`) distinguishes the two.
2. **Channel variant grouping** (`live-channel-curation.util.ts`)
    - Within a curated bucket, duplicate quality feeds of the same channel
      (`NPO 1 FHD 50FPS`, `NPO1 HD`, `NPO 1 4K`, `NPO 1 8K+ UHD`, replay
      feeds marked `⏺ʳᵉᶜ`) group under one entry via a normalized key
      (prefix/quality/replay markers stripped, non-alphanumerics removed).
    - The default (played on click) is chosen by a bandwidth-aware ranking:
      **1080p/FHD → HD → unlabeled → 4K/UHD/8K → SD**. 4K/8K feeds are
      deliberately deprioritized (bandwidth), but stay reachable.
    - Rows with multiple variants show a `layers` badge with the variant
      count; clicking it opens `LiveChannelVariantDialogComponent`, which
      lists every variant with its quality chip, a replay icon
      (name marker or `tv_archive`), and a high-bandwidth warning on
      4K/8K rows. Picking one starts playback of exactly that feed.
    - Provider notice rows (`☰☰ UPDATE YOUR PLAYLIST ☰☰`) are dropped.

## Where it lives

- Pure logic + specs: `libs/portal/xtream/data-access/src/lib/curation/`
- Store feature: `with-curation.feature.ts` (`withCuration()`), composed
  into `XtreamStore` after `withSelection()`. Exposes
  `liveCurationEnabled`, `curatedLiveCategories`,
  `curatedLiveCategoryCounts`, `curatedLiveCategoryLookup`,
  `curatedSelectedLiveGroups`, and `setLiveCurationEnabled()`.
- Category panel: `WorkspaceContextPanelComponent` swaps in curated
  categories/counts for the Xtream live section and hosts the
  `auto_awesome` toggle (selection resets to the live overview on toggle).
- Live layout: `LiveStreamLayoutComponent` feeds
  `PortalChannelsListComponent` a `channelsOverride` of group primaries
  plus `variantGroups` for the badge, opens the variant dialog, and keeps
  the curated selection when playing member channels (remote-control
  up/down navigates the deduped list).

## Behavior notes

- The toggle persists in `localStorage` (`xtream-live-curation-enabled`)
  and defaults to **on** — for providers without recognizable prefixes the
  curated build passes categories through, so it is effectively a no-op.
- Selecting a curated bucket filters the in-memory `liveStreams` by the
  bucket's member category ids; selecting a pass-through (positive id)
  category uses the normal store path without grouping.
- Favorites, EPG previews, and playback all operate on real streams (the
  group primary is the best variant's stream with only its display name
  cleaned), so no downstream contract changes.
- VOD/series curation and a configurable focus country are future work;
  the focus prefix is the `CURATED_FOCUS_PREFIX` constant.
