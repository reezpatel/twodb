# @twodb/editor (twodb-editor)

Shared rich-text editor for twodb apps, built on TipTap v3. Content is stored as **HTML**.

```tsx
import "@twodb/editor/styles.css";
import { RichTextEditor, RichTextView } from "@twodb/editor";

<RichTextEditor value={html} onChange={setHtml} placeholder="Describe…" onUploadImage={async (file) => url} />
<RichTextView html={html} />   // sanitized, read-only
```

- Bold/italic/underline/strike/code, headings, lists, task lists, quotes, code blocks, links, images (paste/drop/upload).
- `RichTextEditor` props: `value`, `onChange`, `onBlur`, `placeholder`, `editable`, `minimal` (no toolbar), `autofocus`, `onUploadImage`, `onSubmit` (Mod-Enter).
- `RichTextView` always runs HTML through DOMPurify — use it for anything that came from a user.
- Styling uses `@twodb/blocks` theme tokens (`text-ink`, `border-outline`, `bg-stone`…); the host app must load `@twodb/blocks/styles.css`.

## BlockEditor (Notion/AFFiNE-style, TipTap JSON)

```tsx
import "@twodb/editor/block.css";
import { BlockEditor } from "@twodb/editor";

<BlockEditor
  key={pageId}                       // uncontrolled: remount to load another doc
  initialContent={doc}               // TipTap JSON
  onChange={(json) => save(json)}    // debounce on the host side
  searchPages={(q) => …}             // @ and [[ mentions → `pageMention {id,title}` nodes
  createPage={(title) => …}          // "Create page" entry in the mention menu
  openPage={(id) => navigate(id)}
  uploadImage={(file) => url}
  slashItems={[…]}                   // extra "/" entries (sub-page, database…)
  DatabaseBlock={MyDatabaseBlock}    // renders `databaseView {databaseId, viewId}` blocks
  PageMention={MyMentionChip}        // live titles for mentions
/>
```

Slash menu (text, headings, lists, to-dos, toggle, quote, callout, divider, code, table, image, link to page), block gutter (`+` inserts below and opens `/`, grip drags/selects), selection toolbar (turn into, marks, highlight, link). Markdown shortcuts come from StarterKit (`# `, `- `, `[] `, `> `, ` ``` `).
