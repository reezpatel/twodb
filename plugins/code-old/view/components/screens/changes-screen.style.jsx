import css from "styled-jsx/css";

export const changesScreenStyles = css`
	.code-changes {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		width: 100%;
		background: var(--bg);
	}

	.code-changes__list {
		flex: none;
		max-height: 40%;
		overflow-y: auto;
		padding: var(--space-2);
		border-bottom: 1px solid var(--line);
	}

	.code-changes__group {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3) var(--space-1);
		font-family: var(--font-cue);
		font-size: 10px;
		letter-spacing: var(--tracking-cue);
		text-transform: uppercase;
		color: var(--ink-3);
	}

	.code-changes__count {
		font-family: var(--font-mono);
		letter-spacing: 0;
	}

	.code-changes__row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		padding: var(--space-1) var(--space-3);
		border: 0;
		border-radius: var(--r-sm);
		background: transparent;
		font: inherit;
		font-size: 13px;
		cursor: pointer;
		text-align: left;
	}

	.code-changes__row:hover {
		background: var(--bg-band-strong);
	}

	.code-changes__badge {
		display: grid;
		place-items: center;
		width: 16px;
		height: 16px;
		border-radius: 3px;
		font-size: 10px;
		font-weight: 700;
		flex: none;
	}

	.code-changes__badge--m {
		background: var(--warning-ink);
		color: var(--bg);
	}

	.code-changes__badge--a {
		background: var(--go);
		color: var(--bg);
	}

	.code-changes__badge--d {
		background: var(--danger-ink);
		color: var(--bg);
	}

	.code-changes__name {
		font-family: var(--font-mono);
		font-size: 12.5px;
		color: var(--ink);
		flex: none;
	}

	.code-changes__path {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 11.5px;
		color: var(--ink-3);
	}

	.code-changes__stats {
		display: inline-flex;
		gap: var(--space-1);
		font-family: var(--font-mono);
		font-size: 11px;
		flex: none;
	}

	.code-changes__add {
		color: var(--go);
	}

	.code-changes__del {
		color: var(--danger-ink);
	}

	.code-changes__diff-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-2) var(--space-4);
		flex: none;
	}

	.code-changes__diff-title {
		font-family: var(--font-mono);
		font-size: 11.5px;
		color: var(--ink-2);
	}

	.code-changes__diff-toggle {
		border: 0;
		background: transparent;
		font: inherit;
		font-size: 11.5px;
		color: var(--accent);
		cursor: pointer;
		padding: 0;
	}

	.code-changes__diff {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 0 var(--space-4) var(--space-3);
		font-family: var(--font-mono);
		font-size: 11.5px;
		line-height: 1.55;
	}

	.code-changes__diff-line {
		padding: 0 var(--space-2);
		white-space: pre;
		overflow-x: auto;
	}

	.code-changes__diff-line--hunk {
		color: var(--accent);
	}

	.code-changes__diff-line--ctx {
		color: var(--ink-3);
	}

	.code-changes__diff-line--add {
		color: var(--go);
		background: var(--go-bg);
	}

	.code-changes__diff-line--del {
		color: var(--danger-ink);
		background: var(--danger-bg);
	}

	.code-changes__footer {
		padding: var(--space-2) var(--space-4);
		border-top: 1px solid var(--line);
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--ink-3);
		flex: none;
	}
`;
