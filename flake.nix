{
  description = "TwoDB server and node agent release packaging";

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
          pkgs,
          ...
        }:
        let
          cfg = config.services.twodb-server;
        in
        {
          options.services.twodb-server = {
            enable = lib.mkEnableOption "twodb-server";

            package = lib.mkOption {
              type = lib.types.package;
              default = self.packages.${pkgs.system}.twodb-server;
              description = "twodb-server package to run.";
            };

            port = lib.mkOption {
              type = lib.types.port;
              default = 3001;
              description = "TCP port the server listens on.";
            };

            databaseUrl = lib.mkOption {
              type = lib.types.str;
              description = "PostgreSQL connection string.";
            };

            workDir = lib.mkOption {
              type = lib.types.str;
              default = "/var/lib/twodb";
              description = "Runtime data directory.";
            };
          };

          config = lib.mkIf cfg.enable {
            systemd.services.twodb-server = {
              description = "TwoDB server";
              after = [ "network-online.target" ];
              wants = [ "network-online.target" ];
              wantedBy = [ "multi-user.target" ];
              environment = {
                TWODB_DATABASE_URL = cfg.databaseUrl;
                TWODB_PORT = toString cfg.port;
                TWODB_WORK_DIR = cfg.workDir;
                TWODB_STATIC_DIR = "${cfg.package}/share/twodb/web-dist";
                TWODB_VENDOR_DIR = "${cfg.package}/share/twodb/vendor";
              };
              serviceConfig = {
                ExecStart = "${cfg.package}/bin/twodb-server";
                DynamicUser = true;
                StateDirectory = "twodb";
                Restart = "on-failure";
              };
            };
          };
        };
    }
    // flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        version = "0.1.0";
        placeholderHash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
        serverSrc = pkgs.fetchurl {
          url = "https://github.com/reezpatel/twodb/releases/download/v${version}/twodb-server-${version}.tar.gz";
          sha256 = placeholderHash;
        };
        nodeAsset =
          {
            "x86_64-linux" = "twodb-node-linux-x64";
            "x86_64-darwin" = "twodb-node-darwin-x64";
            "aarch64-darwin" = "twodb-node-darwin-arm64";
          }
          .${system} or (throw "twodb-node: unsupported system ${system}");
        nodeSrc = pkgs.fetchurl {
          url = "https://github.com/reezpatel/twodb/releases/download/v${version}/${nodeAsset}.tar.gz";
          sha256 = placeholderHash;
        };
      in
      {
        packages = {
          twodb-server = pkgs.stdenv.mkDerivation {
            pname = "twodb-server";
            inherit version;
            src = serverSrc;
            dontConfigure = true;
            dontBuild = true;
            installPhase = ''
              mkdir -p $out/share/twodb $out/bin
              cp -R server.mjs web-dist vendor plugins $out/share/twodb/
              cat > $out/bin/twodb-server <<EOF
              #!/bin/sh
              export TWODB_STATIC_DIR="$out/share/twodb/web-dist"
              export TWODB_VENDOR_DIR="$out/share/twodb/vendor"
              exec ${pkgs.nodejs_22}/bin/node $out/share/twodb/server.mjs
              EOF
              chmod +x $out/bin/twodb-server
            '';
          };

          twodb-node = pkgs.stdenv.mkDerivation {
            pname = "twodb-node";
            inherit version;
            src = nodeSrc;
            dontConfigure = true;
            dontBuild = true;
            dontStrip = true;
            installPhase = ''
              mkdir -p $out/bin
              install -m 0755 twodb-node $out/bin/twodb-node
            ''
            + pkgs.lib.optionalString pkgs.stdenv.hostPlatform.isLinux ''
              patchelf --set-interpreter ${pkgs.stdenv.cc.bintools.dynamicLinker} $out/bin/twodb-node || true
            '';
          };
        };
      }
    );
}
