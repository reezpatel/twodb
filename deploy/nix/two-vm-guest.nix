# Microvm guest assets for two-runner, built entirely with Nix (no Docker, no manual downloads):
#
#   two-vm-agent   the guest agent, STATIC (CGO off) so it runs in any rootfs
#   two-vm-kernel  Firecracker's official CI guest kernel (virtio-blk + vsock built in)
#   two-vm-rootfs  ext4 image: busybox userland + the agent, started by /sbin/init
#
# Used by services.two-runner.microvm.enable (NixOS) — see two-runner-module.nix.
{
  pkgs,
  nixpkgs,
  src,
  version,
  # Size of the guest disk. Each microvm gets its own copy of this image, so keep it modest.
  rootfsSizeMiB ? 2048,
}:
let
  inherit (pkgs) lib;
  arch = if pkgs.stdenv.hostPlatform.isAarch64 then "aarch64" else "x86_64";

  agent = pkgs.buildGoModule {
    pname = "two-vm-agent";
    inherit version src;
    vendorHash = "sha256-MHi11CN4xvaJ9Tx0Ij/ZppYQAYL0lZ3xbC/4F7D5zvw=";
    subPackages = [ "cmd/two-vm-agent" ];
    env.CGO_ENABLED = "0";
    ldflags = [ "-s" "-w" ];
    meta = {
      description = "TwoDB microvm guest agent (static)";
      mainProgram = "two-vm-agent";
      platforms = lib.platforms.linux;
    };
  };

  kernel = pkgs.fetchurl {
    url = "https://s3.amazonaws.com/spec.ccfc.min/firecracker-ci/v1.12/${arch}/vmlinux-6.1.128";
    hash =
      {
        x86_64 = "sha256-J6gxC5pydRfp6wIERSS2zrd95XKONJG2l01chGIn7Mg=";
        aarch64 = "sha256-yxKRxmvKdbwRy5yDV/zvmWW7F4bf/LQqYJI8Pg5J8xk=";
      }
      .${arch};
    # fetchurl keeps the file name; the runner wants a plain file, so expose it under a stable name below.
  };

  busybox = pkgs.pkgsStatic.busybox;

  # PID 1: mount the pseudo filesystems, make /app, run the agent forever. vsock needs no network setup.
  init = pkgs.writeScript "two-vm-init" ''
    #!/bin/sh
    export PATH=/bin:/sbin
    mount -t proc proc /proc
    mount -t sysfs sys /sys
    mount -t devtmpfs dev /dev 2>/dev/null
    mkdir -p /dev/pts /tmp /app /root /run
    mount -t devpts devpts /dev/pts 2>/dev/null
    mount -t tmpfs tmpfs /tmp
    mount -t tmpfs tmpfs /run
    hostname twodb-vm
    export HOME=/root TERM=xterm-256color
    while true; do
      ${agent}/bin/two-vm-agent || true
      sleep 1
    done
  '';

  fs = pkgs.callPackage "${nixpkgs}/nixos/lib/make-ext4-fs.nix" {
    inherit pkgs;
    inherit lib;
    storePaths = [ busybox agent init ];
    volumeLabel = "root";
    populateImageCommands = ''
      mkdir -p files/sbin files/bin files/usr/bin files/proc files/sys files/dev files/tmp files/run files/app files/root files/etc
      ln -s ${init} files/sbin/init
      # busybox applets (sh, ls, cat, grep, tar, ...) on PATH
      for a in $(${busybox}/bin/busybox --list); do ln -sf ${busybox}/bin/busybox files/bin/$a; done
      echo "root:x:0:0:root:/root:/bin/sh" > files/etc/passwd
      echo "root:x:0:" > files/etc/group
    '';
  };

  rootfs = pkgs.runCommand "two-vm-rootfs-${version}" { nativeBuildInputs = [ pkgs.e2fsprogs ]; } ''
    cp ${fs} rootfs.ext4
    chmod u+w rootfs.ext4
    e2fsck -fy rootfs.ext4 >/dev/null || true
    resize2fs rootfs.ext4 ${toString rootfsSizeMiB}M >/dev/null
    install -Dm444 rootfs.ext4 $out/rootfs.ext4
  '';
in
{
  two-vm-agent = agent;
  two-vm-kernel = pkgs.runCommand "two-vm-kernel-6.1.128" { } ''
    install -Dm444 ${kernel} $out/vmlinux
  '';
  two-vm-rootfs = rootfs;
}
