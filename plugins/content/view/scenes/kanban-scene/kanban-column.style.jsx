import css from "styled-jsx/css";

export const kanbanColumnStyles = css`
  .kanban-column {
    display: flex;
    flex-direction: column;
    flex: none;
    width: 280px;
    min-height: 0;
  }

  .kanban-column__head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 2px 4px 10px;
  }

  .kanban-column__dot {
    width: 8px;
    height: 8px;
    border-radius: var(--r-pill);
    flex-shrink: 0;
  }

  .kanban-column__title {
    font-size: var(--text-md);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .kanban-column__count {
    font-size: var(--text-sm);
    color: var(--ink-3);
    font-variant-numeric: tabular-nums;
  }

  .kanban-column__actions {
    margin-left: auto;
    display: inline-flex;
  }

  .kanban-column__body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 0;
    overflow-y: auto;
    padding: 2px 2px 8px;
    border-radius: var(--r-md);
    transition: background var(--dur-2) var(--ease-out);
  }

  .kanban-column.is-drop .kanban-column__body {
    background: var(--accent-soft-bg);
  }

  .kanban-column__add {
    display: grid;
    place-items: center;
    min-height: 40px;
    flex: none;
    border: 1.5px dashed var(--line-strong);
    border-radius: var(--r-md);
    background: transparent;
    color: var(--ink-3);
    cursor: pointer;
    transition:
      border-color var(--dur-2) var(--ease-out),
      color var(--dur-2) var(--ease-out),
      background var(--dur-2) var(--ease-out);
  }

  .kanban-column__add:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-soft-bg);
  }

  .kanban-column__add :global(svg) {
    width: 16px;
    height: 16px;
    stroke-width: 2;
  }

  .kanban-column__composer {
    display: flex;
    min-height: 40px;
    flex: none;
    padding: 0 12px;
    align-items: center;
    border: 1.5px dashed var(--accent);
    border-radius: var(--r-md);
  }

  .kanban-column__composer input {
    width: 100%;
    border: 0;
    background: transparent;
    font: inherit;
    font-size: var(--text-sm);
    color: var(--ink);
    outline: none;
  }

  .kanban-column__composer input::placeholder {
    color: var(--ink-3);
  }
`;
