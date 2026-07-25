# Phase 01 — Foundation & Tooling

> **Epic goal:** Turn an empty repository into a deployable Vite + TypeScript skeleton with Spektrum wired via a pinned CDN import map and a proven, Actions-free gh-pages deploy.
> **Verification:** `npm run build` and `npx tsc --noEmit` are clean, ESLint passes with `max-lines` enforced, `npm run deploy` publishes `dist/` to the `gh-pages` branch, and the live `https://<user>.github.io/thundertv/` page renders a working Spektrum `{{expr}}` binding (checked in the browser, not just locally). **Partially met — see "Completion notes" below**: everything through a genuine real-browser proof of the Spektrum binding is done and verified; the literal live-`gh-pages`-URL step is deferred because this phase was implemented inside the `thunder-tv` monorepo's `thundertv/` subfolder rather than a standalone repository (see the note at the top of `thundertv/README.md`), so there is no separate repository to point GitHub Pages at yet.

Before this phase there is nothing but an empty `thundertv` repository. After it, the repo contains a strict-TS Vite scaffold with the agreed folder skeleton (`src/core/`, `src/ui/`, `src/app/`, `src/styles/`, `scripts/`), Spektrum resolving through a version-pinned import map with a vendored fallback in `public/vendor/`, lint/format tooling that enforces the ≤300/400-line rule, and a one-command local deploy that has been exercised end to end against a real GitHub Pages URL.

**Implementation location:** `thundertv/` at the repo root of `thunder-tv`, on branch `claude/iptv-project-plan-cgnwib`, per the note at the top of `thundertv/README.md`. All code is a fully standalone project (no Nx, no parent-workspace dependency) designed for zero-change extraction into its own repository.

## Feature 01.1 — Repository scaffold (Vite vanilla-ts)

Create the standalone `thundertv` repository from the Vite vanilla-ts template — the single-`package.json`, no-workspace baseline every later phase builds on.

- [x] **01.1.1** Initialize repo — *adapted*: scaffolded as the `thundertv/` subfolder of `thunder-tv` (see "Implementation location" above) rather than an independent repository, since this session's GitHub access is scoped to `thunder-tv` only. Fully standalone code; no separate `main` branch exists yet.
- [x] **01.1.2** Scaffold Vite — ran `npm create vite@latest thundertv -- --template vanilla-ts`. *Deviation*: template noise was pruned in the same pass rather than as a separate first commit, since nothing was committed until this phase's wrap-up commit — no pristine-template history exists to preserve.
- [x] **01.1.3** Prune template noise — deleted `counter.ts`, `style.css`, `assets/{hero.png,typescript.svg,vite.svg}`, `public/icons.svg`; `src/` started clean apart from `main.ts`.
- [x] **01.1.4** Pin the toolchain — `vite` and `typescript` pinned exact (no `^`/`~`) in `package.json`; `engines.node: ">=22"` added.
- [x] **01.1.5** Commit the lockfile — `package-lock.json` generated via `npm install`; verified `rm -rf node_modules && npm ci` reproduces it (both `vite` and `tsc` binaries present after).
- [x] **01.1.6** Name and describe — `name: "thundertv"`, `private: true`, `type: "module"`, one-line description set.
- [x] **01.1.7** Define the script surface — `dev`/`build`/`preview`/`deploy`/`lint`/`format`/`typecheck`/`test` all reserved from the start (unimplemented ones exited non-zero with a "wired in Feature/Phase N" message until their feature landed).
- [x] **01.1.8** Strip `index.html` — reduced to `<div id="app">` + one module script (later extended by Feature 01.4/01.10; still minimal, no template cruft).
- [x] **01.1.9** Verify the dev loop — `npm run dev` serves on **port 5173** (Vite default); confirmed hot reload by editing `main.ts` mid-session and diffing the served module content before/after.
- [x] **01.1.10** Verify the build loop — `npm run build` + `npm run preview` (port 4173) confirmed; served `dist/` output matched dev-server behavior.

## Feature 01.2 — Strict TypeScript configuration

