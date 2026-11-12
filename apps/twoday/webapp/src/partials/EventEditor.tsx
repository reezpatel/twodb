import type { Draft } from "../hooks/useCalendar";
export function EventEditor({ draft, busy, onChange, onAllDay, onSave, onDelete, onClose }: { draft: Draft; busy: boolean; onChange:(v:Draft)=>void; onAllDay:(v:boolean)=>void; onSave:()=>void; onDelete:()=>void; onClose:()=>void }) {
  return <form className="event-editor" onSubmit={e=>{e.preventDefault();onSave();}}><header><h2>{draft.id ? "Edit event":"New event"}</h2><button type="button" disabled={busy} onClick={onClose}>Close</button></header><fieldset disabled={busy}>
    <label>Title<input required maxLength={300} value={draft.title} onChange={e=>onChange({...draft,title:e.target.value})}/></label>
    <label className="check"><input type="checkbox" checked={draft.allDay} onChange={e=>onAllDay(e.target.checked)}/>All day</label>
    <label>Start<input required type={draft.allDay ? "date":"datetime-local"} value={draft.start} onChange={e=>onChange({...draft,start:e.target.value})}/></label>
    <label>{draft.allDay ? "End date (exclusive)":"End"}<input required type={draft.allDay ? "date":"datetime-local"} value={draft.end} onChange={e=>onChange({...draft,end:e.target.value})}/></label>
    <p>{draft.allDay ? "A one-day event ends on the following date." : "Times use your browser’s local timezone."}</p>
    <label>Location<input value={draft.location} maxLength={1000} onChange={e=>onChange({...draft,location:e.target.value})}/></label>
    <label>Description<textarea rows={5} value={draft.description} maxLength={20000} onChange={e=>onChange({...draft,description:e.target.value})}/></label>
    <footer><button className="primary">{busy ? "Saving…":"Save event"}</button>{draft.id && <button type="button" onClick={onDelete}>Delete</button>}</footer>
  </fieldset></form>;
}
