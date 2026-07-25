# Phase 01 — Foundation & Tooling

> **Epic goal:** Turn an empty repository into a deployable Vite + TypeScript skeleton with Spektrum wired via a pinned CDN import map and a proven, Actions-free gh-pages deploy.
> **Verification:** `npm run build` and `npx tsc --noEmit` are clean, ESLint passes with `max-lines` enforced, `npm run deploy` publishes `dist/` to the `gh-pages` branch, and the live `https://<user>.github.io/thundertv/` page renders a working Spektrum `{{expr}}` binding (checked in the browser, not just locally).

Before this phase there is nothing but an empty `thundertv` repository. After it, the repo contains a strict-TS Vite scaffold with the agreed folder skeleton (`src/core/`, `src/ui/`, `src/app/`, `src/styles/`, `scripts/`), Spektrum resolving through a version-pinned import map with a vendored fallback in `public/vendor/`, lint/format tooling that enforces the ≤300/400-line rule, and a one-command local deploy that has been exercised end to end against a real GitHub Pages URL.

## Feature 01.1 — Repository scaffold (Vite vanilla-ts)

Create the standalone `thundertv` repository from the Vite vanilla-ts template — the single-`package.json`, no-workspace baseline every later phase builds on.

- [ ] **01.1.1** Initialize repo — create the `thundertv` git repository with `main` as the default branch, independent of the thunder-tv monorepo.
- [ ] **01.1.2** Scaffold Vite — run `npm create vite@latest . -- --template vanilla-ts` and commit the pristine template as the first commit.
- [ ] **01.1.3** Prune template noise — delete the template's `counter.ts`, sample styles, and Vite/TS logo assets so `src/` starts empty apart from `main.ts`.
- [ ] **01.1.4** Pin the toolchain — set exact (non-caret) versions for `vite` and `typescript` in `package.json` and add an `engines.node` field.
- [ ] **01.1.5** Commit the lockfile — generate `package-lock.json` with `npm install` and verify `npm ci` reproduces `node_modules` from scratch.
- [ ] **01.1.6** Name and describe — set `name: "thundertv"`, `private: true`, `type: "module"`, and a one-line description in `package.json`.
- [ ] **01.1.7** Define the script surface — reserve `dev`, `build`, `preview`, `deploy`, `lint`, and `test` entries in `package.json` (stubs where the tool lands in a later feature).
- [ ] **01.1.8** Strip `index.html` — reduce it to a minimal shell (`<div id="app">`, one `<script type="module" src="/src/main.ts">`) ready for the import map in 01.4.
- [ ] **01.1.9** Verify the dev loop — run `npm run dev`, confirm hot reload on a `main.ts` edit, and note the working port in the phase file.
- [ ] **01.1.10** Verify the build loop — run `npm run build` + `npm run preview` and confirm the served `dist/` output matches the dev-server page.

## Feature 01.2 — Strict TypeScript configuration

Lock in a strict `tsconfig.json` from day one so type debt never accumulates — every later `src/core/` contract depends on strictness being non-negotiable.

- [ ] **01.2.1** Enable strict mode — set `"strict": true` plus `noUncheckedIndexedAccess`, `noImplicitOverride`, and `exactOptionalPropertyTypes` in `tsconfig.json`.
- [ ] **01.2.2** Ban silent dead code — enable `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch`.
- [ ] **01.2.3** Target evergreen — set `target`/`lib` to `ES2022` + `DOM` + `DOM.Iterable` and `moduleResolution: "bundler"` to match Vite's resolution.
- [ ] **01.2.4** Cover workers — add `WebWorker` lib support so the later parser workers (`src/m3u/`, `src/epg/`) type-check without per-file pragmas.
- [ ] **01.2.5** Isolate modules — enable `isolatedModules` and `verbatimModuleSyntax` so every file transpiles independently under esbuild.
- [ ] **01.2.6** Declare the spektrum external — add a `src/types/spektrum.d.ts` ambient module declaring `setValue`, `getValue`, `computed`, `defineFn`, `run`, and `replay` signatures for the import-map-resolved `spektrum` specifier.
- [ ] **01.2.7** Forbid implicit any escape hatches — set `allowJs: false` and confirm no `@ts-ignore`/`@ts-expect-error` exists in the scaffold.
- [ ] **01.2.8** Wire the typecheck script — make `npm run typecheck` run `tsc --noEmit` and document it as part of the standing verification checklist in the README stub.
- [ ] **01.2.9** Prove strictness bites — temporarily introduce an unchecked-index access, confirm `tsc --noEmit` fails, then revert (note the check in this file).
- [ ] **01.2.10** Verify editor parity — confirm VS Code / the workspace TS server picks up the same `tsconfig.json` diagnostics as the CLI run.

