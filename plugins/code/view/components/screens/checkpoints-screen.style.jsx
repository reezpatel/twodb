import css from "styled-jsx/css";

export const checkpointsScreenStyles = css`
	.code-checkpoints {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		width: 100%;
		background: var(--bg);
	}

	.code-checkpoints__actions {
		display: flex;
		justify-content: flex-end;
		padding: var(--space-3) var(--space-4) 0;
		flex: none;
	}

	.code-checkpoints__new {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-3);
		border: 1px solid var(--line);
		border-radius: var(--r-md);
		background: var(--bg);
		font: inherit;
		font-size: 12px;
		color: var(--ink-2);
		cursor: pointer;
	}

	.code-checkpoints__new:hover {
		background: var(--bg-band-strong);
		color: var(--ink);
	}

	.code-checkpoints__timeline {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: var(--space-3) var(--space-4);
	}

	.code-checkpoints__item {
		display: flex;
		gap: var(--space-3);
	}

	.code-checkpoints__rail {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex: none;
		width: 12px;
		padding-top: 5px;
	}

	.code-checkpoints__dot {
		width: 8px;
		height: 8px;
		border-radius: 999px;
		background: var(--accent);
		flex: none;
	}

	.code-checkpoints__line {
		flex: 1;
		width: 1px;
		background: var(--line);
		margin-top: 2px;
	}

	.code-checkpoints__card {
		flex: 1;
		min-width: 0;
		padding-bottom: var(--space-4);
	}

	.code-checkpoints__card-head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.code-checkpoints__title {
		font-size: 13px;
		font-weight: 500;
		color: var(--ink);
	}

	.code-checkpoints__auto {
		font-family: var(--font-cue);
		font-size: 9px;
		letter-spacing: var(--tracking-cue);
		text-transform: uppercase;
		color: var(--ink-3);
		border: 1px solid var(--line);
		border-radius: 999px;
		padding: 1px 5px;
	}

	.code-checkpoints__meta {
		margin-top: 1px;
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--ink-3);
	}

	.code-checkpoints__card-actions {
		display: flex;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}

	.code-checkpoints__action {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: 2px var(--space-2);
		border: 1px solid var(--line);
		border-radius: var(--r-sm);
		background: transparent;
		font: inherit;
		font-size: 11.5px;
		color: var(--ink-2);
		cursor: pointer;
	}

	.code-checkpoints__action:hover {
		background: var(--bg-band-strong);
		color: var(--ink);
	}
`;
