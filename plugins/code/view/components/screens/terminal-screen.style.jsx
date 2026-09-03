import css from "styled-jsx/css";

export const terminalScreenStyles = css`
	.code-term {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		width: 100%;
		background: var(--bg);
	}

	.code-term__tabs {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: var(--space-2) var(--space-3) 0;
		border-bottom: 1px solid var(--line);
		flex: none;
	}

	.code-term__tab {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-3);
		border: 0;
		border-radius: var(--r-sm) var(--r-sm) 0 0;
		background: transparent;
		font: inherit;
		font-family: var(--font-mono);
		font-size: 11.5px;
		color: var(--ink-3);
		cursor: pointer;
	}

	.code-term__tab:hover {
		background: var(--bg-band);
		color: var(--ink-2);
	}

	.code-term__tab.is-active {
		background: var(--bg-band-strong);
		color: var(--ink);
	}

	.code-term__tab-close {
		display: grid;
		place-items: center;
		width: 14px;
		height: 14px;
		border-radius: 3px;
		opacity: 0;
	}

	.code-term__tab:hover .code-term__tab-close {
		opacity: 1;
	}

	.code-term__tab-new {
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		border: 0;
		border-radius: var(--r-sm);
		background: transparent;
		color: var(--ink-3);
		cursor: pointer;
	}

	.code-term__tab-new:hover {
		background: var(--bg-band-strong);
		color: var(--ink-2);
	}

	.code-term__body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: var(--space-3) var(--space-4);
		background: var(--ink);
		font-family: var(--font-mono);
		font-size: 12px;
		line-height: 1.6;
		color: var(--bg);
	}

	.code-term__line {
		white-space: pre-wrap;
		word-break: break-all;
	}

	.code-term__line--dim {
		color: var(--bg);
		opacity: 0.5;
	}

	.code-term__line--ok {
		color: var(--go);
	}

	.code-term__line--err {
		color: var(--danger-ink);
	}

	.code-term__prompt {
		color: var(--go);
		margin-right: var(--space-2);
		user-select: none;
	}

	.code-term__cmd {
		color: var(--bg);
	}

	.code-term__cursor {
		display: inline-block;
		width: 7px;
		height: 14px;
		vertical-align: -2px;
		background: var(--bg);
		animation: code-term-blink 1.1s steps(2, start) infinite;
	}

	@keyframes code-term-blink {
		50% {
			opacity: 0;
		}
	}
`;
