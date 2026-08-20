import css from "styled-jsx/css";

export const workspaceSceneStyles = css`
	.scene__chrome {
		grid-column: 2 / -1;
		grid-row: 1;
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
		padding: 0 10px;
		border-right: 0;
		border-bottom: 1px solid var(--line);
		background: var(--surface);
	}

	.scene__body {
		grid-column: 2 / -1;
		grid-row: 2;
		display: grid;
		place-items: center;
		min-width: 0;
		min-height: 0;
		padding: var(--space-6);
		background: var(--bg);
	}

	.scene__panel {
		width: min(520px, 100%);
		padding: var(--space-5);
		border: 1px solid var(--line);
		border-radius: var(--r-lg);
		background: var(--surface);
	}

	.scene__title {
		margin: 0 0 var(--space-2);
		font-size: var(--text-xl);
		font-weight: 650;
		color: var(--ink);
	}

	.scene__copy {
		margin: 0;
		color: var(--ink-2);
		line-height: 1.6;
	}
`;
