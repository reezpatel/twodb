import { useState, type ReactNode } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  Divider,
  Input,
  Radio,
  Select,
  Skeleton,
  Switch,
  Tabs,
  Textarea,
  Tooltip,
} from "@twodb/ui";

export interface Story {
  title: string;
  render: () => ReactNode;
  code?: string;
}

export interface ComponentEntry {
  id: string;
  group: "Foundation" | "Primitives";
  name: string;
  description: string;
  stories: Story[];
}

/* --- Signature foundation piece: the horizon, night → day --- */
function HorizonStrip() {
  const cues = [
    { n: "00", name: "Night", hex: "#050506", bg: "#050506", ink: "#f4f3f8" },
    { n: "10", name: "Cobalt horizon", hex: "#0A2BFF", bg: "#0a2bff", ink: "#ffffff" },
    { n: "20", name: "Rose gather", hex: "#D24BFF", bg: "#d24bff", ink: "#ffffff" },
    { n: "30", name: "Rose light", hex: "#FF7BAE", bg: "#ff7bae", ink: "#121218" },
    { n: "40", name: "Dawn wash", hex: "#FFD7E6", bg: "#ffd7e6", ink: "#121218" },
    { n: "50", name: "Day", hex: "#FFFFFF", bg: "#ffffff", ink: "#121218" },
  ];
  return (
    <div className="horizon">
      {cues.map((c) => (
        <div key={c.n} className="horizon__band" style={{ background: c.bg, color: c.ink }}>
          <span className="horizon__cue">{c.n}</span>
          <span className="horizon__name">{c.name}</span>
          <span className="horizon__hex tw-tnum">{c.hex}</span>
        </div>
      ))}
    </div>
  );
}

function TypeScale() {
  const rows = [
    { label: "Display / cue", cls: "type-demo__cue", text: "LIGHT RISES ON YOUR WORK" },
    { label: "Title", cls: "type-demo__title", text: "Every note, one horizon" },
    { label: "Body", cls: "type-demo__body", text: "Capture it in seconds. Find it in one search. Let the light carry the state — never shadow, never noise." },
    { label: "Data / tabular", cls: "type-demo__data tw-tnum", text: "06:12:00 · 128 notes · 99.9%" },
  ];
  return (
    <div className="type-demo">
      {rows.map((r) => (
        <div key={r.label} className="type-demo__row">
          <span className="tw-cue">{r.label}</span>
          <span className={r.cls}>{r.text}</span>
        </div>
      ))}
    </div>
  );
}

/* --- Stateful demos --- */
function TabsDemo() {
  const [tab, setTab] = useState("notes");
  return (
    <div style={{ width: "100%" }}>
      <Tabs
        aria-label="Demo sections"
        value={tab}
        onValueChange={setTab}
        items={[
          { id: "notes", label: "Notes" },
          { id: "automations", label: "Automations" },
          { id: "apps", label: "Apps" },
        ]}
      />
      <p style={{ marginTop: 12, color: "var(--ink-2)" }}>
        {tab === "notes" && "Notes live here — each one a card on the horizon."}
        {tab === "automations" && "Automations: plain-language rules that act for you."}
        {tab === "apps" && "Apps the AI built for you, ready to use."}
      </p>
    </div>
  );
}

function DialogDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Open dialog
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Archive this note?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Keep it
            </Button>
            <Button onClick={() => setOpen(false)}>Archive</Button>
          </>
        }
      >
        It stays searchable, but leaves your daily view. You can bring it back any time.
      </Dialog>
    </>
  );
}

