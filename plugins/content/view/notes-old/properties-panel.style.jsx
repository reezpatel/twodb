import css from "styled-jsx/css";

export const propRowStyles = css`
	.shell__proprow {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 4px 0;
		font-size: var(--text-sm);
	}

	.shell__proplabel {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--ink-3);
		white-space: nowrap;
	}

	.shell__proplabel :global(svg) {
		flex: none;
	}

	.shell__propval {
		min-width: 0;
		font-weight: 500;
		color: var(--ink);
		text-align: right;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
`;

export const relationSectionStyles = css`
	.shell__rel {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.shell__rellabel {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--ink-3);
		font-weight: 450;
	}

	.shell__dashed {
		padding: 6px 9px;
		border: 1px dashed var(--line-strong);
		border-radius: var(--r-sm);
		background: transparent;
		font-size: var(--text-sm);
		color: var(--ink-3);
		cursor: pointer;
		text-align: left;
		transition:
			border-color var(--dur-1) var(--ease-out),
			color var(--dur-1) var(--ease-out),
			background var(--dur-1) var(--ease-out);
	}

	.shell__dashed:hover {
		border-color: var(--accent);
		color: var(--accent);
		background: var(--accent-soft-bg);
	}
`;

export const propDotStyles = css`
	.shell__propdot {
		display: inline-block;
		width: 11px;
		height: 11px;
		border-radius: 50%;
		border: 1.5px solid var(--ink-3);
	}
`;

export const propertiesPanelStyles = css`
	.shell__chrome--props {
		grid-column: 4;
		grid-row: 1;
		display: flex;
		align-items: center;
		gap: 7px;
		min-width: 0;
		padding: 0 8px 0 12px;
		border-bottom: 1px solid var(--line);
		border-left: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink-3);
	}

	.shell__chrome--props strong {
		font-size: var(--text-md);
		font-weight: 600;
		color: var(--ink);
	}

	.shell__barbtn {
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		flex: none;
		border: 0;
		border-radius: var(--r-sm);
		background: transparent;
		color: var(--ink-3);
		cursor: pointer;
		padding: 0;
		transition:
			background var(--dur-1) var(--ease-out),
			color var(--dur-1) var(--ease-out);
	}

	.shell__barbtn:hover:not(:disabled) {
		background: var(--bg-band-strong);
		color: var(--ink);
	}

	.shell__barbtn:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.shell__chromespacer {
		flex: 1;
	}

	.shell__props {
		grid-column: 4;
		grid-row: 2;
		border-left: 1px solid var(--line);
		background: var(--surface);
		min-height: 0;
		display: flex;
	}

	.shell__propscroll {
		flex: 1;
		overflow-y: auto;
		padding: 12px 14px var(--space-4);
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.shell__propscroll::-webkit-scrollbar {
		width: 8px;
	}

	.shell__propscroll::-webkit-scrollbar-thumb {
		background: var(--line-strong);
		border-radius: var(--r-pill);
		border: 2px solid transparent;
		background-clip: content-box;
	}

	.shell__proprows {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.shell__mono {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
	}

	.shell__valuechip,
	.shell__statusval {
		display: inline-flex;
		align-items: center;
	}

	.shell__valuechip {
		gap: 5px;
		padding: 3px 7px;
		border-radius: var(--r-sm);
		background: var(--bg-band);
		font-size: var(--text-xs);
		font-weight: 600;
	}

	.shell__doctypeicon {
		display: grid;
		place-items: center;
		width: 18px;
		height: 18px;
		border-radius: var(--r-sm);
		background: var(--shell-green-bg);
		color: var(--shell-green);
	}

	.shell__valuechip .shell__doctypeicon {
		width: 15px;
		height: 15px;
	}

	.shell__statusval {
		gap: 6px;
	}

	.shell__statusval i {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--shell-orange);
	}

	.shell__ghostrow {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 4px;
		padding: 5px 7px;
		border: 0;
		border-radius: var(--r-sm);
		background: transparent;
		font-size: var(--text-sm);
		color: var(--ink-3);
		cursor: pointer;
		transition:
			background var(--dur-1) var(--ease-out),
			color var(--dur-1) var(--ease-out);
	}

	.shell__ghostrow:hover {
		background: var(--bg-band);
		color: var(--ink);
	}

	.shell__relchip {
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 6px 9px;
		border-radius: var(--r-sm);
		font-size: var(--text-sm);
		font-weight: 550;
		white-space: nowrap;
		overflow: hidden;
	}

	.shell__relchip :global(svg) {
		flex: none;
	}

	.shell__chip--red {
		background: var(--shell-red-bg);
		color: var(--shell-red);
	}

	.shell__chip--purple {
		background: var(--shell-purple-bg);
		color: var(--shell-purple);
	}

	.shell__chip--blue {
		background: var(--shell-blue-bg);
		color: var(--shell-blue);
	}

	.shell__chip--green {
		background: var(--shell-green-bg);
		color: var(--shell-green);
	}

	.shell__relopen {
		margin-left: auto;
		opacity: 0.65;
	}

	.shell__addrel {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 7px;
		border: 1px dashed var(--line-strong);
		border-radius: var(--r-md);
		background: transparent;
		font-size: var(--text-sm);
		color: var(--ink-3);
		cursor: pointer;
		transition:
			border-color var(--dur-1) var(--ease-out),
			color var(--dur-1) var(--ease-out),
			background var(--dur-1) var(--ease-out);
	}

	.shell__addrel:hover {
		border-color: var(--accent);
		color: var(--accent);
		background: var(--accent-soft-bg);
	}
`;
