import css from "styled-jsx/css";

export const chatSectionStyles = css.global`
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

	.code-chat__tool-group {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-1);
		max-width: 72ch;
	}

	.code-chat__tool-group .code-chat__tool-output {
		align-self: stretch;
	}

	.code-chat__dir-cwd {
		color: var(--ink-3);
		padding-bottom: var(--space-1);
		margin-bottom: var(--space-1);
		border-bottom: 1px solid var(--line);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.code-chat__cmd {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: var(--space-1);
		align-self: stretch;
	}

	.code-chat__tool-output--stderr {
		border-color: var(--danger-ink);
		color: var(--danger-ink);
	}

	.code-chat__cmd-meta {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--ink-3);
	}

	.code-chat__dir-list {
		display: flex;
		flex-direction: column;
		gap: 1px;
		margin: var(--space-2) 0 0;
		padding: var(--space-2) var(--space-3);
		background: var(--bg-field);
		border: 1px solid var(--line);
		border-radius: var(--r-sm);
		font-family: var(--font-mono);
		font-size: 11.5px;
		max-height: 320px;
		overflow-y: auto;
		align-self: stretch;
	}

	.code-chat__dir-entry {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--ink-2);
	}

	.code-chat__dir-entry svg {
		color: var(--ink-3);
		flex: none;
	}

	.code-chat__dir-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.code-chat__tool-output {
		margin: var(--space-2) 0 0;
		padding: var(--space-2) var(--space-3);
		background: var(--bg-field);
		border: 1px solid var(--line);
		border-radius: var(--r-sm);
		font-family: var(--font-mono);
		font-size: 11.5px;
		line-height: 1.5;
		color: var(--ink-2);
		white-space: pre-wrap;
		word-break: break-word;
		overflow-wrap: anywhere;
		max-height: 320px;
		overflow-y: auto;
		overflow-x: hidden;
		max-width: 100%;
	}

	.code-chat__tool-call.is-error .code-chat__tool-output {
		border-color: var(--danger-ink);
		color: var(--danger-ink);
	}

	.code-chat__tool-expand {
		margin-left: auto;
		border: 0;
		background: transparent;
		font: inherit;
		font-size: 11px;
		color: var(--accent);
		cursor: pointer;
		padding: 0;
	}

	.code-chat__tool-expand:disabled {
		color: var(--ink-3);
		cursor: default;
	}

	.code-chat__tool-call.is-error {
		border-color: var(--danger-ink);
		color: var(--danger-ink);
	}

	.code-chat__spin {
		animation: code-chat-spin 1s linear infinite;
	}

	.code-chat__older {
		align-self: center;
		border: 1px solid var(--line);
		border-radius: var(--r-sm);
		background: transparent;
		font: inherit;
		font-size: 11.5px;
		color: var(--ink-3);
		padding: var(--space-1) var(--space-3);
		cursor: pointer;
	}

	.code-chat__older:hover {
		background: var(--bg-band);
		color: var(--ink-2);
	}

	.code-chat__empty {
		margin: 0;
		font-size: 13px;
		color: var(--ink-3);
		text-align: center;
	}

	.code-chat__error {
		margin: 0 var(--space-4);
		font-size: 12px;
		color: var(--danger-ink);
		flex: none;
	}

	.code-chat__switch-note {
		margin: 0;
		font-size: 13px;
		line-height: 1.5;
		color: var(--ink-2);
	}

	@keyframes code-chat-spin {
		to {
			transform: rotate(360deg);
		}
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

	.code-chat__info-item--button {
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		color: var(--ink-dim);
		cursor: pointer;
	}

	.code-chat__info-item--button:hover {
		color: var(--ink);
	}

	.code-chat__info-label {
		color: var(--ink-3);
	}

	.code-chat__switch-options {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.code-chat__switch-option {
		display: flex;
		flex-direction: column;
		gap: 2px;
		text-align: left;
		background: none;
		border: 1px solid var(--line);
		border-radius: var(--r-md);
		padding: var(--space-2) var(--space-3);
		cursor: pointer;
	}

	.code-chat__switch-option:hover:not(:disabled) {
		border-color: var(--ink-dim);
	}

	.code-chat__switch-option:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.code-chat__switch-option-label {
		font-weight: 500;
		color: var(--ink);
	}

	.code-chat__switch-option-hint {
		font-size: var(--text-sm);
		color: var(--ink-dim);
	}

	.code-chat__switch-option--danger .code-chat__switch-option-label {
		color: var(--danger-ink);
	}

	@keyframes code-chat-blink {
		50% {
			opacity: 0;
		}
	}
`;
