import css from "styled-jsx/css";

export const projectBarStyles = css`
	.code-project-bar {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-4);
		border-bottom: 1px solid var(--line);
	}

	.code-project-bar__name {
		font-size: var(--text-md);
		font-weight: 600;
		color: var(--ink);
	}

	.code-project-bar__actions {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		margin-left: auto;
	}
`;
