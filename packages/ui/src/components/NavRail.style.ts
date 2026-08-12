import css from "styled-jsx/css";

export const navRailStyles = css`
	.tw-rail {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		width: 56px;
		height: 100%;
		padding: var(--space-3) 0;
		border-right: 1px solid var(--line);
		background: var(--bg-rail);
		color: var(--ink);
	}

	.tw-rail__item {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border: none;
		border-radius: var(--r-md);
		background: transparent;
		color: var(--ink-3);
		cursor: pointer;
		transition:
			background var(--dur-1) var(--ease-out),
			color var(--dur-1) var(--ease-out),
			box-shadow var(--dur-1) var(--ease-out);
	}

	.tw-rail__item :global(svg) {
		width: 18px;
		height: 18px;
	}

	.tw-rail__item:hover {
		background: var(--bg-band-strong);
		color: var(--ink);
	}

	.tw-rail__item--active,
	.tw-rail__item--active:hover {
		background: var(--accent-soft-bg);
		color: var(--accent);
	}

	.tw-rail__spacer {
		flex: 1;
	}
`;
