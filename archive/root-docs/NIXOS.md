# TwoDB on NixOS — server + runners

The flake ships a NixOS module that runs the GHCR containers from CI:

- `services.twodb-server` — the server container: built desktop app served at
  `/`, API under `/api`, twodb schema ensured on start
- `services.twodb-runner` — the runner agent container (outbound WebSocket to
  the server, executes terminal + agent commands)

## 1. Server

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
    environment = {
      # postgres + memgraph must be reachable from the container
      TWODB_DATABASE_URL = "postgres://twodb:twodb@10.0.0.2:5432/twodb";
      MEMGRAPH_URL = "bolt://10.0.0.2:7687";
      BETTER_AUTH_URL = "http://myhost:3001";
      # BETTER_AUTH_SECRET belongs in environmentFile, not the world-readable store
    };
    environmentFile = /run/secrets/twodb-server-env;
  };

  virtualisation.docker.enable = true; # or podman via oci-containers backend

  networking.firewall.allowedTCPPorts = [ 3001 ];
}
```

`environmentFile` (e.g. an agenix secret) should hold at least:

```ini
BETTER_AUTH_SECRET=<long-random-string>
TWODB_DATABASE_URL=postgres://...
MEMGRAPH_URL=bolt://...
```

`nixos-rebuild switch --flake .#myhost` and it's up:

- **Web + API**: `http://myhost:3001` — UI at `/`, API under `/api`
- Migrations run automatically on container start
- Health: `GET /api/health` (used by the container healthcheck too)

### First run

1. Open `http://myhost:3001`, register a user, create an organization
2. Settings → **LLM** — add a connection (models are fetched automatically)
3. Settings → **Runners** — create an access key for each runner machine

## 2. Runners

```nix
{
  services.twodb-runner = {
    enable = true;
    serverUrl = "http://myhost:3001";
    runnerName = config.networking.hostName;
    environmentFile = /run/secrets/twodb-runner-env; # TWODB_RUNNER_KEY=twr_…
  };
}
```

The runner uses host networking and connects outbound, so it needs no inbound
ports. After `nixos-rebuild switch` it shows **online** under Settings →
Runners within seconds and reconnects on its own after outages.

On non-NixOS machines use `docker-compose.runner.yaml` or plain `docker run`
(see README → Docker).

## 3. Reverse proxy (optional)

```nix
services.nginx.virtualHosts."twodb.example.com" = {
  forceSSL = true;
  enableACME = true;
  locations."/".proxyPass = "http://127.0.0.1:3001";
  # websockets (code sessions, terminal) need upgrade headers
  locations."/".proxyWebsockets = true;
};
```

If you proxy with HTTPS, set `BETTER_AUTH_URL=https://twodb.example.com` and
`PASSKEY_RP_ID=twodb.example.com` in the server environment (passkeys bind to
the origin and WebAuthn needs HTTPS outside localhost).
