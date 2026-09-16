{
  config,
  lib,
  ...
}:

let
  cfg = config.services.twodb;
in
{
  options.services.twodb = {
    enable = lib.mkEnableOption "twodb server";

    package = lib.mkOption {
      type = lib.types.package;
      description = "The twodb package to run.";
    };

    port = lib.mkOption {
      type = lib.types.port;
      default = 3001;
      description = "HTTP port the api listens on.";
    };

    environment = lib.mkOption {
      type = lib.types.attrsOf lib.types.str;
      default = { };
      example = {
        DATABASE_URL = "postgres://twodb:twodb@localhost:5432/twodb";
        MEMGRAPH_URL = "bolt://localhost:7687";
        TWODB_ADMIN_RP_ID = "twodb.example.com";
        TWODB_ADMIN_ORIGIN = "https://twodb.example.com";
      };
      description = "Environment variables for the api (see apps/api/src/config.ts).";
    };

    environmentFile = lib.mkOption {
      type = lib.types.nullOr lib.types.path;
      default = null;
      description = "File with extra env vars (secrets); loaded by systemd.";
    };

    openFirewall = lib.mkOption {
      type = lib.types.bool;
      default = false;
      description = "Open the api port in the firewall.";
    };
  };

  config = lib.mkIf cfg.enable {
    systemd.services.twodb = {
      description = "twodb server";
      wantedBy = [ "multi-user.target" ];
      after = [ "network.target" ];

      environment = {
        PORT = toString cfg.port;
        TWO_DB_WORK_DIR = "%S/twodb";
      }
      // cfg.environment;

      serviceConfig = {
        ExecStart = "${cfg.package}/bin/twodb-api";
        Restart = "on-failure";
        DynamicUser = true;
        StateDirectory = "twodb";
        EnvironmentFile = lib.optional (cfg.environmentFile != null) cfg.environmentFile;
        # hardening
        NoNewPrivileges = true;
        ProtectSystem = "strict";
        ProtectHome = true;
        PrivateTmp = true;
      };
    };

    networking.firewall.allowedTCPPorts = lib.mkIf cfg.openFirewall [ cfg.port ];
  };
}
