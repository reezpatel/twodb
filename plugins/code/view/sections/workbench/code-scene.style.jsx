import css from "styled-jsx/css";

export const codeSceneNextStyles = css`
	.code-next {
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
	}

	.code-next__body {
		flex: 1;
		min-width: 0;
		min-height: 0;
	}

	.code-next__pane-side {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		background: var(--surface);
	}
`;