Lock in a strict `tsconfig.json` from day one so type debt never accumulates — every later `src/core/` contract depends on strictness being non-negotiable.

- [x] **01.2.1** Enable strict mode — `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes` all set.
- [x] **01.2.2** Ban silent dead code — `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` set (the last two were already in Vite's template default; kept).
- [x] **01.2.3** Target evergreen — `target`/`lib` set to `ES2022` + `DOM` + `DOM.Iterable`, `moduleResolution: "bundler"`.
- [x] **01.2.4** Cover workers — added `WebWorker` to `lib` alongside `DOM`. The classic TS conflict between the `DOM` and `WebWorker` lib global scopes (`self`, etc.) did **not** manifest here — `skipLibCheck: true` (inherited from the Vite template) suppresses it; confirmed with a clean `tsc --noEmit` after adding both.
- [x] **01.2.5** Isolate modules — `isolatedModules` and `verbatimModuleSyntax` both set.
- [x] **01.2.6** Declare the spektrum external — `src/types/spektrum.d.ts` wraps spektrum's **real, published** `.d.ts` (fetched verbatim from `https://unpkg.com/spektrum@1.1.0/spektrum.d.ts`) in a `declare module 'spektrum'` block, rather than hand-guessed signatures. *Correction to this task's premise*: the real API has no `getValue` export (state is read via the `appState` object or `getPathObj(appState, path)` instead) — the ambient declaration reflects the actual API, not the assumed one.
- [x] **01.2.7** Forbid implicit any escape hatches — `allowJs: false` set; confirmed zero `@ts-ignore`/`@ts-expect-error` in the tree.
- [x] **01.2.8** Wire the typecheck script — `npm run typecheck` runs `tsc --noEmit`; documented in `README.md`'s Commands section.
- [x] **01.2.9** Prove strictness bites — appended an out-of-bounds array index read to `main.ts`; `tsc --noEmit` failed with `TS2322: Type 'number | undefined' is not assignable to type 'number'` as expected; reverted.
- [x] **01.2.10** Verify editor parity — *adapted*: no interactive editor available in this session to test directly; verified by construction instead — `tsconfig.json` is the sole TS config (no conflicting `jsconfig.json`), which is what any standard editor TS server needs to pick up identical diagnostics to the CLI.

## Feature 01.3 — ESLint + Prettier + max-lines rule

Install the lint/format stack that mechanically enforces the standing conventions — most importantly the ≤300-line target with a hard 400-line `max-lines` ceiling.

- [x] **01.3.1** Install ESLint flat config — `eslint`, `typescript-eslint`, `@eslint/js`, `globals` installed; `eslint.config.js` at repo root using flat config.
- [x] **01.3.2** Enforce the line budget — `max-lines: [error, { max: 400, ... }]`, commented with the 300-line target.
- [x] **01.3.3** Enable type-aware rules — `parserOptions.projectService` wired; `no-floating-promises`/`no-misused-promises` set to `error`.
- [x] **01.3.4** Add Prettier — `.prettierrc` (4-space indent, single quotes) + `eslint-config-prettier` applied last in the config chain.
- [x] **01.3.5** Scaffold the platform fence — placeholder `no-restricted-globals: ['error']` (empty list) for `src/**/*.ts` excluding `src/core/**`, with a `TODO(Phase 03, Feature 03.9)` comment.
- [x] **01.3.6** Ban CSS-in-TS animation escapes — `no-restricted-syntax` rule added matching string literals containing `transition:`/`animation:`.
- [x] **01.3.7** Wire the scripts — `npm run lint` → `eslint . --max-warnings 0`; `npm run format` → `prettier --write .`; both cover the whole repo tree including `scripts/`.
- [x] **01.3.8** Ignore build output — `dist/**`, `node_modules/**`, `public/vendor/**` ignored in both ESLint and `.prettierignore`.
- [x] **01.3.9** Prove max-lines bites — generated a throwaway 401-line file and a file with a `transition:` string literal; both failed lint as expected (`max-lines`, `no-restricted-syntax`); deleted after.
- [x] **01.3.10** Lint the scaffold clean — `npm run lint` is zero-error/zero-warning on the full tree (re-verified after every subsequent feature in this phase).

## Feature 01.4 — Spektrum import map integration (CDN, pinned)

Wire Spektrum as a runtime-resolved, version-pinned CDN module — the app's only framework, kept out of the Vite bundle entirely.

- [x] **01.4.1** Add the import map — inserted into `index.html`'s `<head>`, before the module script.
- [x] **01.4.2** Pin exactly — confirmed `https://unpkg.com/spektrum@1.1.0/spektrum.min.js` resolves with no redirect (HTTP 200, `url_effective` unchanged); URL and purpose documented in an `index.html` comment block.
- [x] **01.4.3** Mark spektrum external — `build.rollupOptions.external: ['spektrum']` set. *Extra finding*: this alone is **not sufficient for `npm run dev`** — see 01.4.5.
- [x] **01.4.4** Import in `main.ts` (now `src/app/index.ts`, imported by `main.ts` — see Feature 01.6) — bootstrap imports `setValue`, `bindDOM`, `run` from `spektrum` and binds `{{ smoke.message }}`.
- [x] **01.4.5** Confirm dev-server passthrough — **required real debugging, documented for future phases**: Vite's dev-server import-analysis plugin rewrites even an `external: true`-resolved bare specifier to an internal `/@id/spektrum` marker rather than leaving it literal (confirmed by inspecting `vite/dist/node/chunks/node.js`'s `externalRE = /^([a-z]+:)?\/\//`, which only special-cases fully-qualified URLs). Fixed with a `transform` hook (`enforce`/`order: 'post'`) in `vite.config.ts` that rewrites the marker back to a bare `"spektrum"` import after Vite's own transform runs, so the dev-served code is byte-identical in shape to what Rollup emits for production. Verified via `curl` against the dev server's transformed module source.
- [x] **01.4.6** Confirm build passthrough — built `dist/`; grepped for Spektrum-internal-only tokens (`E_TICK_OVERFLOW`, `E_COMPUTED_SELF_DEP`) — zero matches. The bundle contains only a plain `import{...}from"spektrum"` statement, never inlined implementation.
- [x] **01.4.7** Record the integrity hash — computed real SHA-384 (`openssl dgst -sha384 -binary | openssl base64 -A`) of the fetched pinned file; stored in `scripts/spektrum-version.json` along with the CDN URL and vendored path.
- [x] **01.4.8** Document the swap contract — comment block in `index.html` explains the packaged-target rewrite and that `scripts/package-target.mjs`'s regex depends on the exact JSON shape.
- [x] **01.4.9** Guard the shape — `scripts/check-importmap.mjs` written; fails if the `"spektrum"` key is missing, the URL doesn't match `spektrum-version.json`, or the URL isn't an exact pin (`@latest`/range). Proven by injecting a version mismatch and confirming a non-zero exit, then reverting.
- [x] **01.4.10** Smoke both loops — **real headless-Chromium verification**, not just curl: see Feature 01.10's completion note for the full interactive proof. Dev-loop verified via source inspection (CDN unreachable from this sandbox's browser — see the note below); build/preview loop verified with an actual browser click-through.

