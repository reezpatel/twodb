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

            extraEnvironment = lib.mkOption {
              type = lib.types.attrsOf lib.types.str;
              default = { };
              description = "Extra environment variables for the service (e.g. TWODB_ADMIN_RP_ID, TWODB_ADMIN_ORIGIN).";
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
                TWODB_PLUGINS_DIR = "${cfg.package}/share/twodb/plugins";
              }
              // cfg.extraEnvironment;
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
        version = "0.0.15";
        serverSrc = pkgs.fetchurl {
          url = "https://github.com/reezpatel/twodb/releases/download/v${version}/twodb-server-v${version}.tar.gz";
          sha256 = "063dicl8zxd13yhjwv37zwxjpk3zb7lwz1xxsw9q3pgzkvz42ivm";
        };
        nodeAsset =
          {
            "x86_64-linux" = "twodb-node-linux-x64";
            "aarch64-linux" = "twodb-node-linux-arm64";
            "x86_64-darwin" = "twodb-node-darwin-x64";
            "aarch64-darwin" = "twodb-node-darwin-arm64";
          }
          .${system} or (throw "twodb-node: unsupported system ${system}");
        nodeHash =
          {
            "x86_64-linux" = "1ah6bxf9sifi7gjhwk1lrk0bipy23hi21rl9vl9paar2jvq4zz12";
            "aarch64-linux" = "0is3fyvac8yplii63acdxl1mvqx4r7kr6piisxq3qpch338njkcn";
            "x86_64-darwin" = "0y6px4ymdwiy5rfqamydx151cncyc80kc9ggb41iqjrrh4yjcq3r";
            "aarch64-darwin" = "1qbalksdbk15khq4li4x90zpnk6l035ljlxj95j8y9s6fs7j269h";
          }
          .${system} or (throw "twodb-node: unsupported system ${system}");
        nodeSrc = pkgs.fetchurl {
          url = "https://github.com/reezpatel/twodb/releases/download/v${version}/${nodeAsset}";
          name = "twodb-node";
          sha256 = nodeHash;
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
            unpackPhase = ''
              sourceRoot=unpacked
              mkdir $sourceRoot
              tar -xzf $src -C $sourceRoot
            '';
            installPhase = ''
              mkdir -p $out/share/twodb $out/bin
              cp -R server.mjs web-dist vendor plugins $out/share/twodb/
              cat > $out/bin/twodb-server <<EOF
              #!/bin/sh
              export TWODB_STATIC_DIR="$out/share/twodb/web-dist"
              export TWODB_VENDOR_DIR="$out/share/twodb/vendor"
              export TWODB_PLUGINS_DIR="$out/share/twodb/plugins"
              exec ${pkgs.nodejs_22}/bin/node $out/share/twodb/server.mjs
              EOF
              chmod +x $out/bin/twodb-server
            '';
          };

          twodb-node = pkgs.stdenv.mkDerivation {
            pname = "twodb-node";
            inherit version;
            src = nodeSrc;
            dontUnpack = true;
            dontConfigure = true;
            dontBuild = true;
            dontStrip = true;
            installPhase = ''
              mkdir -p $out/bin
              install -m 0755 $src $out/bin/twodb-node
            ''
            + pkgs.lib.optionalString pkgs.stdenv.hostPlatform.isLinux ''
              patchelf --set-interpreter ${pkgs.stdenv.cc.bintools.dynamicLinker} $out/bin/twodb-node || true
            '';
          };
        };
      }
    );
}
