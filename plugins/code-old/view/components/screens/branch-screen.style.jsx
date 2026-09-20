import css from "styled-jsx/css";

export const branchScreenStyles = css`
	.code-branch {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		width: 100%;
		background: var(--bg);
	}

	.code-branch__search {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: var(--space-3) var(--space-4) 0;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--line);
		border-radius: var(--r-md);
		color: var(--ink-3);
		flex: none;
	}

	.code-branch__search:focus-within {
		border-color: var(--accent);
	}

	.code-branch__input {
		flex: 1;
		border: 0;
		background: transparent;
		font: inherit;
		font-size: 13px;
		color: var(--ink);
		outline: none;
	}

	.code-branch__input::placeholder {
		color: var(--ink-3);
	}

	.code-branch__list {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: var(--space-2) var(--space-2) var(--space-3);
	}

	.code-branch__group {
		padding: var(--space-2) var(--space-3) var(--space-1);
		font-family: var(--font-cue);
		font-size: 10px;
		letter-spacing: var(--tracking-cue);
		text-transform: uppercase;
		color: var(--ink-3);
	}

	.code-branch__row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		padding: var(--space-2) var(--space-3);
		border: 0;
		border-radius: var(--r-sm);
		background: transparent;
		font: inherit;
		font-size: 13px;
		color: var(--ink-2);
		cursor: pointer;
		text-align: left;
	}

	.code-branch__row:hover {
		background: var(--bg-band-strong);
		color: var(--ink);
	}

	.code-branch__row :global(svg) {
		color: var(--ink-3);
	}

	.code-branch__check {
		display: grid;
		place-items: center;
		width: 14px;
		flex: none;
		color: var(--go);
	}

	.code-branch__check :global(svg) {
		color: var(--go);
	}

	.code-branch__name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-mono);
		font-size: 12.5px;
	}

	.code-branch__meta {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--ink-3);
		flex: none;
	}

	.code-branch__up {
		color: var(--go);
	}

	.code-branch__down {
		color: var(--danger-ink);
	}

	.code-branch__footer {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-2) var(--space-4);
		border-top: 1px solid var(--line);
		font-size: 11px;
		color: var(--ink-3);
		flex: none;
	}

	.code-branch__footer kbd {
		display: inline-grid;
		place-items: center;
		min-width: 18px;
		height: 18px;
		padding: 0 4px;
		border: 1px solid var(--line);
		border-radius: 4px;
		font-family: var(--font-mono);
		font-size: 10.5px;
	}
`;
