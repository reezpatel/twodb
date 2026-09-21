// Builds the plugin into .build/ — the same layout the api expects from a
// published npm package:
//
//   .build/
//     package.json      common file: name, version, twodb manifest, exports
//     service/main.js   node ESM bundle; bare imports stay external and are
//                       resolved from node_modules at runtime
//     view/main.js      browser ESM bundle; everything inlined except react
//     view/styles.css   only emitted when the view imports css (≤2 files)
//
// `node build.mjs` builds once; `node build.mjs --watch` (the dev script)
// rebuilds on change.
//
import { context } from "esbuild";
import { transformSync } from "@babel/core";
import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const watch = process.argv.includes("--watch");
const root = path.dirname(fileURLToPath(import.meta.url));
const outdir = path.join(root, ".build");

await fs.rm(outdir, { recursive: true, force: true });

async function readJson(file) {
  let raw;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch (err) {
    throw new Error(`cannot read ${path.basename(file)}: ${err.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`invalid json in ${path.basename(file)}: ${err.message}`);
  }
}

const pkg = await readJson(path.join(root, "package.json"));

const styledJsx = {
  name: "styled-jsx",
  setup(b) {
    b.onLoad({ filter: /\.(jsx|tsx)$|\.style\.ts$/ }, (args) => {
      const code = readFileSync(args.path, "utf8");
      const result = transformSync(code, {
        babelrc: false,
        configFile: false,
        plugins: ["styled-jsx/babel"],
        sourceFileName: args.path,
        parserOpts: { sourceType: "module", plugins: ["typescript", "jsx"] },
      });
      return { contents: result.code, loader: path.extname(args.path).slice(1) };
    });
  },
};

const dropFonts = {
  name: "drop-fontsource",
  setup(b) {
    b.onLoad({ filter: /\.css$/ }, (args) => {
      if (!args.path.includes("fontsource")) return null;
      return { contents: "", loader: "css" };
    });
  },
};

// Runs after every successful view build: normalize the css name and write
// the bundle package.json (its exports depend on whether styles exist).
async function finalize() {
  // esbuild emits imported css as <entry>.css next to the bundle.
  let hasStyles = false;
  try {
    await fs.rename(path.join(outdir, "view/main.css"), path.join(outdir, "view/styles.css"));
    hasStyles = true;
  } catch {
    // no css imported by the view — drop a stale styles.css if a rebuild
    // removed the last css import
    await fs.rm(path.join(outdir, "view/styles.css"), { force: true });
  }

  const outPkg = {
    name: pkg.name,
    version: pkg.version,
    description: pkg.twodb?.description,
    type: "module",
    twodb: pkg.twodb,
    exports: {
      "./service": "./service/main.js",
      "./view": "./view/main.js",
      ...(hasStyles ? { "./view/styles.css": "./view/styles.css" } : {}),
    },
    // Runtime deps of the externalized service bundle, so an npm install of
    // this package pulls in everything service/main.js imports.
    dependencies: pkg.dependencies ?? {},
  };

  await fs.writeFile(path.join(outdir, "package.json"), JSON.stringify(outPkg, null, "\t") + "\n");

  console.log(`built ${pkg.name}@${pkg.version} -> .build/ (view styles: ${hasStyles ? "yes" : "none"})`);
}

const finalizeOnEnd = {
  name: "finalize-on-end",
  setup(b) {
    b.onEnd(async (result) => {
      if (result.errors.length === 0) await finalize();
    });
  },
};

// Service: bundle local sources, keep package imports external so the api
// shares one instance of fastify / @twodb/shared-backend / etc. with us.
const service = await context({
  entryPoints: [path.join(root, "service/index.ts")],
  outfile: path.join(outdir, "service/main.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  banner: {
    js: "import { createRequire as __cr } from \"node:module\";const require=__cr(import.meta.url);",
  },
  sourcemap: "inline",
  external: ["pg-native"],
});

// View: self-contained except react/react-dom, which must be the shell's own
// copies (a second react copy breaks hooks). The shell resolves these bare
// imports when it loads the bundle.
const view = await context({
  entryPoints: [path.join(root, "view/index.tsx")],
  loader: { ".woff": "dataurl", ".woff2": "dataurl" },
  // bundled CJS deps (styled-jsx runtime) require("react") — hand them the
  // shell's react (the facade default) instead of esbuild's broken ESM shim
  banner: {
    js: `import __twodbReact from "react";const require=(id)=>{if(id==="react")return __twodbReact;throw new Error(\'Dynamic require of "\'+id+\'" is not supported in the view bundle\')};`,
  },
  outfile: path.join(outdir, "view/main.js"),
  bundle: true,
  platform: "browser",
  format: "esm",
  target: "es2022",
  jsx: "automatic",
  external: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query"],
  plugins: [styledJsx, dropFonts, finalizeOnEnd],
});

await Promise.all([service.rebuild(), view.rebuild()]);

if (watch) {
  await Promise.all([service.watch(), view.watch()]);
  console.log("watching for changes…");
} else {
  await Promise.all([service.dispose(), view.dispose()]);
}
