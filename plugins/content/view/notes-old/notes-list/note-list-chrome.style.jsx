import css from "styled-jsx/css";

export const noteListChromeStyles = css`
  .shell__chrome--list {
    grid-column: 2;
    grid-row: 1;
    display: flex;
    align-items: center;
    gap: 1px;
    min-width: 0;
    padding: 0 8px 0 12px;
    border-right: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
    background: var(--surface);
  }

  .shell__chromespacer {
    flex: 1;
  }

  .shell__listtitle {
    font-size: var(--text-md);
    font-weight: 500;
    white-space: nowrap;
  }

  .shell__sort {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 7px;
    border: 0;
    border-radius: var(--r-sm);
    background: transparent;
    font-size: var(--text-sm);
    color: var(--ink-3);
    cursor: pointer;
    white-space: nowrap;
    transition:
      background var(--dur-1) var(--ease-out),
      color var(--dur-1) var(--ease-out);
  }

  .shell__sort:hover {
    background: var(--bg-band-strong);
    color: var(--ink);
  }

  .shell__viewmenu {
    display: grid;
    padding: 3px;
  }

  .shell__viewmenu :global(.tw-seg) {
    border-color: var(--line);
  }

  .shell__viewmenu :global(.tw-seg__btn) {
    width: 29px;
    height: 27px;
  }
`;
