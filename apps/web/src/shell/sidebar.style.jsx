import css from "styled-jsx/css";

export const sidebarStyles = css`
	.shell__sidebarSlot {
		grid-column: 1;
		grid-row: 1 / 3;
		min-height: 0;
	}

	.shell__rail-account {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border: none;
		border-radius: var(--r-md);
		background: transparent;
		cursor: pointer;
		transition: background var(--dur-1) var(--ease-out);
	}

	.shell__rail-account:hover {
		background: var(--bg-band-strong);
	}
`;