## Feature 01.3 — ESLint + Prettier + max-lines rule

Install the lint/format stack that mechanically enforces the standing conventions — most importantly the ≤300-line target with a hard 400-line `max-lines` ceiling.

- [ ] **01.3.1** Install ESLint flat config — add `eslint`, `typescript-eslint`, and an `eslint.config.js` at the repo root using the flat-config format.
- [ ] **01.3.2** Enforce the line budget — configure `max-lines` at `{ max: 400 }` (error) for `**/*.ts`, with a comment stating the 300-line target from the masterplan conventions.
- [ ] **01.3.3** Enable type-aware rules — wire `parserOptions.projectService` so `no-floating-promises` and `no-misused-promises` run on all `src/` files.
- [ ] **01.3.4** Add Prettier — install `prettier` with a checked-in `.prettierrc` (4-space indent, single quotes) and `eslint-config-prettier` to silence conflicting stylistic rules.
- [ ] **01.3.5** Scaffold the platform fence — add a placeholder `no-restricted-globals` block (empty overrides for `src/core/**`) with a TODO pointing at Phase 03 Feature 03.9, so the config shape exists now.
- [ ] **01.3.6** Ban CSS-in-TS animation escapes — add a `no-restricted-syntax` rule rejecting string literals containing `transition:` or `animation:` in `.ts` files, backing the no-animation policy.
- [ ] **01.3.7** Wire the scripts — make `npm run lint` run `eslint .` and `npm run format` run `prettier --write .`, both covering `scripts/` as well as `src/`.
- [ ] **01.3.8** Ignore build output — configure ESLint/Prettier ignores for `dist/`, `node_modules/`, and `public/vendor/` (vendored Spektrum is never linted or reformatted).
- [ ] **01.3.9** Prove max-lines bites — add a temporary 401-line file, confirm `npm run lint` fails on it, delete it, and note the result here.
- [ ] **01.3.10** Lint the scaffold clean — run `npm run lint` on the real tree and fix every reported issue so the baseline is zero warnings.

## Feature 01.4 — Spektrum import map integration (CDN, pinned)

Wire Spektrum as a runtime-resolved, version-pinned CDN module — the app's only framework, kept out of the Vite bundle entirely.

- [ ] **01.4.1** Add the import map — insert `<script type="importmap">{ "imports": { "spektrum": "https://unpkg.com/spektrum@1.1.0/spektrum.min.js" } }</script>` into `index.html` before the module script.
- [ ] **01.4.2** Pin exactly — verify the pinned `spektrum@1.1.0` URL resolves to an immutable versioned file (no `@latest`, no semver range) and record the resolved URL + its purpose in a comment.
- [ ] **01.4.3** Mark spektrum external — set `build.rollupOptions.external: ['spektrum']` in `vite.config.ts` so `import { setValue } from 'spektrum'` survives the build untouched.
- [ ] **01.4.4** Import in `main.ts` — replace template code with a minimal bootstrap that imports `setValue` and `run` from `spektrum` and binds one `{{expr}}` in `index.html`.
- [ ] **01.4.5** Confirm dev-server passthrough — verify `npm run dev` serves the page with the bare `spektrum` specifier resolved by the browser import map, not pre-bundled by Vite (`optimizeDeps.exclude` if needed).
- [ ] **01.4.6** Confirm build passthrough — inspect `dist/` and assert no Spektrum source is inlined into any emitted chunk (grep the bundle for `setValue` internals).
- [ ] **01.4.7** Record the integrity hash — compute the SHA-384 of the pinned CDN file and store it in `scripts/spektrum-version.json` for the vendor-sync check in 01.5.
- [ ] **01.4.8** Document the swap contract — add a comment block in `index.html` explaining that packaged targets rewrite this import map entry to `./vendor/spektrum.min.js` (masterplan §6.10), and that the regex in `scripts/package-target.mjs` depends on this exact JSON shape.
- [ ] **01.4.9** Guard the shape — add a `scripts/check-importmap.mjs` script that fails if `index.html`'s import map loses the `"spektrum":` key or the version pin drifts from `scripts/spektrum-version.json`.
- [ ] **01.4.10** Smoke both loops — verify the `{{expr}}` binding updates via `setValue` in dev and in `npm run preview` against the built `dist/`.

