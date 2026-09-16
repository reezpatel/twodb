import css from "styled-jsx/css";

export const notesSidenavStyles = css`
	.notes-sidenav {
		width: 232px;
		flex: none;
		display: flex;
		flex-direction: column;
		min-height: 0;
		padding-top: var(--space-2);
		overflow-y: auto;
		background: var(--surface);
		border-right: 1px solid var(--line);
	}

	.notes-sidenav::-webkit-scrollbar {
		width: 8px;
	}

	.notes-sidenav::-webkit-scrollbar-thumb {
		background: var(--line-strong);
		border-radius: var(--r-pill);
		border: 2px solid transparent;
		background-clip: content-box;
	}

	.notes-sidenav__rule {
		height: 1px;
		margin: var(--space-2) var(--space-2);
		background: color-mix(in srgb, var(--line) 55%, transparent);
	}
`;
