import css from "styled-jsx/css";

export const chatSceneStyles = css`
.mock-dd {
	grid-column: 2 / -1;
	grid-row: 1 / 3;
	display: grid;
	grid-template-columns: 230px 1fr 300px;
	width: 100%;
	height: 100%;
	min-height: 0;
	overflow: hidden;
	background: var(--bg);
}

.mock-dd__side {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
	padding: var(--space-4) var(--space-3);
	border-right: 1px solid var(--line);
	background: var(--bg-band);
}

.mock-dd__workspace {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 var(--space-1);
}

.mock-dd__workspace strong {
	font-size: var(--text-lg);
	font-weight: 650;
	color: var(--ink);
}

.mock-dd__quick {
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.mock-dd__quickitem {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 6px var(--space-2);
	border-radius: var(--r-md);
	font-size: var(--text-md);
	color: var(--ink-2);
}

.mock-dd__quickitem svg {
	color: var(--ink-3);
	flex-shrink: 0;
}

.mock-dd__quickitem b {
	margin-left: auto;
	font-weight: 500;
	font-size: var(--text-sm);
	color: var(--ink-3);
}

.mock-dd__chanhead {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: var(--space-2) var(--space-2) 0;
	border-top: 1px solid var(--line);
}

.mock-dd__channels {
	display: flex;
	flex-direction: column;
	gap: 1px;
	overflow-y: auto;
}

.mock-dd__chan {
	display: flex;
	align-items: center;
	gap: 7px;
	padding: 6px var(--space-2);
	border: none;
	border-radius: var(--r-md);
	background: transparent;
	font-family: var(--font-ui);
	font-size: var(--text-md);
	color: var(--ink-2);
	text-align: left;
	cursor: pointer;
	transition: background var(--dur-1) var(--ease-out);
}

.mock-dd__chan:hover {
	background: var(--bg-band-strong);
}

.mock-dd__chan--active,
.mock-dd__chan--active:hover {
	background: var(--accent-soft-bg);
	color: var(--accent);
	font-weight: 600;
}

.mock-dd__hash {
	color: var(--ink-3);
	font-size: 12px;
	width: 12px;
	flex-shrink: 0;
}

.mock-dd__chan b {
	margin-left: auto;
	font-weight: 500;
	font-size: var(--text-sm);
	color: var(--ink-3);
}

.mock-dd__thread {
	display: flex;
	flex-direction: column;
	min-width: 0;
}

.mock-dd__thread-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--space-3);
	padding: var(--space-3) var(--space-4);
	border-bottom: 1px solid var(--line);
	font-size: var(--text-md);
	color: var(--ink-2);
}

.mock-dd__crumbs strong {
	color: var(--ink);
	font-weight: 650;
}

.mock-dd__facepile {
	display: inline-flex;
}

.mock-dd__facepile .tw-avatar {
	margin-left: -6px;
	border: 2px solid var(--surface);
}

.mock-dd__facepile .tw-avatar:first-child {
	margin-left: 0;
}

.mock-dd__posts {
	flex: 1;
	overflow-y: auto;
	padding: var(--space-4);
	display: flex;
	flex-direction: column;
	max-height: 560px;
}

.mock-dd__post {
	display: flex;
	gap: var(--space-3);
	padding: var(--space-3) 0;
	border-bottom: 1px solid var(--line);
}

.mock-dd__post--last {
	border-bottom: none;
}

.mock-dd__post-main {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
}

.mock-dd__post-head {
	display: flex;
	align-items: baseline;
	gap: var(--space-2);
}

.mock-dd__post-head strong {
	font-size: var(--text-md);
	font-weight: 650;
	color: var(--ink);
}

.mock-dd__post-head span {
	font-size: var(--text-sm);
	color: var(--ink-3);
}

.mock-dd__post-main p {
	margin: 0;
	font-size: var(--text-md);
	color: var(--ink-2);
	line-height: 1.6;
}

.mock-dd__mention {
	color: var(--accent);
	font-weight: 600;
}

.mock-dd__linkcard {
	display: flex;
	align-items: center;
	gap: var(--space-3);
	padding: var(--space-3);
	border: 1px solid var(--line);
	border-radius: var(--r-md);
	background: var(--surface);
	max-width: 460px;
}

.mock-dd__linkicon {
	display: grid;
	place-items: center;
	width: 32px;
	height: 32px;
	border-radius: var(--r-sm);
	background: var(--accent-soft-bg);
	color: var(--accent);
	flex-shrink: 0;
}

.mock-dd__linktext {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
}

.mock-dd__linktext strong {
	font-size: var(--text-md);
	font-weight: 600;
	color: var(--ink);
}

.mock-dd__linktext span {
	font-size: var(--text-sm);
	color: var(--ink-3);
}

.mock-dd__reactions {
	display: flex;
	gap: 6px;
}

.mock-dd__reaction {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	padding: 3px 9px;
	border: 1px solid var(--line);
	border-radius: var(--r-pill);
	background: var(--surface);
	font-size: var(--text-sm);
	cursor: pointer;
	transition:
		border-color var(--dur-1) var(--ease-out),
		background var(--dur-1) var(--ease-out);
}

.mock-dd__reaction b {
	font-weight: 600;
	color: var(--ink-2);
}

.mock-dd__reaction:hover {
	border-color: var(--line-strong);
}

.mock-dd__reaction--active {
	border-color: color-mix(in srgb, var(--accent) 45%, transparent);
	background: var(--accent-soft-bg);
}

.mock-dd__reaction--active b {
	color: var(--accent);
}

.mock-dd__composer {
	position: relative;
	padding: var(--space-3) var(--space-4);
	border-top: 1px solid var(--line);
}

.mock-dd__composer-bar {
	display: flex;
	align-items: center;
	gap: 2px;
}

.mock-dd__input {
	flex: 1;
	min-width: 0;
	border: none;
	background: transparent;
	font-family: var(--font-ui);
	font-size: var(--text-md);
	color: var(--ink);
	padding: 0 var(--space-2);
	height: 32px;
}

.mock-dd__input:focus {
	outline: none;
}

.mock-dd__mentions {
	position: absolute;
	bottom: calc(100% - 4px);
	left: var(--space-4);
	display: flex;
	flex-direction: column;
	gap: 2px;
	padding: var(--space-2);
	background: var(--surface);
	border: 1px solid var(--line-strong);
	border-radius: var(--r-md);
	box-shadow: var(--shadow-overlay);
	z-index: var(--z-overlay);
	min-width: 200px;
	animation: tw-menu-in var(--dur-2) var(--ease-out) both;
}

.mock-dd__mentions .tw-cue {
	padding: 2px 6px 4px;
}

.mock-dd__mention-row {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 6px;
	border: none;
	border-radius: var(--r-sm);
	background: transparent;
	font-family: var(--font-ui);
	font-size: var(--text-md);
	color: var(--ink);
	cursor: pointer;
	text-align: left;
}

.mock-dd__mention-row:hover {
	background: var(--bg-band-strong);
}

.mock-dd__info {
	display: flex;
	flex-direction: column;
	padding: var(--space-3) var(--space-5) var(--space-4);
	border-left: 1px solid var(--line);
	overflow-y: auto;
	max-height: 720px;
}

.mock-dd__info > * {
	flex-shrink: 0;
}

.mock-dd__info .tw-tabs {
	margin-bottom: var(--space-2);
}

.mock-dd__infosec {
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
	padding: var(--space-4) 0;
}

.mock-dd__infosec:first-of-type {
	padding-top: var(--space-2);
}

.mock-dd__infosec + .mock-dd__infosec,
.mock-dd__alt {
	border-top: 1px solid var(--line);
}

.mock-dd__alt {
	padding-top: var(--space-4);
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
}

.mock-dd__meta div {
	display: flex;
	align-items: center;
	justify-content: space-between;
	font-size: var(--text-md);
	padding: 3px 0;
}

.mock-dd__member {
	display: flex;
	align-items: center;
	gap: var(--space-2);
	padding: 4px 0;
}

.mock-dd__infosec h4 {
	margin: 0;
	font-size: var(--text-md);
	font-weight: 650;
	color: var(--ink);
}

.mock-dd__infosec h4 b {
	color: var(--ink-3);
	font-weight: 500;
}

.mock-dd__meta {
	margin: 0;
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.mock-dd__meta div {
	display: flex;
	align-items: center;
	justify-content: space-between;
	font-size: var(--text-md);
}

.mock-dd__meta dt {
	color: var(--ink-3);
}

.mock-dd__meta dd {
	margin: 0;
	color: var(--ink);
	font-weight: 550;
}

.mock-dd__linked {
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.mock-dd__linked span {
	display: flex;
	align-items: center;
	gap: 7px;
	font-size: var(--text-md);
	color: var(--ink-2);
}

.mock-dd__linked b {
	margin-left: auto;
	color: var(--ink-3);
	font-weight: 500;
}

.mock-dd__activity {
	display: flex;
	gap: 4px;
	flex-wrap: wrap;
}

.mock-dd__activity i {
	width: 12px;
	height: 12px;
	border-radius: 3px;
	background: var(--accent);
}

.mock-dd__members {
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
}

.mock-dd__member {
	display: flex;
	align-items: center;
	gap: var(--space-2);
}

.mock-dd__member-avatar {
	position: relative;
	flex-shrink: 0;
}

.mock-dd__online {
	position: absolute;
	right: -1px;
	bottom: -1px;
	width: 9px;
	height: 9px;
	border-radius: var(--r-pill);
	background: var(--go);
	border: 2px solid var(--surface);
}

.mock-dd__member-text {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
}

.mock-dd__member-text strong {
	font-size: var(--text-md);
	font-weight: 600;
	color: var(--ink);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.mock-dd__member-text span {
	font-size: var(--text-xs);
	color: var(--ink-3);
}

@media (max-width: 1100px) {
	.mock-dd {
		grid-template-columns: 220px 1fr;
	}

	.mock-dd__info {
		display: none;
	}
}

.mock-dd__discard {
	border-radius: var(--r-pill);
	background: var(--bg-band-strong);
	color: var(--ink-2);
	padding: 0 16px;
}

.mock-dd__discard:hover {
	background: var(--line);
	color: var(--ink);
}

.mock-dd__send {
	border-radius: var(--r-pill);
	background: var(--twdb-night);
	color: #ffffff;
	padding: 0 18px;
	box-shadow: none;
}

.mock-dd__send:hover {
	background: #1b1b22;
}

.mock-dd__send:disabled {
	background: var(--twdb-night);
	color: #ffffff;
}
`;
