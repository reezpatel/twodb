import { useEffect, useState, type ReactNode } from "react";
import {
  Avatar,
  Badge,
  Button,
  Dialog,
  IconButton,
  Input,
  NavSection,
  PasswordInput,
  Radio,
  Select,
  SettingGroup,
  SettingRow,
  Switch,
  Textarea,
  TimePicker,
  Tooltip,
} from "@twodb/ui";
import {
  Bell,
  Check,
  Copy,
  Laptop,
  Lock,
  LogOut,
  Palette,
  ShieldCheck,
  Smartphone,
  Trash2,
  User,
} from "lucide-react";

type SectionId = "profile" | "account" | "privacy" | "notifications" | "appearance";

const SECTIONS = [
  { id: "profile", label: "Profile", icon: <User /> },
  { id: "account", label: "Account & security", icon: <ShieldCheck /> },
  { id: "privacy", label: "Privacy", icon: <Lock /> },
  { id: "notifications", label: "Notifications", icon: <Bell /> },
  { id: "appearance", label: "Appearance", icon: <Palette /> },
];

/* transient "Saved" feedback */
function useSaved() {
  const [saved, setSaved] = useState(false);
  function mark() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }
  return { saved, mark };
}

function SaveBar({ saved, onSave }: { saved: boolean; onSave: () => void }) {
  return (
    <div className="mock-set__savebar">
      <Button size="sm" onClick={onSave}>
        Save changes
      </Button>
      <Button size="sm" variant="ghost">
        Cancel
      </Button>
      {saved ? (
        <Badge tone="go">
          <Check size={11} aria-hidden="true" /> Saved
        </Badge>
      ) : null}
    </div>
  );
}

/* ---------------- Profile ---------------- */

function ProfileSection() {
  const { saved, mark } = useSaved();
  const [photoSeed, setPhotoSeed] = useState(0);
  const names = ["Asha Verma", "Asha V.", "Dr. A. Verma"];
  const photoName = names[photoSeed % names.length];

  return (
    <>
      <SettingGroup label="Public profile" description="How you appear to other people in the workspace.">
        <SettingRow label="Profile photo" description="A clear photo helps your team find you.">
          <div className="mock-set__photo">
            <Avatar name={photoName} size="lg" />
            <div className="mock-set__photo-actions">
              <Button size="sm" variant="secondary" onClick={() => setPhotoSeed((s) => s + 1)}>
                Change photo
              </Button>
              <Button size="sm" variant="ghost">
                Remove
              </Button>
            </div>
          </div>
        </SettingRow>
        <SettingRow label="Full name">
          <div className="mock-set__field"><Input defaultValue="Dr. Asha Verma" aria-label="Full name" /></div>
        </SettingRow>
        <SettingRow label="Headline" description="One line under your name.">
          <div className="mock-set__field"><Input defaultValue="General physician, Verma Clinic" aria-label="Headline" /></div>
        </SettingRow>
        <SettingRow label="Bio">
          <div className="mock-set__field">
            <Textarea defaultValue={"Family clinic in Nashik since 2011.\nDiabetes care, vaccinations, home visits on Thursdays."} aria-label="Bio" />
          </div>
        </SettingRow>
        <SettingRow label="Profile link">
          <div className="mock-set__linkrow">
            <span className="mock-set__prefix">twodb.in/</span>
            <div className="mock-set__field"><Input defaultValue="dr-asha-verma" aria-label="Profile link" /></div>
            <Tooltip tip="Copy link">
              <IconButton label="Copy profile link" icon={<Copy />} variant="secondary" />
            </Tooltip>
          </div>
        </SettingRow>
      </SettingGroup>

      <SettingGroup label="Contact">
        <SettingRow
          label="Email"
          control={<Badge tone="go">Verified</Badge>}
        >
          <div className="mock-set__field"><Input defaultValue="asha@vermaclinic.in" type="email" aria-label="Email" /></div>
        </SettingRow>
        <SettingRow label="Phone" control={<Button size="sm" variant="secondary">Verify</Button>}>
          <div className="mock-set__field"><Input defaultValue="+91 98220 41xx" aria-label="Phone" /></div>
        </SettingRow>
        <SettingRow
          label="Language"
          control={
            <div style={{ width: 180 }}>
              <Select
                aria-label="Language"
                defaultValue="en"
                options={[
                  { value: "en", label: "English" },
                  { value: "hi", label: "हिंदी" },
                  { value: "mr", label: "मराठी" },
                  { value: "gu", label: "ગુજરાતી" },
                  { value: "ta", label: "தமிழ்" },
                ]}
              />
            </div>
          }
        />
        <SettingRow
          label="Time zone"
          control={
            <div style={{ width: 180 }}>
              <Select
                aria-label="Time zone"
                defaultValue="ist"
                options={[
                  { value: "ist", label: "(GMT+5:30) India" },
                  { value: "gst", label: "(GMT+4:00) Gulf" },
                  { value: "gmt", label: "(GMT+0:00) London" },
                ]}
              />
            </div>
          }
        />
      </SettingGroup>

      <SaveBar saved={saved} onSave={mark} />
    </>
  );
}

