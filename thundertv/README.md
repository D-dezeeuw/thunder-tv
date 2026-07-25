# ThunderTV

A compact, fast IPTV player for the web, desktop, and TV.

> **Current repository state:** this project is being developed inside the
> `thundertv/` subfolder of the `thunder-tv` (IPTVnator) repository, on the
> branch `claude/iptv-project-plan-cgnwib`, because the session that started
> it was scoped to that repository only. It is a fully standalone project —
> no Nx, no dependency on the parent workspace — and is designed to be
> extracted into its own `thundertv` repository with zero code changes
> (`git subtree split` or a plain copy both work) as soon as one exists. Once
> extracted, the branch/deploy workflow described below applies literally;
> until then, work happens on the shared branch instead of per-phase feature
> branches pushed to `origin` (see "Branch flow" below).

## What this is

Four constraints drive every decision in this codebase:

1. **Compact and easy to distribute** — a static GitHub Pages web app,
   deployed with a single local command, **no GitHub Actions**.
2. **Portable** — the same bundle runs unchanged in Electron
   (Windows/macOS/Linux) and stays viable on constrained browsers like LG
   webOS TVs.
3. **Performance first** — heavy caching, no transitions/effects, minimal
   live DOM (windowed lists, lazy loading, adaptive updates).
4. **Zero-friction onboarding** — a bookmarkable URL can carry a user's
   subscription (M3U URL or Xtream credentials) so one visit configures a
   device.

The full architecture rationale lives in
[`../.plans/2026-07-25-thundertv-new-iptv-webapp.md`](../.plans/2026-07-25-thundertv-new-iptv-webapp.md).
The build-out plan — 30 phases, 10 features each, 10 tasks per feature — lives
in [`../masterplan/MASTERPLAN.md`](../masterplan/MASTERPLAN.md) and
[`../masterplan/phases/`](../masterplan/phases/). Those two documents are the
source of truth for _why_ and _in what order_; this README is the source of
truth for _how to run it_.

## Commands

```bash
npm install        # or: npm ci, from the committed lockfile
npm run dev         # dev server (Vite) — see "Dev server port" below
npm run build        # tsc --noEmit && vite build -> dist/
npm run preview       # serve the built dist/ locally
npm run deploy        # build + publish dist/ to the gh-pages branch (no CI)
npm run lint         # eslint . --max-warnings 0
npm run format        # prettier --write .
npm run typecheck       # tsc --noEmit
npm run test         # wired in Phase 27 (Testing Infrastructure)
```

### Dev server port

`npm run dev` serves on Vite's default port, `5173` (verified during Feature
01.1). If that port is busy, Vite prints the port it actually bound —
`npm run preview` similarly defaults to `4173`.

## Deploy (GitHub Pages, no Actions)

`npm run deploy` runs `vite build` then pushes `dist/` to the repository's
`gh-pages` branch locally via the `gh-pages` package — no
`.github/workflows/` involved at any point.

**Prerequisites:**

- Push rights to the target repository (deploy authenticates as whatever git
  identity is configured locally).
- Deploy is always run from a clean, merged `main` — never from a feature
  branch — matching the phase-loop's "merge, then deploy" step.
- GitHub Pages must be pointed at the `gh-pages` branch root once, in the
  repository's Settings → Pages.

**Rollback:** redeploy an older `main` commit —

```bash
git checkout <sha>
npm ci
npm run deploy
git checkout main
```

**Before every deploy:** preview `dist/` from a nested subpath locally (not
just `npm run preview`, which serves from the root) to catch any
root-absolute asset reference before it reaches Pages — see Feature 01.8's
`scripts/check-dist.mjs`.

## Standing conventions

- **TypeScript files stay ≤300 lines**, hard ceiling 400
  (`eslint.config.js`'s `max-lines` rule enforces the ceiling; treat 300 as
  the real target and refactor before it bites).
- **No CSS transitions or animations, anywhere.** State changes are instant.
  `eslint.config.js`'s `no-restricted-syntax` rule rejects `transition:`/
  `animation:` string literals in `.ts` files as a first line of defense.
- **Platform APIs (`fetch`, `indexedDB`, `localStorage`, file inputs) are
  only ever touched inside `src/core/`.** Everything else goes through the
  adapters defined there. Enforced by `no-restricted-globals` in
  `eslint.config.js` (fully populated in Phase 03).
