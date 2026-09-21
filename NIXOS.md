# TwoDB on NixOS — server + node agents

Everything ships from this repo's flake: the server (api + web in one process,
reading a release tarball) and the node agent (a compiled binary). Versions
track GitHub releases — bump the input, `nixos-rebuild`, done.

## 1. Server

### Flake-based configuration

In your NixOS flake:

```nix
{
  inputs.twodb.url = "github:reezpatel/twodb";

  outputs = { nixpkgs, ... } @ inputs: {
    nixosConfigurations.myhost = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [
        inputs.twodb.nixosModules.default
        ./configuration.nix
      ];
    };
  };
}
```

Then in `configuration.nix`:

```nix
{ ... }:

{
  services.twodb-server = {
    enable = true;
    port = 3001;
    databaseUrl = "postgres://twodb:twodb@localhost:5432/twodb";
    # workDir defaults to /var/lib/twodb (StateDirectory handles it)

    extraEnvironment = {
      # only needed when using admin passkeys with a real hostname
      TWODB_ADMIN_RP_ID = "twodb.example.com";
      TWODB_ADMIN_ORIGIN = "https://twodb.example.com";
    };
  };

  services.postgresql = {
    enable = true;
    ensureDatabases = [ "twodb" ];
    ensureUsers = [
      {
        name = "twodb";
        ensureDBOwnership = true;
      }
    ];
    # the packaged default connection string uses password auth on localhost;
    # either set a password or point databaseUrl at your socket/peer config
    authentication = ''
      local twodb twodb peer
      host twodb twodb 127.0.0.1/32 scram-sha-256
    '';
  };

  networking.firewall.allowedTCPPorts = [ 3001 ];
}
```

`nixos-rebuild switch --flake .#myhost` and the service is up:

- **Web + API**: `http://myhost:3001` (the same process serves both)
- **Core plugins** (auth, workspace, llm, node, code) are baked into the
  package and **seeded into the database on first boot** — nothing to install
- Runtime data (fetched `npm:` plugins, uploads) lands in `/var/lib/twodb`
- The unit runs as a dynamic user with `StateDirectory`, restarts on failure

### First run

1. Open `http://myhost:3001` — you'll sign in via the auth plugin (passkey;
   set the `TWODB_ADMIN_*` vars above when serving from a real hostname)
2. Create your vault + workspace (first-run flow creates them)
3. Machines: Settings → **Machines** → *Add machine* → copy the token (shown
   once) — that's what a node agent below needs

### Reverse proxy (optional)

```nix
services.nginx.virtualHosts."twodb.example.com" = {
  forceSSL = true;
  enableACME = true;
  locations."/".proxyPass = "http://127.0.0.1:3001";
  # websockets (code sessions) need upgrade headers
  locations."/".proxyWebsockets = true;
};
```

If you proxy with HTTPS, remember `TWODB_ADMIN_ORIGIN` must match the public
origin (passkeys bind to it).

## 2. Node agents

### On a NixOS machine

```nix
{
  inputs.twodb.url = "github:reezpatel/twodb";

  # in the machine's modules — a minimal service for the agent:
  systemd.services.twodb-node = {
    description = "TwoDB node agent";
    after = [ "network-online.target" ];
    wants = [ "network-online.target" ];
    wantedBy = [ "multi-user.target" ];
    environment = {
      TWODB_NODE_URL = "http://myhost:3001";
      TWODB_NODE_TOKEN = "paste-the-token-from-add-machine";
      TWODB_ROOT = "/srv/project";   # the folder sessions work in
    };
    serviceConfig = {
      ExecStart = "${inputs.twodb.packages.x86_64-linux.twodb-node}/bin/twodb-node";
      Restart = "on-failure";
      DynamicUser = true;
      ReadWritePaths = [ "/srv/project" ];
    };
  };
}
```

After `nixos-rebuild switch`, the machine shows **online** under Settings →
Machines within seconds (the agent holds a streaming connection).

### Ad-hoc (any machine, no service)

```bash
nix run github:reezpatel/twodb#twodb-node --help
TWODB_NODE_URL=http://myhost:3001 \
TWODB_NODE_TOKEN=... \
TWODB_ROOT=$HOME/projects/app \
nix run github:reezpatel/twodb#twodb-node
```

### Non-NixOS machines

- **macOS**: `brew install reezpatel/twodb/twodb-node && brew services start twodb-node`
- **Windows**: `choco install twodb-node`, then `twodb-node service install` (elevated)
- **Docker**: `docker compose -f docker-compose.node.yaml up -d`
- **Linux (manual)**: download `twodb-node-linux-x64` from the release, `chmod +x`, run with the three env vars

## 3. Using it

- **Code sessions**: rail → Code → *New session* → pick the machine + folder →
  talk to the agent; it reads/writes/patches files and runs commands on that
  machine, streaming output live
- **LLM providers**: Settings → LLM Providers → add connections (per
  workspace); pick models per session from the footer picker
- **Extra provider adapters**: Admin → Plugins → install by npm identifier,
  e.g. `npm:@twodb/llm-adapter-anthropic` — fetched and loaded at boot

## 4. Updating

Bump the flake input and rebuild:

```bash
nix flake update twodb
nixos-rebuild switch --flake .#myhost   # server host
# agent machines: same, then the service restarts with the new binary
```

Releases: <https://github.com/reezpatel/twodb/releases> — the server package
follows `twodb-server-v<tag>.tar.gz`, the agent follows the platform binary.