export const registry: ComponentEntry[] = [
  {
    id: "horizon",
    group: "Foundation",
    name: "The Horizon",
    description:
      "The palette is one sweep of light: depthless night, a cobalt horizon, rose gathering, dawn wash, day. Color is never decoration — it is the phase a surface is in.",
    stories: [
      {
        title: "Phases",
        render: () => <HorizonStrip />,
        code: `--twdb-night: #050506;   /* 00 night */
--twdb-cobalt: #0A2BFF;  /* 10 cobalt horizon */
--twdb-rose: #D24BFF;    /* 20 rose gather */
--twdb-rose-light: #FF7BAE; /* 30 rose light */
--twdb-dawn: #FFD7E6;    /* 40 dawn wash */
--twdb-day: #FFFFFF;     /* 50 day */`,
      },
      {
        title: "The sweep — identity only",
        render: () => (
          <div
            style={{
              height: 72,
              width: "100%",
              borderRadius: "var(--r-md)",
              background: "var(--wash)",
            }}
          />
        ),
        code: `--wash: linear-gradient(105deg,
  var(--twdb-cobalt) 0%,
  var(--twdb-rose) 55%,
  var(--twdb-rose-light) 100%);

/* Identity material only. Controls stay flat —
   the primary action is solid cobalt, no gradient
   fills, no glow, no colored shadows. */`,
      },
    ],
  },
  {
    id: "typography",
    group: "Foundation",
    name: "Typography",
    description:
      "Two voices: Public Sans carries the interface at reading sizes; Oswald speaks only in tracked caps — cue labels, the wordmark, instrument readouts. Numerals run tabular.",
    stories: [
      {
        title: "Scale",
        render: () => <TypeScale />,
        code: `--font-ui: "Public Sans", system-ui, sans-serif;
--font-cue: "Oswald", "Public Sans", sans-serif;
--tracking-cue: 0.14em;

.tw-cue   { /* tracked caps, instrument labels */ }
.tw-tnum  { /* tabular-nums for data */ }`,
      },
    ],
  },
  {
    id: "button",
    group: "Primitives",
    name: "Button",
    description:
      "Quiet until lit. Only the primary action carries color — a flat cobalt; everything else is hairline and ink until hovered.",
    stories: [
      {
        title: "Variants",
        render: () => (
          <div className="row">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
          </div>
        ),
        code: `<Button>Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="danger">Danger</Button>`,
      },
      {
        title: "Sizes",
        render: () => (
          <div className="row">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>
        ),
        code: `<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>`,
      },
      {
        title: "Disabled",
        render: () => (
          <div className="row">
            <Button disabled>Primary</Button>
            <Button variant="secondary" disabled>
              Secondary
            </Button>
          </div>
        ),
        code: `<Button disabled>Primary</Button>
<Button variant="secondary" disabled>Secondary</Button>`,
      },
    ],
  },
  {
    id: "input",
    group: "Primitives",
    name: "Input",
    description: "A hairline instrument. Focus arrives as a ring of light; errors name the problem.",
    stories: [
      {
        title: "States",
        render: () => (
          <div className="row" style={{ alignItems: "flex-start" }}>
            <Input label="Full name" placeholder="Dr. Asha Verma" />
            <Input label="Phone" placeholder="+91 98765 43210" hint="Used only for reminders" />
            <Input label="Email" defaultValue="asha@clinic" error="That address is incomplete" />
          </div>
        ),
        code: `<Input label="Full name" placeholder="Dr. Asha Verma" />
<Input label="Phone" hint="Used only for reminders" />
<Input label="Email" error="That address is incomplete" />`,
      },
    ],
  },
  {
    id: "textarea",
    group: "Primitives",
    name: "Textarea",
    description: "For longer capture — the note itself.",
    stories: [
      {
        title: "Default",
        render: () => (
          <div style={{ maxWidth: 420, width: "100%" }}>
            <Textarea label="Note" placeholder="Patient reports the fever broke overnight…" />
          </div>
        ),
        code: `<Textarea label="Note" placeholder="Patient reports the fever broke overnight…" />`,
      },
    ],
  },
  {
    id: "select",
    group: "Primitives",
    name: "Select",
    description: "Native under the hood, styled to the horizon.",
    stories: [
      {
        title: "Default",
        render: () => (
          <Select label="Reminder" defaultValue="morning">
            <option value="morning">Every morning</option>
            <option value="week">Once a week</option>
            <option value="never">Never</option>
          </Select>
        ),
        code: `<Select label="Reminder" defaultValue="morning">
  <option value="morning">Every morning</option>
  <option value="week">Once a week</option>
  <option value="never">Never</option>
</Select>`,
      },
    ],
  },
  {
    id: "checkbox",
    group: "Primitives",
    name: "Checkbox",
    description: "A small box that lights when chosen.",
    stories: [
      {
        title: "States",
        render: () => (
          <div className="row">
            <Checkbox label="Sync this notebook" defaultChecked />
            <Checkbox label="Share with assistant" />
            <Checkbox label="Unavailable" disabled />
          </div>
        ),
        code: `<Checkbox label="Sync this notebook" defaultChecked />
<Checkbox label="Share with assistant" />
<Checkbox label="Unavailable" disabled />`,
      },
    ],
  },
  {
    id: "radio",
    group: "Primitives",
    name: "Radio",
    description: "One choice of several — the lit dot.",
    stories: [
      {
        title: "Group",
        render: () => (
          <div className="row">
            <Radio name="density" label="Condensed" defaultChecked />
            <Radio name="density" label="Comfortable" />
            <Radio name="density" label="Spacious" />
          </div>
        ),
        code: `<Radio name="density" label="Condensed" defaultChecked />
<Radio name="density" label="Comfortable" />
<Radio name="density" label="Spacious" />`,
      },
    ],
  },
  {
    id: "switch",
    group: "Primitives",
    name: "Switch",
    description: "The track lights flat cobalt when on.",
    stories: [
      {
        title: "States",
        render: () => (
          <div className="row">
            <Switch label="Morning summary" defaultChecked />
            <Switch label="Automation active" />
          </div>
        ),
        code: `<Switch label="Morning summary" defaultChecked />
<Switch label="Automation active" />`,
      },
    ],
  },
  {
    id: "badge",
    group: "Primitives",
    name: "Badge",
    description: "Small tracked pills for state. Cobalt means go; rose marks the AI's hand.",
    stories: [
      {
        title: "Tones",
        render: () => (
          <div className="row">
            <Badge>Neutral</Badge>
            <Badge tone="go">Synced</Badge>
            <Badge tone="rose">AI draft</Badge>
            <Badge tone="warning">Due soon</Badge>
            <Badge tone="danger">Failed</Badge>
          </div>
        ),
        code: `<Badge>Neutral</Badge>
<Badge tone="go">Synced</Badge>
<Badge tone="rose">AI draft</Badge>
<Badge tone="warning">Due soon</Badge>
<Badge tone="danger">Failed</Badge>`,
      },
    ],
  },
  {
    id: "card",
    group: "Primitives",
    name: "Card",
    description: "A matte band bounded by hairlines — never shadow, never nested.",
    stories: [
      {
        title: "Default",
        render: () => (
          <div style={{ maxWidth: 420, width: "100%" }}>
            <Card
              title="Morning brief"
              actions={<Badge tone="rose">AI</Badge>}
            >
              Three appointments today. Two invoices unpaid. One note from yesterday
              links to both.
            </Card>
          </div>
        ),
        code: `<Card title="Morning brief" actions={<Badge tone="rose">AI</Badge>}>
  Three appointments today. Two invoices unpaid.
</Card>`,
      },
    ],
  },
  {
    id: "tabs",
    group: "Primitives",
    name: "Tabs",
    description: "The active tab's horizon lights in cobalt.",
    stories: [
      {
        title: "Default",
        render: () => <TabsDemo />,
        code: `const [tab, setTab] = useState("notes");

<Tabs
  aria-label="Sections"
  value={tab}
  onValueChange={setTab}
  items={[
    { id: "notes", label: "Notes" },
    { id: "automations", label: "Automations" },
    { id: "apps", label: "Apps" },
  ]}
/>`,
      },
    ],
  },
  {
    id: "dialog",
    group: "Primitives",
    name: "Dialog",
    description: "The stage dims; one lit panel rises. Used only when focus must be protected.",
    stories: [
      {
        title: "Default",
        render: () => <DialogDemo />,
        code: `<Dialog
  open={open}
  onClose={close}
  title="Archive this note?"
  footer={<Button onClick={close}>Archive</Button>}
>
  It stays searchable, but leaves your daily view.
</Dialog>`,
      },
    ],
  },
  {
    id: "avatar",
    group: "Primitives",
    name: "Avatar",
    description: "A soft token for a person — initials until a photo exists.",
    stories: [
      {
        title: "Sizes",
        render: () => (
          <div className="row">
            <Avatar name="Asha Verma" size="sm" />
            <Avatar name="Asha Verma" size="md" />
            <Avatar name="Ravi Kumar" size="lg" />
          </div>
        ),
        code: `<Avatar name="Asha Verma" size="sm" />
<Avatar name="Asha Verma" size="md" />
<Avatar name="Ravi Kumar" size="lg" />`,
      },
    ],
  },
  {
    id: "divider",
    group: "Primitives",
    name: "Divider",
    description: "The horizon rule: a hairline that fades at the edges.",
    stories: [
      {
        title: "Variants",
        render: () => (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 24 }}>
            <Divider />
            <Divider label="Yesterday" />
          </div>
        ),
        code: `<Divider />
<Divider label="Yesterday" />`,
      },
    ],
  },
  {
    id: "skeleton",
    group: "Primitives",
    name: "Skeleton",
    description: "The band warming up before content arrives. Stills completely under reduced motion.",
    stories: [
      {
        title: "Default",
        render: () => (
          <div style={{ maxWidth: 420, width: "100%" }}>
            <Skeleton lines={3} />
          </div>
        ),
        code: `<Skeleton lines={3} />`,
      },
    ],
  },
  {
    id: "tooltip",
    group: "Primitives",
    name: "Tooltip",
    description: "A console readout: always night, always brief.",
    stories: [
      {
        title: "Default",
        render: () => (
          <Tooltip tip="Linked to 4 notes">
            <Button variant="secondary">Hover or focus me</Button>
          </Tooltip>
        ),
        code: `<Tooltip tip="Linked to 4 notes">
  <Button variant="secondary">Hover or focus me</Button>
</Tooltip>`,
      },
    ],
  },
];
