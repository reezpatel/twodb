# two-runner as a service: NixOS (systemd) and nix-darwin (launchd) modules.
#
#   inputs.twodb.url = "github:reezpatel/twodb";
#   imports = [ inputs.twodb.nixosModules.two-runner ];      # or darwinModules.two-runner
#
#   services.two-runner = {
#     enable = true;
#     gateway = "https://twodb.example.com";        # any address that reaches the TwoDB gateway, e.g. a NetBird name/IP:
#                                                   #   "http://slayer.lan.nb:6400"  (private mesh — nothing public needed)
#     name = "build-box";                           # defaults to the hostname
#     enrollTokenFile = config.age.secrets.twodb-enroll.path;   # file with a twodbenroll_... token (Dispatch → enrollment tokens)
#   };
#
# Enrollment: the token is used ONLY while the machine has no runner key yet. The first connect mints a per-runner key
# that is persisted in the state dir (/var/lib/two-runner); restarts reuse it, so a token that stays in the config never
# creates duplicate runners. If the runner is deleted in Dispatch the stale key is rejected and the machine enrolls again.
#
# Microvms (NixOS only — Firecracker needs Linux + /dev/kvm; macOS runners simply run commands, jobs and terminals): `microvm = true;` — the kernel, rootfs and static guest agent come from this flake
# (packages.two-vm-kernel / two-vm-rootfs / two-vm-agent); override with microvm.kernel / microvm.rootfs.
#
# Secrets are never copied into the Nix store: only the PATH of the token/key file is configured. On NixOS the file is
# handed to the (unprivileged) service with systemd LoadCredential, so root-owned agenix/sops files work as-is.
{ self }:
let
  options =
    { lib, pkgs, config }:
    {
      enable = lib.mkEnableOption "two-runner, the machine-side agent for TwoDB Dispatch";

      package = lib.mkOption {
        type = lib.types.package;
        default = self.packages.${pkgs.stdenv.hostPlatform.system}.two-runner;
        defaultText = "the flake's two-runner for this system";
        description = "The two-runner package.";
      };

      gateway = lib.mkOption {
        type = lib.types.str;
        example = "http://slayer.lan.nb:6400";
        description = ''
          URL of the TwoDB gateway (the console host). Any address that reaches it works, including a private NetBird
          name or IP, so the gateway does not have to be reachable from the internet. Use https:// when it is public.
        '';
      };

      name = lib.mkOption {
        type = lib.types.str;
        default = config.networking.hostName;
        defaultText = "config.networking.hostName";
        description = "Runner name shown in Dispatch.";
      };

      enrollTokenFile = lib.mkOption {
        type = lib.types.nullOr lib.types.path;
        default = null;
        example = "/run/agenix/twodb-enroll";
        description = ''
          File containing an enrollment token (twodbenroll_...). Create one in Dispatch → Enrollment tokens. One token
          can enroll any number of machines. Only used until the machine has its own runner key.
        '';
      };

      keyFile = lib.mkOption {
        type = lib.types.nullOr lib.types.path;
        default = null;
        description = ''
          File containing a per-runner key (twodbrun_...) created with "Add runner" in Dispatch. Alternative to
          enrollTokenFile; when set it is always used and nothing is persisted.
        '';
      };

      stateDir = lib.mkOption {
        type = lib.types.str;
        default = "/var/lib/two-runner";
        description = "Where the runner keeps its key and microvm state.";
      };

      extraArgs = lib.mkOption {
        type = lib.types.listOf lib.types.str;
        default = [ ];
        description = "Extra command line arguments for two-runner.";
      };

      extraPackages = lib.mkOption {
        type = lib.types.listOf lib.types.package;
        default = [ ];
        description = "Packages added to PATH of the commands Dispatch runs on this machine.";
      };
    };

  basePackages = pkgs: with pkgs; [ bashInteractive coreutils findutils gnugrep gnused git ];