## Feature 01.5 — Vendored Spektrum fallback copy

Vendor the exact pinned `spektrum.min.js` into `public/vendor/` so packaged targets (Electron, webOS) and the future PWA offline path never depend on a CDN.

- [x] **01.5.1** Vendor the file — `public/vendor/spektrum.min.js` committed, fetched verbatim (13,655 bytes) from the pinned unpkg URL.
- [x] **01.5.2** Verify byte identity — SHA-384 of the vendored file matches `scripts/spektrum-version.json`'s recorded hash exactly.
- [x] **01.5.3** Automate the sync — `scripts/sync-vendor-spektrum.mjs` written and run for real: re-fetches the pinned URL, refuses non-exact-pinned URLs, updates the hash file only if the fetched content changed (idempotent — a no-op re-run reported "sha384 unchanged").
- [x] **01.5.4** Confirm Vite copies it — `dist/vendor/spektrum.min.js` present after build, byte-identical (`diff` clean) to `public/vendor/spektrum.min.js`.
- [x] **01.5.5** Prove the swap works — ran `scripts/package-target.mjs` against a real build, then loaded the result in a **real headless Chromium instance**: `#app` rendered `"ThunderTV is alive"` sourced entirely from the vendored, same-origin file. This is genuine end-to-end proof, not a structural check.
- [x] **01.5.6** Stub the swap script — `scripts/package-target.mjs` implements the regex rewrite with a `--check` dry-run mode; proven idempotent (running it twice reports "already points... at the vendored copy" the second time).
- [x] **01.5.7** Keep it out of tooling — confirmed `eslint public/vendor/spektrum.min.js` reports "ignored" and Prettier's check reports no issues (ignored); `tsc`'s `include` never reaches `public/`.
- [x] **01.5.8** License bookkeeping — `public/vendor/README.md` records package/version/upstream repo/license (MIT) and the "never hand-edit, use sync-vendor-spektrum.mjs" rule.
- [x] **01.5.9** Test the guard — flipped one byte of the vendored file with a script, confirmed `check-importmap.mjs` failed with a clear sha384-mismatch message and remediation instructions, restored the original bytes, confirmed the guard passes again.
- [x] **01.5.10** Document the two paths — "Spektrum: CDN vs. vendored" section added to `README.md`, including the webOS `es-module-shims` note.

