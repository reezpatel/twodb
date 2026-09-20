import css from "styled-jsx/css";

export const usageStatsStyles = css`
	.code-usage {
		border-bottom: 1px solid var(--line);
	}

	.code-usage__header {
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

	.code-usage__title {
		font-size: 13px;
		font-weight: 600;
	}

	.code-usage__toggle {
		display: grid;
		place-items: center;
		width: 16px;
		height: 16px;
		color: var(--ink-3);
		transition: transform var(--dur-2) var(--ease-out);
	}

	.code-usage__providers {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: 0 var(--space-4) var(--space-3);
	}

	.code-usage__provider-name {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: 12px;
		font-weight: 600;
		color: var(--ink-2);
		margin-bottom: var(--space-1);
	}

	.code-usage__current {
		font-family: var(--font-cue);
		font-size: 9px;
		letter-spacing: var(--tracking-cue);
		text-transform: uppercase;
		color: var(--accent);
		border: 1px solid var(--accent);
		border-radius: 999px;
		padding: 1px 5px;
	}

	.code-usage__row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: 2px 0;
	}

	.code-usage__window {
		width: 34px;
		flex: none;
		font-size: 11px;
		color: var(--ink-3);
		font-family: var(--font-mono);
	}

	.code-usage__bar {
		flex: 1;
		height: 4px;
		border-radius: 999px;
		background: var(--bg-band-strong);
		overflow: hidden;
	}

	.code-usage__fill {
		display: block;
		height: 100%;
		border-radius: 999px;
	}

	.code-usage__fill--ok {
		background: var(--accent);
	}

	.code-usage__fill--warning {
		background: var(--warning-ink);
	}

	.code-usage__fill--danger {
		background: var(--danger-ink);
	}

	.code-usage__pct {
		width: 32px;
		flex: none;
		text-align: right;
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--ink-2);
	}

	.code-usage__reset {
		width: 52px;
		flex: none;
		text-align: right;
		font-family: var(--font-mono);
		font-size: 10.5px;
		color: var(--ink-3);
		white-space: nowrap;
	}
`;
