# Manual release steps

What CI does per release tag (`v0.1.0` example) and what still needs hands.

## One-time setup

### GitHub Container Registry — nothing to do

Jobs push to GHCR with the workflow's `GITHUB_TOKEN`. On the first run, make
repo → Settings → Actions → Workflow permissions allows read/write (default),
then mark the packages public if you want them pullable without login.

## Per release (tag `v0.1.0` example)

```bash
git tag v0.1.0 && git push origin v0.1.0
```

| Job     | Output                                                                                      |
| ------- | ------------------------------------------------------------------------------------------- |
| check   | typecheck of server / runner / desktop (gate for the rest)                                  |
| desktop | `twodb_0.1.0_amd64.deb`, `.AppImage`, `.rpm` attached to the GitHub release                 |
| images  | `ghcr.io/reezpatel/twodb:v0.1.0` + `:0.1` + `:sha-…` and `ghcr.io/reezpatel/twodb-runner:…` |

Every push to `main` also rebuilds both images as `:latest` + `:sha-…`
(`docker-image.yaml`).

### After the release run finishes

Nothing is manual anymore — verify the release page has the desktop bundles
and the packages page shows both images with the new tags.

## Verify images locally before tagging

```bash
docker build -t twodb:local .                # server + built web UI
docker build -t twodb-runner:local -f apps/runner/Dockerfile .

docker run -p 3001:3001 \
  -e TWODB_DATABASE_URL=postgres://twodb:twodb@host.docker.internal:5432/twodb \
  -e MEMGRAPH_URL=bolt://host.docker.internal:7687 \
  -e BETTER_AUTH_SECRET=dev-secret \
  twodb:local
curl -s localhost:3001/api/health   # {"ok":true,...}
curl -sI localhost:3001/            # 200 — the desktop app's index.html
```

## Nix / NixOS

`nix develop` gives the dev shell (Node, pnpm, Rust/Tauri toolchain).

NixOS: import `flake.nix#nixosModules.default` and enable
`services.twodb-server` / `services.twodb-runner` (both run the GHCR
containers — see NIXOS.md).
