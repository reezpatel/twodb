import css from "styled-jsx/css";

export const codeSidebarStyles = css`
	.code-side {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow-y: auto;
		border-left: 1px solid var(--line);
		background: var(--bg);
		padding: var(--space-2) 0;
	}

	.code-side__section {
		border-bottom: 1px solid var(--line);
	}

	.code-side__section:last-child {
		border-bottom: 0;
	}

	.code-side__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: var(--space-3) var(--space-4);
		border: 0;
		background: transparent;
		font: inherit;
		cursor: pointer;
		color: var(--ink);
	}

	.code-side__title {
		font-size: 13px;
		font-weight: 600;
	}

	.code-side__toggle {
		display: grid;
		place-items: center;
		width: 16px;
		height: 16px;
		color: var(--ink-3);
		transition: transform var(--dur-2) var(--ease-out);
	}

	.code-side__items {
		padding: 0 var(--space-4) var(--space-3);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.code-side__item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) 0;
		font-size: 13px;
		color: var(--ink-2);
	}

	.code-side__item :global(svg) {
		color: var(--ink-3);
	}

	.code-side__branch {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) 0;
	}

	.code-side__branch :global(svg) {
		color: var(--ink-3);
	}

	.code-side__branch-name {
		flex: 1;
		font-size: 13px;
		color: var(--ink);
	}

	.code-side__branch-refresh {
		display: grid;
		place-items: center;
		width: 20px;
		height: 20px;
		padding: 0;
		border: 0;
		border-radius: var(--r-xs, 4px);
		background: transparent;
		color: var(--ink-3);
		cursor: pointer;
	}

	.code-side__branch-refresh:hover {
		background: var(--bg-band-strong);
		color: var(--ink-2);
	}

	.code-side__file {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) 0;
		font-size: 13px;
	}

	.code-side__file-icon {
		display: grid;
		place-items: center;
		width: 16px;
		height: 16px;
		border-radius: 3px;
		background: var(--warning-ink);
		font-size: 10px;
		font-weight: 700;
		color: var(--bg);
		flex: none;
	}

	.code-side__file-name {
		flex: 1;
		color: var(--ink-2);
	}

	.code-side__file-stats {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		font-family: var(--font-mono);
		font-size: 12px;
	}

	.code-side__add {
		color: var(--go);
	}

	.code-side__del {
		color: var(--danger-ink);
	}

	.code-side__stat {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-1) 0;
		font-size: 13px;
	}

	.code-side__stat-label {
		color: var(--ink-3);
	}

	.code-side__stat-value {
		color: var(--accent);
		font-family: var(--font-mono);
	}

	.code-side__memory {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		padding: var(--space-1) 0;
	}

	.code-side__memory-text {
		flex: 1;
		min-width: 0;
		font-size: 12.5px;
		line-height: 1.45;
		color: var(--ink-2);
	}

	.code-side__memory-scope {
		flex: none;
		font-family: var(--font-cue);
		font-size: 9px;
		letter-spacing: var(--tracking-cue);
		text-transform: uppercase;
		color: var(--ink-3);
		border: 1px solid var(--line);
		border-radius: 999px;
		padding: 1px 5px;
		margin-top: 1px;
	}
`;
