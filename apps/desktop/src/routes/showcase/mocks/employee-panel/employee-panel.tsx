import { useMemo, useState } from "react";
import { Avatar, Badge, Button, IconButton, Menu, MenuDivider, MenuItem } from "../../ui-shims";
import { ExternalLink, FileText, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import "./employee-panel.css";

/* ---------- DayTimeline (ported from @twodb/ui) ---------- */

interface TimelineSegment {
  label: string;
  /** Minutes from midnight. */
  start: number;
  end: number;
  /** Optional color override; defaults cycle the horizon palette. */
  tone?: string;
}

const DAYLINE_TONES = ["var(--color-primary)", "var(--color-magenta-400)", "var(--color-magenta-300)", "#ffd7e6"];

function fmtHour(h: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${String(hr).padStart(2, "0")}:00 ${period}`;
}

function DayTimeline({
  segments,
  startHour,
  endHour,
  tickEvery = 2,
  title,
  dateLabel,
  tracking,
}: {
  segments: TimelineSegment[];
  startHour?: number;
  endHour?: number;
  tickEvery?: number;
  title?: string;
  dateLabel?: string;
  tracking?: boolean;
}) {
  const { from, ticks, total } = useMemo(() => {
    const minStart = Math.min(...segments.map((s) => s.start));
    const maxEnd = Math.max(...segments.map((s) => s.end));
    const fromMin = (startHour ?? Math.floor(minStart / 60)) * 60;
    const toMin = (endHour ?? Math.ceil(maxEnd / 60)) * 60;
    const ticksArr: number[] = [];
    for (let h = fromMin / 60; h <= toMin / 60; h += tickEvery) ticksArr.push(h);
    return { from: fromMin, ticks: ticksArr, total: toMin - fromMin };
  }, [segments, startHour, endHour, tickEvery]);

  const tracked = segments.reduce((sum, s) => sum + (s.end - s.start), 0);

  return (
    <div className="tw-dayline">
      {title || dateLabel || tracking !== undefined ? (
        <div className="tw-dayline__head">
          <span className="tw-dayline__title">
            {title ? <strong>{title}</strong> : null}
            {dateLabel ? <span className="tw-dayline__date tw-tnum">{dateLabel}</span> : null}
          </span>
          {tracking !== undefined ? (
            <span className="tw-dayline__tracking">
              Tracking:
              <i className={tracking ? "tw-dayline__dot tw-dayline__dot--on" : "tw-dayline__dot"} />
              {tracking ? "Active" : "Paused"}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="tw-dayline__bar" role="img" aria-label={segments.map((s) => `${s.label} ${fmtHour(s.start / 60)}–${fmtHour(s.end / 60)}`).join(", ")}>
        {segments.map((s, i) => {
          const left = ((s.start - from) / total) * 100;
          const width = ((s.end - s.start) / total) * 100;
          return (
            <span
              key={s.label + s.start}
              className="tw-dayline__seg"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                background: s.tone ?? DAYLINE_TONES[i % DAYLINE_TONES.length],
              }}
            />
          );
        })}
      </div>

      <div className="tw-dayline__axis tw-tnum">
        {ticks.map((h) => (
          <span key={h} style={{ left: `${((h * 60 - from) / total) * 100}%` }}>
            {fmtHour(h)}
          </span>
        ))}
      </div>

      <div className="tw-dayline__legend">
        {segments.map((s, i) => {
          const pct = Math.round(((s.end - s.start) / tracked) * 100);
          return (
            <span key={s.label} className="tw-dayline__legend-item">
              <i style={{ background: s.tone ?? DAYLINE_TONES[i % DAYLINE_TONES.length] }} />
              <b className="tw-tnum">{pct}%</b> {s.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- data ---------- */

const DAY_SEGMENTS = [
  { label: "Nexora Web", start: 10 * 60, end: 14 * 60 + 15 },
  { label: "Bluemint App", start: 14 * 60 + 15, end: 18 * 60 + 20 },
  { label: "Klaro", start: 18 * 60 + 20, end: 20 * 60 + 30 },
  { label: "FEST", start: 20 * 60 + 30, end: 21 * 60 },
];

const NOTES = [
  {
    id: "n1",
    author: "Anna Kozar",
    scope: "Private",
    date: "Monday, 09 Jan 2026",
    text: "Approved extended PTO request for January.",
  },
  {
    id: "n2",
    author: "Anna Kozar",
    scope: "Public",
    date: "Monday, 21 Nov 2025",
    text: "Completed the advanced 'Inclusive Leadership' corporate certification.",
  },
];

const FILES = [
  { id: "f1", name: "New_Team_Protocols.pdf", meta: "PDF · 2.6 MB" },
  { id: "f2", name: "Employee_Guidelines.docx", meta: "DOCX · 115 KB" },
];

const COMP = [
  {
    label: "Pay rate",
    value: "$44/hour",
    from: "From 11/21/2025",
    current: true,
  },
  {
    label: "Pay rate",
    value: "$41/hour",
    from: "From 07/11/2025",
    current: false,
  },
  {
    label: "Billable rate",
    value: "$45",
    from: "From 11/21/2025",
    current: true,
  },
  {
    label: "Billable rate",
    value: "$40",
    from: "From 07/11/2025",
    current: false,
  },
];

export function EmployeePanelMock() {
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <div className="mock-emp__reopen">
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Reopen panel
        </Button>
      </div>
    );
  }

  return (
    <div className="mock-emp">
      <aside className="mock-emp__panel" aria-label="Employee profile">
        <header className="mock-emp__bar">
          <h3>Employee profile</h3>
          <div className="mock-emp__bar-actions">
            <IconButton label="Open full page" icon={<ExternalLink />} />
            <IconButton label="Close panel" icon={<X />} onClick={() => setOpen(false)} />
          </div>
        </header>

        <div className="mock-emp__scroll">
          {/* profile */}
          <div className="mock-emp__profile">
            <span className="mock-emp__avatar">
              <Avatar name="Emily Davidson" size="lg" />
              <i className="mock-emp__online" aria-label="Online" />
            </span>
            <div className="mock-emp__who">
              <strong>Emily Davidson</strong>
              <span>Co-Admin, Team Manager</span>
            </div>
            <Button size="sm" variant="ghost">
              <Pencil size={13} aria-hidden="true" />
              Edit Profile
            </Button>
          </div>

          <dl className="mock-emp__info">
            <div>
              <dt>Email address</dt>
              <dd>edavidson@gmail.com</dd>
            </div>
            <div>
              <dt>Phone number</dt>
              <dd className="tw-tnum">+1 (303) 555-0134</dd>
            </div>
            <div>
              <dt>Timezone</dt>
              <dd>(UTC-07:00) Denver</dd>
            </div>
          </dl>

          {/* timeline */}
          <section className="mock-emp__section">
            <DayTimeline title="Timeline" dateLabel="Today, Apr 05 2026" tracking segments={DAY_SEGMENTS} tickEvery={3} />
          </section>

          {/* notes */}
          <section className="mock-emp__section">
            <h4>Notes</h4>
            {NOTES.map((n) => (
              <div key={n.id} className="mock-emp__note">
                <div className="mock-emp__note-head">
                  <strong>{n.author}</strong>
                  <Badge size="sm" tone={n.scope === "Private" ? "neutral" : "go"}>
                    {n.scope}
                  </Badge>
                  <Menu trigger={<IconButton size="sm" label={`Options for note by ${n.author}`} icon={<MoreHorizontal />} />}>
                    <MenuItem icon={<Pencil />}>Edit note</MenuItem>
                    <MenuDivider />
                    <MenuItem icon={<Trash2 />} danger>
                      Delete
                    </MenuItem>
                  </Menu>
                </div>
                <span className="mock-emp__note-date tw-tnum">{n.date}</span>
                <p>{n.text}</p>
              </div>
            ))}
          </section>

          {/* files */}
          <section className="mock-emp__section">
            <h4>Files</h4>
            <div className="mock-emp__files">
              {FILES.map((f) => (
                <div key={f.id} className="mock-emp__file">
                  <span className="mock-emp__file-icon">
                    <FileText size={15} aria-hidden="true" />
                  </span>
                  <div className="mock-emp__file-meta">
                    <strong>{f.name}</strong>
                    <span className="tw-tnum">{f.meta}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* compensations */}
          <section className="mock-emp__section">
            <h4>Compensations</h4>
            <div className="mock-emp__comp">
              {COMP.map((c, i) => (
                <div key={i} className={c.current ? "mock-emp__comp-row" : "mock-emp__comp-row mock-emp__comp-row--past"}>
                  <span className="mock-emp__comp-label">{c.label}</span>
                  <span className="mock-emp__comp-from tw-tnum">{c.from}</span>
                  <strong className="tw-tnum">{c.value}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
