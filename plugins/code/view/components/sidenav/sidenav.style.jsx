import css from "styled-jsx/css";

export const codeSidenavStyles = css`
	.code-sidenav {
		display: flex;
		flex-direction: column;
		height: 100%;
		border-right: 1px solid var(--line);
		background: var(--bg);
		overflow: hidden;
	}

	.code-sidenav__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-4);
		border-bottom: 1px solid var(--line);
		flex: none;
	}

	.code-sidenav__title {
		font-size: 14px;
		font-weight: 600;
	}

	.code-sidenav__actions {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	.code-sidenav__action {
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border: 0;
		border-radius: var(--r-sm);
		background: transparent;
		color: var(--ink-3);
		cursor: pointer;
	}

	.code-sidenav__action:hover {
		background: var(--bg-band-strong);
		color: var(--ink-2);
	}

	.code-sidenav__folders {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: var(--space-2) 0;
	}

	.code-sidenav__folder-header {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-4);
		font-size: 12px;
		font-weight: 600;
		color: var(--ink-2);
		cursor: default;
	}

	.code-sidenav__folder-header :global(svg) {
		color: var(--ink-3);
	}

	.code-sidenav__folder-count {
		margin-left: auto;
		font-size: 11px;
		font-weight: 500;
		color: var(--ink-3);
		font-family: var(--font-mono);
	}

	.code-sidenav__session {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		padding: var(--space-2) var(--space-4) var(--space-2) calc(var(--space-4) + 22px);
		border: 0;
		background: transparent;
		font: inherit;
		font-size: 13px;
		color: var(--ink-2);
		cursor: pointer;
		text-align: left;
	}

	.code-sidenav__session:hover {
		background: var(--bg-band);
		color: var(--ink);
	}

	.code-sidenav__session.is-selected {
		background: var(--bg-band-strong);
		color: var(--ink);
	}

	.code-sidenav__status {
		display: grid;
		place-items: center;
		width: 16px;
		height: 16px;
		flex: none;
		color: var(--ink-3);
	}

	.code-sidenav__status--running {
		color: var(--accent);
	}

	.code-sidenav__status--running :global(svg) {
		animation: code-sidenav-spin 1.1s linear infinite;
	}

	.code-sidenav__status--done {
		color: var(--go);
	}

	.code-sidenav__session-title {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.code-sidenav__session-time {
		flex: none;
		font-size: 11px;
		color: var(--ink-3);
		font-family: var(--font-mono);
	}

	@keyframes code-sidenav-spin {
		to {
			transform: rotate(360deg);
		}
	}

	.code-sidenav__session--archived {
		color: var(--ink-3);
	}

	.code-sidenav__footer {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-2);
		border-top: 1px solid var(--line);
		flex: none;
	}

	.code-sidenav__footer-btn {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-2);
		border: 0;
		border-radius: var(--r-sm);
		background: transparent;
		font: inherit;
		font-size: 12px;
		color: var(--ink-3);
		cursor: pointer;
	}

	.code-sidenav__footer-btn:hover {
		background: var(--bg-band-strong);
		color: var(--ink-2);
	}

	.code-sidenav__footer-btn.is-active {
		background: var(--bg-band-strong);
		color: var(--ink);
	}
`;
