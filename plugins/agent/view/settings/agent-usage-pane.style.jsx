import css from "styled-jsx/css";

export const agentUsagePaneStyles = css`
	.usage {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
	}

	/* status line — the instrument cluster's pilot light */
	.usage__status {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.usage__dot {
		width: 7px;
		height: 7px;
		border-radius: var(--r-pill);
		background: var(--go);
		flex-shrink: 0;
	}

	.usage__dot--error {
		background: var(--danger-ink);
	}

	.usage__status-text {
		flex: 1;
		min-width: 0;
		font-size: var(--text-xs);
		color: var(--ink-3);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* failure band — danger tonal well, cue title, recovery copy */
	.usage__error {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--r-md);
		background: var(--danger-bg);
	}

	.usage__error-title {
		color: var(--danger-ink);
	}

	.usage__error-body {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--danger-ink);
		word-break: break-word;
	}

	.usage__error-hint {
		margin: 0;
		font-size: var(--text-xs);
		color: var(--danger-ink);
		opacity: 0.75;
	}

	/* quiet band for loading / empty */
	.usage__state {
		padding: var(--space-6);
		border: 1px dashed var(--line);
		border-radius: var(--r-md);
		font-size: var(--text-sm);
		color: var(--ink-3);
		text-align: center;
	}

	/* one window = one band under a horizon rule, never a boxed card */
	.usage-window {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding-top: var(--space-5);
		border-top: 1px solid var(--line);
	}

	.usage-window__head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.usage-window__group {
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--ink-2);
	}

	.usage-window__readout {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.usage-window__big {
		font-size: 30px;
		font-weight: 650;
		line-height: 1.1;
		letter-spacing: -0.01em;
		color: var(--ink);
	}

	.usage-window__sub {
		font-size: var(--text-xs);
		color: var(--ink-3);
	}

	.usage-window__warn {
		padding: var(--space-2) var(--space-3);
		border-radius: var(--r-md);
		background: var(--warning-bg);
		color: var(--warning-ink);
		font-size: var(--text-xs);
	}

	.usage-window__meta {
		display: flex;
		justify-content: space-between;
		gap: var(--space-3);
		font-size: var(--text-xxs);
		color: var(--ink-3);
	}
`;
