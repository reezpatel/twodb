import { useCalendar } from "./hooks/useCalendar";
import { EventEditor } from "./partials/EventEditor";
export function App() {
  const c = useCalendar();
  return <div className="day-app"><aside><h1>TwoDay</h1><p>Make room for your day.</p><nav aria-label="Calendars">{c.calendars.map(cal=><button key={cal.id} aria-current={cal.id===c.calendarId ? "page":undefined} onClick={()=>c.selectCalendar(cal.id)}><span style={{color:cal.color}}>●</span> {cal.name}</button>)}</nav>
    <form onSubmit={e=>{e.preventDefault();void c.createCalendar();}}><h2>New calendar</h2><label>Space<select required value={c.spaceId} onChange={e=>c.setSpaceId(e.target.value)}>{c.spaces.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Name<input required maxLength={200} value={c.name} onChange={e=>c.setName(e.target.value)}/></label><button disabled={c.busy||!c.spaceId}>Create calendar</button></form>
  </aside><main><header><div><h2>{c.calendars.find(cal=>cal.id===c.calendarId)?.name ?? "Calendar"}</h2><p>Agenda · local events</p></div><button className="primary" disabled={!c.calendarId||c.busy} onClick={c.add}>New event</button></header>
    {c.error && <p role="alert" className="error">{c.error}</p>}
    <label className="month">Month<input type="month" required value={c.month} onChange={e=>{if(e.target.value)c.setMonth(e.target.value);}}/></label>
    <div className="workspace"><section aria-label="Agenda" aria-busy={c.loading}>{c.loading ? <p role="status">Loading events…</p> : !c.events.length ? <p className="empty">{c.calendars.length ? "No events this month. Add an event to get started." : "Create a calendar in a space to get started."}</p> : c.events.map(event=><button key={event.id} className="event-row" disabled={c.busy} onClick={()=>c.edit(event)}><strong>{event.title}</strong><small>{event.allDay ? `${event.startDate} → ${event.endDate} (exclusive) · All day` : `${new Date(event.startAt!).toLocaleString()} → ${new Date(event.endAt!).toLocaleString()}`}</small>{event.location && <small>{event.location}</small>}</button>)}<p>Up to 500 events per month. Invitations and provider sync are not enabled.</p></section>
    {c.draft && <EventEditor draft={c.draft} busy={c.busy} onChange={c.setDraft} onAllDay={c.toggleAllDay} onSave={c.save} onDelete={c.remove} onClose={()=>c.setDraft(null)}/>}</div>
  </main></div>;
}
