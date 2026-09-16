import css from "styled-jsx/css";

export const inputStyles = css`
  .tw-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .tw-field__label {
    color: var(--ink-2);
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .tw-field__hint {
    color: var(--ink-3);
    font-size: var(--text-sm);
  }

  .tw-field__error {
    color: var(--danger-ink);
    font-size: var(--text-sm);
  }

  .tw-input {
    box-sizing: border-box;
    height: 36px;
    padding: 0 var(--space-3);
    border: 1px solid transparent;
    border-radius: var(--r-sm);
    background: var(--bg-field);
    color: var(--ink);
    font-family: var(--font-ui);
    font-size: var(--text-md);
    transition:
      background var(--dur-1) var(--ease-out),
      box-shadow var(--dur-1) var(--ease-out);
  }

  .tw-input--sm {
    height: 26px;
    padding: 0 var(--space-2);
    font-size: var(--text-sm);
  }

  .tw-input--lg {
    height: 38px;
    padding: 0 var(--space-4);
    font-size: var(--text-lg);
  }

  .tw-input::placeholder {
    color: var(--ink-3);
  }

  .tw-input:hover:not(:disabled) {
    background: var(--bg-field-hover);
  }

  .tw-input:focus {
    outline: none;
    background: var(--bg-field);
    box-shadow: 0 0 0 3px var(--ring);
  }

  .tw-input[aria-invalid="true"] {
    border-color: var(--danger-ink);
  }

  .tw-input[aria-invalid="true"]:focus {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger-ink) 20%, transparent);
  }

  .tw-input:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;
