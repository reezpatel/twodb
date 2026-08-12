import css from "styled-jsx/css";

export const calendarSceneStyles = css`
.mock-cal {
	grid-column: 2 / -1;
	grid-row: 1 / 3;
	display: flex;
	flex-direction: column;
	gap: var(--space-4);
	width: 100%;
	height: 100%;
	min-height: 0;
	overflow: auto;
	padding: var(--space-4);
	background: var(--bg);
}

.mock-cal__head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--space-4);
}

.mock-cal__head h2 {
	margin: 0;
	font-size: var(--text-2xl);
	font-weight: 650;
}

.mock-cal__search {
	width: 260px;
}

.mock-cal__card {
	background: var(--surface);
	border: 1px solid var(--line);
	border-radius: var(--r-lg);
	overflow: hidden;
}

.mock-cal__toolbar {
	display: flex;
	align-items: center;
	gap: var(--space-3);
	padding: var(--space-3) var(--space-4);
	border-bottom: 1px solid var(--line);
}

.mock-cal__monthchip {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 4px 10px;
	border: 1px solid var(--line);
	border-radius: var(--r-md);
	background: var(--bg-band);
}

.mock-cal__monthchip-mon {
	font-family: var(--font-cue);
	font-size: 9.5px;
	font-weight: 500;
	letter-spacing: var(--tracking-cue);
	text-transform: uppercase;
	color: var(--ink-3);
}

.mock-cal__monthchip b {
	font-size: var(--text-lg);
	line-height: 1.1;
	color: var(--ink);
}

.mock-cal__monthlabel {
	display: flex;
	flex-direction: column;
}

.mock-cal__monthlabel strong {
	font-size: var(--text-lg);
	font-weight: 650;
	color: var(--ink);
}

.mock-cal__monthlabel span {
	font-size: var(--text-sm);
	color: var(--ink-3);
}

.mock-cal__tools {
	margin-left: auto;
	display: flex;
	align-items: center;
	gap: var(--space-2);
}

.mock-cal .tw-mcal {
	border: none;
	border-radius: 0;
}

.mock-cal__list {
	display: flex;
	flex-direction: column;
	padding: var(--space-3) var(--space-4);
	gap: var(--space-3);
	max-height: 600px;
	overflow-y: auto;
}

.mock-cal__listday {
	display: grid;
	grid-template-columns: 110px 1fr;
	gap: var(--space-3);
	align-items: start;
}

.mock-cal__listdate {
	font-size: var(--text-sm);
	font-weight: 600;
	color: var(--ink-2);
	padding-top: 3px;
}

.mock-cal__listevents {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.tw-mcal__ev {
	display: flex;
	align-items: baseline;
	gap: 6px;
	width: 100%;
	padding: 3px 7px;
	border: none;
	border-radius: var(--r-sm);
	font-family: var(--font-ui);
	font-size: var(--text-xs);
	font-weight: 500;
	text-align: left;
	white-space: nowrap;
	overflow: hidden;
}

.tw-mcal__ev-title {
	overflow: hidden;
	text-overflow: ellipsis;
}

.tw-mcal__ev-time {
	margin-left: auto;
	flex-shrink: 0;
	font-size: 10.5px;
	opacity: 0.75;
}

.tw-mcal__ev--cobalt {
	background: var(--go-bg);
	color: var(--go);
}

.tw-mcal__ev--rose {
	background: var(--rose-soft-bg);
	color: var(--rose-accent);
}

.tw-mcal__ev--warning {
	background: var(--warning-bg);
	color: var(--warning-ink);
}

.tw-mcal__ev--danger {
	background: var(--danger-bg);
	color: var(--danger-ink);
}

.tw-mcal__ev--neutral {
	background: var(--bg-band-strong);
	color: var(--ink-2);
}

.mock-cal__week {
	min-width: 820px;
	overflow-x: auto;
	background: var(--surface);
}

.mock-cal__week-head {
	display: grid;
	grid-template-columns: 64px repeat(7, minmax(104px, 1fr));
	border-bottom: 1px solid var(--line);
}

.mock-cal__week-head > div,
.mock-cal__week-tz {
	min-width: 0;
	padding: 10px 8px;
	border-left: 1px solid var(--line);
}

.mock-cal__week-tz {
	border-left: 0;
	font-size: 10.5px;
	color: var(--ink-3);
}

.mock-cal__week-head > div {
	display: flex;
	flex-direction: column;
	gap: 1px;
}

.mock-cal__week-head strong {
	font-size: var(--text-lg);
	font-weight: 650;
	color: var(--ink-2);
}

.mock-cal__week-head span:not(.mock-cal__week-tz) {
	font-size: var(--text-xs);
	color: var(--ink-3);
}

.mock-cal__week-head .is-today {
	background: var(--accent-soft-bg);
}

.mock-cal__week-head .is-today strong {
	color: var(--accent);
}

.mock-cal__week-grid {
	display: grid;
	grid-template-columns: 64px minmax(728px, 1fr);
}

.mock-cal__week-hours {
	display: flex;
	flex-direction: column;
}

.mock-cal__week-hours span {
	display: block;
	height: 144px;
	padding: 6px 8px 0;
	border-bottom: 1px solid var(--line);
	box-sizing: border-box;
	font-size: 10.5px;
	color: var(--ink-3);
}

.mock-cal__week-lanes {
	position: relative;
	display: grid;
	grid-template-columns: repeat(7, minmax(104px, 1fr));
	height: 864px;
}

.mock-cal__week-lane {
	position: relative;
	min-width: 0;
	height: 864px;
	border-left: 1px solid var(--line);
	background: repeating-linear-gradient(
		to bottom,
		transparent 0,
		transparent 143px,
		var(--line) 143px,
		var(--line) 144px
	);
}

.mock-cal__week-event {
	position: absolute;
	z-index: 2;
	left: 6px;
	right: 6px;
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 4px;
	min-height: 48px;
	padding: 8px 10px;
	border: 1px solid var(--event-line);
	border-left: 2px solid var(--event-accent);
	border-radius: var(--r-sm);
	background: var(--event-bg);
	overflow: hidden;
}

.mock-cal__week-event strong {
	font-size: var(--text-sm);
	font-weight: 650;
	color: var(--ink);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.mock-cal__week-time {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	font-size: 11px;
	color: var(--ink-3);
	white-space: nowrap;
}

.mock-cal__week-time :global(svg) {
	width: 11px;
	height: 11px;
}

.mock-cal__week-people {
	display: flex;
	align-items: center;
	margin-top: auto;
}

.mock-cal__week-people :global(.tw-avatar) {
	width: 22px;
	height: 22px;
	margin-left: -6px;
	border: 2px solid var(--surface);
	font-size: 9px;
}

.mock-cal__week-people :global(.tw-avatar:first-child) {
	margin-left: 0;
}

.mock-cal__week-event--cobalt {
	--event-bg: var(--go-bg);
	--event-line: var(--line-strong);
	--event-accent: var(--go);
}

.mock-cal__week-event--rose {
	--event-bg: var(--rose-soft-bg);
	--event-line: var(--line-strong);
	--event-accent: var(--rose-accent);
}

.mock-cal__week-event--warning {
	--event-bg: var(--warning-bg);
	--event-line: var(--line-strong);
	--event-accent: var(--warning-ink);
}

.mock-cal__week-event--danger {
	--event-bg: var(--danger-bg);
	--event-line: var(--line-strong);
	--event-accent: var(--danger-ink);
}

.mock-cal__week-event--neutral {
	--event-bg: var(--bg-band-strong);
	--event-line: var(--line-strong);
	--event-accent: var(--ink-3);
}


.mock-cal__daily {
	display: grid;
	grid-template-columns: 220px minmax(0, 1fr) 280px;
	width: 100%;
	background: var(--bg);
}

.mock-cal__daily-rail {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
	padding: var(--space-4) var(--space-3);
	border-right: 1px solid var(--line);
	background: var(--surface);
}

.mock-cal__daily-profile {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 6px;
	padding-bottom: var(--space-3);
	border-bottom: 1px solid var(--line);
	text-align: center;
}

.mock-cal__daily-profile :global(.tw-avatar) {
	width: 56px;
	height: 56px;
	font-size: var(--text-xl);
}

.mock-cal__daily-profile strong {
	font-size: var(--text-lg);
	font-weight: 600;
	color: var(--ink);
}

.mock-cal__daily-nav {
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.mock-cal__daily-label {
	display: block;
	padding: 0 var(--space-2) var(--space-2);
	font-family: var(--font-cue);
	font-size: var(--text-cue);
	font-weight: 500;
	letter-spacing: var(--tracking-cue);
	text-transform: uppercase;
	color: var(--ink-3);
}

.mock-cal__daily-navitem,
.mock-cal__daily-settings {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 7px var(--space-2);
	border-radius: var(--r-sm);
	font-size: var(--text-md);
	color: var(--ink-2);
}

.mock-cal__daily-settings {
	margin-top: auto;
	color: var(--ink-3);
}

.mock-cal__daily-navitem :global(svg),
.mock-cal__daily-settings :global(svg) {
	width: 15px;
	height: 15px;
	color: var(--ink-3);
}

.mock-cal__daily-navitem.is-active {
	background: var(--accent-soft-bg);
	color: var(--accent);
	font-weight: 600;
}

.mock-cal__daily-navitem.is-active :global(svg) {
	color: var(--accent);
}

.mock-cal__daily-chips {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	padding: 0 var(--space-2);
}

.mock-cal__daily-chip {
	padding: 7px 14px;
	border: 0;
	border-radius: var(--r-sm);
	background: var(--chip-bg);
	font-family: var(--font-cue);
	font-size: var(--text-cue);
	font-weight: 500;
	letter-spacing: var(--tracking-cue);
	text-transform: uppercase;
	color: white;
	cursor: pointer;
	transition:
		opacity var(--dur-1) var(--ease-out),
		transform var(--dur-1) var(--ease-out);
}

.mock-cal__daily-chip:hover {
	transform: translateY(-1px);
}

.mock-cal__daily-chip.is-off {
	opacity: 0.3;
}

.mock-cal__daily-chip--clinic {
	--chip-bg: var(--go);
}

.mock-cal__daily-chip--patients {
	--chip-bg: var(--rose-accent);
}

.mock-cal__daily-chip--admin {
	--chip-bg: var(--rose-accent);
}

.mock-cal__daily-chip--personal {
	--chip-bg: var(--warning-ink);
}

.mock-cal__daily-day {
	min-width: 0;
	max-height: 760px;
	overflow-y: auto;
}

.mock-cal__daily-timeline {
	display: grid;
	grid-template-columns: 64px minmax(0, 1fr);
	padding: var(--space-4) var(--space-4) var(--space-5) 0;
}

.mock-cal__daily-hours {
	display: flex;
	flex-direction: column;
}

.mock-cal__daily-hours span {
	display: block;
	height: 56px;
	box-sizing: border-box;
	padding-right: 8px;
	text-align: right;
	font-size: 11px;
	color: var(--ink-3);
	transform: translateY(-6px);
}

.mock-cal__daily-hours span:first-child {
	transform: none;
}

.mock-cal__daily-lane {
	position: relative;
	grid-column: 2;
	height: 672px;
}

.mock-cal__daily-lane > i {
	display: block;
	height: 56px;
	border-bottom: 1px solid var(--line);
}

.mock-cal__daily-lane > i:first-child {
	border-top: 1px solid var(--line);
}

.mock-cal__daily-now {
	position: absolute;
	left: -64px;
	right: 0;
	display: flex;
	align-items: center;
	gap: 8px;
	pointer-events: none;
}

.mock-cal__daily-now em {
	width: 56px;
	text-align: right;
	transform: translateY(-6px);
	font-style: normal;
	font-size: 11px;
	font-weight: 600;
	color: var(--ink);
}

.mock-cal__daily-now::after {
	content: "";
	flex: 1;
	height: 1.5px;
	background: var(--ink);
}

.mock-cal__daily-event {
	position: absolute;
	display: flex;
	flex-direction: column;
	gap: 3px;
	min-height: 38px;
	padding: 10px 12px;
	border-left: 2px solid var(--event-accent);
	border-radius: var(--r-sm);
	background: var(--event-bg);
	overflow: hidden;
	container-type: size;
	transition: transform var(--dur-1) var(--ease-out);
}

.mock-cal__daily-event:hover {
	transform: translateY(-1px);
}

.mock-cal__daily-event strong {
	font-size: var(--text-md);
	font-weight: 600;
	color: var(--ink);
}

.mock-cal__daily-note {
	font-size: var(--text-sm);
	color: var(--ink-2);
}

.mock-cal__daily-meta {
	margin-top: auto;
	font-family: var(--font-cue);
	font-size: var(--text-cue);
	font-weight: 500;
	letter-spacing: var(--tracking-cue);
	text-transform: uppercase;
	color: var(--ink-3);
}

.mock-cal__daily-star {
	position: absolute;
	top: 10px;
	right: 10px;
	width: 14px;
	height: 14px;
	color: var(--warning-ink);
	fill: var(--warning-ink);
}

.mock-cal__daily-done {
	position: absolute;
	bottom: 8px;
	right: 10px;
	font-family: var(--font-cue);
	font-size: var(--text-cue);
	font-weight: 500;
	letter-spacing: var(--tracking-cue);
	text-transform: uppercase;
	color: var(--go);
}

.mock-cal__daily-event--clinic {
	--event-bg: var(--accent-soft-bg);
	--event-accent: var(--go);
}

.mock-cal__daily-event--patients {
	--event-bg: var(--rose-soft-bg);
	--event-accent: var(--rose-accent);
}

.mock-cal__daily-event--admin {
	--event-bg: var(--rose-soft-bg);
	--event-accent: var(--rose-accent);
}

.mock-cal__daily-event--personal {
	--event-bg: var(--warning-bg);
	--event-accent: var(--warning-ink);
}

.mock-cal__daily-side {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
	padding: var(--space-4) var(--space-3);
	border-left: 1px solid var(--line);
	background: var(--surface);
}

.mock-cal__daily-sidehead {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.mock-cal__daily-sidehead h3 {
	margin: 0;
	font-size: var(--text-lg);
	font-weight: 600;
	color: var(--ink);
}

.mock-cal__daily-sidehead h3 span {
	font-weight: 400;
	color: var(--ink-3);
}

.mock-cal__daily-mini :global(.tw-cal) {
	border: 0;
	padding: 4px;
}

.mock-cal__daily-agenda {
	display: flex;
	flex-direction: column;
	border-top: 1px solid var(--line);
	padding-top: var(--space-2);
}

.mock-cal__daily-agitem {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 8px 6px;
	border: 0;
	border-radius: var(--r-sm);
	background: none;
	font: inherit;
	text-align: left;
	cursor: pointer;
	transition: background var(--dur-1) var(--ease-out);
}

.mock-cal__daily-agitem:hover {
	background: var(--accent-soft-bg);
}

.mock-cal__daily-agitem.is-off {
	opacity: 0.35;
	cursor: default;
}

.mock-cal__daily-agcheck {
	display: flex;
	color: var(--ink-3);
}

.mock-cal__daily-agcheck :global(svg) {
	width: 16px;
	height: 16px;
}

.mock-cal__daily-agitem.is-done .mock-cal__daily-agcheck {
	color: var(--go);
}

.mock-cal__daily-agtime {
	width: 54px;
	font-family: var(--font-mono);
	font-size: 10.5px;
	color: var(--ink-3);
}

.mock-cal__daily-agtitle {
	font-size: var(--text-md);
	font-weight: 500;
	color: var(--ink);
}

.mock-cal__daily-agitem.is-done .mock-cal__daily-agtitle {
	color: var(--ink-3);
	text-decoration: line-through;
}

.mock-cal__daily-side > :global(.tw-btn) {
	align-self: flex-start;
}

@container (max-height: 64px) {
	.mock-cal__daily-note,
	.mock-cal__daily-meta,
	.mock-cal__daily-done {
		display: none;
	}

	.mock-cal__daily-event strong {
		font-size: var(--text-sm);
	}
}

.mock-cal__empty {
	padding: var(--space-6);
	border: 1px dashed var(--line-strong);
	border-radius: var(--r-lg);
	color: var(--ink-3);
	font-size: var(--text-md);
	text-align: center;
}

.mock-cal__form {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
	min-width: 320px;
}

@media (max-width: 800px) {
	.mock-cal__head {
		flex-direction: column;
		align-items: stretch;
	}

	.mock-cal__search {
		width: 100%;
	}

	.mock-cal__toolbar {
		flex-wrap: wrap;
	}

	.mock-cal__week,
	.mock-cal__daily {
		min-width: 100%;
	}
}

@media (max-width: 1100px) {
	.mock-cal__daily {
		grid-template-columns: 200px minmax(0, 1fr);
	}

	.mock-cal__daily-side {
		grid-column: 1 / -1;
		border-left: 0;
		border-top: 1px solid var(--line);
	}
}
`;
