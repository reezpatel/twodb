{
  description = "TwoDB — server, runner and desktop app";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    {
      nixosModules.default =
        {
          config,
          lib,
          ...
        }:
        let
          serverCfg = config.services.twodb-server;
          runnerCfg = config.services.twodb-runner;
        in
        {
          options.services.twodb-server = {
            enable = lib.mkEnableOption "twodb server (API + web UI)";

            package = lib.mkOption {
              type = lib.types.nullOr lib.types.package;
              default = null;
              description = ''
                Native nix package for the server (the flake's packages output,
                e.g. twodb.packages.x86_64-linux.twodb-server).
                When set, the server runs as a systemd service — no container.
                When null, the OCI container image below is used instead.
              '';
            };

            image = lib.mkOption {
              type = lib.types.str;
              default = "ghcr.io/reezpatel/twodb:latest";
              description = "Server image to run (container mode; ignored when package is set).";
            };

            port = lib.mkOption {
              type = lib.types.port;
              default = 3001;
              description = "Host port for the web UI + API.";
            };

            environment = lib.mkOption {
              type = lib.types.attrsOf lib.types.str;
              default = { };
              description = ''
                Environment for the server, e.g. TWODB_DATABASE_URL,
                MEMGRAPH_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL.
              '';
            };

            environmentFile = lib.mkOption {
              type = lib.types.nullOr lib.types.path;
              default = null;
              description = "File with secrets (TWODB_DATABASE_URL, BETTER_AUTH_SECRET, …).";
            };
          };

          options.services.twodb-runner = {
            enable = lib.mkEnableOption "twodb runner (outbound agent container)";

            image = lib.mkOption {
              type = lib.types.str;
              default = "ghcr.io/reezpatel/twodb-runner:latest";
              description = "Runner image to run.";
            };

            serverUrl = lib.mkOption {
              type = lib.types.str;
              default = "http://localhost:3001";
              description = "Server the runner connects to (outbound WebSocket).";
            };

            runnerName = lib.mkOption {
              type = lib.types.str;
              default = config.networking.hostName;
              description = "Runner name shown in Settings → Runners.";
            };

            environmentFile = lib.mkOption {
              type = lib.types.nullOr lib.types.path;
              default = null;
              description = "File containing TWODB_RUNNER_KEY (from Settings → Runners).";
            };
          };

          config = {
            systemd.services.twodb-server = lib.mkIf (serverCfg.enable && serverCfg.package != null) {
              description = "twodb server (native)";
              wantedBy = [ "multi-user.target" ];
              after = [ "network-online.target" ];
              wants = [ "network-online.target" ];

              environment = serverCfg.environment // {
                TWODB_PORT = toString serverCfg.port;
              };

              serviceConfig = {
                ExecStart = "${serverCfg.package}/bin/twodb-server";
                DynamicUser = true;
                Restart = "on-failure";
                RestartSec = "5s";
              }
              // lib.optionalAttrs (serverCfg.environmentFile != null) {
                EnvironmentFile = [ "${serverCfg.environmentFile}" ];
              };
            };

            virtualisation.oci-containers.containers = lib.mkMerge [
              (lib.mkIf (serverCfg.enable && serverCfg.package == null) {
                twodb-server = {
                  image = serverCfg.image;
                  ports = [ "${toString serverCfg.port}:3001" ];
                  environment = serverCfg.environment;
                  environmentFiles = lib.optional (serverCfg.environmentFile != null) serverCfg.environmentFile;
                  autoStart = true;
                  extraOptions = [ "--health-cmd=curl -fsS http://localhost:3001/api/health || exit 1" ];
                };
              })

              (lib.mkIf runnerCfg.enable {
                twodb-runner = {
                  image = runnerCfg.image;
                  # Host networking so the runner can reach a server on the host
                  # (or anywhere) without NAT/firewalls in the way.
                  extraOptions = [
                    "--network=host"
                  ];
                  environment = {
                    TWODB_SERVER_URL = runnerCfg.serverUrl;
                    TWODB_RUNNER_NAME = runnerCfg.runnerName;
                  };
                  environmentFiles = lib.optional (runnerCfg.environmentFile != null) runnerCfg.environmentFile;
                  autoStart = true;
                };
              })
            ];
          };
        };
    }
    // flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        # Native runner package built from the release tarball (node-pty is a
        # native module, so each platform's tarball carries its own build).
        # Bump runnerVersion -- and the hashes, which `nix build` prints -- per release.
        runnerVersion = "0.1.1";
        runnerTarball =
          arch:
          pkgs.fetchurl {
            url = "https://github.com/reezpatel/twodb/releases/download/v${runnerVersion}/twodb-runner_${runnerVersion}_linux-${arch}.tar.gz";
            hash =
              if arch == "x64" then "sha256-pQslGHHpv0q8e9RSahALAXeR/Z5bT3QV8aEvOsM+w1Q="
              else "sha256-y8JeH+Ouuw/mcHPqT4CACXqM5tn55DP1deHkmTAxQcM=";
          };
        runnerPackage =
          src:
          pkgs.stdenv.mkDerivation {
            pname = "twodb-runner";
            version = runnerVersion;
            inherit src;

            nativeBuildInputs = [ pkgs.makeWrapper ];

            installPhase = ''
              runHook preInstall
              mkdir -p $out/libexec $out/bin
              cp -r . "$out/libexec"
              makeWrapper ${pkgs.nodejs_22}/bin/node $out/bin/twodb-runner \
                --add-flags "$out/libexec/node_modules/tsx/dist/cli.mjs" \
                --add-flags "$out/libexec/src/index.ts"
              find "$out" -xtype l -delete
              runHook postInstall
            '';

            meta.mainProgram = "twodb-runner";
          };

        # Same tarball pattern for the server (ships the web UI in public/).
        serverTarball =
          arch:
          pkgs.fetchurl {
            url = "https://github.com/reezpatel/twodb/releases/download/v${runnerVersion}/twodb-server_${runnerVersion}_linux-${arch}.tar.gz";
            hash =
              if arch == "x64" then "sha256-9IvYaVNhYU6e5TZxNw29rmAPT69lDrSEI6FOER3qOq0="
              else "sha256-6hkp7AZBVlJYUKHYmzA3QvY6tx2juL7SIRJyN7s1TMA=";
          };
        serverPackage =
          src:
          pkgs.stdenv.mkDerivation {
            pname = "twodb-server";
            version = runnerVersion;
            inherit src;

            nativeBuildInputs = [ pkgs.makeWrapper ];

            installPhase = ''
              runHook preInstall
              mkdir -p $out/libexec $out/bin
              cp -r . "$out/libexec"
              makeWrapper ${pkgs.nodejs_22}/bin/node $out/bin/twodb-server \
                --set TWODB_STATIC_DIR "$out/libexec/public" \
                --add-flags "$out/libexec/node_modules/tsx/dist/cli.mjs" \
                --add-flags "$out/libexec/src/index.ts"
              find "$out" -xtype l -delete
              runHook postInstall
            '';

            meta.mainProgram = "twodb-server";
          };
      in
      {
        packages = {
          twodb-runner = runnerPackage (runnerTarball "x64");
          twodb-runner-aarch64 = runnerPackage (runnerTarball "arm64");
          twodb-server = serverPackage (serverTarball "x64");
          twodb-server-aarch64 = serverPackage (serverTarball "arm64");
        };

        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_22
            pnpm
            cargo
            rustc
            pkg-config
            gobject-introspection
            glib
            gtk3
            gdk-pixbuf
            cairo
            pango
            atk
            libsoup_3
            webkitgtk_4_1
            openssl
            glib-networking
            librsvg
            dbus
          ];
          shellHook = ''
            export XDG_DATA_DIRS="$GSETTINGS_SCHEMAS_PATH:$XDG_DATA_DIRS"
          '';
        };
      }
    );
}
