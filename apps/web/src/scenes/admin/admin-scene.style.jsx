import css from "styled-jsx/css";

export const adminSceneStyles = css`
	.admin {
		display: flex;
		flex-direction: column;
		height: 100dvh;
		background: var(--bg);
		color: var(--ink);
	}

	.admin__body {
		flex: 1;
		display: grid;
		place-items: center;
		min-width: 0;
		min-height: 0;
		padding: var(--space-6);
		background: var(--bg);
	}

	.admin__layout {
		flex: 1;
		display: grid;
		grid-template-columns: 56px 1fr;
		min-width: 0;
		min-height: 0;
		background: var(--bg);
	}

	.admin__main {
		min-width: 0;
		min-height: 0;
		overflow-y: auto;
		padding: var(--space-6);
	}

	.admin__muted {
		color: var(--ink-2);
		font-size: var(--text-xs);
	}
`;
