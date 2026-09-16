import css from "styled-jsx/css";

export const passkeysSectionStyles = css`
  .passkeys-page {
    width: min(1240px, 100%);
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .passkeys-page__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-5);
  }

  .passkeys-page__header h1 {
    margin: 0 0 var(--space-1);
    color: var(--ink);
    font-size: var(--text-xl);
    font-weight: 500;
    letter-spacing: 0;
    line-height: 1.2;
  }

  .passkeys-page__header p {
    max-width: var(--measure);
    margin: 0;
    color: var(--ink-3);
    font-size: var(--text-sm);
    line-height: 1.55;
  }

  .passkeys-page__error {
    margin: 0;
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--danger-ink);
    border-radius: var(--r-md);
    background: var(--danger-bg);
    color: var(--danger-ink);
    font-size: var(--text-sm);
  }

  .passkeys-page__list-section {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .passkeys-page__list-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: 0 var(--space-1);
  }

  .passkeys-page__list-heading h2 {
    margin: 0;
    color: var(--ink-2);
    font-size: var(--text-sm);
    font-weight: 550;
    line-height: 1.4;
  }

  .passkeys-page__list {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: var(--r-lg);
    background: var(--surface);
    list-style: none;
    overflow: hidden;
  }

  .passkeys-page__row,
  .passkeys-page__loading-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 72px;
    padding: var(--space-3) var(--space-4);
  }

  .passkeys-page__row + .passkeys-page__row,
  .passkeys-page__loading-row + .passkeys-page__loading-row {
    border-top: 1px solid var(--line);
  }

  .passkeys-page__row {
    transition: background var(--dur-1) var(--ease-out);
  }

  .passkeys-page__row:hover {
    background: var(--bg-band);
  }

  .passkeys-page__key-icon {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    flex: 0 0 40px;
    border-radius: var(--r-md);
    color: var(--accent);
  }

  .passkeys-page__key-icon :global(svg) {
    width: 18px;
    height: 18px;
  }

  .passkeys-page__row-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .passkeys-page__row-title,
  .passkeys-page__meta {
    display: flex;
    align-items: center;
  }

  .passkeys-page__row-title {
    gap: var(--space-2);
    min-width: 0;
  }

  .passkeys-page__row-title strong {
    overflow: hidden;
    color: var(--ink);
    font-size: var(--text-md);
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .passkeys-page__meta {
    flex-wrap: wrap;
    gap: var(--space-1);
    color: var(--ink-3);
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
    line-height: 1.4;
  }

  .passkeys-page__loading-row > div:last-child {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  @media (max-width: 760px) {
    .passkeys-page__header {
      align-items: stretch;
      flex-direction: column;
    }
  }

  @media (max-width: 520px) {
    .passkeys-page__row,
    .passkeys-page__loading-row {
      align-items: flex-start;
      padding: var(--space-3);
    }

    .passkeys-page__key-icon {
      width: 36px;
      height: 36px;
      flex-basis: 36px;
    }

    .passkeys-page__meta > span[aria-hidden="true"] {
      display: none;
    }

    .passkeys-page__meta > span {
      width: 100%;
    }
  }
`;
