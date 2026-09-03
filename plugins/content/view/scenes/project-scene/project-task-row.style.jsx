import css from "styled-jsx/css";

export const projectTaskRowStyles = css`
  .project-row {
    display: grid;
    grid-template-columns: minmax(300px, 1fr) 110px 100px 100px;
    gap: 8px;
    align-items: center;
    padding: 10px 24px;
    border-bottom: 1px solid var(--line);
    cursor: pointer;
  }

  .project-row:hover {
    background: var(--bg-band);
  }

  .project-row.is-selected {
    background: var(--accent-soft-bg);
  }

  .project-row.is-done {
    opacity: 0.6;
  }

  .project-row__task-cell {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .project-row__checkbox {
    width: 18px;
    height: 18px;
    border: 1.5px solid var(--line-strong);
    border-radius: 999px;
    background: var(--surface);
    display: grid;
    place-items: center;
    flex-shrink: 0;
    cursor: pointer;
  }

  .project-row__checkbox.is-checked {
    background: var(--go);
    border-color: var(--go);
    color: var(--accent-ink);
  }

  .project-row__checkbox :global(svg) {
    width: 10px;
    height: 10px;
    stroke-width: 3;
  }

  .project-row__task-id {
    font-size: var(--text-sm);
    color: var(--ink-3);
    white-space: nowrap;
  }

  .project-row__task-title {
    flex: 1;
    min-width: 0;
    font-size: var(--text-sm);
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .project-row__task-attachments {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--ink-3);
    white-space: nowrap;
  }

  .project-row__task-attachments :global(svg) {
    width: 12px;
    height: 12px;
    stroke-width: 1.8;
  }

  .project-row__progress {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: var(--text-sm);
  }

  .project-row__progress-icon {
    width: 14px;
    height: 14px;
  }

  .project-row__progress--ongoing {
    color: var(--accent);
  }

  .project-row__progress--completed {
    color: var(--go);
  }

  .project-row__urgency {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: var(--text-sm);
  }

  .project-row__urgency-bars {
    display: flex;
    gap: 2px;
  }

  .project-row__urgency-bar {
    width: 3px;
    height: 12px;
    border-radius: 1px;
    background: var(--line);
  }

  .project-row__urgency--critical .project-row__urgency-bar {
    background: var(--danger-ink);
  }

  .project-row__urgency--moderate .project-row__urgency-bar:nth-child(-n + 2) {
    background: var(--warning-ink);
  }

  .project-row__urgency--minor .project-row__urgency-bar:first-child {
    background: var(--ink-3);
  }

  .project-row__assignees {
    display: flex;
    align-items: center;
  }

  .project-row__assignee {
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

  .project-row__assignee--orange {
    background: var(--warning-ink);
  }

  .project-row__assignee--purple {
    background: var(--rose-accent);
  }

  .project-row__assignee--teal {
    background: linear-gradient(135deg, var(--go), var(--accent-strong));
  }

  .project-row__assignee--pink {
    background: linear-gradient(135deg, var(--twdb-rose), var(--rose-accent));
  }
`;
