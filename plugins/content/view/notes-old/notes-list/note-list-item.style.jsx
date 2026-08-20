import css from "styled-jsx/css";

export const noteListItemStyles = css`
  .shell__note {
    padding: 11px 14px 9px;
    border-bottom: 1px solid var(--line);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 4px;
    transition: background var(--dur-1) var(--ease-out);
  }

  .shell__note:hover {
    background: var(--bg-band);
  }

  .shell__note.is-open,
  .shell__note.is-open:hover {
    background: var(--accent-soft-bg);
    box-shadow: inset 2px 0 0 var(--accent);
  }

  .shell__notehead {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }

  .shell__notehead strong {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--text-md);
    font-weight: 450;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .shell__note > p {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.45;
    color: var(--ink-3);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-weight: 400;
  }

  .shell__notechips {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 2px;
  }

  .shell__notefoot {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    margin-top: 3px;
    font-weight: 300;
    font-size: var(--text-xs);
    color: var(--ink-3);
  }
`;