- **Credentials are fragment-only.** Connect bookmark URLs (Phase 14) carry
  credentials in the URL hash, never the query string, and the address bar
  is scrubbed immediately after import.
- **Spektrum is the only UI/state framework**, resolved at runtime via the
  pinned CDN import map in `index.html` — never bundled by Vite. See
  "Spektrum: CDN vs. vendored" below.

## Spektrum: CDN vs. vendored

[Spektrum](https://github.com/D-dezeeuw/spektrum) is loaded two different
ways depending on target, both pointing at the exact same pinned version
(currently `1.1.0`, tracked in `scripts/spektrum-version.json`):

- **Web (committed default):** `index.html`'s import map points at the
  pinned unpkg CDN URL. No download, no vendoring step — this is what
  `npm run dev`, `npm run build`, and the deployed Pages site use as-is.
- **Packaged targets (Electron, webOS):** `scripts/package-target.mjs`
  rewrites a _built_ `dist/index.html`'s import map to
  `./vendor/spektrum.min.js`, so the packaged app never depends on the CDN
  being reachable. The vendored copy lives at `public/vendor/spektrum.min.js`
  and is kept in sync (and hash-verified) by
  `scripts/sync-vendor-spektrum.mjs` and `scripts/check-importmap.mjs`.
- **Older TV browsers** (pre-Chromium-89, where import maps aren't
  supported) are expected to need an `es-module-shims` polyfill layered on
  top of the vendored path — that's a webOS-target concern (Phase 30), not
  something the web build carries.

## Who lives where

| Path                 | Owner (phase)                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `src/core/platform/` | Phase 03 — Platform Adapter Layer                                                           |
| `src/core/storage/`  | Phase 04 — Tiered Storage Engine                                                            |
| `src/core/connect/`  | Phase 14 — Connect Bookmark URLs                                                            |
| `src/core/http/`     | Phase 03 — Platform Adapter Layer                                                           |
| `src/m3u/`           | Phase 06 — M3U Parsing Engine                                                               |
| `src/epg/`           | Phases 16-18 — EPG Ingestion / Display / Guide & Mapping                                    |
| `src/xtream/`        | Phases 19-21 — Xtream API Client / Live / VOD & Series                                      |
| `src/player/`        | Phases 10-12 — Playback Foundation / Engines / Player UI                                    |
| `src/ui/`            | Phase 08 onward — virtual list, view partials, bindings                                     |
| `src/app/`           | Shell wiring (sidebar, view switching, hash router); today just the Feature 01.10 bootstrap |
| `src/state/`         | Phase 05 — Spektrum State Architecture                                                      |
| `src/styles/`        | Phase 02 — App Shell & Design System                                                        |
| `src/types/`         | Ambient declarations (`spektrum.d.ts`, Feature 01.2)                                        |
| `scripts/`           | Tooling: Spektrum pin sync/guard, dist checks, packaging swap                               |
| `public/vendor/`     | Vendored Spektrum copy — committed, never hand-edited                                       |

**The `src/core/`-only platform-API rule** (see "Standing conventions" above)
is what keeps this table meaningful: every later phase's code lands in a
predictable place, and nothing outside `src/core/` can quietly grow a direct
`fetch`/`indexedDB` dependency that breaks the Electron/webOS port later.

## Branch flow and tracker

Per `../masterplan/MASTERPLAN.md`'s way of working: each phase (epic) is
implemented on its own `feature/phase-NN-<slug>` branch, with every task
checkbox in `../masterplan/phases/phase-NN-*.md` checked off as it's
completed, verified against that phase's standing checklist, then merged to
`main` and (when user-visible) deployed. **The phase files under
`../masterplan/phases/` are the tracker — there is no separate GitHub Issues
board to keep in sync.**

(Until this project is extracted to its own repository — see the note at the
top of this file — phase work happens as commits on the shared session
branch instead of separate pushed feature branches, since that session is
scoped to a single branch of the parent repository. The checkbox/verification
discipline is unchanged; only the branch topology is temporarily different.)

## Fresh clone

```bash
git clone <repo-url>
cd thundertv
npm ci
npm run build
npm run lint
```

No undocumented setup steps — if this doesn't pass cleanly, it's a bug.
