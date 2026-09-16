import css from "styled-jsx/css";

export const notesShellStyles = css.global`
	.notes-shell {
		grid-column: 2 / -1;
		grid-row: 1 / 3;
		display: flex;
		min-width: 0;
		min-height: 0;
		background: var(--bg);
	}

	.notes-shell > *:last-child {
		flex: 1;
		min-width: 0;
		min-height: 0;
	}
`;