/* ---------------- Account & security ---------------- */

function AccountSection() {
  const [twoFa, setTwoFa] = useState(true);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwState, setPwState] = useState<null | "ok" | "mismatch" | "short">(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function updatePassword() {
    if (next.length < 8) return setPwState("short");
    if (next !== confirm) return setPwState("mismatch");
    setPwState("ok");
    setCur("");
    setNext("");
    setConfirm("");
  }

  const sessions = [
    { id: "s1", icon: <Laptop />, name: "Chrome · Windows", where: "Nashik", current: true },
    { id: "s2", icon: <Smartphone />, name: "twodb app · Android", where: "Nashik", when: "Active 2h ago" },
    { id: "s3", icon: <Smartphone />, name: "Safari · iPhone", where: "Mumbai", when: "Active 3 days ago" },
  ];

  return (
    <>
      <SettingGroup label="Change password" description="At least 8 characters. Sessions elsewhere stay signed in.">
        <SettingRow label="Current password">
          <div className="mock-set__field"><PasswordInput value={cur} onChange={(e) => setCur(e.target.value)} placeholder="••••••••" /></div>
        </SettingRow>
        <SettingRow label="New password">
          <div className="mock-set__field">
            <PasswordInput
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="At least 8 characters"
              error={pwState === "short" ? "Use at least 8 characters" : undefined}
            />
          </div>
        </SettingRow>
        <SettingRow label="Confirm new password">
          <div className="mock-set__field">
            <PasswordInput
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat the new password"
              error={pwState === "mismatch" ? "Passwords don't match" : undefined}
            />
          </div>
        </SettingRow>
        <SettingRow label="">
          <div className="mock-set__savebar" style={{ padding: 0 }}>
            <Button size="sm" onClick={updatePassword}>Update password</Button>
            {pwState === "ok" ? <Badge tone="go"><Check size={11} aria-hidden="true" /> Password updated</Badge> : null}
          </div>
        </SettingRow>
      </SettingGroup>

      <SettingGroup label="Two-factor authentication" description="A second proof when you sign in on a new device.">
        <SettingRow
          label="Two-factor authentication"
          description={twoFa ? "On — codes by authenticator app" : "Off — your account is easier to break into"}
          control={<Switch checked={twoFa} onChange={(e) => setTwoFa(e.target.checked)} aria-label="Two-factor authentication" />}
        />
        {twoFa ? (
          <SettingRow
            label="Code method"
            control={
              <div style={{ width: 200 }}>
                <Select
                  aria-label="Code method"
                  defaultValue="app"
                  options={[
                    { value: "app", label: "Authenticator app" },
                    { value: "sms", label: "SMS to +91 98220 41xx" },
                  ]}
                />
              </div>
            }
          />
        ) : null}
      </SettingGroup>

      <SettingGroup label="Active sessions" description="Devices currently signed in.">
        {sessions.map((s) => (
          <SettingRow
            key={s.id}
            label={s.name}
            description={s.current ? `${s.where} · this device` : `${s.where} · ${s.when}`}
            control={
              s.current ? (
                <Badge tone="go">Current</Badge>
              ) : (
                <Button size="sm" variant="ghost">Log out</Button>
              )
            }
          >
            <span className="mock-set__session-icon">{s.icon}</span>
          </SettingRow>
        ))}
        <SettingRow
          label="Log out everywhere else"
          description="Ends all sessions except this one."
          control={<Button size="sm" variant="danger"><LogOut size={14} aria-hidden="true" /> Log out all</Button>}
        />
      </SettingGroup>

      <SettingGroup label="Danger zone">
        <div className="mock-set__danger">
          <SettingRow
            label="Delete account"
            description="Everything is erased after a 14-day grace period. This cannot be undone."
            control={
              <Button size="sm" variant="danger" onClick={() => setDeleteOpen(true)}>
                <Trash2 size={14} aria-hidden="true" /> Delete account
              </Button>
            }
          />
        </div>
      </SettingGroup>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete your account?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Keep my account</Button>
            <Button variant="danger" onClick={() => setDeleteOpen(false)}>Delete in 14 days</Button>
          </>
        }
      >
        Your notes, automations, and apps are erased after 14 days. Download an archive first if
        you need one — this cannot be undone.
      </Dialog>
    </>
  );
}

