import css from "styled-jsx/css";

export const tableSceneStyles = css`
  .table-scene {
    grid-column: 2 / -1;
    grid-row: 1 / 3;
    display: grid;
    grid-template-rows: 40px minmax(0, 1fr);
    min-width: 0;
    min-height: 0;
    background: var(--bg);
  }

  .table-scene__body {
    grid-column: 1;
    grid-row: 2;
    min-width: 0;
    min-height: 0;
    overflow: auto;
    display: flex;
    flex-direction: column;
  }
`;
