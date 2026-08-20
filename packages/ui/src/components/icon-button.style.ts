import css from "styled-jsx/css";

export const iconButtonStyles = css`
	.tw-icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		border: 1px solid transparent;
		border-radius: var(--r-md);
		background: transparent;
		color: var(--ink-2);
		cursor: pointer;
		transition:
			background var(--dur-1) var(--ease-out),
			color var(--dur-1) var(--ease-out),
			border-color var(--dur-1) var(--ease-out);
	}

	.tw-icon-btn :global(svg) {
		width: 16px;
		height: 16px;
	}

	.tw-icon-btn--sm {
		width: 26px;
		height: 26px;
		border-radius: var(--r-sm);
	}

	.tw-icon-btn--sm :global(svg) {
		width: 14px;
		height: 14px;
	}

	.tw-icon-btn--md {
		width: 32px;
		height: 32px;
	}

	.tw-icon-btn--lg {
		width: 38px;
		height: 38px;
	}

	.tw-icon-btn--lg :global(svg) {
		width: 18px;
		height: 18px;
	}

	.tw-icon-btn--ghost:hover {
		background: var(--bg-band-strong);
		color: var(--ink);
	}

	.tw-icon-btn.is-active {
		background: var(--accent-soft-bg);
		color: var(--accent);
	}

	.tw-icon-btn--secondary {
		background: var(--surface);
		border-color: var(--line-strong);
		color: var(--ink);
	}

	.tw-icon-btn--secondary:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.tw-icon-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
`;
