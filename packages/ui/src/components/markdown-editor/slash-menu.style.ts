import css from "styled-jsx/css";

export const slashMenuStyles = css`
  .tw-slash {
    position: absolute;
    z-index: 30;
    min-width: 220px;
    max-height: 260px;
    overflow-y: auto;
    padding: 4px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    box-shadow: 0 10px 30px rgb(0 0 0 / 0.16);
  }

  .tw-slash__item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: 6px 8px;
    border: 0;
    border-radius: var(--r-sm);
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-size: var(--text-sm);
    text-align: left;
    cursor: pointer;
  }

  .tw-slash__item.is-active {
    background: var(--bg-band);
  }

  .tw-slash__icon {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border: 1px solid var(--line);
    border-radius: var(--r-sm);
    background: var(--bg);
    color: var(--ink-2);
    flex: none;
  }

  .tw-slash__label {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tw-slash__hint {
    font-size: var(--text-xs);
    color: var(--ink-3);
  }
`;
