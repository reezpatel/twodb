import css from "styled-jsx/css";

export const kanbanCardStyles = css`
  .kanban-card {
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    background: var(--surface);
    cursor: grab;
    touch-action: manipulation;
    transition:
      border-color var(--dur-2) var(--ease-out),
      box-shadow var(--dur-2) var(--ease-out),
      opacity var(--dur-2) var(--ease-out);
  }

  .kanban-card:hover {
    border-color: var(--line-strong);
    box-shadow: var(--shadow-overlay);
  }

  .kanban-card:active {
    cursor: grabbing;
  }

  .kanban-card.is-dragging {
    opacity: 0.35;
  }

  .kanban-card :global(.shell__note) {
    border-bottom: 0;
    border-radius: inherit;
  }

  .kanban-card :global(.shell__note.is-open),
  .kanban-card :global(.shell__note.is-open:hover) {
    box-shadow: none;
    background: var(--accent-soft-bg);
  }
`;