in
{
  nixos =
    { config, lib, pkgs, ... }:
    let
      cfg = config.services.two-runner;
    in
    {
      options.services.two-runner = options { inherit lib pkgs config; } // {
      microvm = lib.mkOption {
        description = ''
          Host Firecracker microvms on this machine (Linux with /dev/kvm only). `microvm = true;` is shorthand for
          `microvm.enable = true;`. The guest assets (static agent, Firecracker kernel, busybox rootfs) are built by
          Nix — nothing to download or build by hand.
        '';
        default = { };
        example = lib.literalExpression "{ enable = true; }";
        type = lib.types.coercedTo lib.types.bool (enable: { inherit enable; }) (
          lib.types.submodule {
            options = {
              enable = lib.mkEnableOption "hosting Firecracker microvms (needs /dev/kvm)";
              kernel = lib.mkOption {
                type = lib.types.path;
                default = "${self.packages.${pkgs.stdenv.hostPlatform.system}.two-vm-kernel}/vmlinux";
                defaultText = "the flake's two-vm-kernel (Firecracker CI kernel 6.1)";
                description = "Uncompressed guest kernel (vmlinux) passed as TWO_RUNNER_KERNEL.";
              };
              rootfs = lib.mkOption {
                type = lib.types.path;
                default = "${self.packages.${pkgs.stdenv.hostPlatform.system}.two-vm-rootfs}/rootfs.ext4";
                defaultText = "the flake's two-vm-rootfs (busybox + two-vm-agent, 2 GiB ext4)";
                description = ''
                  Guest root filesystem (ext4) passed as TWO_RUNNER_ROOTFS. Every microvm boots from its own copy.
                  Replace it to give guests more tools (it must contain a static two-vm-agent started by /sbin/init).
                '';
              };
              firecracker = lib.mkOption {
                type = lib.types.package;
                default = pkgs.firecracker;
                defaultText = "pkgs.firecracker";
                description = "Firecracker package (its binary is passed as TWO_RUNNER_FC_BIN).";
              };
            };
          }
        );
      };

        user = lib.mkOption {
          type = lib.types.str;
          default = "two-runner";
          description = ''
            User the runner (and every command Dispatch runs) executes as. The default is an unprivileged system user
            created for you; set e.g. your own user to let jobs use that account's files, or "root" for full access.
          '';
        };
        group = lib.mkOption {
          type = lib.types.str;
          default = "two-runner";
          description = "Group of the runner service.";
        };
        extraGroups = lib.mkOption {
          type = lib.types.listOf lib.types.str;
          default = [ ];
          example = [ "docker" ];
          description = "Extra groups for the default two-runner user.";
        };
        after = lib.mkOption {
          type = lib.types.listOf lib.types.str;
          default = [ ];
          example = [ "netbird-default.service" ];
          description = "Extra units to start after, e.g. the NetBird client when the gateway is on the mesh. The runner also retries every 5 s.";
        };
      };

      config = lib.mkIf cfg.enable {
        assertions = [
          {
            assertion = cfg.enrollTokenFile != null || cfg.keyFile != null;
            message = "services.two-runner needs enrollTokenFile (or keyFile).";
          }
        ];

        users.users = lib.mkIf (cfg.user == "two-runner") {
          two-runner = {
            isSystemUser = true;
            group = cfg.group;
            home = cfg.stateDir;
            extraGroups = cfg.extraGroups ++ lib.optional cfg.microvm.enable "kvm";
          };
        };
        users.groups = lib.mkIf (cfg.group == "two-runner") { two-runner = { }; };

        systemd.services.two-runner = {
          description = "TwoDB Dispatch runner";
          wantedBy = [ "multi-user.target" ];
          after = [ "network-online.target" ] ++ cfg.after;
          wants = [ "network-online.target" ];
          path = basePackages pkgs ++ cfg.extraPackages;
          environment = {
            HOME = cfg.stateDir;
          } // lib.optionalAttrs cfg.microvm.enable {
            TWO_RUNNER_FC_BIN = "${cfg.microvm.firecracker}/bin/firecracker";
            TWO_RUNNER_KERNEL = toString cfg.microvm.kernel;
            TWO_RUNNER_ROOTFS = toString cfg.microvm.rootfs;
          };

          serviceConfig = {
            ExecStart = lib.escapeShellArgs (
              [ "${cfg.package}/bin/two-runner" "--gateway" cfg.gateway "--name" cfg.name "--state" cfg.stateDir ]
              ++ lib.optionals (cfg.enrollTokenFile != null) [ "--enroll-file" "%d/enroll" ]
              ++ lib.optionals (cfg.keyFile != null) [ "--key-file" "%d/key" ]
              ++ lib.optional cfg.microvm.enable "--microvm"
              ++ cfg.extraArgs
            );
            LoadCredential =
              lib.optional (cfg.enrollTokenFile != null) "enroll:${toString cfg.enrollTokenFile}"
              ++ lib.optional (cfg.keyFile != null) "key:${toString cfg.keyFile}";
            User = cfg.user;
            Group = cfg.group;
            StateDirectory = lib.removePrefix "/var/lib/" cfg.stateDir;
            StateDirectoryMode = "0700";
            Restart = "always";
            RestartSec = "5s";
            # Commands Dispatch runs are arbitrary by design, so the unit is deliberately not sandboxed further.
          };
        };
      };
    };

  darwin =
    { config, lib, pkgs, ... }:
    let
      cfg = config.services.two-runner;
    in
    {
      options.services.two-runner = options { inherit lib pkgs config; } // {
        user = lib.mkOption {
          type = lib.types.nullOr lib.types.str;
          default = null;
          description = "User to run the daemon as. null = root (launchd's default); prefer a dedicated user.";
        };
      };

      config = lib.mkIf cfg.enable {
        assertions = [
          {
            assertion = cfg.enrollTokenFile != null || cfg.keyFile != null;
            message = "services.two-runner needs enrollTokenFile (or keyFile).";
          }
        ];

        system.activationScripts.postActivation.text = ''
          mkdir -p ${lib.escapeShellArg cfg.stateDir}
          chmod 700 ${lib.escapeShellArg cfg.stateDir}
          ${lib.optionalString (cfg.user != null) "chown ${lib.escapeShellArg cfg.user} ${lib.escapeShellArg cfg.stateDir}"}
        '';

        launchd.daemons.two-runner.serviceConfig = {
          ProgramArguments =
            [ "${cfg.package}/bin/two-runner" "--gateway" cfg.gateway "--name" cfg.name "--state" cfg.stateDir ]
            ++ lib.optionals (cfg.enrollTokenFile != null) [ "--enroll-file" (toString cfg.enrollTokenFile) ]
            ++ lib.optionals (cfg.keyFile != null) [ "--key-file" (toString cfg.keyFile) ]
            ++ cfg.extraArgs;
          EnvironmentVariables = {
            HOME = cfg.stateDir;
            PATH = lib.makeBinPath (basePackages pkgs ++ cfg.extraPackages) + ":/usr/bin:/bin:/usr/sbin:/sbin";
          };
          RunAtLoad = true;
          KeepAlive = true;
          StandardOutPath = "/var/log/two-runner.log";
          StandardErrorPath = "/var/log/two-runner.log";
        } // lib.optionalAttrs (cfg.user != null) { UserName = cfg.user; };
      };
    };
}
