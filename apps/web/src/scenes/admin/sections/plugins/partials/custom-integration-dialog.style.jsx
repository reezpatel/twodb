import css from "styled-jsx/css";

export const customIntegrationDialogStyles = css`
  .plugins-dialog__copy {
    margin: 0 0 var(--space-2);
    color: var(--ink-2);
    line-height: 1.55;
  }

  .plugins-dialog__form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .plugins-dialog__error {
    margin: 0;
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--danger-ink);
    border-radius: var(--r-md);
    background: var(--danger-bg);
    color: var(--danger-ink);
    font-size: var(--text-sm);
  }
`;
