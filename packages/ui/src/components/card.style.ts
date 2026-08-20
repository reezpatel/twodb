import css from "styled-jsx/css";

export const cardStyles = css`
/* Card — matte bands bounded by hairlines, never shadow */

.tw-card {
	background: var(--surface);
	border: 1px solid var(--line);
	border-radius: var(--r-lg);
	padding: var(--space-5);
	color: var(--ink);
	transition:
		border-color var(--dur-1) var(--ease-out),
		background var(--dur-1) var(--ease-out);
}

.tw-card:hover {
	border-color: var(--line-strong);
}

.tw-card--compact {
	padding: var(--space-4);
	border-radius: var(--r-md);
}

.tw-card--band {
	background: var(--bg-band);
}

.tw-card--rose {
	border-color: color-mix(in srgb, var(--rose-accent) 26%, var(--line));
	background: var(--rose-soft-bg);
}

.tw-card--warning {
	border-color: color-mix(in srgb, var(--warning-ink) 22%, var(--line));
	background: var(--warning-bg);
}

.tw-card--danger {
	border-color: color-mix(in srgb, var(--danger-ink) 24%, var(--line));
	background: var(--danger-bg);
}

.tw-card--rose:hover {
	border-color: color-mix(in srgb, var(--rose-accent) 44%, var(--line-strong));
}

.tw-card--warning:hover {
	border-color: color-mix(in srgb, var(--warning-ink) 38%, var(--line-strong));
}

.tw-card--danger:hover {
	border-color: color-mix(in srgb, var(--danger-ink) 42%, var(--line-strong));
}

.tw-card__header {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: var(--space-3);
	margin-bottom: var(--space-3);
}

.tw-card__title {
	margin: 0;
	font-size: var(--text-lg);
	font-weight: 650;
	line-height: 1.2;
	color: var(--ink);
}

.tw-card__body {
	color: var(--ink);
	font-size: var(--text-md);
	line-height: 1.55;
}

.tw-card__body > :first-child {
	margin-top: 0;
}

.tw-card__body > :last-child {
	margin-bottom: 0;
}

.tw-card--compact .tw-card__header {
	margin-bottom: var(--space-2);
}
`;
