import css from "styled-jsx/css";

export const codeHeaderStyles = css`
	.code-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-4);
		border-bottom: 1px solid var(--line);
	}

	.code-header__label {
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--ink);
	}

	.code-header__actions {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
`;
