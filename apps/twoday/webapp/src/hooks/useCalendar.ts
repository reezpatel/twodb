import { useEffect, useRef, useState } from "react";
export interface Calendar { id: string; name: string; color: string }
export interface CalendarEvent { id: string; calendarId: string; title: string; description: string; location: string; allDay: boolean; startAt: string | null; endAt: string | null; startDate: string | null; endDate: string | null }
export interface Draft { id?: string; calendarId: string; title: string; description: string; location: string; allDay: boolean; start: string; end: string }
function local(date: Date) { return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16); }
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "include", ...init, headers: { "Content-Type": "application/json" } });
  if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(res.status === 401 ? "Sign in to TwoDB and reload this page." : body.error ?? `Request failed (${res.status})`); }
  return res.json();
}
const base = "/apps/twoday";
export function useCalendar() {
  const [calendars, setCalendars] = useState<Calendar[]>([]), [calendarId, setCalendarId] = useState("");
  const [spaces, setSpaces] = useState<{id: string; name: string}[]>([]), [spaceId, setSpaceId] = useState("");
  const [name, setName] = useState("");
  const [month, setMonth] = useState(local(new Date()).slice(0,7));
  const [events, setEvents] = useState<CalendarEvent[]>([]), [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [revision, setRevision] = useState(0);
  const lock = useRef(false);
  useEffect(() => { let active = true;
    Promise.all([api<Calendar[]>(`${base}/calendars`), api<{spaces: {id: string; name: string}[]}>("/registry/spaces")]).then(([c,s]) => {
      if (active) { setCalendars(c); setCalendarId(c[0]?.id ?? ""); setSpaces(s.spaces); setSpaceId(s.spaces[0]?.id ?? ""); }
    }).catch(e => { if (active) setError(e.message); }); return () => { active = false; };
  }, []);
  useEffect(() => { let active = true;
    if (!/^\d{4}-\d{2}$/.test(month)) return;
    const [year,m] = month.split("-").map(Number);
    // Expand by one UTC day on each side, then filter in local time below.
    const from = new Date(Date.UTC(year,m-1,0)).toISOString().slice(0,10);
    const to = new Date(Date.UTC(year,m,2)).toISOString().slice(0,10);
    setLoading(true);
    api<CalendarEvent[]>(`${base}/events?${new URLSearchParams({ from, to, ...(calendarId ? {calendarId} : {}) })}`).then(rows => {
      if (active) setEvents(rows.filter(e => {
        const start = e.allDay ? e.startDate! : local(new Date(e.startAt!)).slice(0,10);
        const end = e.allDay ? e.endDate! : local(new Date(e.endAt!));
        return start.slice(0,7) <= month && end > `${month}-01${e.allDay ? "" : "T00:00"}`;
      }).sort((a,b) => (a.startDate ?? local(new Date(a.startAt!))).localeCompare(b.startDate ?? local(new Date(b.startAt!)))));
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month,calendarId,revision]);
  async function perform(action: () => Promise<void>) { if (lock.current) return; lock.current = true; setBusy(true); setError(""); try { await action(); } catch(e) { setError((e as Error).message); } finally { lock.current = false; setBusy(false); } }
  return { calendars, calendarId, selectCalendar: (id: string) => { setCalendarId(id); setDraft(null); }, spaces, spaceId, setSpaceId, name, setName, month, setMonth, events, draft, setDraft, error, busy, loading,
    createCalendar: () => perform(async () => { const c = await api<Calendar>(`${base}/calendars`, { method: "POST", body: JSON.stringify({spaceId,name}) }); setCalendars(rows => [...rows,c]); setCalendarId(c.id); setName(""); }),
    add: () => { const start = new Date(); start.setSeconds(0,0); setDraft({calendarId, title: "", description: "", location: "", allDay:false, start: local(start), end: local(new Date(start.getTime()+3600000))}); },
    edit: (e: CalendarEvent) => setDraft({id:e.id, calendarId:e.calendarId, title:e.title, description:e.description, location:e.location, allDay:e.allDay, start:e.allDay ? e.startDate! : local(new Date(e.startAt!)), end:e.allDay ? e.endDate! : local(new Date(e.endAt!))}),
    toggleAllDay: (allDay: boolean) => setDraft(d => d ? {...d,allDay,start: allDay ? d.start.slice(0,10) : `${d.start}T09:00`, end: allDay ? new Date(Date.parse(d.start.slice(0,10))+86400000).toISOString().slice(0,10) : `${d.end}T09:00`} : null),
    save: () => perform(async () => { if (!draft) return; const {id,start,end,...fields} = draft;
      if (end <= start) throw new Error("End must be after start.");
      const payload = {...fields, startAt: draft.allDay ? null : new Date(start).toISOString(), endAt: draft.allDay ? null : new Date(end).toISOString(), startDate:draft.allDay ? start : null, endDate:draft.allDay ? end : null};
      await api(`${base}/events${id ? `/${id}` : ""}`, {method:id ? "PUT":"POST", body:JSON.stringify(payload)}); setDraft(null); setRevision(r=>r+1);
    }),
    remove: () => { if (draft?.id && window.confirm("Permanently delete this event?")) void perform(async () => { await api(`${base}/events/${draft.id}`,{method:"DELETE"}); setDraft(null); setRevision(r=>r+1); }); },
  };
}