/* ---------------- Privacy ---------------- */

function PrivacySection() {
  const [switches, setSwitches] = useState({
    activity: true,
    indexing: false,
    receipts: true,
    mentions: true,
  });
  const flip = (k: keyof typeof switches) =>
    setSwitches((s) => ({ ...s, [k]: !s[k] }));

  const whoOptions = [
    { value: "everyone", label: "Everyone" },
    { value: "contacts", label: "Contacts only" },
    { value: "none", label: "Only me" },
  ];

  const [archive, setArchive] = useState<"idle" | "preparing" | "ready">("idle");
  const [blocked, setBlocked] = useState([
    { id: "b1", name: "Spammy Promotions", note: "Blocked Aug 2" },
    { id: "b2", name: "Unknown Caller +91 98…", note: "Blocked Jul 18" },
  ]);

  return (
    <>
      <SettingGroup label="Who can see you" description="Applies to search, your profile page, and the directory.">
        <SettingRow
          label="Profile visibility"
          description="Who can open your full profile."
          control={<div style={{ width: 180 }}><Select aria-label="Profile visibility" defaultValue="contacts" options={whoOptions} /></div>}
        />
        <SettingRow
          label="Look me up by email"
          control={<div style={{ width: 180 }}><Select aria-label="Lookup by email" defaultValue="contacts" options={whoOptions} /></div>}
        />
        <SettingRow
          label="Look me up by phone"
          control={<div style={{ width: 180 }}><Select aria-label="Lookup by phone" defaultValue="none" options={whoOptions} /></div>}
        />
        <SettingRow
          label="Activity status"
          description="Show a green dot when you're online."
          control={<Switch checked={switches.activity} onChange={() => flip("activity")} aria-label="Activity status" />}
        />
        <SettingRow
          label="Search engine indexing"
          description="Let Google link to your public profile."
          control={<Switch checked={switches.indexing} onChange={() => flip("indexing")} aria-label="Search engine indexing" />}
        />
      </SettingGroup>

      <SettingGroup label="Messaging">
        <SettingRow
          label="Who can message you"
          control={
            <div style={{ width: 180 }}>
              <Select
                aria-label="Who can message you"
                defaultValue="contacts"
                options={[
                  { value: "everyone", label: "Everyone" },
                  { value: "contacts", label: "Contacts only" },
                  { value: "none", label: "No one" },
                ]}
              />
            </div>
          }
        />
        <SettingRow
          label="Read receipts"
          description="People see when you've read their message."
          control={<Switch checked={switches.receipts} onChange={() => flip("receipts")} aria-label="Read receipts" />}
        />
        <SettingRow
          label="Allow @mentions"
          description="Others can mention you in notes and chats."
          control={<Switch checked={switches.mentions} onChange={() => flip("mentions")} aria-label="Allow mentions" />}
        />
      </SettingGroup>

      <SettingGroup label="Your data">
        <SettingRow
          label="Download an archive"
          description="Everything you own, as markdown + CSV, by email."
          control={
            archive === "idle" ? (
              <Button size="sm" variant="secondary" onClick={() => { setArchive("preparing"); setTimeout(() => setArchive("ready"), 2000); }}>
                Request archive
              </Button>
            ) : archive === "preparing" ? (
              <Badge tone="warning">Preparing…</Badge>
            ) : (
              <Badge tone="go">Ready — sent to email</Badge>
            )
          }
        />
      </SettingGroup>

      <SettingGroup label="Blocked accounts" description={`${blocked.length} blocked — they can't find or message you.`}>
        {blocked.map((b) => (
          <SettingRow key={b.id} label={b.name} description={b.note}
            control={
              <Button size="sm" variant="ghost" onClick={() => setBlocked((c) => c.filter((x) => x.id !== b.id))}>
                Unblock
              </Button>
            }
          >
            <Avatar name={b.name} size="sm" />
          </SettingRow>
        ))}
        {blocked.length === 0 ? (
          <SettingRow label="No one blocked" description="Accounts you block will appear here." />
        ) : null}
      </SettingGroup>
    </>
  );
}