## Feature 01.6 — Base folder structure (src/core, src/ui, src/app, …)

Lay down the plan's directory skeleton now so every later phase lands code in a predictable place and the lint fences have real paths to guard.

- [x] **01.6.1** Create `src/core/` — `platform/`, `storage/`, `connect/`, `http/` each with a placeholder `index.ts` (`export {}` + an ownership comment).
- [x] **01.6.2** Create the feature roots — `src/m3u/`, `src/epg/`, `src/xtream/`, `src/player/` each with a one-line `README.md` naming the owning phase(s).
- [x] **01.6.3** Create `src/ui/` — stub `index.ts` reserved for the virtual-list controller and bindings.
- [x] **01.6.4** Create `src/app/` — **not left empty**: houses the real `bootstrap()` function that `main.ts` delegates to (see 01.6.8), with the intended platform → storage → connect → render boot order documented inline.
- [x] **01.6.5** Create `src/styles/` — `tokens.css`/`base.css` created empty here, then genuinely populated in Feature 01.10 (first real consumer).
- [x] **01.6.6** Create `src/state/` — stub `index.ts`, kept separate from `src/ui/`.
- [x] **01.6.7** Create `scripts/` — houses `spektrum-version.json`, `check-importmap.mjs`, `sync-vendor-spektrum.mjs`, `package-target.mjs`, `check-dist.mjs` (all written across Features 01.4/01.5/01.8).
- [x] **01.6.8** Wire `main.ts` as the only entry — `main.ts` is now exactly `import { bootstrap } from './app'; bootstrap();`; all real logic lives in `src/app/index.ts`. Verified behavior-identical before/after the refactor via a real browser check (same rendered text).
- [x] **01.6.9** Document ownership — "Who lives where" table added to `README.md`, including the `src/core/`-only platform-API rule.
- [x] **01.6.10** Verify empty-tree health — `npm run build`, `npm run typecheck` (`tsc --noEmit`), `npm run lint` all green with the full skeleton in place.

## Feature 01.7 — gh-pages deploy script

Prove the Actions-free distribution story: one local command builds and pushes `dist/` to the `gh-pages` branch of the real repository.

