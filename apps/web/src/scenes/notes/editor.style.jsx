import css from "styled-jsx/css";

export const editorStyles = css`
	.shell__doctype {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: var(--text-sm);
		font-weight: 600;
		white-space: nowrap;
	}

	.shell__slug {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--ink-3);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.shell__statusdot {
		width: 9px;
		height: 9px;
		flex: none;
		border-radius: 50%;
		background: var(--shell-green);
		margin: 0 2px;
	}

	.shell__chrome--editor {
		grid-column: 3;
		grid-row: 1;
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
		padding: 0 8px 0 16px;
		border-bottom: 1px solid var(--line);
		background: var(--surface);
	}

	.shell__barbtn--star.is-active {
		color: var(--shell-amber);
	}

	.shell__chromespacer {
		flex: 1;
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

	.shell__editor {
		grid-column: 3;
		grid-row: 2;
		overflow-y: auto;
		background: var(--bg);
	}

	.shell__editor::-webkit-scrollbar {
		width: 8px;
	}

	.shell__editor::-webkit-scrollbar-thumb {
		background: var(--line-strong);
		border-radius: var(--r-pill);
		border: 2px solid transparent;
		background-clip: content-box;
	}

	.shell__doc {
		max-width: 660px;
		margin: 0 auto;
		padding: 34px 48px 120px;
	}

	.shell__doctitle {
		margin: 0 0 22px;
		font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
		font-size: 31px;
		font-weight: 700;
		letter-spacing: -0.015em;
		line-height: 1.15;
		color: var(--ink);
	}

	.shell__blocks {
		position: relative;
		font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
		font-size: 15.5px;
		line-height: 1.68;
		color: var(--ink-2);
	}

	.shell__blocks :global(p) {
		margin: 0 0 18px;
	}

	.shell__blocks :global(strong) {
		color: var(--ink);
		font-weight: 650;
	}

	.shell__blocks :global(em) {
		font-style: italic;
	}

	.shell__blocks :global(.shell__link) {
		color: var(--accent);
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 2px;
		cursor: pointer;
	}

	.shell__blocks :global(ul) {
		margin: 4px 0 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.shell__blocks :global(li) {
		position: relative;
		padding-left: 22px;
	}

	.shell__blocks :global(li::before) {
		content: "";
		position: absolute;
		left: 2px;
		top: 0.62em;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--accent);
	}

	.shell__blocks :global(.shell__emoji) {
		margin-right: 2px;
	}

	.shell__gutter {
		position: absolute;
		left: -40px;
		top: 2px;
		display: flex;
		align-items: center;
		gap: 2px;
		color: var(--ink-3);
		opacity: 0.75;
	}

	.shell__gutter :global(svg) {
		cursor: pointer;
	}
`;
