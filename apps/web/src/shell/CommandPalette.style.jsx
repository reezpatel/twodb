import css from "styled-jsx/css";

export const commandPaletteStyles = css`
	.shell__palette-backdrop {
		position: fixed;
		inset: 0;
		z-index: 60;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 12vh var(--space-4) var(--space-4);
		background: color-mix(in srgb, var(--ink) 18%, transparent);
	}

	.shell__palette {
		display: flex;
		flex-direction: column;
		width: min(560px, 100%);
		background: var(--bg);
		border: 1px solid var(--line);
		border-radius: var(--r-lg);
		box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25);
		overflow: hidden;
	}

	/* search row */

	.shell__palette-search {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 16px;
		border-bottom: 1px solid var(--line);
	}

	.shell__palette-search > svg {
		flex-shrink: 0;
		color: var(--ink-3);
	}

	.shell__palette-search input {
		flex: 1;
		min-width: 0;
		border: 0;
		background: none;
		font: inherit;
		font-size: var(--text-md);
		color: var(--ink);
		outline: none;
	}

	.shell__palette-search input::placeholder {
		color: var(--ink-3);
	}

	/* kbd chips */

	.shell__palette-kbd {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.shell__palette-kbd kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 22px;
		height: 22px;
		padding: 0 5px;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 4px;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 500;
		color: var(--ink-2);
	}

	/* results */

	.shell__palette-results {
		max-height: 400px;
		overflow-y: auto;
	}

	.shell__palette-section {
		padding: 8px 0;
	}

	.shell__palette-sectitle {
		display: block;
		padding: 6px 16px 8px;
		font-size: var(--text-sm);
		font-weight: 500;
		color: var(--ink-3);
	}

	.shell__palette-item {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 10px 16px;
		border: 0;
		background: none;
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition: background var(--dur-1) var(--ease-out);
	}

	.shell__palette-item:hover,
	.shell__palette-item.is-selected {
		background: var(--surface);
	}

	.shell__palette-itemicon {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		color: var(--ink-3);
	}

	.shell__palette-item.is-selected .shell__palette-itemicon {
		color: var(--accent);
	}

	.shell__palette-itemlabel {
		flex: 1;
		min-width: 0;
		font-size: var(--text-md);
		color: var(--ink);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* no-results state (Cmd K Dialog) */

	.shell__palette-empty {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 48px 40px 32px;
		min-height: 340px;
		overflow: hidden;
	}

	.shell__palette-emptybg {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
	}

	.shell__palette-ripple {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		border-radius: 50%;
		border: 1px solid color-mix(in srgb, var(--accent) 8%, transparent);
	}

	.shell__palette-ripple--1 {
		width: 180px;
		height: 180px;
	}

	.shell__palette-ripple--2 {
		width: 280px;
		height: 280px;
	}

	.shell__palette-ripple--3 {
		width: 380px;
		height: 380px;
	}

	.shell__palette-appicon {
		position: absolute;
		transform-origin: center;
	}

	.shell__palette-appicon-bg {
		display: grid;
		place-items: center;
		width: 42px;
		height: 42px;
		border-radius: 10px;
		box-shadow: 0 2px 8px rgb(0 0 0 / 0.08);
		color: var(--bg);
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.5px;
	}

	.shell__palette-emptyicon {
		position: relative;
		display: grid;
		place-items: center;
		width: 64px;
		height: 64px;
		margin-bottom: 24px;
		border-radius: 16px;
		background: var(--surface);
		color: var(--ink-3);
	}

	.shell__palette-emptytitle {
		position: relative;
		margin: 0 0 10px;
		font-size: var(--text-lg);
		font-weight: 600;
		color: var(--ink);
	}

	.shell__palette-emptytext {
		position: relative;
		margin: 0 0 24px;
		font-size: var(--text-md);
		line-height: 1.6;
		text-align: center;
		color: var(--ink-3);
	}

	.shell__palette-clear {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 140px;
		height: 40px;
		padding: 0 20px;
		border: 1px solid var(--line);
		border-radius: var(--r-md);
		background: var(--bg);
		font: inherit;
		font-size: var(--text-md);
		font-weight: 500;
		color: var(--ink-2);
		cursor: pointer;
		box-shadow: 0 1px 3px rgb(0 0 0 / 0.06);
		transition:
			border-color var(--dur-1) var(--ease-out),
			background var(--dur-1) var(--ease-out);
	}

	.shell__palette-clear:hover {
		background: var(--surface);
		border-color: var(--line-strong);
	}

	/* footer hints */

	.shell__palette-footer {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 10px 16px;
		border-top: 1px solid var(--line);
		background: var(--surface);
	}

	.shell__palette-hint {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 11px;
		color: var(--ink-3);
	}

	.shell__palette-hint kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 18px;
		height: 18px;
		padding: 0 4px;
		background: var(--bg);
		border: 1px solid var(--line);
		border-radius: 3px;
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 500;
		color: var(--ink-3);
	}
`;
