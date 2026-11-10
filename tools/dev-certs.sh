#!/usr/bin/env bash
# Generates a trusted dev cert for the webapp HTTPS dev servers.
#
# Browsers hard-fail WebSocket connections on untrusted certs — no click-
# through like pages get — so Vite HMR over WSS needs a locally-trusted
# cert, not the throwaway self-signed one @vitejs/plugin-basic-ssl makes.
# WebAuthn also needs a real hostname (IP RP IDs are spec-illegal), so dev
# uses divine.local / 192.168.2.5.
#
# One-time setup: run `mkcert -install` so this machine's browser trusts
# the local CA. Then run this script (uses nixpkgs mkcert if mkcert isn't
# on PATH). Certs land in .dev-certs/ (gitignored).
set -euo pipefail
cd "$(dirname "$0")/.."

MKCERT="mkcert"
command -v mkcert >/dev/null 2>&1 || MKCERT="nix run nixpkgs#mkcert --"

mkdir -p .dev-certs
$MKCERT -install
# nixpkgs mkcert is old: -cert-file/-key-file instead of -certfile/-keyfile
$MKCERT -cert-file .dev-certs/dev.pem -key-file .dev-certs/dev-key.pem \
  divine.local localhost 192.168.2.5 127.0.0.1 \
  || $MKCERT -certfile .dev-certs/dev.pem -keyfile .dev-certs/dev-key.pem \
  divine.local localhost 192.168.2.5 127.0.0.1
cp "$(mkcert -CAROOT 2>/dev/null || echo ~/.local/share/mkcert)/rootCA.pem" .dev-certs/rootCA.pem

echo
echo "Trusted cert written to .dev-certs/ (valid ~4 years)."
echo "If other devices browse the dev server, import .dev-certs/rootCA.pem in their browser/OS trust store."
