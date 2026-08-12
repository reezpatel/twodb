import css from "styled-jsx/css";

export const projectViewStyles = css`
	.notes-project-view {
		display: grid;
		place-items: center;
		min-width: 0;
		min-height: 0;
		background: var(--bg);
	}

	.notes-view__placeholder {
		display: grid;
		gap: var(--space-2);
		width: min(420px, calc(100% - var(--space-6)));
		padding: var(--space-5);
		border: 1px solid var(--line);
		border-radius: var(--r-lg);
		background: var(--surface);
		text-align: center;
	}

	.notes-view__placeholder strong {
		font-size: var(--text-xl);
		font-weight: 650;
	}

	.notes-view__placeholder p {
		margin: 0;
		color: var(--ink-3);
		line-height: 1.5;
	}
`;
