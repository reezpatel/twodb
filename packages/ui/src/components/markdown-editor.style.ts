import css from "styled-jsx/css";

export const markdownEditorStyles = css`
/* MarkdownEditor — a calm writing surface: hairline frame, lit toolbar */

.tw-editor {
	background: var(--surface);
	border: 1px solid var(--line-strong);
	border-radius: var(--r-md);
	overflow: hidden;
	transition:
		border-color var(--dur-1) var(--ease-out),
		box-shadow var(--dur-1) var(--ease-out);
}

.tw-editor:focus-within {
	border-color: var(--accent);
	box-shadow: 0 0 0 3px var(--ring);
}

.tw-editor--error {
	border-color: var(--danger-ink);
}

.tw-editor--error:focus-within {
	box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger-ink) 20%, transparent);
}

/* --- Toolbar --- */

.tw-editor__toolbar {
	display: flex;
	align-items: center;
	gap: 2px;
	flex-wrap: wrap;
	padding: 6px 8px;
	border-bottom: 1px solid var(--line);
	background: var(--bg-band);
}

.tw-editor__sep {
	width: 1px;
	height: 16px;
	margin: 0 4px;
	background: var(--line-strong);
	flex-shrink: 0;
}

.tw-editor__toolbar :global(.tw-icon-btn.is-active) {
	background: var(--accent-soft-bg);
	color: var(--accent);
}

/* --- Writing surface --- */

.tw-editor__content {
	padding: var(--space-3) var(--space-4);
}

.tw-editor__content :global(.ProseMirror) {
	outline: none;
	font-size: var(--text-md);
	line-height: 1.6;
	color: var(--ink);
}

.tw-editor__content :global(.ProseMirror) p {
	margin: 0 0 var(--space-3);
	max-width: var(--measure);
}

.tw-editor__content :global(.ProseMirror) > *:first-child {
	margin-top: 0;
}

.tw-editor__content :global(.ProseMirror) > *:last-child {
	margin-bottom: 0;
}

.tw-editor__content :global(.ProseMirror) h1,
.tw-editor__content :global(.ProseMirror) h2,
.tw-editor__content :global(.ProseMirror) h3 {
	margin: var(--space-5) 0 var(--space-3);
	max-width: var(--measure);
}

.tw-editor__content :global(.ProseMirror) h1 {
	font-size: var(--text-2xl);
}
.tw-editor__content :global(.ProseMirror) h2 {
	font-size: var(--text-xl);
}
.tw-editor__content :global(.ProseMirror) h3 {
	font-size: var(--text-lg);
}

.tw-editor__content :global(.ProseMirror) ul,
.tw-editor__content :global(.ProseMirror) ol {
	margin: 0 0 var(--space-3);
	padding-left: var(--space-5);
	max-width: var(--measure);
}

.tw-editor__content :global(.ProseMirror) li {
	margin-bottom: 6px;
}

.tw-editor__content :global(.ProseMirror) blockquote {
	margin: 0 0 var(--space-3);
	padding: var(--space-1) 0 var(--space-1) var(--space-4);
	border-left: 1px solid var(--line-strong);
	color: var(--ink-2);
	max-width: var(--measure);
}

.tw-editor__content :global(.ProseMirror) code {
	font-family: var(--font-mono);
	font-size: 0.88em;
	background: var(--bg-band-strong);
	border-radius: var(--r-sm);
	padding: 1px 5px;
}

.tw-editor__content :global(.ProseMirror) pre {
	margin: 0 0 var(--space-3);
	padding: var(--space-3) var(--space-4);
	background: var(--twdb-night);
	color: #e8e7f0;
	border-radius: var(--r-md);
	overflow-x: auto;
	font-size: var(--text-sm);
}

.tw-editor__content :global(.ProseMirror) pre code {
	background: none;
	padding: 0;
	color: inherit;
	font-size: inherit;
}

.tw-editor__content :global(.ProseMirror) hr {
	border: 0;
	height: 1px;
	margin: var(--space-5) 0;
	background: linear-gradient(
		90deg,
		transparent,
		var(--line-strong),
		transparent
	);
}

.tw-editor__content :global(.ProseMirror) strong {
	font-weight: 650;
}

.tw-editor__content :global(.ProseMirror) a {
	color: var(--accent);
	text-decoration: underline;
	text-underline-offset: 2px;
}

/* placeholder */
.tw-editor__content :global(.ProseMirror) p.is-editor-empty:first-child::before {
	content: attr(data-placeholder);
	float: left;
	height: 0;
	pointer-events: none;
	color: var(--ink-3);
}

/* readonly: no frame emphasis, content only */
.tw-editor--readonly {
	border-color: var(--line);
}

/* --- Read mode: document rhythm (the blog/preview surface) --- */

.tw-editor--readonly .tw-editor__content {
	padding: var(--space-5) var(--space-6);
}

.tw-editor--readonly :global(.ProseMirror) {
	font-size: var(--text-lg);
	line-height: 1.75;
}

.tw-editor--readonly :global(.ProseMirror) p {
	margin-bottom: var(--space-4);
}

.tw-editor--readonly :global(.ProseMirror) h1 {
	font-size: var(--text-2xl);
	margin: var(--space-6) 0 var(--space-3);
	line-height: 1.25;
}

.tw-editor--readonly :global(.ProseMirror) h2 {
	margin: var(--space-6) 0 var(--space-3);
	line-height: 1.3;
}

.tw-editor--readonly :global(.ProseMirror) h3 {
	margin: var(--space-5) 0 var(--space-2);
	line-height: 1.35;
}

.tw-editor--readonly :global(.ProseMirror) li {
	margin-bottom: var(--space-2);
}

.tw-editor--readonly :global(.ProseMirror) blockquote {
	margin: var(--space-4) 0;
	padding: var(--space-2) 0 var(--space-2) var(--space-4);
}

.tw-editor--readonly :global(.ProseMirror) pre {
	margin: var(--space-4) 0;
	padding: var(--space-4) var(--space-5);
	font-size: var(--text-md);
}

.tw-editor--readonly :global(.ProseMirror) table {
	margin: var(--space-3) 0 var(--space-5);
}

.tw-editor--readonly :global(.ProseMirror) th {
	padding: 10px var(--space-3);
}

.tw-editor--readonly :global(.ProseMirror) td {
	padding: 11px var(--space-3);
}

.tw-editor--readonly :global(.ProseMirror) img {
	margin: var(--space-4) 0 var(--space-5);
}

.tw-editor--readonly :global(.ProseMirror) hr {
	margin: var(--space-6) 0;
}

/* tables: the ledger inside the page */
.tw-editor__content :global(.ProseMirror) table {
	width: 100%;
	margin: var(--space-2) 0 var(--space-4);
	border-collapse: collapse;
	border: 1px solid var(--line);
	border-radius: var(--r-md);
	font-size: var(--text-md);
	overflow: hidden;
}

.tw-editor__content :global(.ProseMirror) th {
	padding: 8px var(--space-3);
	font-family: var(--font-cue);
	font-size: 10.5px;
	font-weight: 500;
	letter-spacing: var(--tracking-cue);
	text-transform: uppercase;
	color: var(--ink-3);
	text-align: left;
	border-bottom: 1px solid var(--line-strong);
	background: var(--bg-band);
}

.tw-editor__content :global(.ProseMirror) td {
	padding: 10px var(--space-3);
	border-bottom: 1px solid var(--line);
	color: var(--ink);
	font-variant-numeric: tabular-nums;
}

.tw-editor__content :global(.ProseMirror) tr:last-child td {
	border-bottom: none;
}

/* images: framed, never bleeding past the measure */
.tw-editor__content :global(.ProseMirror) img {
	display: block;
	max-width: 100%;
	height: auto;
	margin: var(--space-3) 0 var(--space-4);
	border-radius: var(--r-md);
	border: 1px solid var(--line);
}

.tw-editor__content :global(.ProseMirror) img.ProseMirror-selectednode {
	outline: 2px solid var(--accent);
	outline-offset: 2px;
}
`;