## Feature 01.5 — Vendored Spektrum fallback copy

Vendor the exact pinned `spektrum.min.js` into `public/vendor/` so packaged targets (Electron, webOS) and the future PWA offline path never depend on a CDN.

- [ ] **01.5.1** Vendor the file — download the pinned `spektrum@1.1.0/spektrum.min.js` and commit it verbatim as `public/vendor/spektrum.min.js`.
- [ ] **01.5.2** Verify byte identity — compare the vendored file's SHA-384 against `scripts/spektrum-version.json` from 01.4.7 and fail loudly on mismatch.
- [ ] **01.5.3** Automate the sync — write `scripts/sync-vendor-spektrum.mjs` that re-downloads the pinned version, updates the hash file, and refuses to run against an unpinned URL.
- [ ] **01.5.4** Confirm Vite copies it — check that `npm run build` places the file at `dist/vendor/spektrum.min.js` unmodified (public dir passthrough, no hashing, no minify re-pass).
- [ ] **01.5.5** Prove the swap works — hand-edit a built `dist/index.html` import map to `"./vendor/spektrum.min.js"`, open it via `npm run preview`, and confirm the smoke binding still renders.
- [ ] **01.5.6** Stub the swap script — create `scripts/package-target.mjs` performing the masterplan §6.10 regex rewrite of the built import map, with a `--check` mode that dry-runs against `dist/index.html`.
- [ ] **01.5.7** Keep it out of tooling — confirm the ESLint/Prettier ignores from 01.3.8 cover `public/vendor/` and that `tsc` does not attempt to check the vendored file.
- [ ] **01.5.8** License bookkeeping — record Spektrum's license and upstream repo URL in `public/vendor/README.md` next to the vendored file.
- [ ] **01.5.9** Test the guard — corrupt one byte of the vendored copy locally, confirm `scripts/check-importmap.mjs`/hash verification fails, restore it.
- [ ] **01.5.10** Document the two paths — describe CDN-first web vs vendored packaged builds (and the webOS `es-module-shims` note) in the README stub's architecture section.

## Feature 01.6 — Base folder structure (src/core, src/ui, src/app, …)

Lay down the plan's directory skeleton now so every later phase lands code in a predictable place and the lint fences have real paths to guard.

- [ ] **01.6.1** Create `src/core/` — add `platform/`, `storage/`, `connect/`, and `http/` subfolders, each with a placeholder `index.ts` exporting nothing yet.
- [ ] **01.6.2** Create the feature roots — add empty `src/m3u/`, `src/epg/`, `src/xtream/`, and `src/player/` directories with one-line `README.md` stubs naming their future owner phase.
- [ ] **01.6.3** Create `src/ui/` — reserve it for the virtual-list controller, view partials, and bindings; add a stub `index.ts`.
- [ ] **01.6.4** Create `src/app/` — reserve it for shell wiring (sidebar, view switching, hash router) consumed by `main.ts`.
- [ ] **01.6.5** Create `src/styles/` — add empty `tokens.css` and `base.css` files referenced from `index.html`, ready for Phase 02.
- [ ] **01.6.6** Create `src/state/` — reserve the Spektrum store-module home (Phase 05) with a stub `index.ts`, keeping state out of `src/ui/`.
- [ ] **01.6.7** Create `scripts/` — house `package-target.mjs`, `sync-vendor-spektrum.mjs`, and `check-importmap.mjs` from earlier features under one folder.
- [ ] **01.6.8** Wire `main.ts` as the only entry — make it the single bootstrap importing from `src/app/`, matching the plan's boot order (platform → storage → connect → render).
- [ ] **01.6.9** Document ownership — add a short "who lives where" table to the README stub mapping each folder to its masterplan phase, including the `src/core/`-only platform-API rule.
- [ ] **01.6.10** Verify empty-tree health — run `npm run build`, `npm run typecheck`, and `npm run lint` over the full skeleton and confirm all three stay green with the new folders in place.

