import css from "styled-jsx/css";

export const progressStyles = css`
/* Progress — a single horizontal bar that reads left to right.
   The rail is a hairline band; the fill takes the chosen tone. */

.tw-progress {
	display: block;
	width: 100%;
	height: 8px;
	border-radius: var(--r-pill);
	background: var(--bg-band-strong);
	overflow: hidden;
}

.tw-progress__fill {
	display: block;
	height: 100%;
	border-radius: var(--r-pill);
	background: var(--accent);
	transition: width var(--dur-3) var(--ease-out);
}

.tw-progress__fill--rose {
	background: var(--rose-accent);
}

.tw-progress__fill--purple {
	background: #6b54ff;
}

.tw-progress__fill--go {
	background: var(--go);
}

.tw-progress__fill--warning {
	background: var(--warning-ink);
}
`;
