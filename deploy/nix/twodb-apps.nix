{ ... }:
{
  # TwoDB apps cluster — the NEW ecosystem control plane (TwoDB gateway +
  # orchestrator, ghcr.io/reezpatel/app-twodb:latest), running alongside the
  # OLD monolith twodb-server (app.twodb.io, port 3001) which this module
  # deliberately does NOT touch.
  #
  # What it runs on slayer:
  #   - twodb-apps-postgres: dedicated Postgres 17 container for app schemas
  #     (separate from the host Postgres the monolith uses).
  #   - twodb-control-plane: the gateway/admin UI. It orchestrates sibling
  #     app containers itself (install/start/stop/upgrade) by shelling out
  #     to the docker CLI (bundled in the image) against the rootful podman
  #     docker-compat socket — DOCKER_HOST below. All app containers land on
  #     the shared `twodb-net` network and are reached by container NAME;
  #     no app ports are published on the host (TWODB_APP_PUBLISH_PORTS=false).
  #
  # Exposure:
  #   - Humans: nginx vhost https://hub.twodb.io → 127.0.0.1:6400 (ACME).
  #     The same origin serves the admin webapp AND the gateway API
  #     (/api/auth, /registry, /orchestrator, /apps/<slug>/*).
  #   - twodb-cli from other machines: NetBird mesh only — port 6400 is
  #     opened exclusively on nb-default, never publicly.
  #
  # Requires (already present via the memgraph/monolith stack):
  #   virtualisation.podman.enable + the rootful podman.socket unit.
  #
  # Secrets (one time): the shared env file holds the gateway secret AND the
  # postgres password/URL (rootful podman reads it as root; agenix root:0400
  # is fine):
  #   agenix -e secerts/twodb-apps-env.age
  # with content:
  #   AUTH_SECRET=<openssl rand -hex 32>
  #   POSTGRES_PASSWORD=<openssl rand -hex 16>
  #   TWODB_PG_ADMIN_URL=postgres://twodb:<same password>@twodb-apps-postgres:5432/twodb
  #
  # Post-deploy (one time):
  #   1. Point hub.twodb.io at slayer's public IP (147.93.171.18) for ACME.
  #   2. Open https://hub.twodb.io — register the first user via passkey.
  #   3. Apps tab → Install the apps you want (images pull from
  #      ghcr.io/reezpatel/app-<slug>:latest; cut a repo tag vX.Y.Z to
  #      publish updates, then hit Upgrade on the row).
  #
  # Note: the image tracks :latest (pull = "newer"), same trade-off as the
  # monolith module. Releases are driven by repo tags, not by this host.
  # If the ghcr.io/reezpatel/app-* packages are private, rootful podman
  # needs auth once: podman login ghcr.io (or make the packages public in
  # the repo's package settings).
  flake.modules.nixos.twodb-apps =
    { config, pkgs, ... }:
    let
      domain = "hub.twodb.io";
      network = "twodb-net";
      dataDir = "/var/lib/twodb-apps";
    in
    {
      # Holds AUTH_SECRET / POSTGRES_PASSWORD / TWODB_PG_ADMIN_URL (see header).
      age.secrets.twodb-apps-env.file = ../../../secerts/twodb-apps-env.age;

      # Rootful podman docker-compat socket the control plane orchestrates
      # through. (virtualisation.podman.enable itself comes from the
      # memgraph module; this just makes sure the API socket is up.)
      systemd.sockets.podman.wantedBy = [ "sockets.target" ];

      # The shared app network, created declaratively (the orchestrator would
      # create it lazily on first install, but postgres + the control plane
      # need it before that). DNS name resolution between containers comes
      # from netavark/aardvark-dns (NixOS podman default).
      systemd.services.twodb-apps-net = {
        description = "podman network for the twodb apps cluster";
        wantedBy = [ "multi-user.target" ];
        after = [ "podman.service" ];
        serviceConfig = {
          Type = "oneshot";
          RemainAfterExit = true;
        };
        script = ''
          ${pkgs.podman}/bin/podman network exists ${network} \
            || ${pkgs.podman}/bin/podman network create ${network}
        '';
      };

      # Dedicated Postgres for the apps ecosystem (one schema per app,
      # provisioned by TwoDB itself). NOT the host postgres the monolith uses.
      virtualisation.oci-containers.containers.twodb-apps-postgres = {
        image = "docker.io/library/postgres:17-alpine";
        autoStart = true;
        extraOptions = [
          "--network=${network}"
          "--health-cmd=pg_isready -U twodb -d twodb"
          "--health-interval=5s"
        ];
        environment = {
          POSTGRES_DB = "twodb";
          POSTGRES_USER = "twodb";
        };
        environmentFiles = [ config.age.secrets.twodb-apps-env.path ]; # POSTGRES_PASSWORD
        # Named volume, not a host dir — podman auto-chowns named volumes
        # for the image's uid (postgres alpine = uid 70); a root-owned host
        # dir would fail initdb.
        volumes = [ "twodb-apps-postgres-data:/var/lib/postgresql/data" ];
      };

      # The control plane itself.
      virtualisation.oci-containers.containers.twodb-control-plane = {
        image = "ghcr.io/reezpatel/app-twodb:latest";
        autoStart = true;
        # Re-pull when the registry has a newer :latest (see monolith module
        # for why "newer" over the default "missing").
        pull = "newer";
        # Gateway API on loopback only — nginx terminates TLS on 443.
        ports = [ "127.0.0.1:6400:6400" ];
        extraOptions = [
          "--network=${network}"
          "--health-cmd=node -e \"fetch('http://localhost:6400/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""
        ];
        environment = {
          PORT = "6400";
          # Control-plane SQLite on the persistent volume (bootstraps itself
          # on first run — no setup step).
          TWODB_SQLITE_FILE = "/data/twodb-control-plane.sqlite";
          # App containers reach postgres by container name on twodb-net.
          TWODB_PG_CONTAINER_HOST = "twodb-apps-postgres";
          # Apps call home to the gateway by container name (they can't
          # reach the host's loopback — firewalled, and there'd be nothing
          # there anyway: the gateway is a container too).
          TWODB_GATEWAY_URL_FOR_CONTAINERS = "http://twodb-control-plane:6400";
          # The gateway proxies to apps by container name, not host port.
          TWODB_APP_HTTP_URL_TEMPLATE = "http://twodb-app-{slug}:{containerPort}";
          TWODB_APP_PUBLISH_PORTS = "false";
          # Pull released images instead of building from a checkout (there
          # is no checkout on this host).
          TWODB_APP_IMAGE_REGISTRY = "ghcr.io/reezpatel";
          # docker CLI (bundled in the image) talks to rootful podman.
          DOCKER_HOST = "unix:///run/podman/podman.sock";
          # Public origin: better-auth cookies + passkey binding.
          AUTH_BASE_URL = "https://${domain}";
          AUTH_TRUSTED_ORIGINS = "https://${domain}";
          PASSKEY_RP_ID = domain;
          PASSKEY_ORIGIN = "https://${domain}";
        };
        # AUTH_SECRET + TWODB_PG_ADMIN_URL (see header).
        environmentFiles = [ config.age.secrets.twodb-apps-env.path ];
        volumes = [
          "${dataDir}/control-plane:/data"
          "/run/podman/podman.sock:/run/podman/podman.sock"
        ];
      };

      # Ordering: network first, postgres before the control plane.
      systemd.services.podman-twodb-apps-postgres.after = [ "twodb-apps-net.service" ];
      systemd.services.podman-twodb-control-plane = {
        after = [
          "twodb-apps-net.service"
          "podman-twodb-apps-postgres.service"
          "podman.socket"
        ];
        requires = [ "podman.socket" ];
      };

      systemd.tmpfiles.rules = [
        "d ${dataDir} 0750 root root -"
        "d ${dataDir}/control-plane 0750 root root -"
      ];

      # twodb-cli from mesh machines only; humans go through nginx on 443.
      networking.firewall.interfaces."nb-default".allowedTCPPorts = [ 6400 ];

      services.nginx.virtualHosts.${domain} = {
        forceSSL = true;
        enableACME = true;
        locations."/" = {
          proxyPass = "http://127.0.0.1:6400";
          # core-async LISTEN/NOTIFY is server-side, but the explorer's
          # try-it and future streaming endpoints benefit from long timeouts
          # and websocket upgrade support.
          proxyWebsockets = true;
          extraConfig = ''
            proxy_read_timeout 86400s;
            proxy_send_timeout 86400s;
          '';
        };
      };
    };
}
