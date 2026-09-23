import { build } from "esbuild";
import { readFileSync } from "node:fs";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const nodeRequire = createRequire(path.join(root, "../packages/shared-frontend"));
const outdir = path.join(root, "../apps/api/vendor");

const REACT_EXTERNAL = {
  react: "react",
  "react/jsx-runtime": "react/jsx-runtime",
  "react/jsx-dev-runtime": "react/jsx-dev-runtime",
};

const TARGETS = [
  { spec: "react", file: "react.js", withDefault: true, external: {} },
  { spec: "react/jsx-runtime", file: "react-jsx-runtime.js", withDefault: false, external: {} },
  { spec: "react/jsx-dev-runtime", file: "react-jsx-dev-runtime.js", withDefault: false, external: {} },
  { spec: "@tanstack/react-query", file: "tanstack-react-query.js", withDefault: false, external: REACT_EXTERNAL },
  {
    spec: "@twodb/shared-frontend",
    file: "twodb-shared-frontend.js",
    withDefault: false,
    external: { ...REACT_EXTERNAL, "@tanstack/react-query": "@tanstack/react-query" },
    resolveDir: path.join(root, "../packages/shared-frontend"),
  },
];

const dropFonts = {
  name: "drop-fontsource",
  setup(b) {
    b.onLoad({ filter: /\.css$/ }, (args) => {
      if (!args.path.includes("fontsource") && !args.path.includes("katex")) return null;
      return { contents: "", loader: "css" };
    });
  },
};

const styledJsx = {
  name: "styled-jsx",
  setup(b) {
    b.onLoad({ filter: /\.(jsx|tsx)$|\.style\.ts$/ }, (args) => {
      const { transformSync } = nodeRequire("@babel/core");
      const result = transformSync(readFileSync(args.path, "utf8"), {
        babelrc: false,
        configFile: false,
        plugins: [nodeRequire.resolve("styled-jsx/babel")],
        sourceFileName: args.path,
        parserOpts: { sourceType: "module", plugins: ["typescript", "jsx"] },
      });
      return { contents: result.code, loader: path.extname(args.path).slice(1) };
    });
  },
};

await fs.rm(outdir, { recursive: true, force: true });
await fs.mkdir(outdir, { recursive: true });

for (const target of TARGETS) {
  let contents;
  if (target.spec === "react") {
    const names = Object.keys(nodeRequire("react"));
    contents = `import d from "react";\nexport default d;\nexport const { ${names.join(", ")} } = d;\n`;
  } else if (target.spec === "react/jsx-runtime" || target.spec === "react/jsx-dev-runtime") {
    const names = Object.keys(nodeRequire(target.spec));
    contents = `import d from ${JSON.stringify(target.spec)};\nexport default d;\nexport const { ${names.join(", ")} } = d;\n`;
  } else {
    contents = target.withDefault
      ? `import d from ${JSON.stringify(target.spec)};\nexport default d;\nexport * from ${JSON.stringify(target.spec)};\n`
      : `export * from ${JSON.stringify(target.spec)};\n`;
  }
  const entry = contents;

  await build({
    stdin: { contents: entry, resolveDir: target.resolveDir ?? path.join(root, "../apps/api"), loader: "js" },
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    outfile: path.join(outdir, target.file),
    external: Object.keys(target.external),
    plugins: [dropFonts, styledJsx],
    define: target.spec === "react/jsx-dev-runtime" ? { "process.env.NODE_ENV": '"development"' } : undefined,
    minify: true,
    logLevel: "warning",
  });
}

const importMap = {
  imports: {
    react: "/vendor/react.js",
    "react/jsx-runtime": "/vendor/react-jsx-runtime.js",
    "react/jsx-dev-runtime": "/vendor/react-jsx-dev-runtime.js",
    "@tanstack/react-query": "/vendor/tanstack-react-query.js",
    "@twodb/shared-frontend": "/vendor/twodb-shared-frontend.js",
  },
};

await fs.writeFile(path.join(outdir, "import-map.json"), `${JSON.stringify(importMap, null, 2)}\n`);

const sizes = await Promise.all(
  (await fs.readdir(outdir)).map(async (file) => `${file} (${((await fs.stat(path.join(outdir, file))).size / 1024).toFixed(1)} kB)`),
);
console.log(`vendored browser deps -> apps/api/vendor\n  ${sizes.join("\n  ")}`);
