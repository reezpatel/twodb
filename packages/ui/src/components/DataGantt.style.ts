import css from "styled-jsx/css";

export const dataGanttStyles = css`
/* DataGantt — data-to-details timeline with hairline tracks and tabular dates */

.tw-gantt {
	width: 100%;
	overflow: hidden;
	border: 1px solid var(--line);
	border-radius: var(--r-lg);
	background: var(--surface);
	color: var(--ink);
}

.tw-gantt__toolbar {
	display: flex;
	align-items: flex-end;
	justify-content: space-between;
	gap: var(--space-4);
	padding: var(--space-4) var(--space-4) var(--space-3);
	border-bottom: 1px solid var(--line);
	background: var(--bg-band);
}

.tw-gantt__title {
	margin: 4px 0 0;
	font-size: var(--text-lg);
	font-weight: 650;
	line-height: 1.2;
}

.tw-gantt__range {
	color: var(--ink-3);
	font-size: var(--text-sm);
	white-space: nowrap;
}

.tw-gantt__grid {
	display: grid;
	grid-template-columns: minmax(240px, 0.82fr) minmax(440px, 1.65fr);
	overflow-x: auto;
	background: var(--surface);
}

.tw-gantt__head {
	min-height: 38px;
	border-bottom: 1px solid var(--line-strong);
	font-family: var(--font-cue);
	font-size: 10.5px;
	font-weight: 500;
	letter-spacing: var(--tracking-cue);
	text-transform: uppercase;
	color: var(--ink-3);
}

.tw-gantt__head--data {
	position: sticky;
	left: 0;
	z-index: 3;
	display: flex;
	align-items: center;
	padding: 0 var(--space-4);
	border-right: 1px solid var(--line);
	background: var(--surface);
}

.tw-gantt__head--timeline {
	position: relative;
	min-width: 440px;
	background-image: linear-gradient(90deg, var(--line) 1px, transparent 1px);
	background-size: 25% 100%;
}

.tw-gantt__head--timeline > span {
	position: absolute;
	top: 11px;
	transform: translateX(-50%);
	white-space: nowrap;
}

.tw-gantt__head--timeline .tw-gantt__today-label {
	top: 8px;
	padding: 1px 6px;
	border-radius: var(--r-pill);
	background: var(--accent-soft-bg);
	color: var(--accent);
}

.tw-gantt__record {
	position: sticky;
	left: 0;
	z-index: 2;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--space-3);
	width: 100%;
	min-height: 72px;
	padding: var(--space-3) var(--space-4);
	border: 0;
	border-right: 1px solid var(--line);
	border-bottom: 1px solid var(--line);
	background: var(--surface);
	color: var(--ink);
	font: inherit;
	text-align: left;
	cursor: pointer;
	transition:
		background var(--dur-1) var(--ease-out),
		box-shadow var(--dur-1) var(--ease-out),
		color var(--dur-1) var(--ease-out);
}

.tw-gantt__record:hover {
	background: var(--bg-band);
}

.tw-gantt__record:focus-visible {
	z-index: 4;
	outline: none;
	box-shadow:
		inset 0 0 0 1px var(--accent),
		0 0 0 3px var(--ring);
}

.tw-gantt__record--active {
	background: var(--accent-soft-bg);
	box-shadow: inset 1px 0 0 var(--accent);
}

.tw-gantt__record-main {
	min-width: 0;
}

.tw-gantt__record strong {
	display: block;
	margin-top: 3px;
	overflow: hidden;
	font-size: var(--text-md);
	font-weight: 650;
	line-height: 1.25;
	text-overflow: ellipsis;
}

.tw-gantt__kicker {
	display: block;
	overflow: hidden;
	font-family: var(--font-cue);
	font-size: 10.5px;
	font-weight: 500;
	letter-spacing: var(--tracking-cue);
	text-transform: uppercase;
	text-overflow: ellipsis;
	color: var(--ink-3);
}

.tw-gantt__record-range {
	display: block;
	margin-top: 4px;
	color: var(--ink-3);
	font-size: var(--text-sm);
}

.tw-gantt__record-meta {
	display: inline-flex;
	flex-shrink: 0;
	flex-direction: column;
	align-items: flex-end;
	gap: 6px;
	color: var(--ink-3);
	font-size: var(--text-sm);
	white-space: nowrap;
}

.tw-gantt__track {
	position: relative;
	min-width: 440px;
	min-height: 72px;
	border-bottom: 1px solid var(--line);
	background-image: linear-gradient(90deg, var(--line) 1px, transparent 1px);
	background-size: 25% 100%;
}

.tw-gantt__grid > :nth-last-child(-n + 2) {
	border-bottom: 0;
}

.tw-gantt__bar {
	position: absolute;
	top: 50%;
	height: 20px;
	min-width: 12px;
	overflow: hidden;
	transform: translateY(-50%);
	border: 1px solid var(--line-strong);
	border-radius: var(--r-pill);
	background: var(--bg-band-strong);
	transition:
		border-color var(--dur-1) var(--ease-out),
		background var(--dur-1) var(--ease-out);
}

.tw-gantt__bar > span {
	display: block;
	width: 100%;
	height: 100%;
	transform-origin: left;
	transition: transform var(--dur-2) var(--ease-out);
}

.tw-gantt__bar--neutral > span {
	background: var(--ink-3);
}

.tw-gantt__bar--go > span {
	background: var(--go);
}

.tw-gantt__bar--rose > span {
	background: var(--rose-accent);
}

.tw-gantt__bar--warning > span {
	background: var(--warning-ink);
}

.tw-gantt__bar--danger > span {
	background: var(--danger-ink);
}

.tw-gantt__bar--active {
	border-color: var(--accent);
	background: var(--accent-soft-bg);
}

.tw-gantt__milestone {
	position: absolute;
	top: 50%;
	width: 10px;
	height: 10px;
	transform: translate(-50%, -50%) rotate(45deg);
	border: 1px solid var(--surface);
	background: var(--ink-3);
}

.tw-gantt__milestone--go,
.tw-gantt__milestone-dot--go {
	background: var(--go);
}

.tw-gantt__milestone--rose,
.tw-gantt__milestone-dot--rose {
	background: var(--rose-accent);
}

.tw-gantt__milestone--warning,
.tw-gantt__milestone-dot--warning {
	background: var(--warning-ink);
}

.tw-gantt__milestone--danger,
.tw-gantt__milestone-dot--danger {
	background: var(--danger-ink);
}

.tw-gantt__today {
	position: absolute;
	top: 0;
	bottom: 0;
	width: 1px;
	background: var(--accent);
}

.tw-gantt__today::before {
	content: "";
	position: absolute;
	top: 0;
	left: -3px;
	width: 7px;
	height: 7px;
	border-radius: var(--r-pill);
	background: var(--accent);
}

.tw-gantt__detail {
	border-top: 1px solid var(--line-strong);
	padding: var(--space-4);
	background: var(--bg-band);
}

.tw-gantt__detail-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: var(--space-4);
	margin-bottom: var(--space-3);
}

.tw-gantt__detail-head h4 {
	margin: 4px 0 0;
	font-size: var(--text-lg);
	font-weight: 650;
	line-height: 1.2;
}

.tw-gantt__detail-grid {
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(220px, 0.46fr);
	gap: var(--space-4);
	align-items: start;
	margin-bottom: var(--space-4);
}

.tw-gantt__detail-copy {
	max-width: var(--measure);
	margin-bottom: var(--space-3);
	color: var(--ink-2);
	font-size: var(--text-md);
	line-height: 1.55;
}

.tw-gantt__detail-progress {
	display: grid;
	grid-template-columns: auto 1fr;
	gap: var(--space-2) var(--space-3);
	align-items: center;
	max-width: 420px;
}

.tw-gantt__detail-progress > span {
	font-family: var(--font-cue);
	font-size: 10.5px;
	font-weight: 500;
	letter-spacing: var(--tracking-cue);
	text-transform: uppercase;
	color: var(--ink-3);
}

.tw-gantt__detail-progress strong {
	justify-self: end;
	font-size: var(--text-sm);
	color: var(--ink-2);
}

.tw-gantt__detail-progress i {
	grid-column: 1 / -1;
	height: 5px;
	overflow: hidden;
	border-radius: var(--r-pill);
	background: var(--bg-band-strong);
}

.tw-gantt__detail-progress i span {
	display: block;
	width: 100%;
	height: 100%;
	transform-origin: left;
	background: var(--action);
	transition: transform var(--dur-2) var(--ease-out);
}

.tw-gantt__milestones {
	padding: var(--space-3);
	border: 1px solid var(--line);
	border-radius: var(--r-md);
	background: var(--surface);
}

.tw-gantt__milestones ul {
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
	padding: var(--space-2) 0 0;
	margin: 0;
	list-style: none;
}

.tw-gantt__milestones li {
	display: grid;
	grid-template-columns: 10px minmax(0, 1fr) auto;
	gap: var(--space-2);
	align-items: center;
	color: var(--ink-2);
	font-size: var(--text-sm);
}

.tw-gantt__milestones time {
	color: var(--ink-3);
}

.tw-gantt__milestone-dot {
	width: 8px;
	height: 8px;
	transform: rotate(45deg);
	background: var(--ink-3);
}

.tw-gantt__facts {
	display: grid;
	grid-template-columns: repeat(4, minmax(120px, 1fr));
	gap: var(--space-3);
	margin: 0;
}

.tw-gantt__facts div {
	min-width: 0;
	padding: var(--space-3);
	border: 1px solid var(--line);
	border-radius: var(--r-md);
	background: var(--surface);
}

.tw-gantt__facts dt {
	margin-bottom: 5px;
	font-family: var(--font-cue);
	font-size: 10.5px;
	font-weight: 500;
	letter-spacing: var(--tracking-cue);
	text-transform: uppercase;
	color: var(--ink-3);
}

.tw-gantt__facts dd {
	margin: 0;
	color: var(--ink);
	font-size: var(--text-md);
	font-variant-numeric: tabular-nums;
}

.tw-gantt__empty {
	padding: var(--space-7) var(--space-4);
	text-align: center;
	color: var(--ink-3);
}

@media (max-width: 760px) {
	.tw-gantt__toolbar {
		align-items: flex-start;
		flex-direction: column;
	}

	.tw-gantt__grid {
		grid-template-columns: minmax(210px, 0.8fr) minmax(420px, 1.4fr);
	}

	.tw-gantt__head--timeline,
	.tw-gantt__track {
		min-width: 420px;
	}

	.tw-gantt__detail-grid,
	.tw-gantt__facts {
		grid-template-columns: 1fr 1fr;
	}
}

@media (max-width: 560px) {
	.tw-gantt__detail-grid,
	.tw-gantt__facts {
		grid-template-columns: 1fr;
	}
}

@media (prefers-reduced-motion: reduce) {
	.tw-gantt__bar,
	.tw-gantt__bar > span,
	.tw-gantt__detail-progress i span,
	.tw-gantt__record {
		transition: none;
	}
}
`;
