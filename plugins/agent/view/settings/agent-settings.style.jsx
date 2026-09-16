import css from "styled-jsx/css";

export const agentSettingsStyles = css`
  .agent-settings {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    max-width: 760px;
  }

  .agent-settings__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .agent-settings__header h3 {
    margin: 0 0 var(--space);
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--ink);
  }

  .agent-settings__header p {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--ink-3);
  }

  .agent-settings__nav-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    width: 100%;
  }

  .agent-settings__confirm {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--ink-2);
  }

  .agent-settings__state {
    padding: var(--space-6);
    border: 1px dashed var(--line);
    border-radius: var(--r-md);
    font-size: var(--text-sm);
    color: var(--ink-3);
    text-align: center;
  }
`;
