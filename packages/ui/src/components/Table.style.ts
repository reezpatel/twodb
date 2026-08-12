import css from "styled-jsx/css";

export const tableStyles = css`
/* Table — the ledger: hairline rules, cue-caps header, tabular data */

.tw-table-wrap {
	border: 1px solid var(--line);
	border-radius: var(--r-lg);
	background: var(--surface);
	overflow: hidden;
}

.tw-table-scroll {
	overflow-x: auto;
}

.tw-table {
	width: 100%;
	border-collapse: collapse;
	font-size: var(--text-md);
}

.tw-thead {
	border-bottom: 1px solid var(--line-strong);
}

.tw-th {
	padding: 9px var(--space-3);
	font-family: var(--font-cue);
	font-size: 10.5px;
	font-weight: 500;
	letter-spacing: var(--tracking-cue);
	text-transform: uppercase;
	color: var(--ink-3);
	text-align: left;
	white-space: nowrap;
}

.tw-th--right,
.tw-td--right {
	text-align: right;
}

.tw-td {
	padding: 10px var(--space-3);
	color: var(--ink);
	border-bottom: 1px solid var(--line);
	vertical-align: middle;
}

.tw-tbody .tw-tr:last-child .tw-td {
	border-bottom: none;
}

.tw-tbody .tw-tr {
	transition: background var(--dur-1) var(--ease-out);
}

.tw-tbody .tw-tr:hover {
	background: var(--bg-band);
}

/* numbers stay tabular in data cells by default */
.tw-td {
	font-variant-numeric: tabular-nums;
}

/* --- DataTable chrome: toolbar, sortable heads, filters, pagination --- */

.tw-datatable__toolbar {
	display: flex;
	align-items: center;
	gap: var(--space-3);
	padding: var(--space-3);
	border-bottom: 1px solid var(--line);
}

.tw-datatable__toolbar .tw-search {
	max-width: 260px;
	flex: 1;
}

/* resize handle: a hairline that lights cobalt while dragging */
.tw-table--data {
	table-layout: fixed;
}

.tw-table--data .tw-th {
	position: relative;
}

.tw-table--data .tw-td {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.tw-col-resize {
	position: absolute;
	right: -4px;
	top: 0;
	height: 100%;
	width: 8px;
	cursor: col-resize;
	z-index: 1;
	touch-action: none;
}

.tw-col-resize::after {
	content: "";
	position: absolute;
	left: 3.5px;
	top: 18%;
	height: 64%;
	width: 1px;
	background: transparent;
	transition: background var(--dur-1) var(--ease-out);
}

.tw-col-resize:hover::after,
.tw-col-resize--active::after {
	background: var(--accent);
}

/* --- Filter builder popover --- */

.tw-filterpop-anchor {
	position: relative;
	margin-left: auto;
}

.tw-filterpop {
	position: absolute;
	right: 0;
	top: calc(100% + 6px);
	z-index: var(--z-overlay);
	width: 580px;
	max-width: calc(100vw - 48px);
	max-height: 420px;
	overflow-y: auto;
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
	padding: var(--space-3);
	background: var(--surface);
	border: 1px solid var(--line-strong);
	border-radius: var(--r-md);
	box-shadow: var(--shadow-overlay);
	animation: tw-menu-in var(--dur-2) var(--ease-out) both;
}

.tw-filterpop__head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--space-3);
	padding-bottom: var(--space-1);
}

.tw-filterpop__rule {
	display: grid;
	grid-template-columns: 150px 150px 1fr 26px;
	gap: var(--space-2);
	align-items: center;
}

.tw-filterpop__foot {
	display: flex;
	gap: var(--space-2);
	padding-top: var(--space-1);
}

/* --- Cell types: display --- */

.tw-cell-url,
.tw-cell-file {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	max-width: 100%;
}

.tw-cell-url {
	color: var(--accent);
}

.tw-cell-url :global(svg),
.tw-cell-file :global(svg) {
	width: 12px;
	height: 12px;
	flex-shrink: 0;
}

.tw-cell-file {
	color: var(--ink-2);
}

.tw-cell-file :global(svg) {
	color: var(--ink-3);
}

.tw-cell-url span,
.tw-cell-file span {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.tw-cell-empty {
	color: var(--ink-3);
}

.tw-cell-chips {
	display: inline-flex;
	gap: 4px;
	flex-wrap: wrap;
}

.tw-cell-progress {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	width: 100%;
	font-size: var(--text-sm);
	color: var(--ink-2);
}

.tw-cell-progress__bar {
	flex: 1;
	min-width: 40px;
	height: 4px;
	border-radius: var(--r-pill);
	background: var(--bg-band-strong);
	overflow: hidden;
}

.tw-cell-progress__bar i {
	display: block;
	height: 100%;
	width: 100%;
	border-radius: var(--r-pill);
	background: var(--action);
	transform-origin: left;
	transition: transform var(--dur-2) var(--ease-out);
}

.tw-cell-stars {
	display: inline-flex;
	gap: 2px;
}

.tw-cell-stars :global(svg) {
	width: 13px;
	height: 13px;
	color: var(--line-strong);
}

.tw-cell-stars :global(svg).is-on {
	color: #d97706;
	fill: currentColor;
}

.tw-cell-stars--edit button {
	display: inline-flex;
	padding: 2px;
	border: none;
	background: none;
	cursor: pointer;
}

.tw-cell-stars--edit :global(svg) {
	width: 16px;
	height: 16px;
}

.tw-cell-stars--edit button:hover :global(svg) {
	color: #d97706;
}

/* --- Cell editing --- */

.tw-td--editable {
	cursor: cell;
}

.tw-td--editable:hover {
	box-shadow: inset 0 0 0 1px var(--line-strong);
}

.tw-td--editing {
	box-shadow: inset 0 0 0 1.5px var(--accent);
	background: var(--surface);
}

.tw-cell-input {
	width: 100%;
	height: 24px;
	padding: 0;
	border: none;
	background: transparent;
	font: inherit;
	color: var(--ink);
	outline: none;
}

.tw-cell-range {
	width: 100%;
	accent-color: var(--action);
}

.tw-cell-popanchor {
	display: inline-block;
	max-width: 100%;
}

.tw-cellpop {
	position: fixed;
	z-index: var(--z-tooltip);
	display: flex;
	flex-direction: column;
	gap: 2px;
	padding: 4px;
	background: var(--surface);
	border: 1px solid var(--line-strong);
	border-radius: var(--r-md);
	box-shadow: var(--shadow-overlay);
	animation: tw-menu-in var(--dur-2) var(--ease-out) both;
}

.tw-cellpop__item {
	display: flex;
	padding: 4px 6px;
	border: none;
	border-radius: var(--r-sm);
	background: transparent;
	cursor: pointer;
	text-align: left;
	transition: background var(--dur-1) var(--ease-out);
}

.tw-cellpop__item:hover {
	background: var(--bg-band-strong);
}

.tw-cellpop__item--selected {
	background: var(--accent-soft-bg);
}

.tw-cellpop__foot {
	border-top: 1px solid var(--line);
	padding-top: 4px;
	margin-top: 2px;
	display: flex;
	justify-content: flex-end;
}

.tw-cellpop__done {
	border: none;
	background: none;
	font-family: var(--font-ui);
	font-size: var(--text-sm);
	font-weight: 600;
	color: var(--accent);
	cursor: pointer;
	padding: 4px 6px;
	border-radius: var(--r-sm);
}

.tw-cellpop__done:hover {
	background: var(--accent-soft-bg);
}

/* --- Column config --- */

.tw-colconfig-anchor {
	position: relative;
	display: inline-flex;
	margin-left: 2px;
}

.tw-col-config {
	opacity: 0;
	transition:
		opacity var(--dur-1) var(--ease-out),
		background var(--dur-1) var(--ease-out);
}

.tw-th:hover .tw-col-config,
.tw-col-config[aria-expanded="true"],
.tw-col-config:focus-visible {
	opacity: 1;
}

.tw-colconfig {
	position: fixed;
	z-index: var(--z-tooltip);
	width: 264px;
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
	padding: var(--space-3);
	background: var(--surface);
	border: 1px solid var(--line-strong);
	border-radius: var(--r-md);
	box-shadow: var(--shadow-overlay);
	animation: tw-menu-in var(--dur-2) var(--ease-out) both;
	/* panel content reads as interface, not cue caps */
	font-family: var(--font-ui);
	font-size: var(--text-md);
	font-weight: 400;
	letter-spacing: normal;
	text-transform: none;
}

@media (max-width: 700px) {
	.tw-filterpop__rule {
		grid-template-columns: 1fr 1fr;
	}
}

.tw-th__inner {
	display: inline-flex;
	align-items: center;
	gap: 6px;
}

.tw-th__sort {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 0;
	border: none;
	background: none;
	font: inherit;
	letter-spacing: inherit;
	text-transform: inherit;
	color: inherit;
	cursor: pointer;
	transition: color var(--dur-1) var(--ease-out);
}

.tw-th__sort:hover {
	color: var(--ink);
}

.tw-th__sort :global(svg) {
	width: 12px;
	height: 12px;
}

.tw-th__sort--active,
.tw-th__sort--active:hover {
	color: var(--accent);
}

.tw-datatable__footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--space-3);
	padding: 10px var(--space-3);
	border-top: 1px solid var(--line);
	font-size: var(--text-sm);
	color: var(--ink-3);
	font-variant-numeric: tabular-nums;
}

.tw-datatable__pager {
	display: flex;
	align-items: center;
	gap: var(--space-2);
}

.tw-datatable__pagesize {
	width: 118px;
}

.tw-datatable__empty {
	padding: var(--space-7) var(--space-3);
	text-align: center;
	color: var(--ink-3);
	font-size: var(--text-md);
}

/* keep the last column's resize handle inside the scroll frame */
.tw-table--data .tw-th:last-child .tw-col-resize {
	right: 0;
}
`;
