import css from "styled-jsx/css";

export const segmentedStyles = css`
/* Segmented control — a contained pill-on-band toggle.
   The active button lifts off the band as a white pill; the rest
   stay quiet. Use for short, mutually exclusive choices. */

.tw-seg {
	display: inline-flex;
	gap: 2px;
	padding: 3px;
	border: 1px solid var(--line-strong);
	border-radius: var(--r-md);
	background: var(--bg-band);
	font-family: var(--font-ui);
}

.tw-seg--full {
	display: flex;
	width: 100%;
}

.tw-seg__btn {
	flex: 0 0 auto;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
	min-width: 0;
	height: 30px;
	padding: 0 14px;
	border: 0;
	border-radius: 7px;
	background: transparent;
	color: var(--ink-3);
	font-family: inherit;
	font-size: var(--text-md);
	font-weight: 550;
	white-space: nowrap;
	cursor: pointer;
	transition:
		background var(--dur-1) var(--ease-out),
		color var(--dur-1) var(--ease-out),
		box-shadow var(--dur-1) var(--ease-out);
}

.tw-seg__icon {
	display: inline-grid;
	place-items: center;
	flex: none;
}

.tw-seg__icon :global(svg) {
	width: 14px;
	height: 14px;
}

.tw-seg--icon-only .tw-seg__btn {
	width: 30px;
	padding: 0;
}

.tw-seg--icon-only .tw-seg__label {
	position: absolute;
	width: 1px;
	height: 1px;
	padding: 0;
	margin: -1px;
	overflow: hidden;
	clip: rect(0 0 0 0);
	white-space: nowrap;
	border: 0;
}

.tw-seg--full .tw-seg__btn {
	flex: 1 1 0;
	justify-content: center;
}

.tw-seg__btn:hover:not(.tw-seg__btn--active) {
	color: var(--ink);
}

.tw-seg__btn--active {
	background: var(--surface);
	color: var(--ink);
	box-shadow:
		0 1px 2px rgb(5 5 6 / 0.06),
		0 0 0 0.5px var(--line-strong);
}

.tw-seg__btn:focus-visible {
	outline: none;
	box-shadow:
		0 0 0 3px var(--ring),
		0 1px 2px rgb(5 5 6 / 0.06);
}

/* Count — a quiet tabular numeral riding after the label. */
.tw-seg__count {
	margin-left: 7px;
	font-size: var(--text-sm);
	font-weight: 500;
	font-variant-numeric: tabular-nums;
	color: var(--ink-3);
}
`;
