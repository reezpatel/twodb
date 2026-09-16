import css from "styled-jsx/css";

export const pluginDetailStyles = css`
	.admin__section {
		max-width: 640px;
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.admin__section-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.admin__section-title {
		margin: 0 0 var(--space-1);
		font-size: var(--text-xl);
		font-weight: 650;
		color: var(--ink);
	}

	.admin__copy {
		margin: 0;
		color: var(--ink-2);
		line-height: 1.6;
	}

	.admin__status {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		margin: 0;
		font-size: var(--text-sm);
		color: var(--ink-2);
	}

	.admin__status-row {
		display: flex;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.admin__status-value {
		margin: 0;
		color: var(--ink);
		font-family: var(--font-mono, monospace);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
`;
