import css from "styled-jsx/css";

export const searchInputStyles = css`
  .tw-search {
    position: relative;
    display: block;
    min-width: 0;
  }

  .tw-search > :global(svg) {
    position: absolute;
    left: 11px;
    top: 50%;
    z-index: 1;
    transform: translateY(-50%);
    width: 15px;
    height: 15px;
    color: var(--ink-3);
    pointer-events: none;
    transition: color var(--dur-1) var(--ease-out);
  }

  .tw-search:focus-within > :global(svg) {
    color: var(--accent);
  }

  .tw-search__input {
    appearance: none;
    box-sizing: border-box;
    width: 100%;
    height: 38px;
    padding: 0 var(--space-3) 0 33px;
    border: 1px solid transparent;
    border-radius: var(--r-sm);
    background: var(--bg-field);
    color: var(--ink-3);
    font-family: var(--font-ui);
    font-size: var(--text-md);
    transition:
      background var(--dur-1) var(--ease-out),
      box-shadow var(--dur-1) var(--ease-out);
  }

  .tw-search__input::placeholder {
    color: var(--ink-3);
  }

  .tw-search__input:hover {
    background: var(--bg-field-hover);
  }

  .tw-search__input:focus {
    outline: none;
    background: var(--bg-field);
    box-shadow: 0 0 0 2px var(--ring);
  }

  .tw-search__input[aria-invalid="true"] {
    border-color: var(--danger-ink);
  }

  .tw-search__input[aria-invalid="true"]:focus {
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--danger-ink) 20%, transparent);
  }

  .tw-search__input:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;
