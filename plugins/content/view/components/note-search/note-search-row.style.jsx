import css from "styled-jsx/css";

export const noteSearchRowStyles = css`
  .shell__searchrow {
    display: flex;
    align-items: center;
    gap: 4px;
    margin: 8px 10px 2px;
    flex: none;
  }

  .shell__searchrow :global(.tw-search) {
    flex: 1;
    min-width: 0;
  }

  .shell__searchrow :global(.tw-input) {
    height: 30px;
    font-size: var(--text-sm);
  }
`;
