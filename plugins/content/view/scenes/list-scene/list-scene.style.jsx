import css from "styled-jsx/css";

export const listSceneStyles = css`
  .list-scene {
    grid-column: 2 / -1;
    grid-row: 1 / 3;
    display: grid;
    grid-template-columns: var(--list-scene-list-width, 340px) 9px minmax(
        0,
        1fr
      );
    grid-template-rows: 40px minmax(0, 1fr);
    min-width: 0;
    min-height: 0;
    background: var(--bg);
  }

  .list-scene__list {
    grid-column: 1;
    grid-row: 2;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    background: var(--bg);
  }

  .list-scene__list::-webkit-scrollbar {
    width: 8px;
  }

  .list-scene__list::-webkit-scrollbar-thumb {
    background: var(--line-strong);
    border-radius: var(--r-pill);
    border: 2px solid transparent;
    background-clip: content-box;
  }

  .list-scene__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-6) var(--space-3);
    color: var(--ink-3);
    font-size: var(--text-sm);
    text-align: center;
  }

  .list-scene__empty p {
    margin: 0;
  }

  .list-scene__resizer {
    grid-column: 2;
    grid-row: 1 / 3;
    width: 9px;
    height: 100%;
    padding: 0;
    border: 0;
    border-left: 1px solid var(--line);
    border-right: 1px solid var(--line);
    background: var(--surface);
    cursor: col-resize;
    transition:
      background var(--dur-1) var(--ease-out),
      border-color var(--dur-1) var(--ease-out);
  }

  .list-scene__resizer:hover,
  .list-scene__resizer:focus-visible {
    background: var(--bg-band-strong);
    border-color: var(--line-strong);
    outline: none;
  }
`;
