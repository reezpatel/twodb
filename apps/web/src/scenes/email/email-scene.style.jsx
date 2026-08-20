import css from "styled-jsx/css";

export const emailSceneStyles = css`
.mock-in {
	display: grid;
	grid-template-columns: 230px 330px 1fr;
	grid-column: 2 / -1;
	grid-row: 1 / 3;
	width: 100%;
	height: 100%;
	min-height: 0;
	overflow: hidden;
	background: var(--bg);
}

.mock-in__folders {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
	padding: var(--space-4) var(--space-3);
	border-right: 1px solid var(--line);
	background: var(--bg-band);
}

.mock-in__account {
	display: flex;
	align-items: center;
	gap: var(--space-2);
	padding: 0 var(--space-1);
}

.mock-in__account-text {
	display: flex;
	flex-direction: column;
	min-width: 0;
}

.mock-in__account-text strong {
	font-size: var(--text-md);
	font-weight: 650;
	color: var(--ink);
}

.mock-in__account-text span {
	font-size: var(--text-xs);
	color: var(--ink-3);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.mock-in__count {
	font-size: var(--text-sm);
	color: var(--ink-3);
}

.mock-in__labels {
	display: flex;
	flex-direction: column;
	gap: 2px;
	padding-top: var(--space-2);
	border-top: 1px solid var(--line);
}

.mock-in__labels-head {
	padding: var(--space-2) var(--space-2) 6px;
}

.mock-in__label {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 6px var(--space-2);
	font-size: var(--text-md);
	color: var(--ink-2);
	border-radius: var(--r-md);
}

.mock-in__label i {
	width: 8px;
	height: 8px;
	border-radius: 2px;
	flex-shrink: 0;
}

.mock-in__label b {
	margin-left: auto;
	font-weight: 500;
	color: var(--ink-3);
	font-size: var(--text-sm);
}

.mock-in__folders-foot {
	margin-top: auto;
}

.mock-in__list {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
	padding: var(--space-4) var(--space-3);
	border-right: 1px solid var(--line);
	min-width: 0;
}

.mock-in__list-head h3 {
	margin: 0;
	display: flex;
	align-items: baseline;
	gap: var(--space-2);
	font-size: var(--text-xl);
	font-weight: 650;
}

.mock-in__list-head h3 span {
	font-size: var(--text-sm);
	font-weight: 400;
	color: var(--ink-3);
}

.mock-in__threads {
	display: flex;
	flex-direction: column;
	overflow-y: auto;
	min-height: 0;
}

.mock-in__group {
	display: flex;
	align-items: center;
	gap: 5px;
	padding: var(--space-2) var(--space-2) 6px;
}

.mock-in__thread {
	position: relative;
	display: flex;
	align-items: flex-start;
	gap: var(--space-2);
	padding: 10px var(--space-2);
	border: none;
	border-radius: var(--r-md);
	background: transparent;
	text-align: left;
	cursor: pointer;
	font-family: var(--font-ui);
	transition: background var(--dur-1) var(--ease-out);
}

.mock-in__thread:hover {
	background: var(--bg-band-strong);
}

.mock-in__thread--active,
.mock-in__thread--active:hover {
	background: var(--surface);
	box-shadow: inset 2px 0 0 var(--accent);
}

.mock-in__thread-main {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.mock-in__thread-top {
	display: flex;
	align-items: center;
	gap: 6px;
}

.mock-in__thread-top strong {
	font-size: var(--text-md);
	font-weight: 600;
	color: var(--ink);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.mock-in__thread-time {
	margin-left: auto;
	font-size: var(--text-xs);
	color: var(--ink-3);
	flex-shrink: 0;
}

.mock-in__thread-snippet {
	font-size: var(--text-sm);
	color: var(--ink-3);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.mock-in__unread {
	position: absolute;
	right: 8px;
	bottom: 10px;
	width: 7px;
	height: 7px;
	border-radius: var(--r-pill);
	background: var(--accent);
}

.mock-in__read {
	display: flex;
	flex-direction: column;
	min-width: 0;
}

.mock-in__toolbar {
	display: flex;
	align-items: center;
	gap: 2px;
	padding: var(--space-2) var(--space-3);
	border-bottom: 1px solid var(--line);
}

.mock-in__pager {
	margin-left: auto;
	display: inline-flex;
	align-items: center;
	gap: var(--space-2);
	font-size: var(--text-sm);
	color: var(--ink-3);
}

.mock-in__scroll {
	padding: var(--space-4) var(--space-5) var(--space-6);
	overflow-y: auto;
	min-height: 0;
	display: flex;
	flex-direction: column;
	gap: var(--space-4);
}

.mock-in__date {
	font-size: var(--text-sm);
	color: var(--ink-3);
}

.mock-in__subject {
	margin: 0;
	display: flex;
	align-items: center;
	gap: var(--space-2);
	font-size: var(--text-2xl);
	font-weight: 650;
}

.mock-in__summary {
	padding: var(--space-3) var(--space-4);
	background: var(--rose-soft-bg);
	border: 1px solid color-mix(in srgb, var(--rose-accent) 22%, transparent);
	border-radius: var(--r-md);
}

.mock-in__summary-label {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	font-family: var(--font-cue);
	font-size: var(--text-xs);
	font-weight: 500;
	letter-spacing: var(--tracking-cue);
	text-transform: uppercase;
	color: var(--rose-accent);
	margin-bottom: 6px;
}

.mock-in__summary p {
	margin: 0;
	font-size: var(--text-md);
	color: var(--ink-2);
	line-height: 1.55;
}

.mock-in__msg {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
	padding-top: var(--space-4);
	border-top: 1px solid var(--line);
}

.mock-in__msg-head {
	display: flex;
	align-items: center;
	gap: var(--space-2);
}

.mock-in__msg-who {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
}

.mock-in__msg-who strong {
	font-size: var(--text-md);
	font-weight: 650;
	color: var(--ink);
}

.mock-in__msg-who span {
	font-size: var(--text-sm);
	color: var(--ink-3);
}

.mock-in__msg-time {
	font-size: var(--text-sm);
	color: var(--ink-3);
}

.mock-in__starred {
	color: var(--accent);
}

.mock-in__msg-recips {
	display: flex;
	align-items: center;
	gap: 6px;
	flex-wrap: wrap;
}

.mock-in__recip-label {
	font-size: var(--text-sm);
	color: var(--ink-3);
	margin-right: 2px;
}

.mock-in__chip {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 3px 10px 3px 4px;
	border: 1px solid var(--line);
	border-radius: var(--r-pill);
	font-size: var(--text-sm);
	color: var(--ink);
	background: var(--surface);
}

.mock-in__chip--file {
	padding: 6px 12px;
	border-radius: var(--r-md);
	font-weight: 500;
}

.mock-in__chip--file svg {
	color: var(--rose-accent);
}

.mock-in__chip--file em {
	font-style: normal;
	color: var(--ink-3);
	font-size: var(--text-xs);
}

.mock-in__msg-body {
	margin: 0;
	font-size: var(--text-md);
	color: var(--ink-2);
	line-height: 1.6;
	max-width: var(--measure);
}

.mock-in__attach {
	display: flex;
	gap: var(--space-2);
	flex-wrap: wrap;
}

.mock-in__empty {
	margin: auto;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: var(--space-3);
	padding: var(--space-6);
	color: var(--ink-3);
	font-size: var(--text-md);
	text-align: center;
	max-width: 420px;
}

.mock-in__empty p {
	margin: 0;
	line-height: 1.5;
}

.mock-compose {
	position: absolute;
	right: var(--space-4);
	bottom: var(--space-4);
	z-index: var(--z-overlay);
	width: min(720px, calc(100% - 32px));
	color: var(--ink);
}

.mock-compose__window {
	position: relative;
	width: 100%;
	padding: 18px;
	border: 1px solid var(--line-strong);
	border-radius: 20px;
	background: var(--bg);
	box-shadow: var(--shadow-overlay);
}

.mock-compose__top,
.mock-compose__top > div,
.mock-compose__window-actions,
.mock-compose__address,
.mock-compose__pill,
.mock-compose__attachment,
.mock-compose__footer,
.mock-compose__tools,
.mock-compose__assist {
	display: flex;
	align-items: center;
}

.mock-compose__top {
	justify-content: space-between;
	gap: var(--space-3);
	padding: 0 6px 16px;
}

.mock-compose__top > div:first-child {
	gap: var(--space-2);
}

.mock-compose__top h2 {
	margin: 0;
	font-size: var(--text-lg);
	font-weight: 700;
	line-height: 1.2;
}

.mock-compose__mail-icon {
	display: grid;
	place-items: center;
	width: 24px;
	height: 24px;
	color: var(--ink-2);
}

.mock-compose__window-actions,
.mock-compose__tools {
	gap: var(--space-2);
}

.mock-compose__round {
	display: grid;
	place-items: center;
	width: 38px;
	height: 38px;
	padding: 0;
	border: 1px solid var(--line-strong);
	border-radius: var(--r-pill);
	background: var(--surface);
	color: var(--ink);
	box-shadow: var(--shadow-overlay);
	transition:
		border-color var(--dur-1) var(--ease-out),
		background var(--dur-1) var(--ease-out);
}

.mock-compose__round:hover {
	border-color: var(--accent);
	background: var(--accent-soft-bg);
}

.mock-compose__round :global(svg),
.mock-compose__mail-icon :global(svg),
.mock-compose__small-chevron :global(svg),
.mock-compose__pill button :global(svg),
.mock-compose__assist :global(svg) {
	width: 16px;
	height: 16px;
	stroke-width: 1.85;
}

.mock-compose__paper {
	padding: 24px;
	border: 1px solid var(--line-strong);
	border-radius: 18px;
	background: var(--surface);
}

.mock-compose__address {
	position: relative;
	gap: var(--space-2);
	min-height: 36px;
	padding: 2px 0;
}

.mock-compose__field-label {
	width: 42px;
	flex: 0 0 auto;
	font-size: var(--text-md);
	font-weight: 650;
	color: var(--ink);
}

.mock-compose__pill {
	gap: 7px;
	min-width: 0;
	max-width: 220px;
	height: 32px;
	padding: 3px 4px 3px 6px;
	border: 1px solid var(--line);
	border-radius: var(--r-pill);
	background: var(--bg-band);
}

.mock-compose__pill .tw-avatar {
	width: 24px;
	height: 24px;
	font-size: 10px;
}

.mock-compose__pill strong {
	overflow: hidden;
	font-size: var(--text-md);
	font-weight: 600;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.mock-compose__pill button,
.mock-compose__small-chevron {
	display: grid;
	place-items: center;
	width: 24px;
	height: 24px;
	padding: 0;
	border: 1px solid var(--line);
	border-radius: var(--r-pill);
	background: var(--surface);
	color: var(--ink-2);
}

.mock-compose__small-chevron {
	border: 0;
	background: transparent;
	color: var(--ink-3);
}

.mock-compose__cc {
	display: flex;
	gap: var(--space-2);
	margin-left: auto;
}

.mock-compose__divider {
	height: 1px;
	margin: var(--space-2) 0 var(--space-4);
	background: var(--line);
}

.mock-compose__body {
	max-width: 600px;
}

.mock-compose__body h3 {
	margin: 0 0 var(--space-4);
	font-size: var(--text-lg);
	font-weight: 750;
	line-height: 1.25;
	color: var(--ink);
}

.mock-compose__body p {
	margin: 0 0 var(--space-3);
	font-size: var(--text-md);
	line-height: 1.52;
	color: var(--ink);
}

.mock-compose__attachments {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: var(--space-2);
	margin-top: var(--space-5);
}

.mock-compose__attachment {
	gap: var(--space-2);
	min-width: 0;
	padding: 10px;
	border: 1px solid var(--line);
	border-radius: var(--r-md);
	background: var(--bg-band);
}

.mock-compose__attachment span:last-child {
	min-width: 0;
}

.mock-compose__attachment strong,
.mock-compose__attachment em {
	display: block;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.mock-compose__attachment strong {
	font-size: var(--text-sm);
	font-weight: 650;
}

.mock-compose__attachment em {
	margin-top: 2px;
	color: var(--ink-3);
	font-size: var(--text-sm);
	font-style: normal;
}

.mock-compose__filemark {
	position: relative;
	display: grid;
	place-items: center;
	width: 38px;
	height: 42px;
	flex: 0 0 auto;
	border: 1px solid var(--line-strong);
	border-radius: var(--r-md);
	background: var(--surface);
}

.mock-compose__filemark :global(svg) {
	width: 18px;
	height: 18px;
}

.mock-compose__filemark--figma {
	grid-template-columns: repeat(2, 8px);
	grid-template-rows: repeat(2, 8px);
	gap: 2px;
}

.mock-compose__filemark--figma i {
	width: 8px;
	height: 8px;
	border-radius: 999px;
}

.mock-compose__filemark--figma i:nth-child(1) {
	background: #f24e1e;
}
.mock-compose__filemark--figma i:nth-child(2) {
	background: #ff7262;
}
.mock-compose__filemark--figma i:nth-child(3) {
	background: #a259ff;
}
.mock-compose__filemark--figma i:nth-child(4) {
	background: #1abcfe;
}
.mock-compose__filemark--blend {
	color: #ea7600;
}
.mock-compose__filemark--pdf {
	color: #e11d2e;
}

.mock-compose__footer {
	gap: var(--space-2);
	padding: 16px 0 4px;
}

.mock-compose__tools {
	flex: 1;
}

.mock-compose__tools .mock-compose__round,
.mock-compose__footer > .mock-compose__round {
	width: 40px;
	height: 40px;
}

.mock-compose__send {
	min-width: 120px;
	height: 40px;
	border-radius: var(--r-pill);
	background: var(--ink);
	color: var(--surface);
}

.mock-compose__assist {
	position: absolute;
	right: 24px;
	bottom: 64px;
	gap: 7px;
	padding: 5px 9px;
	border: 1px solid var(--line);
	border-radius: var(--r-pill);
	background: var(--surface);
	color: var(--ink-3);
	font-size: var(--text-sm);
}

@media (max-width: 900px) {
	.mock-compose__paper {
		padding: var(--space-4);
	}

	.mock-compose__address {
		align-items: flex-start;
		flex-wrap: wrap;
	}

	.mock-compose__field-label {
		width: 100%;
	}

	.mock-compose__cc {
		margin-left: 0;
	}

	.mock-compose__attachments {
		grid-template-columns: 1fr;
	}

	.mock-compose__assist {
		display: none;
	}
}

@media (max-width: 620px) {
	.mock-compose__window {
		padding: var(--space-3);
	}

	.mock-compose__top,
	.mock-compose__footer {
		flex-wrap: wrap;
	}

	.mock-compose__tools {
		order: 2;
		width: 100%;
	}

	.mock-compose__send {
		flex: 1;
	}
}


@media (max-width: 1100px) {
	.mock-in {
		grid-template-columns: 220px 1fr;
	}

	.mock-in__read {
		display: none;
	}
}

.mock-in__label--marketing i {
	background: var(--twdb-cobalt);
}

.mock-in__label--finance i {
	background: var(--twdb-rose);
}

.mock-in__label--operation i {
	background: var(--twdb-rose-light);
}
`;
