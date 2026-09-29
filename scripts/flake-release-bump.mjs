#!/usr/bin/env node
// Bumps flake.nix to a released version: runnerVersion + SRI hashes for the
// runner/server release tarballs. Used by the release workflow's flake-bump job.
//
//   node scripts/flake-release-bump.mjs <version> <tarball-dir>
//
// <version> without the leading "v" (e.g. 0.1.2). <tarball-dir> must contain
// twodb-runner_<version>_{linux,macos}-{x64,arm64}.tar.gz and
// twodb-server_<version>_linux-{x64,arm64}.tar.gz.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [version, dir] = process.argv.slice(2);
if (!version || !dir) {
  console.error("usage: node scripts/flake-release-bump.mjs <version> <tarball-dir>");
  process.exit(1);
}

const sri = (file) => `sha256-${createHash("sha256").update(readFileSync(file)).digest("base64")}`;

const tarball = (name) => {
  const path = join(dir, name);
  if (!existsSync(path)) {
    console.error(`missing release asset: ${name}`);
    process.exit(1);
  }
  return sri(path);
};

const runnerHashes = {
  "x86_64-linux": tarball(`twodb-runner_${version}_linux-x64.tar.gz`),
  "aarch64-linux": tarball(`twodb-runner_${version}_linux-arm64.tar.gz`),
  "aarch64-darwin": tarball(`twodb-runner_${version}_macos-arm64.tar.gz`),
  "x86_64-darwin": tarball(`twodb-runner_${version}_macos-x64.tar.gz`),
};
const serverHashes = {
  x64: tarball(`twodb-server_${version}_linux-x64.tar.gz`),
  arm64: tarball(`twodb-server_${version}_linux-arm64.tar.gz`),
};

const flakePath = new URL("../flake.nix", import.meta.url).pathname;
let flake = readFileSync(flakePath, "utf8");

const replace = (pattern, replacement, label) => {
  if (!pattern.test(flake)) {
    console.error(`flake.nix pattern not found: ${label}`);
    process.exit(1);
  }
  flake = flake.replace(pattern, replacement);
};

replace(/runnerVersion = "[^"]+"/, `runnerVersion = "${version}"`, "runnerVersion");
for (const [system, hash] of Object.entries(runnerHashes)) {
  replace(new RegExp(`(${system} = \\{[\\s\\S]*?hash = ")[^"]+`), `$1${hash}`, `runner ${system}`);
}
replace(/(serverTarballFor = pkgs\.fetchurl[\s\S]*?isAarch64 then\s*)"sha256-[^"]+"/, `$1"${serverHashes.arm64}"`, "server aarch64");
replace(/(serverTarballFor = pkgs\.fetchurl[\s\S]*?else\s*)"sha256-[^"]+"/, `$1"${serverHashes.x64}"`, "server x64");

writeFileSync(flakePath, flake);
console.log(`flake.nix bumped to v${version}`);