/* ---------------- Notifications ---------------- */

const NOTIF_ROWS = [
  { id: "mentions", label: "Mentions & replies", desc: "Someone @mentions you or replies to you." },
  { id: "messages", label: "Direct messages", desc: "New messages in one-to-one chats." },
  { id: "invoices", label: "Invoice updates", desc: "Paid, overdue, or failed payments." },
  { id: "brief", label: "Morning brief", desc: "Your daily brief is ready to read." },
  { id: "automations", label: "Automation results", desc: "Runs that finished or need attention." },
  { id: "product", label: "Product news", desc: "New features, at most once a month." },
] as const;

type Channel = "email" | "push" | "whatsapp";
const CHANNELS: { id: Channel; label: string }[] = [
  { id: "email", label: "Email" },
  { id: "push", label: "Push" },
  { id: "whatsapp", label: "WhatsApp" },
];

function NotificationsSection() {
  const [grid, setGrid] = useState<Record<string, Record<Channel, boolean>>>(() =>
    Object.fromEntries(
      NOTIF_ROWS.map((r, i) => [
        r.id,
        { email: i < 4, push: true, whatsapp: i === 1 || i === 3 },
      ]),
    ),
  );
  const [quiet, setQuiet] = useState(true);

  return (
    <>
      <SettingGroup
        label="What reaches you, and where"
        description="Each event picks its channels — email to asha@vermaclinic.in, push to this device, WhatsApp to +91 98220 41xx."
      >
        <div className="mock-set__matrix">
          <div className="mock-set__matrix-head">
            <span />
            {CHANNELS.map((c) => (
              <span key={c.id} className="tw-cue">{c.label}</span>
            ))}
          </div>
          {NOTIF_ROWS.map((row) => (
            <div className="mock-set__matrix-row" key={row.id}>
              <div className="mock-set__matrix-label">
                <span className="tw-srow__label">{row.label}</span>
                <span className="tw-srow__desc">{row.desc}</span>
              </div>
              {CHANNELS.map((c) => (
                <span key={c.id} className="mock-set__matrix-cell">
                  <Switch
                    checked={grid[row.id][c.id]}
                    onChange={() =>
                      setGrid((g) => ({
                        ...g,
                        [row.id]: { ...g[row.id], [c.id]: !g[row.id][c.id] },
                      }))
                    }
                    aria-label={`${row.label} on ${c.label}`}
                  />
                </span>
              ))}
            </div>
          ))}
        </div>
      </SettingGroup>

      <SettingGroup label="Delivery">
        <SettingRow
          label="Summary emails"
          description="Non-urgent updates batched instead of one mail each."
          control={
            <div style={{ width: 180 }}>
              <Select
                aria-label="Summary emails"
                defaultValue="daily"
                options={[
                  { value: "realtime", label: "As they happen" },
                  { value: "daily", label: "Daily digest" },
                  { value: "weekly", label: "Weekly digest" },
                ]}
              />
            </div>
          }
        />
        <SettingRow
          label="Quiet hours"
          description="Only direct calls come through overnight."
          control={<Switch checked={quiet} onChange={(e) => setQuiet(e.target.checked)} aria-label="Quiet hours" />}
        />
        {quiet ? (
          <SettingRow label="From">
            <div className="mock-set__quiet">
              <TimePicker defaultValue={new Date(2026, 0, 1, 22, 0)} aria-label="Quiet from" />
              <span className="tw-srow__desc">to</span>
              <TimePicker defaultValue={new Date(2026, 0, 1, 7, 0)} aria-label="Quiet until" />
            </div>
          </SettingRow>
        ) : null}
      </SettingGroup>
    </>
  );
}

