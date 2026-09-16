import css from "styled-jsx/css";

export const emptyStateStyles = css`
  .tw-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 240px;
    padding: var(--space-7) var(--space-5);
    border: 1px solid var(--line);
    border-radius: var(--r-lg);
    background: var(--surface);
    color: var(--ink);
    text-align: center;
    gap: 12px;
  }

  .tw-empty__icon {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    margin-bottom: var(--space-4);
    border-radius: var(--r-sm);
    background: var(--bg-band-strong);
    color: var(--ink-2);
  }

  .tw-empty--accent .tw-empty__icon {
    border-color: color-mix(in srgb, var(--accent) 22%, var(--line));
    background: var(--accent-soft-bg);
    color: var(--accent);
  }

  .tw-empty__icon :global(svg) {
    width: 22px;
    height: 22px;
  }

  .tw-empty__title {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: 500;
    line-height: 1.25;
    color: var(--ink);
  }

  .tw-empty__description {
    max-width: 48ch;
    margin-top: var(--space-2);
    color: var(--ink-2);
    font-size: var(--text-md);
    line-height: 1.45;
  }

  .tw-empty__description > :first-child {
    margin-top: 0;
  }

  .tw-empty__description > :last-child {
    margin-bottom: 0;
  }

  .tw-empty__action {
    margin-top: var(--space-4);
  }

  @media (max-width: 520px) {
    .tw-empty {
      min-height: 220px;
      padding: var(--space-6) var(--space-4);
    }
  }
`;
