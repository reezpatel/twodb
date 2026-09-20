import css from "styled-jsx/css";

export const markdownStyles = css.global`
	.md {
		font-size: 13.5px;
		line-height: 1.55;
		color: var(--ink);
		overflow-wrap: break-word;
	}

	.md p {
		margin: 0 0 var(--space-2);
	}

	.md p:last-child {
		margin-bottom: 0;
	}

	.md [data-streamdown="heading-1"],
	.md [data-streamdown="heading-2"],
	.md [data-streamdown="heading-3"],
	.md [data-streamdown="heading-4"],
	.md [data-streamdown="heading-5"],
	.md [data-streamdown="heading-6"] {
		margin: var(--space-3) 0 var(--space-1);
		font-weight: 600;
		line-height: 1.3;
	}

	.md [data-streamdown="heading-1"] {
		font-size: 1.35em;
	}

	.md [data-streamdown="heading-2"] {
		font-size: 1.2em;
	}

	.md [data-streamdown="heading-3"] {
		font-size: 1.1em;
	}

	.md [data-streamdown="ordered-list"],
	.md [data-streamdown="unordered-list"] {
		margin: 0 0 var(--space-2);
		padding-left: var(--space-5);
	}

	.md [data-streamdown="list-item"] {
		margin: var(--space-1) 0;
	}

	.md [data-streamdown="link"] {
		color: var(--accent-ink);
		text-decoration: none;
		border-bottom: 1px solid transparent;
	}

	.md [data-streamdown="link"]:hover {
		border-bottom-color: var(--accent-ink);
	}

	.md [data-streamdown="inline-code"] {
		font-family: var(--font-mono);
		font-size: 0.9em;
		background: var(--bg-2, var(--line));
		border-radius: var(--r-sm);
		padding: 1px 5px;
	}

	.md [data-streamdown="code-block"] {
		margin: var(--space-2) 0;
		border: 1px solid var(--line);
		border-radius: var(--r-md);
		background: var(--bg-1, transparent);
	}

	.md pre {
		margin: 0;
		padding: var(--space-3);
		font-family: var(--font-mono);
		font-size: 12.5px;
		line-height: 1.5;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.md code {
		font-family: var(--font-mono);
	}

	.md [data-streamdown="blockquote"] {
		margin: var(--space-2) 0;
		padding-left: var(--space-3);
		border-left: 2px solid var(--line);
		color: var(--ink-dim);
	}

	.md [data-streamdown="horizontal-rule"] {
		border: none;
		border-top: 1px solid var(--line);
		margin: var(--space-3) 0;
	}

	.md div[data-streamdown="table-wrapper"] {
		margin: var(--space-2) 0;
	}

	.md div[data-streamdown="table-wrapper"] > div:first-child {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-1);
		margin-bottom: var(--space-1);
	}

	.md div[data-streamdown="table-wrapper"] button {
		display: inline-flex;
		align-items: center;
		background: none;
		border: 1px solid transparent;
		border-radius: var(--r-sm);
		padding: var(--space-1);
		color: var(--ink-3);
		cursor: pointer;
	}

	.md div[data-streamdown="table-wrapper"] button:hover:not(:disabled) {
		color: var(--ink);
		background: var(--bg-band);
		border-color: var(--line);
	}

	.md div[data-streamdown="table-wrapper"] button:disabled {
		cursor: default;
		opacity: 0.5;
	}

	.md table[data-streamdown="table-wrapper"] {
		width: 100%;
		border-collapse: collapse;
		border: 1px solid var(--line);
		border-radius: var(--r-sm);
		font-size: 12.5px;
	}

	.md [data-streamdown="table-header"] {
		background: var(--bg-band);
	}

	.md [data-streamdown="table-header-cell"],
	.md [data-streamdown="table-cell"] {
		padding: var(--space-1) var(--space-2);
		text-align: left;
	}

	.md [data-streamdown="table-header-cell"] {
		font-weight: 600;
		border-bottom: 1px solid var(--line);
	}

	.md [data-streamdown="table-body"] [data-streamdown="table-row"] + [data-streamdown="table-row"] {
		border-top: 1px solid var(--line);
	}
`;
