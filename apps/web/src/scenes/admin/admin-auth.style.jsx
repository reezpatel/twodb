import css from "styled-jsx/css";

export const adminAuthStyles = css`
  .admin__body {
    flex: 1;
    display: grid;
    place-items: center;
    min-width: 0;
    min-height: 0;
    padding: var(--space-6);
    background: var(--bg);
  }

  .admin__auth {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-6);
    width: min(420px, 100%);
    text-align: center;
  }

  .admin__auth-hero {
    display: grid;
    place-items: center;
    width: 112px;
    height: 112px;
    border-radius: var(--r-pill);
    background: var(--accent-soft-bg);
    color: var(--accent);
  }

  .admin__auth-title {
    margin: 0;
    font-size: var(--text-2xl);
    font-weight: 500;
    line-height: 1.4;
    color: var(--ink);
  }

  .admin__auth-points {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    margin: 0;
    padding: 0;
    list-style: none;
    align-self: stretch;
    text-align: left;
  }

  .admin__auth-point {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    font-size: var(--text-md);
    color: var(--ink);
  }

  .admin__auth-point svg {
    flex: 0 0 auto;
    color: var(--accent);
  }

  .admin__error {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--danger, #c0392b);
  }
`;
