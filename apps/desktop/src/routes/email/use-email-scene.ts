import { useMemo, useState } from "react";

export interface EmailThread {
  id: string;
  from: string;
  count?: number;
  time: string;
  snippet: string;
  pinned?: boolean;
  unread?: boolean;
}

export interface EmailMessage {
  id: string;
  author: string;
  email: string;
  time: string;
  to: string[];
  cc?: string[];
  body: string;
  attachments?: { name: string; size: string }[];
}

export interface EmailFolder {
  id: string;
  label: string;
  icon: string;
  count?: number;
}

const THREADS: EmailThread[] = [
  { id: "sitemap", from: "Ava, Ethan, Sophia, Me", count: 12, time: "10:15", snippet: "Hello Design Team,…", pinned: true, unread: true },
  { id: "oliver", from: "Oliver from Nissan", count: 5, time: "10:45", snippet: "Let's finalize these details during o…", pinned: true },
  { id: "luna", from: "Luna from BrightCo", count: 15, time: "09:30", snippet: "Hi! I've just uploaded the newest b…", pinned: true },
  { id: "liam", from: "Liam", count: 10, time: "09:50", snippet: "It's still bit rough, but I'm open to…", unread: true },
  { id: "helena", from: "Helena Ross", count: 4, time: "09:50", snippet: "Sorry, my bad. Those projects wer…" },
  { id: "coinbase", from: "Coinbase", time: "15 Jun", snippet: "You have received a transfer from…" },
  { id: "wise", from: "Wise", time: "09:55", snippet: "You received an incoming transfer…" },
  { id: "tripadvisor", from: "TripAdvisor", time: "8 Jun", snippet: "Good news incoming" },
  { id: "figma", from: "Figma", time: "09:40", snippet: "Your request to view “Coptera” ha…" },
  { id: "webflow", from: "Webflow", time: "15 Jun", snippet: "Exciting news ahead! Your templa…" },
  { id: "binance", from: "Binance", time: "8 Jun", snippet: "You received an incoming transfer…" },
];

const MESSAGES: Record<string, EmailMessage[]> = {
  sitemap: [
    {
      id: "m1",
      author: "Ava Thompson",
      email: "ava.thompson@uxerflow.com",
      time: "10:15",
      to: ["Ethan"],
      cc: ["Sophia", "Liam"],
      body: "Hello Team, I have gathered the latest updates regarding our project based on the recent feedback from our users. The focus is on enhancing usability, minimizing clutter, and ensuring a seamless experience for our primary users. I look forward to your thoughts and any additional suggestions for improvement.",
      attachments: [
        { name: "user-feedback.pdf", size: "1.5 MB" },
        { name: "project-overview.fig", size: "5.2 MB" },
      ],
    },
    {
      id: "m2",
      author: "Ethan Carter",
      email: "ethan.carter@uxerflow.com",
      time: "10:24",
      to: ["Me"],
      cc: ["Sophia", "Liam"],
      body: "Hi everyone, I've revamped the navigation layout and introduced a new section for quick access to frequently used features. I also adjusted the margins to align with our updated design standards. Please review and share your feedback before we proceed!",
      attachments: [
        { name: "frequently used features.pdf", size: "1.5 MB" },
        { name: "navigation flow & scenario.pdf", size: "1.5 MB" },
      ],
    },
    {
      id: "m3",
      author: "Sophia Lee",
      email: "sophia.lee@uxerflow.com",
      time: "10:30",
      to: ["Me", "Ethan"],
      cc: ["Liam"],
      body: "Looks good to me. The quick-access section reads clearly on mobile now — ship it after Liam's pass on the margins.",
    },
  ],
};

const LABEL_COLORS: Record<string, string> = {
  marketing: "bg-blue-500",
  finance: "bg-rose-400",
  operation: "bg-amber-300",
};

export interface LabelDef {
  id: string;
  label: string;
  count: number;
  dotClass: string;
}

const LABELS: LabelDef[] = [
  { id: "marketing", label: "Marketing", count: 35, dotClass: LABEL_COLORS.marketing },
  { id: "finance", label: "Finance", count: 20, dotClass: LABEL_COLORS.finance },
  { id: "operation", label: "Operation", count: 14, dotClass: LABEL_COLORS.operation },
];

/** Mock email client state — folders, thread list, reading pane selection, compose window. */
export function useEmailScene() {
  const [folder, setFolder] = useState("inbox");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>("sitemap");
  const [composeOpen, setComposeOpen] = useState(false);

  const { pinned, rest, activeThread, messages } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = THREADS.filter((t) => !q || t.from.toLowerCase().includes(q));
    return {
      pinned: visible.filter((t) => t.pinned),
      rest: visible.filter((t) => !t.pinned),
      activeThread: THREADS.find((t) => t.id === selected) ?? null,
      messages: selected ? (MESSAGES[selected] ?? []) : [],
    };
  }, [query, selected]);

  return { folder, setFolder, query, setQuery, selected, setSelected, composeOpen, setComposeOpen, pinned, rest, activeThread, messages, labels: LABELS };
}
