import { useEffect, useRef, useState } from "react";
import { ExternalLink, Play, RefreshCw, TerminalSquare } from "lucide-react";
import { Badge, Button, Card, CardContent, Input, Tabs, TabsContent, TabsList, TabsTrigger } from "@twodb/blocks";
import { dispatchClient, type Microvm } from "../../../lib/dispatch-client.js";
import { useVmConsole, useVmTerminal } from "../hooks/useVmDetail.js";

export interface VmDetailPanelProps {
  vm: Microvm | null;
  error: string | null;
  reload: () => Promise<void>;
  identifier: string;
  /** Boot/resume by identifier (no runnerId — server resolves). */
  onBoot: () => Promise<unknown>;
  bootBusy: boolean;
}

/** Microvm detail: exec console + live terminal (vsock pty relay). */
export function VmDetailPanel(props: VmDetailPanelProps) {
  const runnerName = props.vm?.runnerName ?? null;
  const running = props.vm?.status === "running";
  const console_ = useVmConsole(runnerName, props.identifier);
  const [terminalOn, setTerminalOn] = useState(false);
  const terminal = useVmTerminal(props.identifier, terminalOn && running);

  if (props.error && !props.vm) return <p className="p-6 text-[13px] text-destructive">{props.error}</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-semibold text-ink">{props.identifier}</h2>
        {props.vm ? (
          <>
            <Badge tone={running ? "success" : "neutral"}>{props.vm.status}</Badge>
            <span className="text-[12px] text-ink-muted">
              {props.vm.runnerName ?? props.vm.runnerId} · {props.vm.bootCount} boots
            </span>
          </>
        ) : (
          <span className="text-[12px] text-ink-muted">not registered (boot it first)</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => void props.reload()}>
            <RefreshCw className="size-3.5" />
          </Button>
          {!running ? (
            <Button size="sm" variant="primary" disabled={props.bootBusy} onClick={() => void props.onBoot()}>
              <Play className="size-3.5" />
              {props.vm?.status === "idle-stopped" ? "Resume" : "Boot"}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant={terminalOn ? "secondary" : "primary"}
            disabled={!running}
            onClick={() => setTerminalOn((v) => !v)}
          >
            <TerminalSquare className="size-3.5" />
            {terminalOn ? "Close terminal" : "Terminal"}
          </Button>
          <Button size="sm" variant="secondary" disabled={!running} onClick={() => window.open(dispatchClient.vmStreamUrl(props.identifier, "vscode"), "_blank")}>
            <ExternalLink className="size-3.5" />
            VSCode
          </Button>
        </div>
      </div>

      {terminalOn && running ? <TerminalRelay {...terminal} /> : null}

      <Card>
        <CardContent className="p-4">
          <Console {...console_} />
        </CardContent>
      </Card>
    </div>
  );
}

/** Raw pty relay view: scrollback + typed input straight to the shell. */
function TerminalRelay(props: { connected: boolean; text: string; send: (d: string) => void }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [props.text]);

  return (
    <Card>
      <CardContent className="space-y-2 p-3">
        <div className="flex items-center gap-2">
          <span className={`inline-block size-2 rounded-full ${props.connected ? "bg-emerald-500" : "bg-stone-400"}`} />
          <span className="text-[11px] text-ink-muted">{props.connected ? "terminal live (vsock pty)" : "connecting…"}</span>
        </div>
        <div
          ref={bodyRef}
          className="h-72 overflow-auto rounded-md border border-outline bg-black p-3 font-mono text-[12px] leading-relaxed text-emerald-100"
          onClick={() => inputRef.current?.focus()}
        >
          <pre className="whitespace-pre-wrap break-all">{props.text || "\u00a0"}</pre>
        </div>
        <Input
          ref={inputRef}
          placeholder="type a command (Enter to send)"
          className="font-mono text-[12px]"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              props.send(e.currentTarget.value + "\r");
              e.currentTarget.value = "";
              e.preventDefault();
            }
          }}
        />
      </CardContent>
    </Card>
  );
}

/** Exec console: one command in, buffered stdout/stderr out. */
function Console(props: ReturnType<typeof useVmConsole>) {
  const [command, setCommand] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [props.entries.length]);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={command}
          placeholder="exec inside the microvm (e.g. ls /app)"
          className="font-mono text-[12px]"
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && command && !props.busy) {
              void props.run(command);
              setCommand("");
            }
          }}
        />
        <Button size="sm" variant="primary" disabled={!command || props.busy} onClick={() => { void props.run(command); setCommand(""); }}>
          Run
        </Button>
      </div>
      <div ref={bodyRef} className="max-h-72 space-y-2 overflow-auto">
        {props.entries.map((entry, i) => (
          <div key={i}>
            <p className="text-[11px] text-ink-muted">$ {entry.command}</p>
            {entry.result ? (
              <pre className="whitespace-pre-wrap rounded-md border border-outline bg-surface-muted p-2 text-[11px]">
                {entry.result.stdout}
                {entry.result.stderr ? `\n(stderr) ${entry.result.stderr}` : ""}
              </pre>
            ) : null}
            {entry.error ? <p className="text-[11px] text-destructive">{entry.error}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
