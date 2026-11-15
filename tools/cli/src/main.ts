import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readConfig, requireConfig } from "./config.js";
import { cmdAuth } from "./cmd-auth.js";
import { appHelp, isRawMethod, listApps, mainHelp, runRawCall, runAppCommand } from "./commands.js";
import { bold, dim, red } from "./ui.js";

const VERSION = readVersion();

function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8")) as { version: string };
    return pkg.version;
  } catch {
    return "0.0.0-dev";
  }
}

async function main(argv: string[]): Promise<number> {
  if (argv[0] === "--version" || argv[0] === "-v" || argv[0] === "version") {
    process.stdout.write(`twodb ${VERSION}\n`);
    return 0;
  }
  if (argv[0] === "--help" || argv[0] === "-h" || argv[0] === "help" || argv.length === 0) {
    const config = await readConfig();
    if (!config?.apiKey) {
      process.stdout.write(
        [
          bold("twodb") + dim(" — one CLI for every app installed on your TwoDB control plane"),
          "",
          `${"First:"} run ${bold("twodb auth <control-plane-url>")} to log in.`,
          "",
          `Then:  twodb --help      ${dim("# lists every installed app as a command")}`,
          `       twodb <app> --help ${dim("# that app's API as commands")}`,
          "",
        ].join("\n") + "\n",
      );
      return 0;
    }
    return mainHelp(config.gateway, config.apiKey);
  }

  const [head, ...rest] = argv;

  if (head === "auth") return cmdAuth(rest);

  const config = await requireConfig();
  const gateway = config.gateway;
  const apiKey = config.apiKey!;

  if (head === "apps") {
    const apps = await listApps(gateway, apiKey).catch((err) => {
      process.stderr.write(`twodb: ${(err as Error).message}\n`);
      process.exit(1);
    });
    const jsonFlag = rest.includes("--json");
    if (jsonFlag) {
      process.stdout.write(JSON.stringify(apps, null, 2) + "\n");
      return 0;
    }
    process.stdout.write(`${bold("Installed apps")}\n\n`);
    for (const app of apps) {
      const dot = app.status === "active" ? "●" : "○";
      process.stdout.write(`${dot} ${app.slug.padEnd(18)} ${(app.name ?? "").padEnd(22)} ${(app.installStatus ?? "").padEnd(12)} ${app.version ?? ""}\n`);
    }
    process.stdout.write(`\n${dim("twodb <app> --help to see an app's API as commands")}\n`);
    return 0;
  }

  // `twodb tools ...` is sugar for `twodb toolkit ...`
  const appSlug = head === "tools" ? "toolkit" : head!;

  // Validate the app exists (nice error for typos), then dispatch.
  const apps = await listApps(gateway, apiKey).catch((err) => {
    process.stderr.write(`twodb: ${(err as Error).message}\n`);
    process.exit(1);
  });
  if (!apps.some((a) => a.slug === appSlug)) {
    process.stderr.write(`twodb: no app "${appSlug}" — installed apps: ${apps.map((a) => a.slug).join(", ")}\n`);
    return 1;
  }

  const sub = rest[0];
  if (!sub || sub === "--help" || sub === "-h") {
    return appHelp(gateway, apiKey, appSlug);
  }
  if (isRawMethod(sub)) {
    return runRawCall(gateway, apiKey, appSlug, sub.toLowerCase(), rest.slice(1));
  }
  return runAppCommand(gateway, apiKey, appSlug, rest);
}

process.on("unhandledRejection", (err) => {
  process.stderr.write(red(`twodb: ${String((err as Error)?.stack ?? err)}\n`));
  process.exit(1);
});

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => {
    process.stderr.write(red(`twodb: ${String((err as Error)?.stack ?? err)}\n`));
    process.exit(1);
  },
);
