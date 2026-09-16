import css from "styled-jsx/css";

export const nodeCreateDialogStyles = css`
	.node-create {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.node-create__error {
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--danger-ink);
		border-radius: var(--r-md);
		background: var(--danger-bg);
		color: var(--danger-ink);
		font-size: var(--text-sm);
	}

	.node-create__actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
		padding-top: var(--space-2);
	}

	.node-create__done {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
	}

	.node-create__success-intro {
		margin: 0;
		color: var(--ink-2);
		font-size: var(--text-sm);
		line-height: 1.5;
	}
`;
