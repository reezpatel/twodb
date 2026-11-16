# two-runner

The machine-side agent for **Dispatch**: it dials the TwoDB gateway over one outbound WebSocket and runs commands, detached
jobs and (optionally) Firecracker microvms for your workspace. Nothing needs to listen on the node.

```
two-runner --gateway http://slayer.lan.nb:6400 --enroll-file /run/secrets/twodb-enroll --name build-box
```

## Connecting
`--gateway` is any address that reaches the TwoDB gateway (the console host). That can be a **private NetBird name or IP** —
the gateway does not have to be public. Use `https://` when it is.

| | |
|---|---|
| **Enrollment token** (`--enroll` / `--enroll-file`) | Create one in Dispatch → Enrollment tokens. One token enrolls any number of machines. It is used **only while the machine has no runner key**: the first connect mints a per-runner key, saved in `<state>/runner.key`; restarts reuse it, so a token left in your config never creates duplicates. If the runner is deleted in Dispatch, the stale key is rejected and the machine enrolls again by itself. |
| **Runner key** (`--key` / `--key-file`) | A single runner created with "Add runner" in Dispatch. Always used, nothing is persisted. |

Every option also has an environment variable: `TWO_RUNNER_GATEWAY`, `_NAME`, `_ENROLL`, `_ENROLL_FILE`, `_KEY`, `_KEY_FILE`,
`_STATE`, `_MICROVM=true`. Prefer the `*_FILE` forms so secrets stay out of process listings and the Nix store.
Other flags: `--name` (default hostname), `--microvm` (needs `/dev/kvm` + `firecracker`), `--state` (default `~/.two-runner`), `--version`.

## Nix / NixOS
```nix
# flake.nix
inputs.twodb.url = "github:reezpatel/twodb";

# NixOS (nix-darwin: inputs.twodb.darwinModules.two-runner)
imports = [ inputs.twodb.nixosModules.two-runner ];
services.two-runner = {
  enable = true;
  gateway = "http://slayer.lan.nb:6400";                  # NetBird name or IP of the gateway
  name = "build-box";                                     # default: networking.hostName
  enrollTokenFile = config.age.secrets.twodb-enroll.path; # or keyFile = ... for a per-runner key
  # microvm = true;                                       # adds the kvm group + firecracker
  # user = "me"; extraGroups = [ "docker" ]; extraPackages = [ pkgs.nodejs ];
  # after = [ "netbird-default.service" ];                # start after the NetBird client
};
```
The token/key **file path** is the only thing in your config — the secret never enters the Nix store. On NixOS the service reads it
through systemd `LoadCredential`, so a root-only agenix/sops file works for the unprivileged `two-runner` user.
Commands Dispatch runs execute as `services.two-runner.user` (default: a dedicated unprivileged user) — choose it deliberately.

Just the binary: `nix run github:reezpatel/twodb#two-runner -- --help`.

## Build
```
go build -o two-runner .            # or: nix build .#two-runner
go build -ldflags "-X main.version=1.2.3" ...
```
When `go.mod`/`go.sum` change, update `vendorHash` in `flake.nix` (set it to `lib.fakeHash`, run `nix build .#two-runner`, paste the printed hash).
