import css from "styled-jsx/css";

export const projectSelectorStyles = css`
	.code-project-selector {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		width: min(440px, 100%);
	}

	.code-project-selector__error {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--danger-ink);
	}
`;
