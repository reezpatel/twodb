import css from "styled-jsx/css";

export const pluginDetailDialogStyles = css`
  .plugins-detail {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .plugins-detail__description {
    margin: 0;
    color: var(--ink-2);
    line-height: 1.5;
  }

  .plugins-detail__settings {
    padding-top: var(--space-4);
    border-top: 1px solid var(--line);
  }
`;
