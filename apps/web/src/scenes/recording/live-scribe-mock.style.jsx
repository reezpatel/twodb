import css from "styled-jsx/css";

export const liveScribeStyles = css`
/* LiveScribe mock — live transcription studio */

.mock-ls {
	display: flex;
	flex-direction: column;
	width: 100%;
	border: 1px solid var(--line-strong);
	border-radius: var(--r-lg);
	background: var(--bg);
	overflow: hidden;
}

/* --- top bar --- */

.mock-ls__bar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--space-3);
	padding: var(--space-3) var(--space-4);
	border-bottom: 1px solid var(--line);
	background: var(--surface);
}

.mock-ls__title h2 {
	margin: 0;
	font-size: var(--text-lg);
	font-weight: 600;
	color: var(--ink);
	display: inline;
}

.mock-ls__title span {
	margin-left: 10px;
	font-size: var(--text-sm);
	color: var(--ink-3);
}

.mock-ls__baractions {
	display: flex;
	align-items: center;
	gap: 6px;
}

.mock-ls__host {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	margin-left: 6px;
	padding: 4px 10px 4px 4px;
	border: 1px solid var(--line);
	border-radius: 999px;
	font-size: var(--text-sm);
	font-weight: 500;
	color: var(--ink);
}

/* --- layout --- */

.mock-ls__grid {
	display: grid;
	grid-template-columns: minmax(0, 1fr) 340px;
	gap: var(--space-3);
	padding: var(--space-3);
}

.mock-ls__left {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
	min-width: 0;
}

/* --- video stage --- */

.mock-ls__stage {
	position: relative;
	border-radius: var(--r-md);
	overflow: hidden;
	aspect-ratio: 16 / 8.5;
	background: rgb(5 5 6);
}

.mock-ls__stage > img {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.mock-ls__speaker {
	position: absolute;
	top: 12px;
	left: 12px;
	display: inline-flex;
	align-items: center;
	gap: 8px;
	padding: 4px 12px 4px 4px;
	border-radius: 999px;
	background: rgb(5 5 6 / 0.62);
	color: #fff;
	font-size: var(--text-sm);
	font-weight: 500;
	backdrop-filter: blur(6px);
}

.mock-ls__rec {
	position: absolute;
	top: 12px;
	right: 12px;
	display: inline-flex;
	align-items: center;
	gap: 7px;
	padding: 5px 11px;
	border-radius: 999px;
	background: rgb(5 5 6 / 0.62);
	color: #d9d8e4;
	font-family: var(--font-cue);
	font-size: 10px;
	font-weight: 500;
	letter-spacing: var(--tracking-cue);
	text-transform: uppercase;
	backdrop-filter: blur(6px);
}

.mock-ls__rec i {
	width: 7px;
	height: 7px;
	border-radius: 50%;
	background: #9291a3;
}

.mock-ls__rec.is-live {
	color: #fff;
}

.mock-ls__rec.is-live i {
	background: #ff9ec0;
	animation: mock-ls-pulse 1.6s var(--ease-out) infinite;
}

@keyframes mock-ls-pulse {
	0%,
	100% {
		box-shadow: 0 0 0 0 rgb(255 158 192 / 0.5);
	}
	50% {
		box-shadow: 0 0 0 5px rgb(255 158 192 / 0);
	}
}

/* call controls */

.mock-ls__controls {
	position: absolute;
	bottom: 12px;
	left: 50%;
	transform: translateX(-50%);
	display: flex;
	gap: 8px;
}

.mock-ls__ctl {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 40px;
	height: 40px;
	border: 1px solid rgb(255 255 255 / 0.18);
	border-radius: 50%;
	background: rgb(5 5 6 / 0.55);
	color: #fff;
	cursor: pointer;
	backdrop-filter: blur(6px);
	transition:
		background var(--dur-1) var(--ease-out),
		border-color var(--dur-1) var(--ease-out),
		transform var(--dur-1) var(--ease-out);
}

.mock-ls__ctl:hover {
	background: rgb(5 5 6 / 0.8);
	transform: translateY(-1px);
}

.mock-ls__ctl :global(svg) {
	width: 16px;
	height: 16px;
}

.mock-ls__ctl.is-off {
	background: rgb(255 255 255 / 0.92);
	color: rgb(5 5 6);
}

.mock-ls__ctl--end {
	background: #c2285a;
	border-color: #c2285a;
}

.mock-ls__ctl--end:hover {
	background: #a91f4c;
}

/* --- scribe card --- */

.mock-ls__scribe {
	border: 1px solid var(--line);
	border-radius: var(--r-md);
	background: var(--surface);
	display: flex;
	flex-direction: column;
	min-height: 0;
}

.mock-ls__scribehead {
	display: flex;
	align-items: center;
	gap: var(--space-3);
	padding: var(--space-3) var(--space-4);
	border-bottom: 1px solid var(--line);
}

.mock-ls__ai {
	display: inline-flex;
	align-items: center;
	gap: 10px;
}

.mock-ls__ai > :global(svg) {
	width: 18px;
	height: 18px;
	color: var(--rose-accent);
}

.mock-ls__ai span {
	display: flex;
	flex-direction: column;
}

.mock-ls__ai strong {
	font-size: var(--text-md);
	font-weight: 600;
	color: var(--ink);
}

.mock-ls__ai em {
	font-style: normal;
	font-size: var(--text-sm);
	color: var(--ink-3);
}

.mock-ls__scribehead :global(.tw-btn) {
	margin-left: auto;
}

/* waveform */

.mock-ls__wave {
	display: flex;
	align-items: center;
	gap: 2.5px;
	height: 26px;
	flex: 1;
	justify-content: center;
}

.mock-ls__wave i {
	width: 2.5px;
	height: 4px;
	border-radius: 2px;
	background: var(--line-strong);
}

.mock-ls__wave.is-live i {
	background: var(--accent);
	animation: mock-ls-wave 0.9s ease-in-out infinite alternate;
}

@keyframes mock-ls-wave {
	from {
		height: 4px;
		opacity: 0.55;
	}
	to {
		height: 22px;
		opacity: 1;
	}
}

/* language pair */

.mock-ls__langs {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: var(--space-3);
	padding: 8px var(--space-4);
	border-bottom: 1px solid var(--line);
}

.mock-ls__lang {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	font-size: var(--text-sm);
	font-weight: 500;
	color: var(--ink-2);
}

.mock-ls__lang :global(svg) {
	width: 12px;
	height: 12px;
	color: var(--ink-3);
}

.mock-ls__swap {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 26px;
	height: 26px;
	border-radius: var(--r-sm);
	background: var(--accent-soft-bg);
	color: var(--accent);
}

.mock-ls__swap :global(svg) {
	width: 13px;
	height: 13px;
}

/* transcript lines */

.mock-ls__lines {
	max-height: 260px;
	overflow-y: auto;
	display: flex;
	flex-direction: column;
}

.mock-ls__line {
	display: flex;
	gap: 10px;
	padding: 12px var(--space-4);
	border-bottom: 1px solid var(--line);
}

.mock-ls__line:last-child {
	border-bottom: 0;
}

.mock-ls__line p {
	margin: 3px 0 0;
	font-size: var(--text-md);
	line-height: 1.55;
	color: var(--ink-2);
	max-width: var(--measure);
}

.mock-ls__lmeta {
	font-size: var(--text-sm);
	color: var(--ink-3);
}

.mock-ls__lmeta strong {
	color: var(--ink);
	font-weight: 600;
}

.mock-ls__line--pending {
	padding: 10px var(--space-4);
}

.mock-ls__dots {
	display: inline-flex;
	gap: 4px;
}

.mock-ls__dots i {
	width: 5px;
	height: 5px;
	border-radius: 50%;
	background: var(--ink-3);
	animation: mock-ls-dot 1.1s ease-in-out infinite;
}

.mock-ls__dots i:nth-child(2) {
	animation-delay: 0.15s;
}

.mock-ls__dots i:nth-child(3) {
	animation-delay: 0.3s;
}

@keyframes mock-ls-dot {
	0%,
	100% {
		opacity: 0.3;
	}
	50% {
		opacity: 1;
	}
}

/* --- right column --- */

.mock-ls__right {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
	min-width: 0;
}

.mock-ls__panel {
	border: 1px solid var(--line);
	border-radius: var(--r-md);
	background: var(--surface);
	overflow: hidden;
}

.mock-ls__panelhead {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: var(--space-3) var(--space-4) var(--space-2);
}

.mock-ls__panelhead h3 {
	margin: 0;
	font-size: var(--text-md);
	font-weight: 600;
	color: var(--ink);
}

.mock-ls__showall {
	font-size: var(--text-sm);
	color: var(--accent);
}

.mock-ls__tiles {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 8px;
	padding: 0 var(--space-3) var(--space-3);
}

.mock-ls__tile {
	position: relative;
	border-radius: var(--r-sm);
	overflow: hidden;
	aspect-ratio: 16 / 10;
}

.mock-ls__tile img {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.mock-ls__tname {
	position: absolute;
	bottom: 6px;
	left: 6px;
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 3px 9px 3px 3px;
	border-radius: 999px;
	background: rgb(5 5 6 / 0.62);
	color: #fff;
	font-size: 11px;
	font-weight: 500;
	backdrop-filter: blur(4px);
}

.mock-ls__tmic {
	position: absolute;
	top: 6px;
	right: 6px;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 20px;
	height: 20px;
	border-radius: 50%;
	background: rgb(5 5 6 / 0.62);
	color: #fff;
}

.mock-ls__tmic :global(svg) {
	width: 11px;
	height: 11px;
}

/* accordions */

.mock-ls__acc {
	display: flex;
	align-items: center;
	gap: 8px;
	width: 100%;
	padding: 12px var(--space-4);
	border: 0;
	background: none;
	font: inherit;
	font-size: var(--text-md);
	font-weight: 600;
	color: var(--ink);
	cursor: pointer;
	text-align: left;
}

.mock-ls__acc > :global(svg:first-child) {
	width: 15px;
	height: 15px;
	color: var(--accent);
}

.mock-ls__acc > :global(svg:last-child) {
	width: 14px;
	height: 14px;
	margin-left: auto;
	color: var(--ink-3);
	transition: transform var(--dur-1) var(--ease-out);
}

.mock-ls__acc[aria-expanded="false"] > :global(svg:last-child) {
	transform: rotate(-90deg);
}

.mock-ls__accbody {
	margin: 0;
	padding: 0 var(--space-4) var(--space-3);
	font-size: var(--text-md);
	line-height: 1.6;
	color: var(--ink-2);
}

.mock-ls__points {
	margin: 0;
	padding: 0 var(--space-4) var(--space-3) var(--space-6);
	font-size: var(--text-md);
	line-height: 1.6;
	color: var(--ink-2);
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.mock-ls__side {
	max-height: 300px;
	overflow-y: auto;
}

.mock-ls__sline {
	display: flex;
	gap: 10px;
	padding: 10px var(--space-4);
	border-bottom: 1px solid var(--line);
}

.mock-ls__sline:last-child {
	border-bottom: 0;
}

.mock-ls__sline p {
	margin: 0;
	font-size: var(--text-sm);
	line-height: 1.55;
	color: var(--ink-2);
}

.mock-ls__sline strong {
	color: var(--ink);
}

.mock-ls__stime {
	font-family: var(--font-mono);
	font-size: 10.5px;
	color: var(--ink-3);
	padding-top: 2px;
}

@media (max-width: 1000px) {
	.mock-ls__grid {
		grid-template-columns: 1fr;
	}
}
`;
