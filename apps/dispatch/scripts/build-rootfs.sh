#!/usr/bin/env bash
# Builds the dispatch microvm rootfs: Ubuntu 24.04 squashfs -> ext4 image
# with the two-vm-agent baked in (starts via /etc/init/two-vm-agent.conf).
#
# Usage: build-rootfs.sh [out.ext4]
# Requires: docker (privileged only for mount, run from repo root)
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
FC_DIR="${FC_DIR:-$HOME/.local/share/twodb-dispatch/fc}"
SQUASHFS="${SQUASHFS:-$FC_DIR/ubuntu-24.04.squashfs}"
OUT="${1:-$FC_DIR/ubuntu-24.04.ext4}"
SIZE_MB="${SIZE_MB:-2048}"

[ -f "$SQUASHFS" ] || { echo "missing $SQUASHFS (see dispatch README)"; exit 1; }

# 1. build the guest agent (host arch = guest arch for now: x86_64).
#    CGO_ENABLED=0 is critical: a dynamic NixOS binary can't exec inside the
#    Ubuntu rootfs (no matching ld.so) — the guest agent must be static.
( cd "$REPO/apps/two-runner" && CGO_ENABLED=0 go build -o /tmp/two-vm-agent ./cmd/two-vm-agent )

# 2. build the ext4 in a throwaway container (needs mount for squashfs-extract)
docker run --rm --privileged \
  -v "$SQUASHFS:/src/rootfs.squashfs:ro" \
  -v /tmp/two-vm-agent:/src/two-vm-agent:ro \
  -v "$(dirname "$OUT"):/out" \
  -e SIZE_MB=$SIZE_MB \
  alpine:3.20 sh -exc '
    apk add --no-cache squashfs-tools e2fsprogs >/dev/null
    mkdir -p /work/root
    unsquashfs -q -d /work/root /src/rootfs.squashfs >/dev/null

    # guest agent: PID-file-less companion started by init
    install -m 0755 /src/two-vm-agent /work/root/usr/local/bin/two-vm-agent
    mkdir -p /work/root/app /work/root/etc/init.d
    cat > /work/root/etc/init.d/two-vm-agent <<"EOF"
#!/bin/sh
# starts as early as possible; vsock appears when the host connects.
(
  mkdir -p /app
  while true; do
    /usr/local/bin/two-vm-agent 2>>/var/log/two-vm-agent.log || sleep 1
  done
) &
EOF
    chmod +x /work/root/etc/init.d/two-vm-agent

    # systemd unit: the Ubuntu CI rootfs boots with systemd (/sbin/init ->
    # systemd), so the agent runs as a multi-user.target service.
    mkdir -p /work/root/etc/systemd/system/multi-user.target.wants
    cat > /work/root/etc/systemd/system/two-vm-agent.service <<'EOF2'
[Unit]
Description=TwoDB VM Agent (vsock :52)
After=local-fs.target

[Service]
Type=simple
ExecStart=/usr/local/bin/two-vm-agent
Restart=always
RestartSec=1
StandardOutput=journal+console
StandardError=journal+console

[Install]
WantedBy=multi-user.target
EOF2
    ln -sf /etc/systemd/system/two-vm-agent.service /work/root/etc/systemd/system/multi-user.target.wants/two-vm-agent.service

    truncate -s "${SIZE_MB}M" /out/rootfs.ext4.tmp
    mkfs.ext4 -q -F -L root /out/rootfs.ext4.tmp
    mkdir -p /mnt/root
    mount -t ext4 /out/rootfs.ext4.tmp /mnt/root
    trap "umount /mnt/root" EXIT
    cp -a /work/root/. /mnt/root/
    umount /mnt/root
    trap - EXIT
  '

mv "$(dirname "$OUT")/rootfs.ext4.tmp" "$OUT"
echo "rootfs ready: $OUT ($(du -h "$OUT" | cut -f1))"
