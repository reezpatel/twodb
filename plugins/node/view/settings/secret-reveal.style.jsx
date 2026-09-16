import css from "styled-jsx/css";

export const secretRevealStyles = css`
	.node-secret {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.node-secret__warning {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--r-md);
		background: var(--warning-bg);
		color: var(--warning-ink);
	}

	.node-secret__warning svg {
		flex-shrink: 0;
		margin-top: 2px;
	}

	.node-secret__warning strong {
		display: block;
		font-size: var(--text-sm);
		font-weight: 600;
	}

	.node-secret__warning p {
		margin: var(--space-1) 0 0;
		font-size: var(--text-sm);
		line-height: 1.45;
	}

	.node-secret__value-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.node-secret__value {
		flex: 1;
		min-width: 0;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--line);
		border-radius: var(--r-md);
		background: var(--bg-field);
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		color: var(--ink);
		overflow-wrap: anywhere;
		user-select: all;
	}
`;
