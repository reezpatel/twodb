import css from "styled-jsx/css";

export const chatSectionStyles = css`
	.code-chat {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		background: var(--bg);
	}

	/* --- top tool row --- */

	.code-chat__tools {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-2) var(--space-4);
		border-bottom: 1px solid var(--line);
		flex: none;
	}

	.code-chat__tool {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-3);
		border: 0;
		border-radius: var(--r-sm);
		background: transparent;
		font: inherit;
		font-size: 12.5px;
		color: var(--ink-3);
		cursor: pointer;
	}

	.code-chat__tool:hover {
		background: var(--bg-band);
		color: var(--ink-2);
	}

	.code-chat__tool.is-active {
		background: var(--bg-band-strong);
		color: var(--ink);
	}

	/* --- messages --- */

	.code-chat__messages {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: var(--space-5) var(--space-5) var(--space-4);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.code-chat__message {
		max-width: 72ch;
	}

	.code-chat__message--user {
		align-self: flex-end;
		background: var(--bg-band);
		border: 1px solid var(--line);
		border-radius: var(--r-md);
		padding: var(--space-2) var(--space-3);
	}

	.code-chat__role {
		display: block;
		font-family: var(--font-cue);
		font-size: 10px;
		letter-spacing: var(--tracking-cue);
		text-transform: uppercase;
		color: var(--ink-3);
		margin-bottom: var(--space-1);
	}

	.code-chat__message--user .code-chat__role {
		color: var(--ink-3);
	}

	.code-chat__text {
		margin: 0;
		font-size: 13.5px;
		line-height: 1.55;
		color: var(--ink);
	}

	.code-chat__cursor {
		display: inline-block;
		width: 7px;
		height: 14px;
		margin-left: 3px;
		vertical-align: -2px;
		background: var(--accent);
		animation: code-chat-blink 1s steps(2, start) infinite;
	}

	.code-chat__tool-call {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-3);
		border: 1px dashed var(--line);
		border-radius: var(--r-sm);
		font-family: var(--font-mono);
		font-size: 11.5px;
		color: var(--ink-3);
		max-width: fit-content;
	}

	.code-chat__tool-call-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* --- composer --- */

	.code-chat__composer {
		margin: 0 var(--space-4);
		border: 1px solid var(--line);
		border-radius: var(--r-md);
		background: var(--bg-card, var(--bg));
		flex: none;
	}

	.code-chat__composer:focus-within {
		border-color: var(--accent);
	}

	.code-chat__input {
		display: block;
		width: 100%;
		box-sizing: border-box;
		padding: var(--space-3);
		border: 0;
		background: transparent;
		resize: none;
		font: inherit;
		font-size: 13.5px;
		color: var(--ink);
		outline: none;
	}

	.code-chat__input::placeholder {
		color: var(--ink-3);
	}

	.code-chat__composer-bar {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: 0 var(--space-2) var(--space-2);
	}

	.code-chat__model {
		margin-left: var(--space-2);
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--ink-3);
	}

	.code-chat__composer-spacer {
		flex: 1;
	}

	/* --- info strip --- */

	.code-chat__info {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
		padding: var(--space-2) var(--space-4);
		border-top: 1px solid var(--line);
		margin-top: var(--space-3);
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--ink-2);
		flex: none;
	}

	.code-chat__info-item {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}

	.code-chat__info-item--file {
		color: var(--ink);
	}

	.code-chat__info-label {
		color: var(--ink-3);
	}

	@keyframes code-chat-blink {
		50% {
			opacity: 0;
		}
	}
`;
