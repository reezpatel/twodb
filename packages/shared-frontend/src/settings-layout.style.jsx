import css from "styled-jsx/css";

export const settingsLayoutStyles = css`
	.twdb-settings {
		grid-column: 2 / -1;
		grid-row: 1 / 3;
		display: grid;
		grid-template-columns: 240px minmax(0, 1fr);
		min-height: 0;
		overflow: hidden;
		background: var(--bg);
		color: var(--ink);
	}

	.twdb-settings__content {
		padding: var(--space-7);
		overflow-y: auto;
	}
`;
