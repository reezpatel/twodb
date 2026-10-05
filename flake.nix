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
            enable = lib.mkEnableOption "twodb runner (outbound agent)";

            package = lib.mkOption {
              type = lib.types.nullOr lib.types.package;
              default = self.packages.${config.nixpkgs.hostPlatform.system}.twodb-runner;
              defaultText = "flake twodb-runner for this system";
              description = "Native runner package — runs as a systemd service. Set to null for the container.";
            };

            image = lib.mkOption {
              type = lib.types.str;
              default = "ghcr.io/reezpatel/twodb-runner:latest";
              description = "Runner image to run (container mode; ignored when package is set).";
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

            systemd.services.twodb-runner = lib.mkIf (runnerCfg.enable && runnerCfg.package != null) {
              description = "twodb runner (native)";
              wantedBy = [ "multi-user.target" ];
              after = [ "network-online.target" ];
              wants = [ "network-online.target" ];

              environment = {
                TWODB_SERVER_URL = runnerCfg.serverUrl;
                TWODB_RUNNER_NAME = runnerCfg.runnerName;
              };

              serviceConfig = {
                ExecStart = "${runnerCfg.package}/bin/twodb-runner";
                DynamicUser = true;
                Restart = "always";
                RestartSec = "10s";
              }
              // lib.optionalAttrs (runnerCfg.environmentFile != null) {
                EnvironmentFile = [ "${runnerCfg.environmentFile}" ];
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

              (lib.mkIf (runnerCfg.enable && runnerCfg.package == null) {
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

      # nix-darwin: native runner via launchd (packages.twodb-runner).
      darwinModules.default =
        {
          config,
          lib,
          ...
        }:
        let
          cfg = config.services.twodb-runner;
          parseEnvFile =
            file:
            lib.listToAttrs (
              map
                (
                  l:
                  (
                    let
                      parts = lib.splitString "=" l;
                    in
                    {
                      name = builtins.head parts;
                      value = lib.concatStringsSep "=" (builtins.tail parts);
                    }
                  )
                )
                (
                  builtins.filter (l: l != "" && !lib.startsWith "#" l) (
                    lib.splitString "\n" (builtins.readFile file)
                  )
                )
            );
        in
        {
          options.services.twodb-runner = {
            enable = lib.mkEnableOption "twodb runner (launchd)";

            package = lib.mkOption {
              type = lib.types.package;
              default = self.packages.${config.nixpkgs.hostPlatform.system}.twodb-runner;
              defaultText = "flake twodb-runner for this system";
              description = "Runner package from the twodb flake.";
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

            environment = lib.mkOption {
              type = lib.types.attrsOf lib.types.str;
              default = { };
              description = "Extra environment for the runner.";
            };

            environmentFile = lib.mkOption {
              type = lib.types.nullOr lib.types.path;
              default = null;
              description = "KEY=VALUE file with secrets (TWODB_RUNNER_KEY).";
            };
          };

          config = lib.mkIf cfg.enable {
            launchd.daemons.twodb-runner = {
              serviceConfig = {
                ProgramArguments = [ "${cfg.package}/bin/twodb-runner" ];
                RunAtLoad = true;
                KeepAlive = true;
                EnvironmentVariables =
                  cfg.environment
                  // {
                    TWODB_SERVER_URL = cfg.serverUrl;
                    TWODB_RUNNER_NAME = cfg.runnerName;
                  }
                  // lib.optionalAttrs (cfg.environmentFile != null) (parseEnvFile cfg.environmentFile);
                StandardOutPath = "/var/log/twodb-runner.log";
                StandardErrorPath = "/var/log/twodb-runner.log";
              };
            };
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
        runnerVersion = "0.2.5";
        # node-pty is a native module — each system needs its platform tarball.
        runnerTarballFor =
          sys:
          let
            src =
              {
                x86_64-linux = {
                  os = "linux";
                  arch = "x64";
                  hash = "sha256-K6XyM4DIlb2Or7Vd1zM9iMns8TGcUex1IoF3K4xl6h8=";
                };
                aarch64-linux = {
                  os = "linux";
                  arch = "arm64";
                  hash = "sha256-SD6R12Gv6HV4IpY9T1ePhgzFeBVhKO95dEfHdca9E/0=";
                };
                aarch64-darwin = {
                  os = "macos";
                  arch = "arm64";
                  hash = "sha256-ot8XAW6Q8sCPw3OrhOTvU6Ya0J5pTDpXJHDZn4qA/6s=";
                };
                x86_64-darwin = {
                  os = "macos";
                  arch = "x64";
                  hash = "sha256-Go3CHfi4iZGqirhkSYTKwKbHu19GO2knHMvWgaksM8Q=";
                };
              }
              .${sys};
          in
          pkgs.fetchurl {
            url = "https://github.com/reezpatel/twodb/releases/download/v${runnerVersion}/twodb-runner_${runnerVersion}_${src.os}-${src.arch}.tar.gz";
            inherit (src) hash;
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
        # The server bundle is pure JS (no native modules) — the linux tarball
        # of the matching arch runs everywhere, darwin included.
        serverTarballFor = pkgs.fetchurl {
          url = "https://github.com/reezpatel/twodb/releases/download/v${runnerVersion}/twodb-server_${runnerVersion}_linux-${
            if pkgs.stdenv.hostPlatform.isAarch64 then "arm64" else "x64"
          }.tar.gz";
          hash =
            if pkgs.stdenv.hostPlatform.isAarch64 then
              "sha256-RqojFO6Rq6qhaeKd6t56IEPil644KFgos4ApsZpuH9c="
            else
              "sha256-ObfH7AtX/jk3mf/Dts5sfpq6weZRjuQMsIVa+k2NuDc=";
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
          twodb-runner = runnerPackage (runnerTarballFor system);
          twodb-server = serverPackage serverTarballFor;
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
