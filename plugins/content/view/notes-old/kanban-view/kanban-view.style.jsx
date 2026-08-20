import css from "styled-jsx/css";

export const kanbanViewStyles = css`
.mock-kanban {
	--mk-done: var(--go);

	display: flex;
	width: 100%;
	height: 100%;
	overflow: hidden;
	border: 1px solid var(--line);
	border-radius: var(--r-lg);
	background: var(--bg);
	color: var(--ink);
}

[data-phase="night"] .mock-kanban {
	--mk-done: var(--go);
}

.mock-kanban__brand {
	display: grid;
	place-items: center;
	width: 34px;
	height: 34px;
	margin-bottom: 8px;
	border: 1.5px solid var(--line-strong);
	border-radius: var(--r-pill);
	color: var(--ink);
}

.mock-kanban__brand :global(svg) {
	width: 16px;
	height: 16px;
	stroke-width: 2;
}

.mock-kanban__main {
	flex: 1;
	display: flex;
	flex-direction: column;
	min-width: 0;
}

.mock-kanban__head {
	display: flex;
	align-items: flex-end;
	justify-content: space-between;
	gap: var(--space-4);
	padding: var(--space-5) var(--space-6) var(--space-4);
}

.mock-kanban__crumbs {
	display: flex;
	align-items: center;
	gap: 6px;
	font-size: var(--text-xs);
	color: var(--ink-3);
}

.mock-kanban__crumbs :global(svg) {
	width: 12px;
	height: 12px;
	stroke-width: 1.8;
}

.mock-kanban__crumbs-here {
	color: var(--accent);
	font-weight: 600;
}

.mock-kanban__head h1 {
	margin: 4px 0 0;
	font-size: var(--text-2xl);
	font-weight: 650;
	letter-spacing: -0.01em;
}

.mock-kanban__toolbar {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 0 var(--space-6) var(--space-4);
}

.mock-kanban__toolbar :global(.tw-menu-anchor) :global(.tw-btn) :global(svg) {
	width: 14px;
	height: 14px;
}

.mock-kanban__menu-tick {
	display: inline-block;
	width: 16px;
	height: 16px;
}

.mock-kanban__summary {
	margin-left: auto;
	font-size: var(--text-xs);
	color: var(--ink-3);
	font-variant-numeric: tabular-nums;
}

.mock-kanban__board {
	flex: 1;
	display: grid;
	grid-template-columns: repeat(4, minmax(230px, 1fr));
	gap: var(--space-4);
	padding: 0 var(--space-6) var(--space-5);
	min-height: 0;
	overflow-x: auto;
}

.mock-kanban__col {
	display: flex;
	flex-direction: column;
	min-height: 0;
	min-width: 0;
}

.mock-kanban__col-head {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 2px 4px 10px;
}

.mock-kanban__dot {
	width: 8px;
	height: 8px;
	border-radius: var(--r-pill);
	flex-shrink: 0;
}

.mock-kanban__dot--todo {
	background: var(--ink-3);
}

.mock-kanban__dot--week {
	background: var(--rose-accent);
}

.mock-kanban__dot--progress {
	background: var(--accent);
}

.mock-kanban__dot--done {
	background: var(--mk-done);
}

.mock-kanban__col-title {
	font-size: var(--text-md);
	font-weight: 600;
}

.mock-kanban__col-count {
	font-size: var(--text-sm);
	color: var(--ink-3);
	font-variant-numeric: tabular-nums;
}

.mock-kanban__col-head :global(.tw-menu-anchor) {
	margin-left: auto;
}

.mock-kanban__col-body {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 10px;
	min-height: 0;
	overflow-y: auto;
	padding: 2px 2px 8px;
	border-radius: var(--r-md);
	transition: background var(--dur-2) var(--ease-out);
}

.mock-kanban__col.is-drop .mock-kanban__col-body {
	background: var(--accent-soft-bg);
}

.mock-kanban__add {
	display: grid;
	place-items: center;
	min-height: 46px;
	border: 1.5px dashed var(--line-strong);
	border-radius: var(--r-md);
	background: transparent;
	color: var(--ink-3);
	cursor: pointer;
	transition:
		border-color var(--dur-2) var(--ease-out),
		color var(--dur-2) var(--ease-out),
		background var(--dur-2) var(--ease-out);
}

.mock-kanban__add:hover {
	border-color: var(--accent);
	color: var(--accent);
	background: var(--accent-soft-bg);
}

.mock-kanban__add :global(svg) {
	width: 16px;
	height: 16px;
	stroke-width: 2;
}

.mock-kanban__add--editing {
	display: flex;
	padding: 0 12px;
	border-color: var(--accent);
	cursor: text;
}

.mock-kanban__add--editing input {
	width: 100%;
	border: 0;
	background: transparent;
	font: inherit;
	font-size: var(--text-sm);
	color: var(--ink);
	outline: none;
}

.mock-kanban__add--editing input::placeholder {
	color: var(--ink-3);
}

.mock-kanban__cell {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.mock-kanban__tilt {
	transition:
		transform var(--dur-2) var(--ease-out),
		opacity var(--dur-2) var(--ease-out);
}

.mock-kanban__tilt.is-dragging {
	transform: rotate(2.5deg);
	opacity: 0.45;
}

.mock-kanban__card {
	display: flex;
	flex-direction: column;
	gap: 10px;
	padding: 14px;
	border: 1px solid var(--line);
	border-radius: var(--r-md);
	background: var(--surface);
	cursor: grab;
	transition:
		border-color var(--dur-2) var(--ease-out),
		box-shadow var(--dur-2) var(--ease-out),
		opacity var(--dur-2) var(--ease-out);
}

.mock-kanban__card:hover {
	border-color: var(--line-strong);
	box-shadow: var(--shadow-overlay);
}

.mock-kanban__card:active {
	cursor: grabbing;
}

.mock-kanban__card.is-selected {
	border-color: var(--accent);
	box-shadow: 0 0 0 3px var(--ring);
}

.mock-kanban__card.is-done {
	opacity: 0.72;
}

.mock-kanban__card.is-done:hover {
	opacity: 1;
}

.mock-kanban__card-title {
	margin: 0;
	font-size: var(--text-md);
	font-weight: 600;
	line-height: 1.35;
}

.mock-kanban__pills {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 6px;
}

.mock-kanban__cat {
	display: inline-flex;
	align-items: center;
	height: 22px;
	padding: 0 8px;
	border-radius: var(--r-pill);
	font-size: var(--text-xs);
	font-weight: 600;
	white-space: nowrap;
}

.mock-kanban__cat--admin {
	background: var(--accent-soft-bg);
	color: var(--accent);
}

.mock-kanban__cat--design {
	background: var(--rose-soft-bg);
	color: var(--rose-accent);
}

.mock-kanban__cat--devops {
	background: var(--twdb-dawn);
	color: var(--twdb-night);
}

.mock-kanban__cat--research {
	background: var(--bg-band-strong);
	color: var(--ink-2);
}

.mock-kanban__subtasks {
	padding: 8px 10px;
	border-radius: var(--r-sm);
	background: var(--bg-band);
}

.mock-kanban__subtasks :global(.tw-checkitem) {
	padding: 4px 0;
}

.mock-kanban__subtasks :global(.tw-checkitem__label) {
	font-size: var(--text-sm);
	color: var(--ink-2);
}

.mock-kanban__card-foot {
	display: flex;
	align-items: center;
	margin-top: 2px;
}

.mock-kanban__stack {
	display: flex;
	align-items: center;
}

.mock-kanban__stack :global(.tw-avatar) {
	margin-left: -7px;
	border: 2px solid var(--surface);
}

.mock-kanban__stack :global(.tw-avatar):first-child {
	margin-left: 0;
}

.mock-kanban__stack--head :global(.tw-avatar) {
	border-color: var(--bg);
}

.mock-kanban__meta {
	margin-left: auto;
	display: flex;
	align-items: center;
	gap: 10px;
	color: var(--ink-3);
	font-size: var(--text-xs);
	font-variant-numeric: tabular-nums;
}

.mock-kanban__meta-item {
	display: inline-flex;
	align-items: center;
	gap: 4px;
}

.mock-kanban__meta-item :global(svg) {
	width: 13px;
	height: 13px;
	stroke-width: 1.8;
}

.mock-kanban__group-wrap {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.mock-kanban__group-wrap + .mock-kanban__group-wrap {
	margin-top: 6px;
}

.mock-kanban__group {
	display: flex;
	align-items: center;
	gap: 8px;
	font-family: var(--font-cue);
	font-size: 10.5px;
	font-weight: 500;
	letter-spacing: var(--tracking-cue);
	text-transform: uppercase;
	color: var(--ink-3);
}

.mock-kanban__group::after {
	content: "";
	flex: 1;
	height: 1px;
	background: var(--line);
}

.mock-kanban__group-count {
	font-variant-numeric: tabular-nums;
}

.mock-kanban__drop-line {
	height: 2px;
	border-radius: 1px;
	background: var(--accent);
	box-shadow: 0 0 0 1px var(--ring);
}

@media (max-width: 720px) {
	.mock-kanban__head {
		padding: var(--space-4) var(--space-4) var(--space-3);
	}

	.mock-kanban__toolbar {
		padding: 0 var(--space-4) var(--space-3);
	}

	.mock-kanban__board {
		padding: 0 var(--space-4) var(--space-4);
		grid-template-columns: repeat(4, minmax(240px, 1fr));
	}

	.mock-kanban__summary {
		display: none;
	}
}
`;