/* ---------------- Appearance ---------------- */

function AppearanceSection() {
  const [theme, setTheme] = useState("day");
  const [density, setDensity] = useState("condensed");

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.dataset.phase = dark ? "night" : "day";
    } else {
      root.dataset.phase = theme;
    }
  }, [theme]);

  return (
    <>
      <SettingGroup label="Theme" description="This changes the real showcase phase — try Night.">
        <SettingRow label="Interface theme">
          <div className="mock-set__radios">
            <Radio name="theme" label="Day" checked={theme === "day"} onChange={() => setTheme("day")} />
            <Radio name="theme" label="Night" checked={theme === "night"} onChange={() => setTheme("night")} />
            <Radio name="theme" label="Follow system" checked={theme === "system"} onChange={() => setTheme("system")} />
          </div>
        </SettingRow>
      </SettingGroup>

      <SettingGroup label="Density">
        <SettingRow label="Information density">
          <div className="mock-set__radios">
            <Radio name="density" label="Condensed" checked={density === "condensed"} onChange={() => setDensity("condensed")} />
            <Radio name="density" label="Comfortable" checked={density === "comfortable"} onChange={() => setDensity("comfortable")} />
            <Radio name="density" label="Spacious" checked={density === "spacious"} onChange={() => setDensity("spacious")} />
          </div>
        </SettingRow>
        <SettingRow label="Preview" description="The frame below follows your density choice.">
          <div className="mock-set__density-preview" data-density={density}>
            <div className="mock-set__density-row" />
            <div className="mock-set__density-row mock-set__density-row--short" />
            <div className="mock-set__density-row" />
          </div>
        </SettingRow>
      </SettingGroup>
    </>
  );
}

/* ---------------- Shell ---------------- */

export function SettingsMock() {
  const [section, setSection] = useState<SectionId>("profile");
  const active = SECTIONS.find((s) => s.id === section)!;

  const bodies: Record<SectionId, ReactNode> = {
    profile: <ProfileSection />,
    account: <AccountSection />,
    privacy: <PrivacySection />,
    notifications: <NotificationsSection />,
    appearance: <AppearanceSection />,
  };

  return (
    <div className="mock-set">
      <header className="mock-set__head">
        <h2>Settings</h2>
        <p>Your profile, security, privacy, and how twodb reaches you.</p>
      </header>
      <div className="mock-set__layout">
        <nav className="mock-set__nav" aria-label="Settings sections">
          <NavSection items={SECTIONS} value={section} onValueChange={(id) => setSection(id as SectionId)} />
        </nav>
        <div className="mock-set__body">
          <h3 className="mock-set__title">{active.label}</h3>
          {bodies[section]}
        </div>
      </div>
    </div>
  );
}
