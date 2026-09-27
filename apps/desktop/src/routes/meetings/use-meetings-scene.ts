import { useEffect, useRef, useState } from "react";

/** Labelled gradient placeholder for synthetic video tiles. */
function ph(c1: string, c2: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='400'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs><rect width='640' height='400' fill='url(#g)'/><circle cx='500' cy='90' r='80' fill='rgba(255,255,255,0.14)'/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const STAGE_IMG = ph("#1a2450", "#3a55ff");

export interface Participant {
  name: string;
  img: string;
  micOff: boolean;
}

export const PARTICIPANTS: Participant[] = [
  { name: "Ravi Kumar", img: ph("#0d2b26", "#0f9d8f"), micOff: false },
  { name: "Meera Iyer", img: ph("#2b1526", "#c2285a"), micOff: false },
  { name: "You", img: ph("#241d10", "#d9a03f"), micOff: true },
  { name: "Dev Patel", img: ph("#131320", "#5c5b6e"), micOff: true },
];

export interface ScribeLine {
  speaker: string;
  time: string;
  text: string;
}

export const SCRIPT: ScribeLine[] = [
  {
    speaker: "Dr. Asha Verma",
    time: "12:22",
    text: "Ward 4 first — Ravi Kumar's discharge summary is ready, but the medication dosage needs one correction before it goes out.",
  },
  {
    speaker: "Ravi Kumar",
    time: "12:21",
    text: "The lab flagged Meera Iyer's lipid panel overnight. I've attached the report to her chart for the 9:40 review.",
  },
  {
    speaker: "Meera Iyer",
    time: "12:19",
    text: "Stock check: gauze and medium gloves are below the reorder line. The order went out Thursday, arriving Monday.",
  },
  {
    speaker: "Dr. Asha Verma",
    time: "12:17",
    text: "Good. Six invoices crossed thirty days this week — the reminders are drafted, someone review the wording before they send.",
  },
  { speaker: "Dev Patel", time: "12:15", text: "I'll take the invoice wording. Also confirming Tuesday's visiting hours with the front desk this afternoon." },
  { speaker: "Ravi Kumar", time: "12:12", text: "New patient intake at 12:30 — Sana Sheikh. Consent forms are printed and at the desk." },
];

/** Live-scribe meeting state — call controls, streaming transcript, summary tabs. */
export function useMeetingsScene() {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [listening, setListening] = useState(true);
  const [lineCount, setLineCount] = useState(3);
  const [sideTab, setSideTab] = useState("summary");
  const [openKey, setOpenKey] = useState<string | null>("overview");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!listening) return;
    const t = setInterval(() => {
      setLineCount((n) => (n < SCRIPT.length ? n + 1 : n));
    }, 3200);
    return () => clearInterval(t);
  }, [listening]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lineCount]);

  const lines = SCRIPT.slice(0, lineCount);
  const done = lineCount >= SCRIPT.length;

  return {
    micOn,
    setMicOn,
    camOn,
    setCamOn,
    listening,
    setListening,
    sideTab,
    setSideTab,
    openKey,
    setOpenKey,
    scrollRef,
    lines,
    done,
    replay: () => {
      setLineCount(1);
      setListening(true);
    },
  };
}
