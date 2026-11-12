import { useContacts } from "./hooks/useContacts";
import { ContactEditor } from "./partials/ContactEditor";
export function App() {
  const c = useContacts();
  return <div className="contacts-app"><aside>
    <h1>TwoContacts</h1><p>Your people, organized.</p>
    <nav aria-label="Address books">{c.books.map(b => <button key={b.id} aria-current={b.id === c.bookId ? "page" : undefined} onClick={() => c.selectBook(b.id)}>{b.name}</button>)}</nav>
    <form onSubmit={e => { e.preventDefault(); void c.createBook(); }}><h2>New address book</h2>
      <label>Space<select required value={c.spaceId} onChange={e => c.setSpaceId(e.target.value)}>{c.spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>Name<input required maxLength={200} value={c.bookName} onChange={e => c.setBookName(e.target.value)}/></label>
      <button disabled={c.busy || !c.spaceId}>Create book</button>
    </form>
  </aside><main>
    <header><div><h2>{c.books.find(b => b.id === c.bookId)?.name ?? "Contacts"}</h2><p>Address book</p></div><button className="primary" disabled={!c.bookId || c.busy} onClick={c.add}>New contact</button></header>
    {c.error && <p role="alert" className="error">{c.error}</p>}
    <input className="search" type="search" aria-label="Search contacts" placeholder="Search name, email or company…" value={c.query} onChange={e => c.setQuery(e.target.value)}/>
    <div className="workspace"><section aria-label="Contacts" aria-busy={c.loading}>
      {c.loading ? <p role="status">Loading contacts…</p> : !c.contacts.length ? <p className="empty">{c.books.length ? "No contacts found. Add a contact to get started." : "Create an address book in a space to get started."}</p> : c.contacts.map(contact => <button className="contact-row" key={contact.id} disabled={c.busy} onClick={() => c.edit(contact)}>
        <span className="avatar">{(contact.name || contact.email).slice(0, 1).toUpperCase()}</span><span><strong>{contact.name || contact.email}{contact.pinned ? " ★" : ""}</strong><small>{contact.email}</small>{contact.company && <small>{contact.company}</small>}</span>
      </button>)}
      {c.contacts.length === 200 && <p>Showing the first 200 results. Refine your search to find more.</p>}
    </section>{c.draft && <ContactEditor draft={c.draft} editing={!!c.editingId} busy={c.busy} onChange={c.setDraft} onSave={c.save} onDelete={c.remove} onClose={() => c.setDraft(null)}/>}</div>
  </main></div>;
}
