import { useState } from "react";
import { Cloud, ExternalLink, Loader2 } from "lucide-react";
import { useAwsWidget } from "./aws-widget";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * AWS SSO chip for the session header (before working/live). Hidden when the
 * session's runner has no aws cli. States:
 *  - not authenticated → "aws" chip; click → device-code login (enter code)
 *  - authenticated → selected profile name; click → switch between profiles
 */

export function AwsChip({ sessionId }: { sessionId: string }) {
  const { status, login, select } = useAwsWidget(sessionId);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<{ userCode: string; verificationUri: string; verificationUriComplete: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const s = status.data;
  if (!s?.available) return null; // runner has no aws / no directory — no widget

  const authenticated = s.authenticated === true;
  const loggingIn = login.isPending || (!!code && !authenticated);

  const startLogin = () => {
    setError(null);
    setCode(null);
    login.mutate(undefined, {
      onSuccess: (start) => setCode({ userCode: start.userCode, verificationUri: start.verificationUri, verificationUriComplete: start.verificationUriComplete }),
      onError: (e) => setError(e.message),
    });
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setCode(null); setError(null); } }}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex h-5 items-center gap-1 rounded-full border px-2 text-[11px] font-medium transition-colors",
            authenticated ? "border-success/40 bg-success/10 text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
          title={authenticated ? `AWS SSO — profile ${s.selectedProfile}${s.profiles?.length ? ` (${s.profiles.length} available)` : ""}` : "AWS SSO — click to authenticate"}
        >
          {loggingIn ? <Loader2 size={11} className="animate-spin" aria-hidden="true" /> : <Cloud size={11} aria-hidden="true" />}
          {authenticated ? s.selectedProfile ?? "aws" : "aws"}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" className="w-72 p-0">
        {authenticated ? (
          <div>
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-xs font-semibold">AWS profiles</span>
              <span className="text-muted-foreground text-[10px]">{s.ssoSession}</span>
            </div>
            <div className="max-h-64 overflow-y-auto p-1">
              {(s.profiles ?? []).map((p) => (
                <button
                  key={p.name}
                  className={cn(
                    "hover:bg-accent/50 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs",
                    p.name === s.selectedProfile && "bg-accent",
                  )}
                  disabled={select.isPending}
                  onClick={() => select.mutate(p.name, { onError: (e) => setError(e.message) })}
                >
                  <span className="min-w-0 flex-1 truncate font-mono">{p.name}</span>
                  {p.accountId && <span className="text-muted-foreground shrink-0 font-mono text-[10px]">{p.accountId}</span>}
                  {p.name === s.selectedProfile && <span className="text-success text-[10px]">●</span>}
                </button>
              ))}
              {select.isPending && (
                <div className="flex justify-center py-1">
                  <Loader2 className="text-muted-foreground size-3 animate-spin" />
                </div>
              )}
            </div>
          </div>
        ) : code ? (
          <div className="p-3">
            <p className="mb-2 text-xs">
              Enter this code at{" "}
              <a href={code.verificationUriComplete ?? code.verificationUri} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-0.5 underline">
                the AWS device page <ExternalLink size={10} aria-hidden="true" />
              </a>
            </p>
            <div className="bg-accent rounded-md py-2 text-center font-mono text-lg tracking-[0.3em] select-all">{code.userCode}</div>
            <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-[11px]">
              <Loader2 size={10} className="animate-spin" aria-hidden="true" />
              waiting for authorization…
            </p>
            <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={() => setCode(null)}>
              Hide
            </Button>
          </div>
        ) : (
          <div className="p-3">
            <p className="text-muted-foreground mb-2 text-xs">
              {s.offline ? "Runner offline — reconnect to authenticate." : "Authenticate this runner's AWS SSO (device code)."}
            </p>
            <Button size="sm" className="w-full" disabled={login.isPending || s.offline} onClick={startLogin}>
              {login.isPending ? <Loader2 size={12} className="animate-spin" /> : <Cloud size={12} aria-hidden="true" />}
              Sign in with SSO
            </Button>
            {s.error && <p className="text-destructive mt-2 text-[11px]">{s.error}</p>}
          </div>
        )}
        {error && <div className="border-t px-3 py-1.5 text-[11px] text-destructive">{error}</div>}
      </PopoverContent>
    </Popover>
  );
}
