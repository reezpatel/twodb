import css from "styled-jsx/css";

export const pluginsSectionStyles = css`
  .plugins-page {
    width: min(1240px, 100%);
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .plugins-page__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-5);
  }

  .plugins-page__header h1 {
    margin: 0 0 var(--space-1);
    color: var(--ink);
    font-size: var(--text-xl);
    font-weight: 500;
    letter-spacing: 0;
    line-height: 1.2;
  }

  .plugins-page__header p {
    max-width: var(--measure);
    margin: 0;
    color: var(--ink-3);
    font-size: var(--text-sm);
    line-height: 1.55;
  }

  .plugins-page__toolbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(240px, 320px);
    align-items: center;
    gap: var(--space-4);
  }

  .plugins-page__search {
    min-width: 0;
  }

  .plugins-page__error {
    margin: 0;
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--danger-ink);
    border-radius: var(--r-md);
    background: var(--danger-bg);
    color: var(--danger-ink);
    font-size: var(--text-sm);
  }

  @media (max-width: 760px) {
    .plugins-page__header {
      align-items: stretch;
      flex-direction: column;
    }

    .plugins-page__toolbar {
      grid-template-columns: 1fr;
    }
  }
`;
