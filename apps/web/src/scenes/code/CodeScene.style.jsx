import css from "styled-jsx/css";

export const codeSceneStyles = css`
	.mock-ai-editor {
		grid-column: 2 / -1;
		grid-row: 1 / 3;
		display: grid;
		grid-template-columns: 48px 280px minmax(0, 1fr) 260px;
		width: 100%;
		height: 100%;
		min-height: 0;
		background: var(--bg);
		color: var(--ink);
		overflow: hidden;
		font-size: 13px;
	}

	/* --- icon rail --- */

	.mock-ai-editor__rail {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 16px 0;
		background: var(--bg-rail);
		border-right: 1px solid var(--line);
	}

	.mock-ai-editor__rail-item {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: var(--ink-3);
		cursor: pointer;
		transition: all var(--dur-1) var(--ease-out);
	}

	.mock-ai-editor__rail-item:hover {
		background: var(--bg-band-strong);
		color: var(--ink-2);
	}

	.mock-ai-editor__rail-item.is-active {
		background: var(--bg-band-strong);
		color: var(--ink);
	}

	.mock-ai-editor__rail-spacer {
		flex: 1;
	}

	/* --- issue sidebar --- */

	.mock-ai-editor__sidebar {
		display: flex;
		flex-direction: column;
		background: var(--bg-band);
		border-right: 1px solid var(--line);
		overflow: hidden;
	}

	.mock-ai-editor__sidebar-header {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 16px;
		border-bottom: 1px solid var(--line);
	}

	.mock-ai-editor__project-name {
		font-size: 14px;
		font-weight: 600;
		color: var(--ink);
	}

	.mock-ai-editor__header-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-left: auto;
	}

	.mock-ai-editor__header-btn {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		padding: 0;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: var(--ink-3);
		cursor: pointer;
	}

	.mock-ai-editor__header-btn:hover {
		background: var(--bg-band-strong);
		color: var(--ink-2);
	}

	.mock-ai-editor__sections {
		flex: 1;
		overflow-y: auto;
		padding: 8px 0;
	}

	.mock-ai-editor__section {
		margin-bottom: 4px;
	}

	.mock-ai-editor__section-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		color: var(--ink-2);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
	}

	.mock-ai-editor__section-header:hover {
		color: var(--ink);
	}

	.mock-ai-editor__section-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		border-radius: 4px;
		background: var(--bg-band-strong);
		font-size: 11px;
		color: var(--ink-3);
	}

	.mock-ai-editor__issue {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 16px;
		cursor: pointer;
		transition: background var(--dur-1) var(--ease-out);
	}

	.mock-ai-editor__issue:hover,
	.mock-ai-editor__issue.is-selected {
		background: var(--bg-band-strong);
	}

	.mock-ai-editor__issue-id {
		font-size: 12px;
		color: var(--ink-3);
		font-family: var(--font-mono);
	}

	.mock-ai-editor__issue-status {
		width: 14px;
		height: 14px;
		display: grid;
		place-items: center;
		color: var(--ink-3);
	}

	.mock-ai-editor__issue-status--done {
		color: var(--go);
	}

	.mock-ai-editor__issue-status--progress {
		color: var(--accent);
		animation: mock-ai-spin 1s linear infinite;
	}

	@keyframes mock-ai-spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.mock-ai-editor__issue-title {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 13px;
		color: var(--ink);
	}

	.mock-ai-editor__issue-badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		border-radius: var(--r-pill);
		font-size: 11px;
		font-weight: 500;
	}

	.mock-ai-editor__issue-badge--feature {
		background: var(--accent-soft-bg);
		color: var(--accent);
	}

	.mock-ai-editor__issue-badge--feature::before {
		content: "";
		width: 6px;
		height: 6px;
		border-radius: var(--r-pill);
		background: var(--action);
	}

	.mock-ai-editor__issue-badge--bug {
		background: var(--danger-bg);
		color: var(--danger-ink);
	}

	.mock-ai-editor__issue-badge--bug::before {
		content: "";
		width: 6px;
		height: 6px;
		border-radius: var(--r-pill);
		background: var(--danger-ink);
	}

	.mock-ai-editor__issue-circle {
		width: 16px;
		height: 16px;
		border: 1.5px solid var(--line-strong);
		border-radius: var(--r-pill);
	}

	/* --- main content --- */

	.mock-ai-editor__main {
		display: flex;
		flex-direction: column;
		background: var(--bg);
		overflow: hidden;
	}

	.mock-ai-editor__tabs {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 12px 20px;
		border-bottom: 1px solid var(--line);
	}

	.mock-ai-editor__tab {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: var(--ink-3);
		font: inherit;
		font-size: 13px;
		cursor: pointer;
		transition: all var(--dur-1) var(--ease-out);
	}

	.mock-ai-editor__tab:hover {
		background: var(--bg-band-strong);
		color: var(--ink-2);
	}

	.mock-ai-editor__tab.is-active {
		background: var(--bg-band-strong);
		color: var(--ink);
	}

	.mock-ai-editor__content-header {
		padding: 20px 24px 0;
	}

	.mock-ai-editor__content-title {
		font-size: 20px;
		font-weight: 600;
		color: var(--ink);
	}

	.mock-ai-editor__empty {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px;
		text-align: center;
	}

	.mock-ai-editor__empty-icon {
		width: 48px;
		height: 48px;
		margin-bottom: 20px;
		color: var(--accent);
	}

	.mock-ai-editor__empty-icon svg {
		width: 100%;
		height: 100%;
	}

	.mock-ai-editor__empty-title {
		font-size: 18px;
		font-weight: 500;
		color: var(--ink);
		margin-bottom: 8px;
	}

	.mock-ai-editor__empty-subtitle {
		font-size: 14px;
		color: var(--ink-3);
		margin-bottom: 24px;
	}

	.mock-ai-editor__start-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 24px;
		border: 0;
		border-radius: 8px;
		background: var(--action);
		color: var(--accent-ink);
		font: inherit;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: background var(--dur-1) var(--ease-out);
	}

	.mock-ai-editor__start-btn:hover {
		background: var(--action-strong);
	}

	/* --- right panel --- */

	.mock-ai-editor__panel {
		display: flex;
		flex-direction: column;
		background: var(--bg-band);
		border-left: 1px solid var(--line);
		overflow-y: auto;
	}

	.mock-ai-editor__panel-section {
		border-bottom: 1px solid var(--line);
	}

	.mock-ai-editor__panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 16px;
		cursor: pointer;
	}

	.mock-ai-editor__panel-title {
		font-size: 12px;
		font-weight: 600;
		color: var(--ink-2);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.mock-ai-editor__panel-toggle {
		width: 16px;
		height: 16px;
		color: var(--ink-3);
		transition: transform var(--dur-2) var(--ease-out);
	}

	.mock-ai-editor__panel-items {
		padding: 0 16px 14px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.mock-ai-editor__panel-item {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 0;
		font-size: 13px;
		color: var(--ink-2);
	}

	.mock-ai-editor__panel-item svg {
		color: var(--ink-3);
	}

	.mock-ai-editor__git-file {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 0;
		font-size: 13px;
	}

	.mock-ai-editor__git-file-icon {
		width: 16px;
		height: 16px;
		border-radius: 3px;
		background: var(--warning-ink);
		display: grid;
		place-items: center;
		font-size: 10px;
		font-weight: 700;
		color: var(--bg);
	}

	.mock-ai-editor__git-file-name {
		flex: 1;
		color: var(--ink-2);
	}

	.mock-ai-editor__git-file-stats {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		font-family: var(--font-mono);
	}

	.mock-ai-editor__git-add {
		color: var(--go);
	}

	.mock-ai-editor__git-del {
		color: var(--danger-ink);
	}

	.mock-ai-editor__branch-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 0;
	}

	.mock-ai-editor__branch-row svg {
		color: var(--ink-3);
	}

	.mock-ai-editor__branch-name {
		flex: 1;
		font-size: 13px;
		color: var(--ink);
	}

	.mock-ai-editor__branch-refresh {
		width: 20px;
		height: 20px;
		padding: 0;
		border: 0;
		border-radius: 4px;
		background: transparent;
		color: var(--ink-3);
		cursor: pointer;
	}

	.mock-ai-editor__branch-refresh:hover {
		background: var(--bg-band-strong);
		color: var(--ink-2);
	}

	.mock-ai-editor__stat-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 0;
		font-size: 13px;
	}

	.mock-ai-editor__stat-label {
		color: var(--ink-3);
	}

	.mock-ai-editor__stat-value {
		color: var(--accent);
		font-family: var(--font-mono);
	}

	@media (max-width: 1100px) {
		.mock-ai-editor {
			grid-template-columns: 48px 240px minmax(0, 1fr) 220px;
		}
	}

	@media (max-width: 900px) {
		.mock-ai-editor {
			grid-template-columns: 48px minmax(0, 1fr);
		}

		.mock-ai-editor__sidebar,
		.mock-ai-editor__panel {
			display: none;
		}
	}
`;
