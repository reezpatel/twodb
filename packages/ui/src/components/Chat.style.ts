import css from "styled-jsx/css";

export const chatStyles = css`
/* Chat — Slack-like messaging in the world's grammar.
   Plain bubbles are matte surfaces; the bot carries the rose light. */

.tw-chat {
	display: flex;
	flex-direction: column;
	height: 100%;
	min-height: 0;
	background: var(--bg);
	border: 1px solid var(--line);
	border-radius: var(--r-lg);
	overflow: hidden;
}

/* active / focused panel — lit cobalt outline */
.tw-chat--active {
	border-color: var(--accent);
	box-shadow: 0 0 0 1px var(--accent);
}

/* header */

.tw-chat__header {
	display: flex;
	align-items: center;
	gap: var(--space-3);
	padding: 10px var(--space-4);
	border-bottom: 1px solid var(--line);
}

.tw-chat__title-block {
	flex: 1;
	min-width: 0;
	display: flex;
	align-items: baseline;
	gap: var(--space-2);
}

.tw-chat__title {
	margin: 0;
	font-size: var(--text-lg);
	font-weight: 650;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.tw-chat__subtitle {
	font-size: var(--text-sm);
	color: var(--ink-3);
	white-space: nowrap;
}

.tw-chat__members {
	display: flex;
	align-items: center;
}

.tw-chat__members :global(.tw-avatar) {
	margin-left: -7px;
	border: 2px solid var(--bg);
}

.tw-chat__members :global(.tw-avatar:first-child) {
	margin-left: 0;
}

.tw-chat__members-more {
	margin-left: 4px;
	font-size: var(--text-xs);
	color: var(--ink-3);
}

/* list */

.tw-chat__list {
	flex: 1;
	overflow-y: auto;
	min-height: 0;
	padding: var(--space-3) var(--space-4);
	display: flex;
	flex-direction: column;
	gap: var(--space-4);
}

/* message group: avatar + author header + stacked messages */

.tw-msg-group {
	display: flex;
	gap: 10px;
}

.tw-msg-group__avatar {
	padding-top: 2px;
}

.tw-msg-group__body {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 3px;
}

.tw-msg-group__head {
	display: flex;
	align-items: center;
	gap: var(--space-2);
}

.tw-msg-group__author {
	font-size: var(--text-md);
	font-weight: 650;
	color: var(--ink);
}

.tw-msg-group__author-badge {
	display: inline-flex;
	align-items: center;
	height: 18px;
	padding: 0 7px;
	border-radius: var(--r-sm);
	background: var(--accent-soft-bg);
	color: var(--accent);
	font-size: var(--text-xs);
	font-weight: 600;
	letter-spacing: 0.01em;
}

.tw-msg-group__time {
	font-size: var(--text-xs);
	color: var(--ink-3);
}

/* thread reply — indent avatar under the parent message,
   draw a vertical connector line down the left rail */
.tw-msg-group--thread {
	position: relative;
	padding-left: 30px;
}

.tw-msg-group--thread .tw-msg-group__avatar {
	margin-left: 0;
}

.tw-msg-group--thread::before {
	content: "";
	position: absolute;
	left: 20px;
	top: -10px;
	width: 2px;
	height: 14px;
	background: var(--line-strong);
	border-radius: 2px;
}

/* single message */

.tw-msg {
	position: relative;
	padding: 1px 0;
}

.tw-msg__hover-actions {
	position: absolute;
	top: -14px;
	right: 0;
	display: flex;
	gap: 2px;
	padding: 2px;
	background: var(--surface);
	border: 1px solid var(--line);
	border-radius: var(--r-md);
	box-shadow: var(--shadow-overlay);
	opacity: 0;
	pointer-events: none;
	transition: opacity var(--dur-1) var(--ease-out);
	z-index: 2;
}

.tw-msg:hover .tw-msg__hover-actions,
.tw-msg__hover-actions:focus-within {
	opacity: 1;
	pointer-events: auto;
}

.tw-msg__content {
	display: flex;
	flex-direction: column;
	gap: 6px;
	align-items: flex-start;
}

.tw-msg__text {
	margin: 0;
	font-size: var(--text-md);
	line-height: 1.5;
	color: var(--ink);
	max-width: 62ch;
	white-space: pre-line;
}

/* inline reply preview — quoted message at the top of a reply */

.tw-msg__reply {
	display: block;
	width: 100%;
	max-width: 62ch;
	text-align: left;
	padding: 7px 12px 9px 14px;
	margin-bottom: 2px;
	border: 1px solid var(--line);
	border-left: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
	border-radius: var(--r-md);
	background: var(--bg-band);
	cursor: pointer;
	color: inherit;
	font: inherit;
	transition:
		background var(--dur-1) var(--ease-out),
		border-color var(--dur-1) var(--ease-out);
}

.tw-msg__reply:hover,
.tw-msg__reply:focus-visible {
	background: var(--bg-band-strong);
	border-color: var(--line-strong);
	border-left-color: var(--accent);
	outline: none;
}

.tw-msg__reply:focus-visible {
	box-shadow: 0 0 0 3px var(--ring);
}

.tw-msg__reply-head {
	display: flex;
	align-items: baseline;
	gap: var(--space-2);
	margin-bottom: 1px;
}

.tw-msg__reply-author {
	font-size: var(--text-sm);
	font-weight: 650;
	color: var(--accent);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	max-width: 32ch;
}

.tw-msg__reply-time {
	font-size: var(--text-xs);
	color: var(--ink-3);
}

.tw-msg__reply-text {
	font-size: var(--text-sm);
	line-height: 1.45;
	color: var(--ink-2);
	white-space: pre-line;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
	text-overflow: ellipsis;
}

/* reactions */

.tw-msg__reactions {
	display: flex;
	gap: 6px;
	margin-top: 6px;
	flex-wrap: wrap;
}

/* footer row — reactions on the left, reply-count link on the right */
.tw-msg__footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--space-3);
	margin-top: 6px;
}

.tw-msg__footer .tw-msg__reactions {
	margin-top: 0;
}

.tw-msg__reply-count {
	margin-left: auto;
	border: none;
	background: transparent;
	padding: 0;
	font-family: var(--font-ui);
	font-size: var(--text-sm);
	font-weight: 600;
	color: var(--accent);
	cursor: pointer;
	transition: color var(--dur-1) var(--ease-out);
}

.tw-msg__reply-count:hover {
	color: var(--accent-strong);
	text-decoration: underline;
	text-underline-offset: 3px;
}

.tw-reaction {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	height: 24px;
	padding: 0 8px;
	border: 1px solid var(--line);
	border-radius: var(--r-pill);
	background: var(--surface);
	font-size: 12px;
	cursor: pointer;
	transition:
		background var(--dur-1) var(--ease-out),
		border-color var(--dur-1) var(--ease-out);
}

.tw-reaction:hover {
	border-color: var(--line-strong);
	background: var(--bg-band);
}

.tw-reaction__count {
	font-size: var(--text-xs);
	font-weight: 600;
	color: var(--ink-2);
}

.tw-reaction--on,
.tw-reaction--on:hover {
	background: var(--accent-soft-bg);
	border-color: color-mix(in srgb, var(--accent) 45%, transparent);
}

.tw-reaction--on .tw-reaction__count {
	color: var(--accent);
}

.tw-reaction--add {
	color: var(--ink-3);
	padding: 0 6px;
}

/* bot action buttons */

.tw-msg__actions {
	display: flex;
	gap: var(--space-2);
	margin-top: 8px;
	flex-wrap: wrap;
}

/* media: image + gallery */

.tw-msg__image {
	border-radius: var(--r-md);
	overflow: hidden;
	border: 1px solid var(--line);
	max-width: 340px;
}

.tw-msg__image img {
	display: block;
	width: 100%;
	height: auto;
}

.tw-msg__gallery {
	display: grid;
	grid-template-columns: repeat(2, 160px);
	gap: 4px;
}

.tw-msg__gallery[data-count="1"] {
	grid-template-columns: 320px;
}

.tw-msg__gallery-item {
	position: relative;
	border-radius: var(--r-sm);
	overflow: hidden;
	border: 1px solid var(--line);
	aspect-ratio: 4 / 3;
}

.tw-msg__gallery-item img {
	width: 100%;
	height: 100%;
	object-fit: cover;
	display: block;
}

.tw-msg__gallery-more {
	position: absolute;
	inset: 0;
	display: grid;
	place-items: center;
	background: rgb(5 5 6 / 0.45);
	color: #ffffff;
	font-size: var(--text-lg);
	font-weight: 650;
}

/* video */

.tw-msg__video {
	position: relative;
	width: 340px;
	max-width: 100%;
	aspect-ratio: 16 / 9;
	border-radius: var(--r-md);
	overflow: hidden;
	border: 1px solid var(--line);
}

.tw-msg__video img {
	width: 100%;
	height: 100%;
	object-fit: cover;
	display: block;
}

.tw-msg__video-play {
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	display: grid;
	place-items: center;
	width: 44px;
	height: 44px;
	border: none;
	border-radius: var(--r-pill);
	background: var(--action);
	color: #ffffff;
	cursor: pointer;
	transition:
		transform var(--dur-1) var(--ease-out),
		background var(--dur-1) var(--ease-out);
}

.tw-msg__video-play:hover {
	transform: translate(-50%, -50%) scale(1.06);
	background: var(--action-strong);
}

.tw-msg__video-duration {
	position: absolute;
	right: 8px;
	bottom: 8px;
	padding: 2px 7px;
	border-radius: var(--r-sm);
	background: rgb(5 5 6 / 0.65);
	color: #ffffff;
	font-size: var(--text-xs);
}

/* audio */

.tw-msg__audio {
	display: flex;
	align-items: center;
	gap: 10px;
	width: 300px;
	max-width: 100%;
	padding: 8px 12px;
	border: 1px solid var(--line);
	border-radius: var(--r-md);
	background: var(--surface);
}

.tw-msg__audio-play {
	display: grid;
	place-items: center;
	width: 28px;
	height: 28px;
	flex-shrink: 0;
	border: none;
	border-radius: var(--r-pill);
	background: var(--action);
	color: #ffffff;
	cursor: pointer;
	transition: background var(--dur-1) var(--ease-out);
}

.tw-msg__audio-play:hover {
	background: var(--action-strong);
}

.tw-msg__wave {
	display: flex;
	align-items: center;
	gap: 2.5px;
	flex: 1;
	height: 24px;
}

.tw-msg__wave i {
	width: 2.5px;
	border-radius: 2px;
	background: var(--line-strong);
	transition: background var(--dur-1) var(--ease-out);
}

.tw-msg__wave--playing i {
	background: var(--accent);
}

.tw-msg__audio-time {
	font-size: var(--text-xs);
	color: var(--ink-3);
}

/* document */

.tw-msg__doc {
	display: flex;
	align-items: center;
	gap: 10px;
	width: 300px;
	max-width: 100%;
	padding: 10px 12px;
	border: 1px solid var(--line);
	border-radius: var(--r-md);
	background: var(--surface);
	transition: border-color var(--dur-1) var(--ease-out);
}

.tw-msg__doc:hover {
	border-color: var(--line-strong);
}

.tw-msg__doc-icon {
	display: grid;
	place-items: center;
	width: 36px;
	height: 36px;
	flex-shrink: 0;
	border-radius: var(--r-sm);
	background: var(--rose-soft-bg);
	color: var(--rose-accent);
}

.tw-msg__doc-meta {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
}

.tw-msg__doc-name {
	font-size: var(--text-md);
	font-weight: 600;
	color: var(--ink);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.tw-msg__doc-sub {
	font-size: var(--text-xs);
	color: var(--ink-3);
}

/* composer — one rounded box: growing text above, tools below */

.tw-composer {
	padding: var(--space-3) var(--space-4) var(--space-4);
	border-top: 1px solid var(--line);
	background: var(--bg);
}

.tw-composer__box {
	border: 1px solid var(--line-strong);
	border-radius: var(--r-lg);
	background: var(--surface);
	transition:
		border-color var(--dur-1) var(--ease-out),
		box-shadow var(--dur-1) var(--ease-out);
}

.tw-composer__box:focus-within {
	border-color: var(--accent);
	box-shadow: 0 0 0 3px var(--ring);
}

.tw-composer__input {
	display: block;
	width: 100%;
	min-height: 40px;
	max-height: 77px; /* 3 lines */
	padding: 10px var(--space-3) 4px;
	border: none;
	background: transparent;
	font-family: var(--font-ui);
	font-size: var(--text-md);
	line-height: 1.5;
	color: var(--ink);
	resize: none;
	outline: none;
}

.tw-composer__input::placeholder {
	color: var(--ink-3);
}

.tw-composer__row {
	display: flex;
	align-items: center;
	gap: 2px;
	padding: 4px var(--space-2) 8px;
}

.tw-composer__send {
	margin-left: auto;
	display: flex;
	align-items: center;
	gap: var(--space-2);
}

.tw-composer__hint {
	font-size: var(--text-xs);
	color: var(--ink-3);
	white-space: nowrap;
}
`;
