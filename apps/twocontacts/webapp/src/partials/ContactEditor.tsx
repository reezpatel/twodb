import type { Draft } from "../hooks/useContacts";
export function ContactEditor({ draft, editing, busy, onChange, onSave, onDelete, onClose }: {
  draft: Draft; editing: boolean; busy: boolean; onChange: (draft: Draft) => void; onSave: () => void; onDelete: () => void; onClose: () => void;
}) {
  return <form className="contact-editor" onSubmit={e => { e.preventDefault(); onSave(); }}>
    <header><h2>{editing ? "Edit contact" : "New contact"}</h2><button type="button" disabled={busy} onClick={onClose}>Close</button></header>
    <fieldset disabled={busy}>
      <label>Name<input value={draft.name} maxLength={200} onChange={e => onChange({ ...draft, name: e.target.value })}/></label>
      <label>Email<input required type="email" value={draft.email} maxLength={320} onChange={e => onChange({ ...draft, email: e.target.value })}/></label>
      <label>Phone<input type="tel" value={draft.phone} maxLength={100} onChange={e => onChange({ ...draft, phone: e.target.value })}/></label>
      <label>Company<input value={draft.company} maxLength={200} onChange={e => onChange({ ...draft, company: e.target.value })}/></label>
      <label>Notes<textarea value={draft.notes} maxLength={20000} rows={6} onChange={e => onChange({ ...draft, notes: e.target.value })}/></label>
      <label className="check"><input type="checkbox" checked={draft.pinned} onChange={e => onChange({ ...draft, pinned: e.target.checked })}/>Favorite</label>
      <footer><button className="primary" type="submit">{busy ? "Saving…" : "Save contact"}</button>{editing && <button type="button" className="danger" onClick={onDelete}>Delete</button>}</footer>
    </fieldset>
  </form>;
}
