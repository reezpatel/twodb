import css from "styled-jsx/css";

export const nodeDrawerStyles = css`
	.node-drawer {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
	}

	.node-drawer__section {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.node-drawer__section--danger {
		border-top: 1px solid var(--line);
		padding-top: var(--space-4);
	}

	.node-drawer__section-title {
		margin: 0;
		font-family: var(--font-cue);
		font-size: 10.5px;
		font-weight: 500;
		letter-spacing: var(--tracking-cue);
		text-transform: uppercase;
		color: var(--ink-3);
	}

	.node-drawer__status-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.node-drawer__meta {
		font-size: var(--text-sm);
		color: var(--ink-3);
	}

	.node-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: var(--r-pill);
		margin-right: var(--space-1);
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

	.node-kv {
		margin: 0;
		display: flex;
		flex-direction: column;
	}

	.node-kv__row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--line);
	}

	.node-kv__row:last-child {
		border-bottom: none;
	}

	.node-kv__row dt {
		flex-shrink: 0;
		color: var(--ink-3);
		font-size: var(--text-sm);
	}

	.node-kv__row dd {
		margin: 0;
		color: var(--ink);
		font-size: var(--text-sm);
		text-align: right;
		overflow-wrap: anywhere;
		font-variant-numeric: tabular-nums;
	}

	.node-kv__mem {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-width: 220px;
	}

	.node-kv__mono {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
	}

	.node-drawer__muted {
		margin: 0;
		color: var(--ink-3);
		font-size: var(--text-sm);
	}

	.node-drawer__state {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-3);
		color: var(--ink-3);
		font-size: var(--text-sm);
	}

	.node-drawer__rename {
		display: flex;
		align-items: flex-end;
		gap: var(--space-3);
	}

	.node-drawer__rename-field {
		flex: 1;
	}

	.node-secrets {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}

	.node-secret-item {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--line);
	}

	.node-secret-item:last-child {
		border-bottom: none;
	}

	.node-secret-item__head {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.node-secret-item__label {
		font-size: var(--text-sm);
		color: var(--ink);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.node-secret-item--revoked .node-secret-item__label {
		color: var(--ink-3);
		text-decoration: line-through;
	}

	.node-secret-item__meta {
		flex-shrink: 0;
		font-size: var(--text-xs);
		color: var(--ink-3);
		white-space: nowrap;
	}

	.node-drawer__new-secret {
		display: flex;
		align-items: flex-end;
		gap: var(--space-3);
	}

	.node-drawer__new-secret-field {
		flex: 1;
	}

	.node-drawer__secret-reveal {
		margin-top: var(--space-2);
	}

	.node-danger__confirm {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.node-danger__confirm > p {
		margin: 0;
		color: var(--ink-2);
		font-size: var(--text-sm);
		line-height: 1.5;
	}

	.node-danger__actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
	}

	.node-danger__error {
		margin: 0;
		color: var(--danger-ink);
		font-size: var(--text-sm);
	}
`;
