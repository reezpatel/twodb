import css from "styled-jsx/css";

export const filesSceneStyles = css`
.mock-pf {
	grid-column: 2 / -1;
	grid-row: 1 / 3;
	display: grid;
	grid-template-columns: minmax(0, 1fr) 270px;
	width: 100%;
	height: 100%;
	min-height: 0;
	overflow: auto;
	background: var(--bg);
}

/* --- center --- */

.mock-pf__main {
	display: flex;
	flex-direction: column;
	min-width: 0;
	padding: var(--space-4);
	gap: var(--space-3);
}

.mock-pf__head {
	display: flex;
	align-items: flex-end;
	justify-content: space-between;
}

.mock-pf__crumb {
	font-size: var(--text-sm);
	color: var(--ink-3);
}

.mock-pf__head h2 {
	margin: 2px 0 0;
	font-size: var(--text-2xl);
	font-weight: 600;
	letter-spacing: -0.01em;
	color: var(--ink);
}

/* folder cards */

.mock-pf__folders {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
	gap: var(--space-2);
}

.mock-pf__folder {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 4px;
	padding: var(--space-3);
	border: 1px solid var(--line);
	border-radius: var(--r-md);
	background: var(--surface);
	font: inherit;
	text-align: left;
	cursor: pointer;
	transition:
		border-color var(--dur-1) var(--ease-out),
		background var(--dur-1) var(--ease-out);
}

.mock-pf__folder:hover {
	border-color: var(--line-strong);
}

.mock-pf__folder.is-active {
	border-color: var(--accent);
	background: var(--accent-soft-bg);
}

.mock-pf__folder > :global(svg) {
	color: var(--accent);
	margin-bottom: 2px;
}

.mock-pf__folder strong {
	font-size: var(--text-md);
	font-weight: 600;
	color: var(--ink);
}

.mock-pf__folder span {
	font-size: var(--text-sm);
	color: var(--ink-3);
}

/* recent chips */

.mock-pf__sect {
	margin: 0;
	font-size: var(--text-md);
	font-weight: 600;
	color: var(--ink);
}

.mock-pf__recent {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
	gap: var(--space-2);
}

.mock-pf__chip {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 10px 12px;
	border: 1px solid var(--line);
	border-radius: var(--r-md);
	background: var(--surface);
	min-width: 0;
}

.mock-pf__chip div {
	display: flex;
	flex-direction: column;
	min-width: 0;
}

.mock-pf__chip strong {
	font-size: var(--text-sm);
	font-weight: 600;
	color: var(--ink);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.mock-pf__chip span {
	font-size: 11px;
	color: var(--ink-3);
}

/* file-type icons */

:global(.mock-pf__ficon) {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 34px;
	height: 34px;
	border-radius: var(--r-sm);
	flex-shrink: 0;
}

:global(.mock-pf__ficon--sm) {
	width: 26px;
	height: 26px;
}

:global(.mock-pf__ficon.is-pdf) {
	background: var(--rose-soft-bg);
	color: var(--rose-accent);
}

:global(.mock-pf__ficon.is-doc) {
	background: var(--accent-soft-bg);
	color: var(--accent);
}

:global(.mock-pf__ficon.is-sheet) {
	background: rgb(15 157 143 / 0.1);
	color: #0f9d8f;
}

:global(.mock-pf__ficon.is-image) {
	background: rgb(217 160 63 / 0.14);
	color: #b07f1f;
}

/* all-files toolbar */

.mock-pf__allhead {
	display: flex;
	align-items: center;
	gap: var(--space-3);
	flex-wrap: wrap;
}

.mock-pf__allhead :global(.tw-input-wrap) {
	margin-left: auto;
	width: 220px;
}

.mock-pf__allhead :global(.tw-tab) {
	padding-inline: 10px;
	white-space: nowrap;
}

.mock-pf__viewtoggle {
	display: flex;
	gap: 2px;
}

/* table */

.mock-pf__tablewrap {
	border: 1px solid var(--line);
	border-radius: var(--r-md);
	background: var(--surface);
	overflow: hidden;
	overflow-x: auto;
}

.mock-pf__table {
	width: 100%;
	border-collapse: collapse;
	font-size: var(--text-md);
}

.mock-pf__table th {
	padding: 10px 12px;
	border-bottom: 1px solid var(--line);
	font-family: var(--font-cue);
	font-size: var(--text-cue);
	font-weight: 500;
	letter-spacing: var(--tracking-cue);
	text-transform: uppercase;
	color: var(--ink-3);
	text-align: left;
}

.mock-pf__table td {
	padding: 9px 12px;
	border-bottom: 1px solid var(--line);
	color: var(--ink-2);
	vertical-align: middle;
}

.mock-pf__table tbody tr:last-child td {
	border-bottom: 0;
}

.mock-pf__table tbody tr.is-selected {
	background: var(--accent-soft-bg);
}

.mock-pf__check {
	width: 36px;
}

.mock-pf__fname {
	display: inline-flex;
	align-items: center;
	gap: 10px;
	font-weight: 500;
	color: var(--ink);
}

.mock-pf__muted {
	color: var(--ink-3);
	white-space: nowrap;
}

.mock-pf__owner {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	white-space: nowrap;
}

.mock-pf__loc {
	font-family: var(--font-mono);
	font-size: 11px;
	color: var(--accent);
	background: var(--accent-soft-bg);
	padding: 2px 7px;
	border-radius: 4px;
	white-space: nowrap;
}

.mock-pf__rowact {
	width: 40px;
	text-align: right;
}

.mock-pf__empty {
	padding: var(--space-5) !important;
	text-align: center;
	color: var(--ink-3);
}

.mock-pf__foot {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 10px 12px;
	border-top: 1px solid var(--line);
	font-size: var(--text-sm);
	color: var(--ink-3);
}

/* grid view */

.mock-pf__grid {
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: var(--space-2);
}

.mock-pf__card {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 6px;
	padding: var(--space-3);
	border: 1px solid var(--line);
	border-radius: var(--r-md);
	background: var(--surface);
	font: inherit;
	text-align: left;
	cursor: pointer;
	transition: border-color var(--dur-1) var(--ease-out);
}

.mock-pf__card:hover {
	border-color: var(--line-strong);
}

.mock-pf__card.is-selected {
	border-color: var(--accent);
	background: var(--accent-soft-bg);
}

.mock-pf__card strong {
	font-size: var(--text-sm);
	font-weight: 600;
	color: var(--ink);
	word-break: break-all;
}

.mock-pf__card span {
	font-size: 11px;
	color: var(--ink-3);
}

/* --- right panel (Files sidebar) --- */

.mock-pf__side {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
	padding: var(--space-3);
	border-left: 1px solid var(--line);
	background: var(--surface);
	min-width: 0;
}

.mock-pf__sidehead {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.mock-pf__sidehead h3 {
	margin: 0;
	font-size: var(--text-lg);
	font-weight: 600;
	color: var(--ink);
}

.mock-pf__sidefolders {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 8px;
}

.mock-pf__tile {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 3px;
	padding: 10px;
	border: 1px solid var(--line);
	border-radius: var(--r-md);
	background: var(--bg);
	font: inherit;
	text-align: left;
	cursor: pointer;
	transition:
		border-color var(--dur-1) var(--ease-out),
		background var(--dur-1) var(--ease-out);
}

.mock-pf__tile:hover {
	border-color: var(--line-strong);
}

.mock-pf__tile.is-active {
	border-color: var(--accent);
	background: var(--accent-soft-bg);
}

.mock-pf__tile > :global(svg) {
	color: var(--accent);
	margin-bottom: 3px;
}

.mock-pf__tile strong {
	font-size: var(--text-sm);
	font-weight: 600;
	color: var(--ink);
}

.mock-pf__tile span {
	font-size: 11px;
	color: var(--ink-3);
}

.mock-pf__sidesect {
	margin: 0;
	font-family: var(--font-cue);
	font-size: var(--text-cue);
	font-weight: 500;
	letter-spacing: var(--tracking-cue);
	text-transform: uppercase;
	color: var(--ink-3);
}

.mock-pf__sidelist {
	display: flex;
	flex-direction: column;
	gap: 4px;
	overflow-y: auto;
}

.mock-pf__siderow {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 7px 8px;
	border: 1px solid transparent;
	border-radius: var(--r-sm);
	background: none;
	font: inherit;
	text-align: left;
	cursor: pointer;
	transition:
		border-color var(--dur-1) var(--ease-out),
		background var(--dur-1) var(--ease-out);
}

.mock-pf__siderow:hover {
	border-color: var(--line);
	background: var(--bg);
}

.mock-pf__siderow.is-selected {
	border-color: var(--accent);
	background: var(--accent-soft-bg);
}

.mock-pf__siderow > div {
	display: flex;
	flex-direction: column;
	min-width: 0;
}

.mock-pf__siderow strong {
	font-size: var(--text-sm);
	font-weight: 600;
	color: var(--ink);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.mock-pf__siderow span {
	font-size: 11px;
	color: var(--ink-3);
}

/* upload dialog */

.mock-pf__upbackdrop {
position: fixed;
inset: 0;
z-index: 60;
display: grid;
place-items: center;
padding: var(--space-4);
background: color-mix(in srgb, var(--ink) 18%, transparent);
}

.mock-pf__updialog {
display: flex;
flex-direction: column;
width: min(440px, 100%);
background: var(--bg);
border: 1px solid var(--line);
border-radius: var(--r-lg);
box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25);
overflow: hidden;
}

.mock-pf__uphead {
display: flex;
align-items: flex-start;
justify-content: space-between;
gap: var(--space-3);
padding: var(--space-4);
border-bottom: 1px solid var(--line);
}

.mock-pf__uptitle {
margin: 0;
font-size: var(--text-lg);
font-weight: 600;
color: var(--ink);
}

.mock-pf__updesc {
margin: 4px 0 0;
font-size: var(--text-sm);
color: var(--ink-3);
}

.mock-pf__dropzone {
display: flex;
flex-direction: column;
align-items: center;
gap: var(--space-3);
margin: var(--space-4);
padding: var(--space-5) var(--space-4);
border: 2px dashed var(--line);
border-radius: var(--r-md);
background: var(--bg);
cursor: pointer;
transition:
border-color var(--dur-1) var(--ease-out),
background var(--dur-1) var(--ease-out);
}

.mock-pf__dropzone.is-dragging {
border-color: var(--accent);
background: var(--accent-soft-bg);
}

.mock-pf__upicon {
display: grid;
place-items: center;
width: 56px;
height: 56px;
border-radius: 50%;
background: var(--surface);
color: var(--ink-3);
}

.mock-pf__dztitle {
font-size: var(--text-md);
font-weight: 600;
color: var(--ink);
text-align: center;
}

.mock-pf__dztext {
font-size: var(--text-sm);
color: var(--ink-3);
}

.mock-pf__uplist {
display: flex;
flex-direction: column;
gap: 8px;
padding: 0 var(--space-4) var(--space-4);
max-height: 220px;
overflow-y: auto;
}

.mock-pf__upfile {
display: grid;
grid-template-columns: 16px minmax(0, 1fr) auto auto;
align-items: center;
gap: 10px;
min-height: 44px;
padding: 10px 12px;
border: 1px solid var(--line);
border-radius: var(--r-sm);
background: var(--surface);
}

.mock-pf__upfileicon {
display: flex;
color: var(--ink-3);
}

.mock-pf__upfilename {
font-size: var(--text-sm);
font-weight: 500;
color: var(--ink);
white-space: nowrap;
overflow: hidden;
text-overflow: ellipsis;
}

.mock-pf__upprogress {
display: flex;
align-items: center;
gap: 8px;
}

.mock-pf__uppercent {
font-size: 11px;
font-weight: 600;
color: var(--accent);
min-width: 32px;
text-align: right;
}

.mock-pf__upsize {
font-size: 11px;
color: var(--ink-3);
min-width: 48px;
text-align: right;
}

.mock-pf__spinner {
width: 14px;
height: 14px;
border: 2px solid var(--line);
border-top-color: var(--accent);
border-radius: 50%;
animation: mock-pf-spin 0.8s linear infinite;
}

@keyframes mock-pf-spin {
to {
transform: rotate(360deg);
}
}

.mock-pf__upfoot {
display: flex;
align-items: center;
justify-content: space-between;
gap: var(--space-3);
padding: var(--space-3) var(--space-4);
border-top: 1px solid var(--line);
background: var(--surface);
}

@media (max-width: 1000px) {
	.mock-pf {
		grid-template-columns: 1fr;
	}

	.mock-pf__folders,
	.mock-pf__recent,
	.mock-pf__grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.mock-pf__side {
		border-left: 0;
		border-top: 1px solid var(--line);
	}
}
`;
