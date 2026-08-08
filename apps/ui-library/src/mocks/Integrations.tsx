import { useState, type ReactNode } from "react";
import { Badge, Button, IconButton, Menu, MenuDivider, MenuItem, Tabs } from "@twodb/ui";
import {
  Blocks,
  Brain,
  Calendar,
  Cloud,
  CreditCard,
  FileDown,
  FileText,
  Globe,
  HardDrive,
  MessageSquare,
  Mic,
  MoreHorizontal,
  Paperclip,
  Phone,
  RefreshCw,
  ScanLine,
  Settings,
  Trash2,
} from "lucide-react";

type Category = "plugins" | "tools" | "services";
type Status = "connected" | "issue";

interface Integration {
  id: string;
  name: string;
  desc: string;
  icon: ReactNode;
  category: Category;
}

const CATALOG: Integration[] = [
  // plugins — where twodb talks to other apps
  { id: "slack", name: "Slack", desc: "Send morning briefs and alerts to a channel.", icon: <MessageSquare />, category: "plugins" },
  { id: "gcal", name: "Google Calendar", desc: "Two-way sync for appointments and reminders.", icon: <Calendar />, category: "plugins" },
  { id: "whatsapp", name: "WhatsApp", desc: "Reply to patients and customers from one inbox.", icon: <Phone />, category: "plugins" },
  { id: "notion-import", name: "Notion Import", desc: "Bring existing docs and databases over.", icon: <FileText />, category: "plugins" },
  { id: "zapier", name: "Zapier", desc: "Reach 6,000 apps through existing Zaps.", icon: <Blocks />, category: "plugins" },
  { id: "webhook", name: "Webhooks", desc: "Push events to any URL you control.", icon: <Globe />, category: "plugins" },

  // tools — built-in abilities that need a key or setup
  { id: "ocr", name: "OCR Scanner", desc: "Turn prescriptions and receipts into text.", icon: <ScanLine />, category: "tools" },
  { id: "voice", name: "Voice Notes", desc: "Dictate notes; get them transcribed and filed.", icon: <Mic />, category: "tools" },
  { id: "pdf", name: "PDF Toolkit", desc: "Merge, split, and sign documents in place.", icon: <FileDown />, category: "tools" },
  { id: "clipper", name: "Web Clipper", desc: "Save pages straight into your notebooks.", icon: <Paperclip />, category: "tools" },

  // services — accounts and infrastructure
  { id: "razorpay", name: "Razorpay", desc: "Collect payments and reconcile invoices.", icon: <CreditCard />, category: "services" },
  { id: "openai", name: "OpenAI", desc: "Power the assistant and the app builder.", icon: <Brain />, category: "services" },
  { id: "gdrive", name: "Google Drive", desc: "Attach files without moving them.", icon: <HardDrive />, category: "services" },
  { id: "s3", name: "S3 Backup", desc: "Nightly encrypted backups to your bucket.", icon: <Cloud />, category: "services" },
];

const CATEGORY_LABEL: Record<Category, string> = {
  plugins: "Plugins",
  tools: "Tools",
  services: "Services",
};

export function IntegrationsMock() {
  const [tab, setTab] = useState<Category>("plugins");
  const [status, setStatus] = useState<Record<string, Status>>({
    slack: "connected",
    gcal: "issue",
    voice: "connected",
    razorpay: "connected",
  });

  const connect = (id: string) => setStatus((s) => ({ ...s, [id]: "connected" }));
  const disconnect = (id: string) =>
    setStatus((s) => {
      const next = { ...s };
      delete next[id];
      return next;
    });

  const items = CATALOG.filter((i) => i.category === tab);
  const connected = items.filter((i) => status[i.id]);
  const available = items.filter((i) => !status[i.id]);

  return (
    <div className="mock-int">
      <header className="mock-int__head">
        <h2>Integrations</h2>
        <p>
          Connect {CATEGORY_LABEL[tab].toLowerCase()} once — twodb keeps them in sync and tells you
          when one needs attention.
        </p>
      </header>

      <Tabs
        aria-label="Integration categories"
        value={tab}
        onValueChange={(v) => setTab(v as Category)}
        items={[
          { id: "plugins", label: "Plugins" },
          { id: "tools", label: "Tools" },
          { id: "services", label: "Services" },
        ]}
      />

      {connected.length > 0 ? (
        <section className="mock-int__section">
          <span className="mock-int__label tw-cue tw-tnum">
            Connected · {connected.length}
          </span>
          <div className="mock-int__rows">
            {connected.map((item) => {
              const state = status[item.id];
              const issue = state === "issue";
              return (
                <div
                  key={item.id}
                  className={issue ? "mock-int__row mock-int__row--issue" : "mock-int__row"}
                >
                  <span className="mock-int__icon">{item.icon}</span>
                  <div className="mock-int__meta">
                    <span className="mock-int__name">{item.name}</span>
                    {issue ? (
                      <span className="mock-int__issue">
                        Connection expired — reconnect to keep syncing.
                      </span>
                    ) : (
                      <span className="mock-int__sub">Syncing since Aug 5</span>
                    )}
                  </div>
                  <Badge tone={issue ? "danger" : "go"}>{issue ? "Issue" : "Connected"}</Badge>
                  {issue ? (
                    <Button size="sm" onClick={() => connect(item.id)}>
                      <RefreshCw size={14} aria-hidden="true" />
                      Reconnect
                    </Button>
                  ) : null}
                  <Menu
                    placement="bottom-end"
                    trigger={<IconButton label={`${item.name} options`} icon={<MoreHorizontal />} />}
                  >
                    <MenuItem icon={<Settings />}>Configure</MenuItem>
                    <MenuItem icon={<RefreshCw />}>Sync now</MenuItem>
                    <MenuDivider />
                    <MenuItem icon={<Trash2 />} danger onClick={() => disconnect(item.id)}>
                      Disconnect
                    </MenuItem>
                  </Menu>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="mock-int__section">
        <span className="mock-int__label tw-cue tw-tnum">Available · {available.length}</span>
        <div className="mock-int__grid">
          {available.map((item) => (
            <div key={item.id} className="mock-int__card">
              <span className="mock-int__icon">{item.icon}</span>
              <span className="mock-int__name">{item.name}</span>
              <p className="mock-int__desc">{item.desc}</p>
              <div className="mock-int__card-foot">
                <Button size="sm" variant="secondary" onClick={() => connect(item.id)}>
                  Connect
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
