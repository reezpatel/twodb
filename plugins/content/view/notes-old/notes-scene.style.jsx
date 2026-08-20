import css from "styled-jsx/css";

export const notesSceneStyles = css`
	.notes-scene {
		grid-column: 2 / -1;
		grid-row: 1 / 3;
		display: grid;
		min-width: 0;
		min-height: 0;
		background: var(--bg);
	}

	.notes-scene--list {
		grid-template-columns: var(--notes-list-width, 320px) 9px minmax(0, 1fr);
		grid-template-rows: 40px minmax(0, 1fr);
	}

	.notes-scene--single {
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: 40px minmax(0, 1fr);
	}

	.notes-scene__list {
		grid-column: 1;
		grid-row: 2;
		min-width: 0;
		min-height: 0;
		background: var(--bg);
	}

	.notes-scene--list > :global(.shell__chrome--list) {
		grid-column: 1;
		grid-row: 1;
		border-right: 0;
	}

	.notes-scene .notes-scene__list > :global(.shell__list) {
		height: 100%;
		border-right: 0;
	}

	.notes-scene__resizer {
		grid-column: 2;
		grid-row: 1 / 3;
		width: 9px;
		height: 100%;
		padding: 0;
		border: 0;
		border-left: 1px solid var(--line);
		border-right: 1px solid var(--line);
		background: var(--surface);
		cursor: col-resize;
		transition:
			background var(--dur-1) var(--ease-out),
			border-color var(--dur-1) var(--ease-out);
	}

	.notes-scene__resizer:hover,
	.notes-scene__resizer:focus-visible {
		background: var(--bg-band-strong);
		border-color: var(--line-strong);
		outline: none;
	}

	.notes-scene__detail {
		grid-column: 3;
		grid-row: 1 / 3;
		min-width: 0;
		min-height: 0;
		background: var(--bg);
	}

	.notes-scene--single > :global(.shell__chrome--list) {
		grid-column: 1;
		grid-row: 1;
		border-right: 0;
	}

	.notes-scene__view {
		grid-column: 1;
		grid-row: 2;
		min-width: 0;
		min-height: 0;
	}

	.notes-scene__view > :global(.notes-view) {
		width: 100%;
		height: 100%;
	}
`;
