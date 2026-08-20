import css from "styled-jsx/css";

export const noteListBodyStyles = css`
	.shell__list {
		grid-column: 2;
		grid-row: 2;
		border-right: 1px solid var(--line);
		background: var(--bg);
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}

	.shell__list::-webkit-scrollbar {
		width: 8px;
	}

	.shell__list::-webkit-scrollbar-thumb {
		background: var(--line-strong);
		border-radius: var(--r-pill);
		border: 2px solid transparent;
		background-clip: content-box;
	}

	.shell__empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-6) var(--space-3);
		color: var(--ink-3);
		font-size: var(--text-sm);
		text-align: center;
	}

	.shell__empty p {
		margin: 0;
	}
`;
