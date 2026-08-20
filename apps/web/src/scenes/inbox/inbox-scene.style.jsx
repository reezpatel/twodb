import css from "styled-jsx/css";

export const inboxSceneStyles = css`
	.inbox-scene {
		grid-column: 2 / -1;
		grid-row: 1 / 3;
		min-height: 0;
		overflow-y: auto;
		padding: 0 var(--space-5);
		background: var(--bg);
	}

	.mock-brief {
		max-width: 760px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
		padding: var(--space-5) 0 var(--space-6);
	}

	.mock-brief__head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-4);
	}

	.mock-brief__head h2 {
		font-family: var(--font-display);
		font-size: var(--text-2xl);
		font-weight: 600;
		letter-spacing: 0.01em;
		color: var(--ink);
		margin: 0;
	}

	.mock-brief__meta {
		margin: 6px 0 0;
		font-size: var(--text-sm);
		color: var(--ink-3);
	}

	.mock-brief__today {
		font-size: var(--text-lg);
		color: var(--ink-3);
		padding-top: 2px;
	}

	.mock-brief__section {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.mock-brief__cue {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.mock-brief__stack {
		background: var(--surface);
		border: 1px solid var(--line-strong);
		border-radius: var(--r-lg, 14px);
		overflow: hidden;
	}

	.mock-brief__row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 13px var(--space-4);
		border-bottom: 1px solid var(--line);
	}

	.mock-brief__groupsep {
		border-bottom: 1px solid var(--line);
	}

	.mock-brief__row--task {
		transition: background var(--dur-1) var(--ease-out);
	}

	.mock-brief__row--task.is-done .mock-brief__title {
		color: var(--ink-3);
		text-decoration: line-through;
		text-decoration-color: var(--line-strong);
	}

	.mock-brief__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		flex-shrink: 0;
		border-radius: var(--r-sm);
		background: var(--bg-band-strong);
		color: var(--ink-2);
	}

	.mock-brief__icon :global(svg) {
		width: 15px;
		height: 15px;
	}

	.mock-brief__icon--rose {
		background: var(--rose-soft-bg);
		color: var(--rose-accent);
	}

	.mock-brief__body {
		display: flex;
		flex-direction: column;
		gap: 1px;
		flex: 1;
		min-width: 0;
	}

	.mock-brief__title {
		font-size: var(--text-md);
		font-weight: 500;
		color: var(--ink);
	}

	.mock-brief__sub {
		font-size: var(--text-sm);
		color: var(--ink-3);
	}

	.mock-brief__time {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 3px 9px;
		border-radius: 999px;
		background: var(--bg-band-strong);
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--ink-2);
		white-space: nowrap;
	}

	.mock-brief__time :global(svg) {
		width: 12px;
		height: 12px;
		color: var(--ink-3);
	}

	.mock-brief__actions {
		display: inline-flex;
		gap: 6px;
		opacity: 0;
		transition: opacity var(--dur-1) var(--ease-out);
	}

	.mock-brief__row--task:hover .mock-brief__actions,
	.mock-brief__row--task:focus-within .mock-brief__actions {
		opacity: 1;
	}

	.mock-brief__foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px var(--space-4);
		background: var(--bg-band);
	}

	.mock-brief__count {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--ink-3);
	}

	.mock-brief__onething {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: var(--space-4);
		border: 1px solid var(--line-strong);
		border-radius: var(--r-lg, 14px);
		background: var(--surface);
	}

	.mock-brief__onething .tw-cue {
		color: var(--rose-accent);
	}

	.mock-brief__signoff {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		font-size: var(--text-sm);
		color: var(--ink-3);
	}

	.mock-brief__signoff :global(svg) {
		width: 14px;
		height: 14px;
	}

	@media (max-width: 640px) {
		.mock-brief__row {
			flex-wrap: wrap;
		}

		.mock-brief__actions {
			opacity: 1;
		}
	}
`;
