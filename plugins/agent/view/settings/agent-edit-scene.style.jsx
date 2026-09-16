import css from "styled-jsx/css";

export const agentEditStyles = css`
	.agent-edit {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		max-width: 480px;
	}

	.agent-edit__note {
		font-size: var(--text-sm);
		color: var(--ink-dim);
	}

	.agent-edit__error {
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--danger-ink);
		border-radius: var(--r-md);
		background: var(--danger-bg);
		color: var(--danger-ink);
		font-size: var(--text-sm);
	}

	.agent-edit__actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-3);
	}
`;
