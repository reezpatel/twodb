# manual-steps.md — publishing & distribution setup

Everything CI does automatically, plus the one-time and per-release steps that
need you. Work top to bottom once; after that a `git tag v0.1.0 && git push
--tags` runs the whole pipeline.

## One-time setup

### 1. npm org + stage-only token (plugin publishing)

- Create/pick an npm account, then create the org (or verify access to) **`@twodb`**
  at <https://www.npmjs.com/org/create>
- The CI token is **stage-only**: it cannot publish directly. It stages every
  version via `npm stage publish`; a maintainer with 2FA then promotes them.
- Repo secret: `NPM_TOKEN` = the stage-only token

CI stages every plugin under `plugins/*` and `plugins/llm-adapters/*` with
`--access public`. **Dynamic**: the publish script scans for folders with a
`package.json` containing `twodb.identifier` — new plugins are picked up on the
next release run with zero config.

**Promotion (per release, you)**: sign in to npmjs.com with a 2FA-enabled
maintainer account → the org's packages show **staged versions** → promote each
(or via `npm promote <pkg>@<version>` if your CLI supports it). Only promoted
versions become `latest` — which is also what the api's `npm:` plugin fetch
resolves, so nothing installs until you promote.

### 2. Chocolatey account (Windows agent package)

- Create an account at <https://community.chocolatey.org>
- Account → API Key → copy it
- Repo secret: `CHOCO_API_KEY` = that key
- CI builds the `.nupkg` per release and attaches it as the `choco-package`
  artifact — the actual push is manual (below) until you're confident in the
  package.

### 3. Homebrew tap (macOS agent)

- Create the public repo **`reezpatel/homebrew-twodb`**
- Formula template lives at `deploy/homebrew/twodb-node.rb`
- Per release (below) you copy it in and bump url/sha256/version

### 4. GitHub Container Registry — nothing to do

The release workflow logs into `ghcr.io` with the built-in `GITHUB_TOKEN`. The
image lands at `ghcr.io/reezpatel/twodb-server`. Make sure repo → Settings →
Actions → General → Workflow permissions allows "Read and write".

## Per release (tag `v0.1.0` example)

```bash
git tag v0.1.0
git push origin v0.1.0
```

CI then automatically:

| Step            | Output                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------- |
| build + test    | green pipeline gate                                                                      |
| docker-image    | `ghcr.io/reezpatel/twodb-server:v0.1.0` + `:latest`                                      |
| publish-plugins | all plugins **staged** to npm — promote with a 2FA maintainer account (see §1)           |
| agent-binaries  | `twodb-node-{linux-x64,darwin-arm64,darwin-x64,windows-x64.exe}` attached to the release |
| server-tarball  | `twodb-server-v0.1.0.tar.gz` attached to the release                                     |
| choco-pack      | `choco-package` artifact (nupkg) — NOT pushed                                            |

### After the release run finishes

**Chocolatey push** (manual until you trust it):

```bash
gh run download -n choco-package -D /tmp/choco
choco push /tmp/choco/twodb-node.<version>.nupkg --source https://push.chocolatey.org/ --key <CHOCO_API_KEY>
```

**Homebrew tap bump** — in `reezpatel/homebrew-twodb`:

```bash
sha=$(curl -fsSL https://github.com/reezpatel/twodb/releases/download/v0.1.0/twodb-node-darwin-arm64.tar.gz | shasum -a 256 | cut -d' ' -f1)
# edit Formula/twodb-node.rb: url → v0.1.0 asset, sha256 → $sha, version "0.1.0"
brew tap-repair || true
brew install reezpatel/twodb/twodb-node && brew services start twodb-node
```

(Set `TWODB_NODE_URL`, `TWODB_NODE_TOKEN`, `TWODB_ROOT` in the service env via
`brew services` env plists or the formula's `environment_vars`.)

**Nix hashes** — `flake.nix` ships placeholder hashes (`sha256-AAA…=`). After
the first release with tarballs available:

```bash
nix-prefetch-url --unpack https://github.com/reezpatel/twodb/releases/download/v0.1.0/twodb-server-v0.1.0.tar.gz
nix-prefetch-url https://github.com/reezpatel/twodb/releases/download/v0.1.0/twodb-node-<host-platform>.tar.gz  # binaries are plain files
# replace both placeholders, then:
nix flake check
```

Then users get:

```bash
nix run github:reezpatel/twodb#twodb-server
nix run github:reezpatel/twodb#twodb-node
```

and NixOS: `services.twodb-server.enable = true;` (see `flake.nix` options).

## Running the server

**Docker (compose, postgres included):**

```bash
docker compose up -d        # server on :3001, postgres + volumes wired
```

Set `TWODB_ADMIN_RP_ID` / `TWODB_ADMIN_ORIGIN` in `docker-compose.yml` when
using passkeys with a real hostname.

**Tarball (any host with node 22):**

```bash
tar xzf twodb-server-v0.1.0.tar.gz
TWODB_DATABASE_URL=postgres://twodb:twodb@localhost:5432/twodb \
TWODB_PLUGINS_DIR=$PWD/plugins TWODB_STATIC_DIR=$PWD/web-dist TWODB_VENDOR_DIR=$PWD/vendor \
node server.mjs
```

The five core plugins are baked in and seeded into a fresh database
automatically (`TWODB_PLUGINS_DIR`). Extra providers install from npm via the
admin UI using identifiers like `npm:@twodb/llm-adapter-anthropic` — always the
registry's latest version.

## Node agent

| Channel | Command                                                                                                             |
| ------- | ------------------------------------------------------------------------------------------------------------------- |
| Docker  | `docker compose -f docker-compose.node.yaml up -d` (or the compose in apps/node)                                    |
| brew    | `brew install reezpatel/twodb/twodb-node && brew services start twodb-node`                                         |
| choco   | `choco install twodb-node`, then elevated: `twodb-node service install` (WinSW-based Windows service, auto-restart) |
| nix     | `nix profile install github:reezpatel/twodb#twodb-node`                                                             |
| binary  | download `twodb-node-<platform>` from the release, run with the three `TWODB_*` env vars                            |

`twodb-node service install` writes the WinSW config beside the exe using the
current environment; `service uninstall | start | stop` manage it.

## Local checks before tagging

```bash
node scripts/vendor-deps.mjs          # vendor bundles + import-map.json
(cd apps/api && node build.mjs)       # dist/server.mjs — boot it on a spare port
(cd apps/web && npx vite build)       # index.html must contain the importmap
node scripts/make-server-tarball.mjs 0.1.0-local   # full release layout dry run
node scripts/publish-plugins.mjs      # dry run — lists what would publish
```