## Feature 01.7 — gh-pages deploy script

Prove the Actions-free distribution story: one local command builds and pushes `dist/` to the `gh-pages` branch of the real repository.

- [ ] **01.7.1** Add the dependency — install `gh-pages` as a devDependency at an exact pinned version.
- [ ] **01.7.2** Wire the script — set `"deploy": "vite build && gh-pages -d dist"` in `package.json`, per the plan's repository layout.
- [ ] **01.7.3** Add `.nojekyll` — place a `.nojekyll` file in `public/` so Pages never runs Jekyll over `dist/` (protects folders and the vendored file).
- [ ] **01.7.4** Configure Pages once — point the GitHub repository's Pages settings at the `gh-pages` branch root and record the resulting public URL in the README stub.
- [ ] **01.7.5** First real deploy — run `npm run deploy` from the local machine and confirm the `gh-pages` branch contains exactly the `dist/` tree, nothing else.
- [ ] **01.7.6** Verify no Actions — confirm the repository has no `.github/workflows/` directory and that the deploy produced no Actions run (Pages "deploy from branch" only).
- [ ] **01.7.7** Verify the live URL — load `https://<user>.github.io/thundertv/` in a browser and confirm the app shell responds with HTTP 200 and correct content-type for `.js` modules.
- [ ] **01.7.8** Test redeploy idempotence — run `npm run deploy` twice in a row and confirm the second run force-updates `gh-pages` cleanly with no stale hashed assets accumulating.
- [ ] **01.7.9** Document rollback — describe in the README how to redeploy a previous `main` commit (`git checkout <sha> && npm ci && npm run deploy`) as the rollback mechanism.
- [ ] **01.7.10** Capture deploy prerequisites — document required git auth (push rights to the repo) and that deploy is always run from a clean, merged `main`, matching the masterplan way-of-working.

## Feature 01.8 — Dev/prod build parity (base './')

Make one `dist/` load identically from a Pages subpath, `npm run preview`, and — later — Electron `file://` and packaged webOS, by committing to relative asset URLs now.

- [ ] **01.8.1** Set the base — configure `base: './'` in `vite.config.ts` with a comment naming the three consumers (Pages subpath, `file://`, webOS).
- [ ] **01.8.2** Audit emitted URLs — inspect built `dist/index.html` and confirm every asset reference (`src`, `href`) is relative, none root-absolute.
- [ ] **01.8.3** Verify from a subpath — serve `dist/` under a nested path locally (e.g. `npx serve` with the app in a subfolder) and confirm all assets resolve, mirroring the `/thundertv/` Pages path.
- [ ] **01.8.4** Verify from `file://` — open `dist/index.html` directly from disk and record which parts work; document the known `file://` caveats (module CORS) for the Electron phase to consume.
- [ ] **01.8.5** Ban absolute references — add a post-build assertion to `scripts/check-importmap.mjs` (or a sibling `scripts/check-dist.mjs`) failing on `src="/` or `href="/` in `dist/index.html`.
- [ ] **01.8.6** Prepare worker parity — set Vite `worker.format: 'es'` and note that future worker imports must use the `new Worker(new URL(...), { import.meta.url })` pattern so `base: './'` keeps working.
- [ ] **01.8.7** Keep chunks deterministic — reserve a `manualChunks` hook in `vite.config.ts` (empty for now) with a comment that player engines get their own chunks in Phase 10/11.
- [ ] **01.8.8** Compare dev vs prod behavior — click through the smoke page in `npm run dev` and in the deployed Pages build, and record any divergence (there must be none) in the phase file.
- [ ] **01.8.9** Measure the baseline budget — record the gzipped size of the built app JS (excluding Spektrum) and check it against the ≤~60 KB budget from MASTERPLAN.md §3 — at this phase it should be near-zero.
- [ ] **01.8.10** Add the parity check to the checklist — extend the README's verification checklist with "preview `dist/` from a subpath before every deploy".

