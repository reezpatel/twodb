import css from "styled-jsx/css";

export const navPanelItemStyles = css`
	.tw-navpanel__item {
		--navpanel-item-icon-color: var(--navpanel-item-color, var(--ink-3));
		--navpanel-count-color: var(--ink-3);

		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		min-height: 28px;
		padding: 6px 8px;
		border: 0;
		border-radius: var(--r-sm);
		background: transparent;
		font-family: var(--font-ui);
		font-size: var(--text-md);
		color: var(--ink-2);
		cursor: pointer;
		text-align: left;
		transition:
			background var(--dur-1) var(--ease-out),
			color var(--dur-1) var(--ease-out);
	}

	.tw-navpanel__item:hover {
		background: var(--bg-band);
		color: var(--ink);
	}

	.tw-navpanel__item.is-active,
	.tw-navpanel__item.is-active:hover {
		--navpanel-item-icon-color: var(--navpanel-item-color, var(--accent));
		--navpanel-count-color: var(--accent);

		background: var(--accent-soft-bg);
		color: var(--accent);
		font-weight: 500;
	}

	:global([data-phase="night"]) .tw-navpanel__item.is-active {
		--navpanel-count-color: var(--ink-2);

		background: color-mix(in srgb, var(--surface) 94%, var(--ink) 6%);
		color: var(--ink);
	}

	:global([data-phase="night"]) .tw-navpanel__item:hover,
	:global([data-phase="night"]) .tw-navpanel__item.is-active:hover {
		--navpanel-count-color: var(--ink-2);

		background: color-mix(in srgb, var(--surface) 88%, var(--ink) 12%);
		color: var(--ink);
	}

	.tw-navpanel__item--child {
		padding-left: 26px;
		color: var(--ink-3);
	}

	.tw-navpanel__icon {
		display: grid;
		place-items: center;
		width: 15px;
		height: 15px;
		flex: none;
		color: var(--navpanel-item-icon-color);
	}

	.tw-navpanel__icon :global(svg) {
		width: 15px;
		height: 15px;
		flex: none;
	}

	.tw-navpanel__dot {
		width: 9px;
		height: 9px;
		flex: none;
		margin: 0 3px;
		border-radius: 50%;
		background: currentColor;
	}

	.tw-navpanel__label {
		flex: 1;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tw-navpanel__meta {
		flex: none;
		display: inline-flex;
		align-items: center;
	}
`;

export const navPanelCountStyles = css`
	.tw-navpanel__count {
		font-size: var(--text-xs);
		color: var(--navpanel-count-color, var(--ink-3));
	}
`;

export const navPanelBadgeStyles = css`
	.tw-navpanel__badge {
		display: grid;
		place-items: center;
		min-width: 17px;
		height: 17px;
		padding: 0 5px;
		border-radius: var(--r-pill);
		background: var(--accent);
		color: var(--accent-ink);
		font-size: 10.5px;
		font-weight: 650;
		font-variant-numeric: tabular-nums;
	}
`;
