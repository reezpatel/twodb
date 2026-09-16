import css from "styled-jsx/css";

export const nodesSceneStyles = css`
	.node-settings {
		display: flex;
		flex-direction: column;
		width: 100%;
		min-height: 0;
		color: var(--ink);
	}

	.node-settings__inner {
		width: 100%;
		max-width: 1160px;
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
	}

	.node-settings__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-4);
	}

	.node-settings__title {
		margin: 0;
		font-size: var(--text-lg);
		font-weight: 600;
	}

	.node-settings__subtitle {
		margin: var(--space-1) 0 0;
		color: var(--ink-3);
		font-size: var(--text-sm);
	}

	.node-settings__actions {
		display: flex;
		gap: var(--space-2);
		flex-shrink: 0;
	}

	.node-settings__state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-7) var(--space-4);
		border: 1px dashed var(--line-strong);
		border-radius: var(--r-lg);
		color: var(--ink-3);
		font-size: var(--text-md);
		text-align: center;
	}

	.node-table-wrap {
		border: 1px solid var(--line);
		border-radius: var(--r-lg);
		background: var(--surface);
		overflow: hidden;
	}

	.node-table-scroll {
		overflow-x: auto;
	}

	.node-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-md);
	}

	.node-thead {
		border-bottom: 1px solid var(--line-strong);
	}

	.node-th {
		padding: var(--space-2) var(--space-3);
		font-family: var(--font-cue);
		font-size: 10.5px;
		font-weight: 500;
		letter-spacing: var(--tracking-cue);
		text-transform: uppercase;
		color: var(--ink-3);
		text-align: left;
		white-space: nowrap;
	}

	.node-th:first-child,
	.node-cell:first-child {
		padding-left: var(--space-4);
	}

	.node-th:last-child,
	.node-cell:last-child {
		padding-right: var(--space-4);
	}

	.node-row {
		cursor: pointer;
		transition: background var(--dur-1) var(--ease-out);
	}

	.node-row:hover,
	.node-row:focus-visible {
		background: var(--bg-band);
		outline: none;
	}

	.node-row--selected {
		background: var(--accent-soft-bg);
	}

	.node-row--selected:hover,
	.node-row--selected:focus-visible {
		background: var(--accent-soft-bg);
	}

	.node-row:last-child .node-cell {
		border-bottom: none;
	}

	.node-cell {
		padding: var(--space-3);
		border-bottom: 1px solid var(--line);
		vertical-align: middle;
		font-variant-numeric: tabular-nums;
	}

	.node-cell--status {
		white-space: nowrap;
	}

	.node-cell--mono {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		white-space: nowrap;
	}

	.node-cell--now {
		white-space: nowrap;
		color: var(--ink-2);
	}

	.node-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: var(--r-pill);
		margin-right: var(--space-2);
		vertical-align: middle;
	}

	.node-dot--online {
		background: var(--go);
		box-shadow: 0 0 0 3px var(--go-bg);
	}

	.node-dot--offline {
		background: var(--ink-3);
		box-shadow: 0 0 0 3px var(--bg-band-strong);
	}

	.node-row__status-text {
		color: var(--ink-2);
		font-size: var(--text-sm);
	}

	.node-row__name {
		font-weight: 550;
		color: var(--ink);
		overflow-wrap: anywhere;
	}

	.node-cue {
		margin-top: 2px;
		font-family: var(--font-mono);
		font-size: var(--text-xxs);
		color: var(--ink-3);
		overflow-wrap: anywhere;
	}

	.node-row__host {
		color: var(--ink);
		white-space: nowrap;
	}

	.node-row__resources {
		color: var(--ink-2);
		font-size: var(--text-sm);
		white-space: nowrap;
	}

	.node-row__resources .node-cue {
		font-family: var(--font-cue);
		letter-spacing: var(--tracking-cue);
		text-transform: none;
	}

	.node-row__muted {
		color: var(--ink-3);
	}
`;
