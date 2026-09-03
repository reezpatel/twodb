import css from "styled-jsx/css";

export const projectPropertiesPanelStyles = css`
  .project-panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-left: 1px solid var(--line);
    background: var(--surface);
    overflow-y: auto;
  }

  .project-panel__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px 14px;
    border-bottom: 1px solid var(--line);
  }

  .project-panel__title {
    font-family: var(--font-cue);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: var(--tracking-cue);
    text-transform: uppercase;
    color: var(--ink-2);
  }

  .project-panel__close {
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: var(--r-sm);
    background: transparent;
    color: var(--ink-3);
    cursor: pointer;
  }

  .project-panel__close:hover {
    background: var(--bg-band);
    color: var(--ink);
  }

  .project-panel__close :global(svg) {
    width: 14px;
    height: 14px;
  }

  .project-panel__props {
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .project-panel__prop {
    display: grid;
    grid-template-columns: 90px 1fr;
    gap: 8px;
    align-items: center;
  }

  .project-panel__prop-label {
    font-size: var(--text-sm);
    color: var(--ink-3);
  }

  .project-panel__prop-value {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--text-sm);
    color: var(--ink);
  }

  .project-panel__prop-icon {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    display: grid;
    place-items: center;
  }

  .project-panel__prop-icon :global(svg) {
    width: 12px;
    height: 12px;
  }

  .project-panel__prop-icon--blue {
    background: var(--accent-soft-bg);
    color: var(--accent);
  }

  .project-panel__prop-icon--red {
    background: var(--danger-bg);
    color: var(--danger-ink);
  }

  .project-panel__prop-icon--purple {
    background: var(--rose-soft-bg);
    color: var(--rose-accent);
  }

  .project-panel__prop-icon--file {
    background: var(--bg-band);
    color: var(--ink-2);
  }

  .project-panel__assignee {
    width: 26px;
    height: 26px;
    border-radius: 999px;
    border: 2px solid var(--surface);
    background: linear-gradient(135deg, var(--twdb-cobalt), var(--twdb-rose));
    display: grid;
    place-items: center;
    font-size: 10px;
    font-weight: 600;
    color: var(--accent-ink);
  }

  .project-panel__assignee--purple {
    background: var(--rose-accent);
  }

  .project-panel__assignee--teal {
    background: linear-gradient(135deg, var(--go), var(--accent-strong));
  }

  .project-panel__section {
    padding: 16px 20px;
    border-top: 1px solid var(--line);
  }

  .project-panel__section-title {
    margin-bottom: 12px;
    font-family: var(--font-cue);
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: var(--tracking-cue);
    text-transform: uppercase;
    color: var(--ink-3);
  }

  .project-panel__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .project-panel__tag {
    display: inline-flex;
    align-items: center;
    height: 24px;
    padding: 0 10px;
    border-radius: var(--r-sm);
    font-size: var(--text-sm);
  }

  .project-panel__tag--blue {
    background: var(--accent-soft-bg);
    color: var(--accent);
  }

  .project-panel__tag--red {
    background: var(--danger-bg);
    color: var(--danger-ink);
  }

  .project-panel__tag--green {
    background: var(--go-bg);
    color: var(--go);
  }

  .project-panel__attachments {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .project-panel__attachment {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border: 1px solid var(--line);
    border-radius: var(--r-sm);
    background: var(--surface);
  }

  .project-panel__attachment-icon {
    width: 28px;
    height: 28px;
    border-radius: var(--r-sm);
    background: var(--bg-band);
    display: grid;
    place-items: center;
    color: var(--ink-2);
  }

  .project-panel__attachment-icon :global(svg) {
    width: 14px;
    height: 14px;
  }

  .project-panel__attachment-info {
    flex: 1;
    min-width: 0;
  }

  .project-panel__attachment-name {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .project-panel__attachment-meta {
    font-size: 11px;
    color: var(--ink-3);
  }

  .project-panel__discussion {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .project-panel__comment {
    display: flex;
    gap: 10px;
  }

  .project-panel__comment-avatar {
    width: 28px;
    height: 28px;
    border-radius: 999px;
    background: linear-gradient(135deg, var(--twdb-cobalt), var(--twdb-rose));
    display: grid;
    place-items: center;
    font-size: 10px;
    font-weight: 600;
    color: var(--accent-ink);
    flex-shrink: 0;
  }

  .project-panel__comment-content {
    flex: 1;
    min-width: 0;
  }

  .project-panel__comment-author {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--ink);
    margin-bottom: 4px;
  }

  .project-panel__comment-text {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--ink-2);
    line-height: 1.5;
  }

  .project-panel__comment-input {
    margin-top: 8px;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    background: var(--surface);
    font-size: var(--text-sm);
    color: var(--ink-3);
  }
`;
