#!/usr/bin/env bash
# Android release signing key — generate, publish to GitHub Actions secrets,
# and back up to Proton Pass.
#
#   scripts/android-signing.sh generate   # new keystore in .secrets/android (never overwrites)
#   scripts/android-signing.sh github     # upload to GitHub secrets (gh CLI)
#   scripts/android-signing.sh backup     # store in Proton Pass (pass-cli; run `pass-cli login` first)
#   scripts/android-signing.sh restore    # recreate .secrets/android from the Proton Pass note
#
# Every APK update must be signed with the SAME key — lose it and users have
# to uninstall/reinstall. Keep the Proton Pass backup. .secrets/ is gitignored.
#
# pass-cli isn't required to be installed: falls back to `nix shell nixpkgs#proton-pass-cli`.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="$ROOT/.secrets/android"
KEYSTORE="$DIR/twodb-release.jks"
ENV_FILE="$DIR/signing.env"
ALIAS="twodb"
ITEM_TITLE="twodb android release keystore"

pass_cli() {
  if command -v pass-cli >/dev/null 2>&1; then pass-cli "$@"
  else nix shell nixpkgs#proton-pass-cli -c pass-cli "$@"; fi
}

load() {
  [[ -f "$KEYSTORE" && -f "$ENV_FILE" ]] || { echo "no keystore in $DIR — run '$0 generate' or '$0 restore'" >&2; exit 1; }
  # shellcheck disable=SC1090
  source "$ENV_FILE"
}

cmd_generate() {
  if [[ -f "$KEYSTORE" ]]; then echo "keystore already exists: $KEYSTORE (refusing to overwrite)"; return; fi
  mkdir -p "$DIR" && chmod 700 "$DIR"
  local pw; pw="$(python3 -c 'import secrets; print(secrets.token_urlsafe(30))')"
  keytool -genkeypair -v -keystore "$KEYSTORE" -storetype PKCS12 \
    -alias "$ALIAS" -keyalg RSA -keysize 4096 -validity 10000 \
    -storepass "$pw" -keypass "$pw" \
    -dname "CN=twodb, O=twodb, C=US" >/dev/null 2>&1
  chmod 600 "$KEYSTORE"
  # PKCS12 uses one password for store + key
  printf 'ANDROID_KEY_ALIAS=%q\nANDROID_KEYSTORE_PASSWORD=%q\nANDROID_KEY_PASSWORD=%q\n' "$ALIAS" "$pw" "$pw" > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "generated $KEYSTORE"
  keytool -list -keystore "$KEYSTORE" -storepass "$pw" -alias "$ALIAS" 2>/dev/null | grep -i "SHA-256\|fingerprint" | head -2
}

cmd_github() {
  load
  base64 -w0 "$KEYSTORE" | gh secret set ANDROID_KEYSTORE_BASE64
  printf %s "$ANDROID_KEYSTORE_PASSWORD" | gh secret set ANDROID_KEYSTORE_PASSWORD
  printf %s "$ANDROID_KEY_PASSWORD" | gh secret set ANDROID_KEY_PASSWORD
  printf %s "$ANDROID_KEY_ALIAS" | gh secret set ANDROID_KEY_ALIAS
  echo "GitHub secrets set: ANDROID_KEYSTORE_BASE64 ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_PASSWORD ANDROID_KEY_ALIAS"
}

cmd_backup() {
  load
  local note
  note="$(printf 'twodb Android release signing key (PKCS12)\nrestore: scripts/android-signing.sh restore\n\nANDROID_KEY_ALIAS=%s\nANDROID_KEYSTORE_PASSWORD=%s\nANDROID_KEY_PASSWORD=%s\n\nKEYSTORE_BASE64:\n%s\n' \
    "$ANDROID_KEY_ALIAS" "$ANDROID_KEYSTORE_PASSWORD" "$ANDROID_KEY_PASSWORD" "$(base64 -w0 "$KEYSTORE")")"
  pass_cli item create note ${PASS_VAULT:+--vault-name "$PASS_VAULT"} --title "$ITEM_TITLE" --note "$note"
  echo "backed up to Proton Pass: \"$ITEM_TITLE\"${PASS_VAULT:+ (vault $PASS_VAULT)}"
}

cmd_restore() {
  if [[ -f "$KEYSTORE" ]]; then echo "keystore already exists: $KEYSTORE (refusing to overwrite)"; exit 1; fi
  mkdir -p "$DIR" && chmod 700 "$DIR"
  local note
  note="$(pass_cli item view ${PASS_VAULT:+--vault-name "$PASS_VAULT"} --item-title "$ITEM_TITLE" --output json)"
  note="$(printf %s "$note" | python3 -c 'import json,sys
d=json.load(sys.stdin)
def find(o):
    if isinstance(o,str) and "KEYSTORE_BASE64:" in o: return o
    if isinstance(o,dict):
        for v in o.values():
            r=find(v)
            if r: return r
    if isinstance(o,list):
        for v in o:
            r=find(v)
            if r: return r
print(find(d) or "")')"
  [[ -n "$note" ]] || { echo "couldn't find the keystore note in Proton Pass" >&2; exit 1; }
  printf %s "$note" | sed -n '/^KEYSTORE_BASE64:/{n;p;}' | base64 -d > "$KEYSTORE"
  printf %s "$note" | grep -E '^ANDROID_(KEY_ALIAS|KEYSTORE_PASSWORD|KEY_PASSWORD)=' | while IFS='=' read -r k v; do printf '%s=%q\n' "$k" "$v"; done > "$ENV_FILE"
  chmod 600 "$KEYSTORE" "$ENV_FILE"
  load
  keytool -list -keystore "$KEYSTORE" -storepass "$ANDROID_KEYSTORE_PASSWORD" -alias "$ANDROID_KEY_ALIAS" >/dev/null && echo "restored $KEYSTORE"
}

case "${1:-}" in
  generate) cmd_generate ;;
  github) cmd_github ;;
  backup) cmd_backup ;;
  restore) cmd_restore ;;
  *) sed -n '2,13p' "$0"; exit 1 ;;
esac
