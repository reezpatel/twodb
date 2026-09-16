import css from "styled-jsx/css";

export const instanceSectionStyles = css`
  .instance-page {
    width: min(1240px, 100%);
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .instance-page__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-5);
  }

  .instance-page__header h1 {
    margin: 0 0 var(--space-1);
    color: var(--ink);
    font-size: var(--text-xl);
    font-weight: 500;
    letter-spacing: 0;
    line-height: 1.2;
  }

  .instance-page__header p {
    max-width: var(--measure);
    margin: 0;
    color: var(--ink-3);
    font-size: var(--text-sm);
    line-height: 1.55;
  }

  .instance-page__status {
    width: min(760px, 100%);
    display: flex;
    flex-direction: column;
    margin: 0;
    border: 1px solid var(--line);
    border-radius: var(--r-lg);
    background: var(--surface);
    overflow: hidden;
  }

  .instance-page__status > div {
    display: grid;
    grid-template-columns: 140px minmax(0, 1fr);
    gap: var(--space-4);
    padding: var(--space-3) var(--space-4);
  }

  .instance-page__status > div + div {
    border-top: 1px solid var(--line);
  }

  .instance-page__status dt {
    color: var(--ink-3);
    font-size: var(--text-sm);
  }

  .instance-page__status dd {
    margin: 0;
    overflow: hidden;
    color: var(--ink);
    font-family: var(--font-mono);
    font-size: var(--text-xxs);
    font-variant-numeric: tabular-nums;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .instance-page__form {
    width: min(760px, 100%);
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: var(--space-2);
  }

  @media (max-width: 760px) {
    .instance-page__header {
      align-items: stretch;
      flex-direction: column;
    }
  }

  @media (max-width: 520px) {
    .instance-page__status > div,
    .instance-page__form {
      grid-template-columns: 1fr;
    }
  }
`;
