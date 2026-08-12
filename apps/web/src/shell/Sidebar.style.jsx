import css from "styled-jsx/css";

export const sidebarStyles = css`
	.shell__chrome--side {
		grid-column: 1;
		grid-row: 1;
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 0 10px;
		background: var(--surface);
		border-bottom: 1px solid var(--line);
		border-right: 1px solid var(--line);
		min-width: 0;
	}

	.shell__sidebarSlot {
		grid-column: 1;
		grid-row: 2;
		min-height: 0;
	}

	.shell__sidebarSlot > :global(.tw-navpanel) {
		gap: 0;
		padding-top: var(--space-2);
	}

	.shell__sidebarSlot > :global(.tw-navpanel::-webkit-scrollbar) {
		width: 8px;
	}

	.shell__sidebarSlot > :global(.tw-navpanel::-webkit-scrollbar-thumb) {
		background: var(--line-strong);
		border-radius: var(--r-pill);
		border: 2px solid transparent;
		background-clip: content-box;
	}

	.shell__sidebar-rule {
		height: 1px;
		margin: var(--space-1) var(--space-2) var(--space-2);
		background: color-mix(in srgb, var(--line) 55%, transparent);
	}

	.shell__sidebar-rule--wide {
		margin-top: var(--space-2);
	}
`;
