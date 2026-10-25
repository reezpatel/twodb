import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { wsUrl } from "@/lib/native";
import { Button } from "@/components/ui/button";
import type { TeamsAccount } from "./use-teams";

/**
 * Remote screen for a Teams account's Chromium session — JPEG screencast
 * frames down, clicks/keys up. Used for interactive sign-in (2FA) and
 * occasional verification.
 */
export function TeamsLiveView({ account, onClose }: { account: TeamsAccount; onClose: () => void }) {
  const [frame, setFrame] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const ws = new WebSocket(wsUrl(`/api/teams/live?accountId=${encodeURIComponent(account.id)}`));
    wsRef.current = ws;
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(String(evt.data)) as { type: string; dataBase64?: string; message?: string };
        if (msg.type === "frame" && msg.dataBase64) setFrame(`data:image/jpeg;base64,${msg.dataBase64}`);
        else if (msg.type === "error") setError(msg.message ?? "live view failed");
      } catch {
        // ignore malformed frames
      }
    };
    ws.onclose = (evt) => {
      if (evt.code !== 1000 && !error) setError(evt.reason || "connection closed");
    };
    return () => {
      ws.close(1000);
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.id]);

  const send = (input: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: "input", input }));
  };

  const onClick = (e: React.MouseEvent<HTMLImageElement>) => {
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    // The screencast is capped at 1280×900 viewport CSS pixels.
    const x = ((e.clientX - rect.left) / rect.width) * 1280;
    const y = ((e.clientY - rect.top) / rect.height) * 900;
    send({ kind: "click", x: Math.round(x), y: Math.round(y) });
  };

  const onWheel = (e: React.WheelEvent) => send({ kind: "scroll", deltaY: e.deltaY });

  const onKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault();
    if (e.key.length === 1) send({ kind: "type", text: e.key });
    else send({ kind: "key", key: e.key });
  };

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft />
          Back
        </Button>
        <h3 className="text-lg font-medium">Connect — {account.label}</h3>
        <span className="text-muted-foreground text-sm">Sign in here once; the session persists on the runner.</span>
      </div>

      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      <div
        className="bg-muted relative min-h-0 flex-1 overflow-hidden rounded-lg border"
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        tabIndex={0}
        ref={(el) => el?.focus()}
      >
        {frame ? (
          <img ref={imgRef} src={frame} alt={`${account.label} browser screen`} className="h-full w-full cursor-crosshair object-contain" onClick={onClick} draggable={false} />
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center text-sm">{error ? "Screen unavailable." : "Connecting to the browser session…"}</div>
        )}
      </div>
      <p className="text-muted-foreground text-xs">Click the screen to interact. Keystrokes go to the browser while this panel has focus.</p>
    </div>
  );
}
