import css from "styled-jsx/css";

export const kanbanSceneStyles = css`
  .kanban-scene {
    grid-column: 2 / -1;
    grid-row: 1 / 3;
    display: grid;
    grid-template-rows: 40px auto minmax(0, 1fr);
    min-width: 0;
    min-height: 0;
    background: var(--bg);
  }

  .kanban-scene__board {
    display: flex;
    align-items: stretch;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-5);
    min-width: 0;
    min-height: 0;
    overflow-x: auto;
  }

  .kanban-scene__overlay-card {
    border: 1px solid var(--accent);
    border-radius: var(--r-md);
    background: var(--surface);
    box-shadow: var(--shadow-overlay);
    transform: rotate(2.5deg);
    cursor: grabbing;
  }

  .kanban-scene__overlay-card :global(.shell__note) {
    border-bottom: 0;
    border-radius: inherit;
  }
`;
