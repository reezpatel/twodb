import css from "styled-jsx/css";

export const fileTreeStyles = css`
	.tw-ftree {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
`;

export const fileTreeNodeStyles = css`
	.tw-ftree__row {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 6px var(--space-2);
		border: none;
		border-radius: var(--r-md);
		background: transparent;
		font-family: var(--font-ui);
		font-size: var(--text-md);
		font-weight: 500;
		color: var(--ink-2);
		text-align: left;
		cursor: pointer;
		transition:
			background var(--dur-1) var(--ease-out),
			color var(--dur-1) var(--ease-out);
	}

	.tw-ftree__row:hover {
		background: var(--bg-band-strong);
		color: var(--ink);
	}

	.tw-ftree__row--selected,
	.tw-ftree__row--selected:hover {
		background: var(--accent-soft-bg);
		color: var(--accent);
		font-weight: 600;
	}

	.tw-ftree__icon {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		color: var(--ink-3);
	}

	.tw-ftree__icon :global(svg) {
		width: 15px;
		height: 15px;
	}

	.tw-ftree__row--selected .tw-ftree__icon {
		color: var(--accent);
	}

	.tw-ftree__label {
		flex: 1;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tw-ftree__count {
		font-weight: 500;
		font-size: var(--text-sm);
		color: var(--ink-3);
	}

	.tw-ftree__chev {
		display: grid;
		place-items: center;
		color: var(--ink-3);
		flex-shrink: 0;
	}

	.tw-ftree__chev :global(svg) {
		width: 14px;
		height: 14px;
	}

	.tw-ftree__children {
		position: relative;
		margin-left: 15px;
		padding-left: 12px;
	}

	.tw-ftree__children::before {
		content: "";
		position: absolute;
		left: 0;
		top: 0;
		bottom: 12px;
		width: 1px;
		background: var(--line-strong);
	}
`;
