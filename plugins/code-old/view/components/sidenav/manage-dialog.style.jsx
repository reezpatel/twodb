import css from "styled-jsx/css";

export const manageDialogStyles = css`
	.code-manage__tabs {
		margin-bottom: var(--space-3);
	}

	.code-manage__list {
		display: flex;
		flex-direction: column;
	}

	.code-manage__row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--line);
	}

	.code-manage__row:last-child {
		border-bottom: 0;
	}

	.code-manage__row :global(svg) {
		color: var(--ink-3);
		flex: none;
	}

	.code-manage__row-main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.code-manage__name {
		font-size: 13px;
		color: var(--ink);
		flex: 1;
	}

	.code-manage__name--mono {
		font-family: var(--font-mono);
		font-size: 12.5px;
	}

	.code-manage__desc {
		font-size: 12px;
		color: var(--ink-3);
	}

	.code-manage__meta {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--ink-3);
	}

	.code-manage__remove {
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		border: 0;
		border-radius: var(--r-sm);
		background: transparent;
		color: var(--ink-3);
		cursor: pointer;
	}

	.code-manage__remove:hover {
		background: var(--bg-band-strong);
		color: var(--danger-ink);
	}
`;
