import { useEffect, useState } from "react";
import { adjustItem } from "../../lib/actions";
import { feedback } from "../../lib/feedback";
import { navigate } from "../../lib/router";
import type { MatchHandlers } from "../../ui/MatchCard";
import type { PickOptions, ScanMode } from "../ScanContext";
import { useCamera } from "./useCamera";
import { useScanSession, type Target } from "./useScanSession";
import { useWedgeScanner } from "./useWedgeScanner";

export type OverlayRequest = { kind: "session"; mode?: ScanMode; target?: Target | null } | ({ kind: "pick"; resolve: (v: string | null) => void } & PickOptions);

const MODE_TITLES: Record<ScanMode, string> = {
  lookup: "Scan anything",
  putaway: "Put away",
  stockIn: "Stock in (+1 per scan)",
  stockOut: "Stock out (−1 per scan)",
};

/** Holding hook for <ScanOverlay>: camera + session + manual entry + navigation handlers. */
export function useScanOverlay(req: OverlayRequest, close: () => void) {
  const session = useScanSession(req.kind === "session" ? { mode: req.mode, target: req.target } : {});
  const [manual, setManual] = useState("");
  const [hitKey, setHitKey] = useState(0);

  const onCode = (raw: string) => {
    setHitKey((k) => k + 1);
    if (req.kind === "pick") {
      feedback("ok");
      req.resolve(raw);
      close();
      return;
    }
    void session.handle(raw);
  };

  const camera = useCamera(onCode, { repeatMs: req.kind === "pick" ? 99999 : 2200 });
  useWedgeScanner(onCode);

  useEffect(() => {
    void camera.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Esc closes; lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && cancel();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancel = () => {
    camera.stop();
    if (req.kind === "pick") req.resolve(null);
    close();
  };

  const go = (to: string) => {
    camera.stop();
    close();
    navigate(to);
  };

  const submitManual = () => {
    const v = manual.trim();
    if (!v) return;
    setManual("");
    onCode(v);
  };

  const t = session.target;
  const handlers: MatchHandlers = {
    onOpenItem: (it) => go(`/items/${it.id}`),
    onOpenPlace: (p) => go(`/places/${p.id}`),
    onDelta: (it, d) => void adjustItem(it, d).then(() => session.handle(it.code ?? it.barcodes[0] ?? it.id)),
    onPutAwayInto: (p) => {
      session.setTarget({ id: p.id, name: p.name, path: p.path });
      session.setMode("putaway");
    },
    onNewItem: ({ code, barcode }) => {
      const q = new URLSearchParams();
      if (code) q.set("code", code);
      if (barcode) q.set("barcode", barcode);
      if (t) q.set("loc", t.id);
      go(`/items/new?${q}`);
    },
    onNewPlace: ({ code }) => go(`/places/new?code=${encodeURIComponent(code)}${t ? `&parent=${t.id}` : ""}`),
  };
  if (session.mode !== "lookup") {
    // Several items share a barcode → user picks which one to move / count.
    handlers.onChoose = (it) => {
      const entry = session.entries.find((e) => e.matches.some((m) => m.type === "item" && m.item.id === it.id));
      if (entry) session.chooseItem(entry, it);
    };
    // In stock modes the stepper would double-count; keep it for lookup only.
    delete handlers.onDelta;
  }

  const title = req.kind === "pick" ? req.title : MODE_TITLES[session.mode];
  const subtitle = req.kind === "pick" ? req.hint : session.mode === "lookup" ? "Labels, boxes, product barcodes & QR codes" : undefined;

  return {
    isPick: req.kind === "pick",
    title,
    subtitle,
    camera,
    hitKey,
    session,
    manual,
    setManual,
    submitManual,
    cancel,
    handlers,
    onSearch: (raw: string) => go(`/items?q=${encodeURIComponent(raw)}`),
  };
}