## Feature 01.9 — Repo hygiene (.editorconfig, .gitignore, README stub, LICENSE)

The unglamorous files that keep every future contributor and agent session consistent from the first clone.

- [ ] **01.9.1** Add `.editorconfig` — UTF-8, LF line endings, final newline, 4-space indent for TS/CSS/HTML, matching the Prettier config from 01.3.4.
- [ ] **01.9.2** Add `.gitignore` — ignore `node_modules/`, `dist/`, editor droppings, and OS files; explicitly do **not** ignore `public/vendor/` (the vendored Spektrum is committed).
- [ ] **01.9.3** Write the README stub — project one-liner, the four constraints from the plan (compact, portable, performance-first, zero-friction onboarding), and the dev/build/deploy commands.
- [ ] **01.9.4** Link the source of truth — reference the masterplan and the architecture plan documents from the README so the repo self-describes its roadmap.
- [ ] **01.9.5** Choose and add LICENSE — add the chosen open-source license file and matching `license` field in `package.json` (note the decision inline per the autonomy rule).
- [ ] **01.9.6** Add `CONTRIBUTING` notes to the README — record the standing conventions: ≤300-line files, no CSS transitions/animations, platform APIs only in `src/core/`, credentials fragment-only.
- [ ] **01.9.7** Document the branch flow — describe `feature/phase-NN-<slug>` branches, all-boxes-checked merges to `main`, and deploy-after-merge in the README's workflow section.
- [ ] **01.9.8** Add an issue-free tracker note — state that the phase files under `masterplan/phases/` are the tracker (checkboxes), not GitHub issues.
- [ ] **01.9.9** Normalize line endings — add a `.gitattributes` forcing LF for text files so Windows contributors don't churn diffs.
- [ ] **01.9.10** Fresh-clone drill — clone the repo into a temp directory, run `npm ci && npm run build && npm run lint`, and confirm everything passes with no undocumented setup steps.

## Feature 01.10 — End-to-end smoke page proving a Spektrum binding renders from the deployed Pages URL

Close the loop: the deployed production URL must demonstrably run Spektrum reactivity, proving CDN import map + `base: './'` + gh-pages all compose.

- [ ] **01.10.1** Build the smoke view — add a minimal block to `index.html` with a `{{smoke.message}}` binding and a `data-action="click:bumpSmoke"` button.
- [ ] **01.10.2** Wire smoke state — in `main.ts`, `setValue('smoke.message', 'ThunderTV is alive')` and register `defineFn('bumpSmoke', ...)` incrementing a `{{smoke.count}}` counter.
- [ ] **01.10.3** Exercise `computed` — derive a `computed` value from `smoke.count` (e.g. even/odd label) and bind it, so all three Spektrum primitives are proven on the page.
- [ ] **01.10.4** Style with tokens only — give the smoke block basic styling via the `src/styles/` files, with zero transitions/animations, as the first consumer of the token pipeline.
- [ ] **01.10.5** Verify locally built — confirm the smoke interactions work against `npm run preview` of `dist/`, not just the dev server.
- [ ] **01.10.6** Deploy and verify live — run `npm run deploy`, hard-reload the Pages URL, click the smoke button, and confirm `{{smoke.count}}` updates from the CDN-loaded Spektrum.
- [ ] **01.10.7** Verify the CDN request — in the browser network panel on the live page, confirm exactly one request to the pinned `spektrum@1.1.0` URL and no bundled copy.
- [ ] **01.10.8** Test the failure story — block the CDN host in devtools on the live page, reload, and record the observed failure mode as input for the vendored/PWA fallback documentation.
- [ ] **01.10.9** Record the evidence — note the deploy date, live URL, and a screenshot/description of the working smoke page in this phase file next to this feature.
- [ ] **01.10.10** Gate the phase — walk the standing verification checklist (build, typecheck, lint, budgets, no forbidden APIs outside `src/core/`) and check off the phase's `> Verification:` line before merging `feature/phase-01-foundation-and-tooling`.
