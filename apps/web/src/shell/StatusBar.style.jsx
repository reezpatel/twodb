import css from "styled-jsx/css";

/**
 * StatusBar styles — the reference example of the twodb styling convention
 * (see /AGENTS.md): large component styles live in a sibling
 * `<Component>.style.jsx` file as a styled-jsx `css` export, applied in the
 * component with `<style jsx>{statusBarStyles}</style>`. Selectors are
 * scoped to the component automatically by styled-jsx.
 */
export const statusBarStyles = css`
	.shell__statusbar {
		grid-column: 1 / -1;
		grid-row: 3;
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 0 10px;
		border-top: 1px solid var(--line);
		background: var(--surface);
		font-size: var(--text-xs);
		color: var(--ink-3);
	}

	.shell__stitem {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 3px 6px;
		border-radius: var(--r-sm);
		white-space: nowrap;
	}

	.shell__chromespacer {
		flex: 1;
	}

	.shell__stbtn {
		border: 0;
		background: transparent;
		cursor: pointer;
		transition:
			background var(--dur-1) var(--ease-out),
			color var(--dur-1) var(--ease-out);
	}

	.shell__stbtn:hover {
		background: var(--bg-band-strong);
		color: var(--ink);
	}

	.shell__stitem--dim {
		opacity: 0.75;
	}

	.shell__stitem--changes {
		color: var(--shell-orange);
	}

	.shell__stitem--changes i {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--shell-orange);
	}

	.shell__stitem--synced {
		color: var(--shell-green);
	}

	.shell__stitem--claude {
		color: var(--shell-orange);
		font-weight: 550;
	}

	.shell__stbtnicon {
		display: grid;
		place-items: center;
		width: 20px;
		height: 20px;
		border: 0;
		border-radius: var(--r-sm);
		background: transparent;
		color: var(--ink-3);
		cursor: pointer;
		padding: 0;
	}

	.shell__stbtnicon:hover {
		background: var(--bg-band-strong);
		color: var(--ink);
	}
`;