- [x] **01.7.1** Add the dependency — `gh-pages` installed pinned (`6.3.0`).
- [x] **01.7.2** Wire the script — `"deploy": "vite build && gh-pages -d dist"` set exactly as specified.
- [x] **01.7.3** Add `.nojekyll` — `public/.nojekyll` added; confirmed it lands at `dist/.nojekyll` after build.
- [ ] **01.7.4** Configure Pages once — **deferred**: no standalone repository exists yet to configure Pages settings on (see "Implementation location" and "Completion notes").
- [ ] **01.7.5** First real deploy — **deferred**, same reason; `npm run deploy` is fully wired and would work identically once a real repository with push access exists.
- [x] **01.7.6** Verify no Actions — confirmed no `.github/workflows/` directory exists in `thundertv/`; the deploy mechanism is 100% local (`gh-pages` CLI pushing directly), matching the constraint.
- [ ] **01.7.7** Verify the live URL — **deferred**, depends on 01.7.4/01.7.5.
- [ ] **01.7.8** Test redeploy idempotence — **deferred**, depends on 01.7.5. (`gh-pages`'s CLI behavior — force-push a clean tree each run — is standard/well-known, but wasn't exercised against a real remote here.)
- [x] **01.7.9** Document rollback — rollback procedure (`git checkout <sha> && npm ci && npm run deploy`) documented in `README.md`.
- [x] **01.7.10** Capture deploy prerequisites — documented in `README.md`: push rights, always deploy from clean merged `main`, Pages pointed at `gh-pages` branch root.

## Feature 01.8 — Dev/prod build parity (base './')

Make one `dist/` load identically from a Pages subpath, `npm run preview`, and — later — Electron `file://` and packaged webOS, by committing to relative asset URLs now.

