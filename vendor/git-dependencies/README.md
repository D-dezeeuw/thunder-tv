# Vendored git dependencies

The tarballs in `vendor/*.tgz` are exact `npm pack` outputs of GitHub-hosted
dependency forks that npm does not publish. They are vendored so
`pnpm install` works without direct GitHub HTTPS access (`codeload.github.com`
tarball downloads are blocked in restricted build environments such as remote
agent sandboxes) and so installs stay reproducible everywhere.

| Tarball | Source repository | Pinned commit |
| --- | --- | --- |
| `iptv-playlist-parser-0.15.2-iptvnator.2.tgz` | `4gray/iptv-playlist-parser` (tag `v0.15.2-iptvnator.2`) | `d547b6be8a44431c85fbcbcdefb41f28c0dadf6d` |
| `webworkify-webpack-2.1.5.tgz` | `xqq/webworkify-webpack` (mpegts.js fork) | `24d1e719b4a6cac37a518b2bb10fe124527ef4ef` |
| `electron-node-gyp-10.2.0-electron.1.tgz` | `electron/node-gyp` (@electron/rebuild toolchain) | `06b29aafb7708acef8b3669835c8a7857ebc92d2` |

Wired up in `package.json`:

- `iptv-playlist-parser` is a direct dependency using a `file:` spec.
- `webworkify-webpack` (via `mpegts.js`) and `@electron/node-gyp` (via
  `@electron/rebuild`) are redirected through `pnpm.overrides`.

To update one: clone the source repository at the new commit, run
`npm pack <dir> --pack-destination vendor/`, update the `file:` reference and
this table, then run `pnpm install --no-frozen-lockfile`.
