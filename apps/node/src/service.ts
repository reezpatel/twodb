import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const SERVICE_ID = "twodb-node-service";

export function runServiceCommand(subcommand: string): number {
  if (process.platform !== "win32") {
    console.error(
      "[node] `service` commands manage a Windows service via WinSW. On this platform run the agent under systemd, launchd (brew services), docker, or your process manager of choice.",
    );
    return 1;
  }

  const exeDir = path.dirname(process.execPath);
  const winsw = path.join(exeDir, "WinSW.exe");
  const xmlPath = path.join(exeDir, `${SERVICE_ID}.xml`);

  if (!fs.existsSync(winsw)) {
    console.error(`[node] WinSW.exe not found next to the agent (expected ${winsw}).`);
    console.error("[node] the chocolatey package installs it automatically; manual installs can download it from https://github.com/winsw/winsw/releases");
    return 1;
  }

  if (subcommand === "install") {
    const env = (name: string) => process.env[name] ?? "";
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<service>
  <id>${SERVICE_ID}</id>
  <name>TwoDB Node Agent</name>
  <description>Runs twodb-node in the background, executing session commands and patches.</description>
  <executable>${process.execPath}</executable>
  <log mode="roll-by-size"><sizeThreshold>10485760</sizeThreshold><keepFiles>4</keepFiles></log>
  <onfailure action="restart" delay="5 sec"/>
  <env name="TWODB_NODE_URL" value="${env("TWODB_NODE_URL")}"/>
  <env name="TWODB_NODE_TOKEN" value="${env("TWODB_NODE_TOKEN")}"/>
  <env name="TWODB_ROOT" value="${env("TWODB_ROOT")}"/>
</service>
`;
    fs.writeFileSync(xmlPath, xml, "utf8");
    console.log(`[node] wrote ${xmlPath}`);
  }

  const commands: Record<string, string[]> = {
    install: ["install", "start"],
    uninstall: ["stop", "uninstall"],
    start: ["start"],
    stop: ["stop"],
  };

  const sequence = commands[subcommand];
  if (!sequence) {
    console.error(`[node] unknown service subcommand "${subcommand}" — use install | uninstall | start | stop`);
    return 1;
  }

  for (const step of sequence) {
    try {
      execFileSync(winsw, [step], { stdio: "inherit" });
    } catch (error) {
      if (subcommand === "uninstall" && step === "stop") continue;
      console.error(`[node] service ${step} failed: ${error instanceof Error ? error.message : String(error)}`);
      return 1;
    }
  }

  console.log(`[node] service ${subcommand} done`);
  return 0;
}
