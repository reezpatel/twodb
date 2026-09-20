import css from "styled-jsx/css";

export const ribbonStyles = css`
	.code-ribbon {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: var(--space-1);
		height: 48px;
		flex-shrink: 0;
		padding: 0 var(--space-2);
		background: var(--surface);
		border-bottom: 1px solid var(--line);
	}

	.code-ribbon__item {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		padding: 0;
		border: 0;
		border-radius: var(--r-md);
		background: transparent;
		color: var(--ink-3);
		cursor: pointer;
		transition:
			background var(--dur-1) var(--ease-out),
			color var(--dur-1) var(--ease-out);
	}

	.code-ribbon__item:hover {
		background: var(--bg-band-strong);
		color: var(--ink-2);
	}

	.code-ribbon__item.is-active {
		background: var(--bg-band-strong);
		color: var(--ink);
	}

	.code-ribbon__spacer {
		flex: 1;
	}
`;
