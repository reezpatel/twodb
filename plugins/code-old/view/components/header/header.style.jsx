import css from "styled-jsx/css";

export const codeHeaderStyles = css`
	.code-header {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		height: 44px;
		padding: 0 var(--space-4);
		border-bottom: 1px solid var(--line);
		background: var(--bg);
		flex: none;
	}

	.code-header__title {
		font-size: 13px;
		font-weight: 600;
		letter-spacing: 0.01em;
	}

	.code-header__switch {
		flex: 1;
		display: flex;
		justify-content: center;
	}
`;
