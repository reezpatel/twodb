import css from "styled-jsx/css";

export const recordingSceneStyles = css`
	.recording__chrome {
		grid-column: 2 / -1;
		grid-row: 1;
		border-right: 0;
	}

	.recording__body {
		grid-column: 2 / -1;
		grid-row: 2;
		min-width: 0;
		min-height: 0;
		overflow: auto;
		padding: var(--space-4);
		background: var(--bg);
	}
`;
