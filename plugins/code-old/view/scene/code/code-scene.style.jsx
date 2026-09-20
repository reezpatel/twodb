import css from "styled-jsx/css";

export const codeSceneStyles = css`
	.code {
		grid-column: 2 / -1;
		grid-row: 1 / 3;
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		min-height: 0;
		background: var(--bg);
		color: var(--ink);
		overflow: hidden;
		font-size: 13px;
	}

	.code__body {
		flex: 1;
		min-height: 0;
	}
`;
