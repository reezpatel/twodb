{
  stdenv,
  nodejs_22,
  pnpm_10,
  python3,
  makeWrapper,
}:

# twodb server: api (fastify, run from TS sources via tsx) + built web app.
# Mirrors the root Dockerfile: full install → build web → prod-only relink,
# then ship the workspace with its prod node_modules.
stdenv.mkDerivation (finalAttrs: {
  pname = "twodb";
  version = "0.0.0";

  src = ../.;

  nativeBuildInputs = [
    nodejs_22
    pnpm_10.configHook
    python3 # better-sqlite3 node-gyp build
    makeWrapper
  ];

  pnpmDeps = pnpm_10.fetchDeps {
    inherit (finalAttrs) pname version src;
    fetcherVersion = 4;
    hash = "sha256-AK4oCEACWvkaPUP1pQUqcfYRiJludsD+bN04gRjIVMg=";
  };

  env.CI = "true";

  buildPhase = ''
    runHook preBuild

    pnpm --filter twodb-api typecheck
    pnpm --filter twodb-web-app build

    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    # Slim the workspace to production deps before shipping.
    pnpm install --offline --frozen-lockfile --prod

    mkdir -p $out/share/twodb
    cp -r . $out/share/twodb/

    # The api resolves STATIC_DIR / TWO_DB_WORK_DIR relative to its own
    # sources, so cwd inside the tree keeps the packaged web app reachable.
    makeWrapper $out/share/twodb/apps/api/node_modules/.bin/tsx $out/bin/twodb-api \
      --add-flags "$out/share/twodb/apps/api/src/index.ts" \
      --chdir "$out/share/twodb/apps/api" \
      --set-default NODE_ENV production \
      --set-default TWO_DB_WORK_DIR /var/lib/twodb

    runHook postInstall
  '';

  meta = {
    description = "twodb server (api + web)";
    mainProgram = "twodb-api";
    platforms = [
      "x86_64-linux"
      "aarch64-linux"
    ];
  };
})