- [x] **01.8.1** Set the base — `base: './'` set with a comment naming all three consumers.
- [x] **01.8.2** Audit emitted URLs — inspected built `dist/index.html`; every reference (`./favicon.svg`, `./assets/...`) relative, none root-absolute.
- [x] **01.8.3** Verify from a subpath — served `dist/` under a real nested `/thundertv/` path via `npx serve`; index, JS asset, and favicon all resolved HTTP 200.
- [x] **01.8.4** Verify from `file://` — **real finding, not simulated**: opening the built `dist/index.html` directly via `file://` in a real Chromium instance fails with `Access to script ... has been blocked by CORS policy: ... origin 'null' ...` — `type="module"` scripts are blocked outright under the `file://` origin. **Input for Phase 28 (Electron Shell)**: Electron will need a custom protocol handler (e.g. `protocol.handle` registering an `app://` scheme) rather than loading `dist/index.html` via a raw `file://` URL, which is standard, well-documented Electron practice for exactly this reason.
- [x] **01.8.5** Ban absolute references — `scripts/check-dist.mjs` written; fails on `src="/..."`/`href="/..."` (excluding `//` and Vite's dev-only `/@`); proven by injecting a regression and confirming failure, then reverting.
- [x] **01.8.6** Prepare worker parity — `worker.format: 'es'` set with a comment on the required `new Worker(new URL(...))` pattern for future parser workers.
- [x] **01.8.7** Keep chunks deterministic — *adapted*: an empty `manualChunks: {}` stub is not valid under Rollup's TS types (ambiguous between its function/Record overloads — confirmed via a real `tsc` error), so the reservation is a comment only, with the field itself left unset until Phase 10/11 has real content to split.
- [x] **01.8.8** Compare dev vs prod behavior — *adapted*: compared via real headless-Chromium checks (curl for dev-served source, full browser interaction for the built/vendored path) rather than a deployed Pages build (none exists yet) — zero behavioral divergence found.
- [x] **01.8.9** Measure the baseline budget — built app JS+CSS gzipped: **~1.0 KB total** (583 B JS + 448 B CSS) at end of phase, far under the ~60 KB budget, as expected this early.
- [x] **01.8.10** Add the parity check to the checklist — "preview `dist/` from a subpath before every deploy" added to `README.md`'s deploy section.

## Feature 01.9 — Repo hygiene (.editorconfig, .gitignore, README stub, LICENSE)

The unglamorous files that keep every future contributor and agent session consistent from the first clone.

- [x] **01.9.1** Add `.editorconfig` — UTF-8/LF/final-newline/4-space indent set, matching Prettier; vendored files exempted.
- [x] **01.9.2** Add `.gitignore` — `node_modules`/`dist`/editor+OS droppings ignored; `public/vendor/` explicitly called out as **not** ignored, with a comment explaining why.
- [x] **01.9.3** Write the README stub — project one-liner, all four constraints, full command reference.
- [x] **01.9.4** Link the source of truth — README links both the architecture plan and `MASTERPLAN.md`/`phases/`.
- [x] **01.9.5** Choose and add LICENSE — **MIT**, chosen for compatibility with both upstream sources this project depends on: Spektrum itself is MIT-licensed, and the `m3u-utils` code Phase 06 ports from the parent `thunder-tv` (IPTVnator) repository is also MIT-licensed. `package.json`'s `license` field set to match.
- [x] **01.9.6** Add `CONTRIBUTING` notes to the README — standing conventions section added (line limits, no animations, platform-API fence, fragment-only credentials).
- [x] **01.9.7** Document the branch flow — described in README, including the temporary adaptation (shared session branch instead of pushed feature branches) while this lives inside `thunder-tv`.
- [x] **01.9.8** Add an issue-free tracker note — README states plainly that `masterplan/phases/` is the tracker, not GitHub Issues.
- [x] **01.9.9** Normalize line endings — `.gitattributes` added (`* text=auto eol=lf`), with vendored `.js` explicitly marked `-diff -text`.
- [x] **01.9.10** Fresh-clone drill — **actually run**: copied the tree (minus `node_modules`/`dist`) to a scratch directory, ran `npm ci && npm run build && npm run lint` there — all green, no undocumented steps. (`git clone` itself wasn't available to test since no standalone repository exists yet; the copy+`npm ci` drill is the closest real equivalent and covers the same "does a fresh checkout just work" question.)

## Feature 01.10 — End-to-end smoke page proving a Spektrum binding renders from the deployed Pages URL

Close the loop: the deployed production URL must demonstrably run Spektrum reactivity, proving CDN import map + `base: './'` + gh-pages all compose.

- [x] **01.10.1** Build the smoke view — smoke block added to `index.html`'s `#app`, with `{{ smoke.message }}`, `{{ smoke.count }}`, `{{ smoke.parity }}`, and a button. **Correction to this task's premise**: `data-action="click:bumpSmoke"` is not real Spektrum syntax — the actual binding is two separate attributes, `data-action="click"` + `data-fn="bumpSmoke"` (confirmed against the real `docs/bindings.md`, and against a failing-then-passing real-browser click test — the first attempt with the guessed syntax silently did nothing).
- [x] **01.10.2** Wire smoke state — `src/app/index.ts`: `setValue('smoke.message', ...)`, `setValue('smoke.count', 0)`, `defineFn('bumpSmoke', (_el, state) => setValue('smoke.count', readSmokeCount(state) + 1))`.
- [x] **01.10.3** Exercise `computed` — `computed('smoke.parity', ['smoke.count'], ...)` derives even/odd; **verified reactive in a real browser**: after 1 click count=1/odd, after 2 clicks count=2/even.
- [x] **01.10.4** Style with tokens only — `tokens.css` (color/spacing/font tokens) and `base.css` (reset + `.smoke` block styling, zero transitions/animations) both genuinely populated and linked from `index.html`.
- [x] **01.10.5** Verify locally built — full interactive Playwright/Chromium test against `npm run preview` of the built, vendored-swapped `dist/`: initial render correct, first click → count 1/odd, second click → count 2/even, zero console/page errors.
- [ ] **01.10.6** Deploy and verify live — **deferred**, no live Pages URL exists yet (see Feature 01.7).
- [ ] **01.10.7** Verify the CDN request — **deferred**, same reason. (The equivalent same-origin/vendored-path network request *was* verified for real — see 01.5.5.)
- [x] **01.10.8** Test the failure story — **found for real, earlier than planned**: this sandboxed environment's outbound HTTPS proxy resets connections from this specific headless-Chromium instance to the CDN host (`unpkg.com`), while `curl` and Node's `fetch` through the identical proxy succeed — isolated across three independent checks (direct top-level navigation, proxy flag variants, HTTP/2 disabled) before concluding it's an environment/proxy-fingerprinting limitation, not an application defect. The **observed failure mode** is `net::ERR_CONNECTION_RESET` on the CDN request with **zero other page errors** — i.e., exactly the shape of failure the vendored-fallback path (Feature 01.5) and the future PWA offline path (Phase 24) need to handle gracefully. Real live-CDN-blocked-in-a-browser behavior (as opposed to this sandbox's specific cause) remains to be observed once a real deploy exists.
- [x] **01.10.9** Record the evidence — **no live URL yet**, so recording the equivalent local evidence instead: real headless-Chromium (`playwright-core` against the pre-installed sandbox Chromium) proof, same-origin/vendored path, `dist/` built at commit time of this phase. Full interaction trace: before-click state `{message: "ThunderTV is alive", count: 0, parity: "even"}`; after 1 click `count: 1, parity: "odd"`; after 2 clicks `count: 2, parity: "even"`; zero console errors, zero page errors throughout.
- [x] **01.10.10** Gate the phase — standing verification checklist walked: `npm run build` ✓, `npx tsc --noEmit` ✓, `npm run lint` ✓ (zero warnings, `--max-warnings 0`), budgets ✓ (~1 KB gzipped vs. ~60 KB budget), no forbidden platform APIs outside `src/core/` (nothing yet touches `fetch`/`indexedDB`/`localStorage` at all — Phase 03/04's job).

## Completion notes

**What's genuinely done and verified:** all tooling, all configuration, all scripts, and — critically — a **real, interactive, headless-Chromium proof** that `setValue`, `computed`, and `defineFn` all work correctly through both the CDN-import-map mechanism (verified structurally, dev and build) and the vendored-file swap path (verified with actual clicks and reactive DOM updates, since that path is same-origin and unaffected by this sandbox's proxy limitation).

**What's deferred, and why:** every task requiring a real, separate `thundertv` GitHub repository with Pages configured (Feature 01.7's 01.7.4/01.7.5/01.7.7/01.7.8, Feature 01.10's 01.10.6/01.10.7) is deferred. This session's GitHub access is scoped to the `thunder-tv` repository only; creating and pushing to a new public repository unilaterally was judged (per the standing instructions on risky/hard-to-reverse actions) to need explicit user authorization rather than being assumed. All the code and tooling those steps would exercise is written, wired, and locally proven — `npm run deploy` will work the moment a real repository exists; nothing about the deferred tasks is a design gap, only an execution-environment gap.

**Sandbox-specific finding (not a ThunderTV defect):** this session's headless Chromium cannot complete outbound HTTPS connections to the CDN host through the sandbox's proxy (`net::ERR_CONNECTION_RESET`), while `curl` and Node's `fetch` succeed through the identical proxy. This was isolated with three independent fix attempts (explicit `--proxy-server` flag, `--ignore-certificate-errors`, disabling HTTP/2/QUIC) before concluding it's an environment/tooling limitation rather than a wiring bug — confirmed by the fact the exact same code path (same import map mechanism, same `bindDOM`/`setValue`/`computed`/`defineFn` code) works perfectly end-to-end once the only variable changed is same-origin vs. cross-origin (the vendored-file test in Feature 01.5/01.10).

**Two real engineering findings worth carrying forward:**
- **Vite dev-server externalization** (01.4.5): `build.rollupOptions.external` alone does not make a bare specifier resolve via a browser import map under `npm run dev` — Vite's import-analysis plugin rewrites it to an internal `/@id/` marker regardless. A `transform` hook running after import-analysis (`enforce`/`order: 'post'`) that rewrites the marker back to the bare specifier is required, and is now in `vite.config.ts` with a comment explaining why.
- **`file://` module CORS** (01.8.4): confirmed for real that `type="module"` scripts fail to load under a raw `file://` origin (`origin 'null'`). Phase 28 (Electron Shell) should plan on a custom protocol handler (`protocol.handle` / `app://` scheme) rather than loading `dist/index.html` directly via `file://`.
