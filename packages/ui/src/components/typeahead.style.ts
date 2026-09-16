import css from "styled-jsx/css";

export const typeaheadStyles = css`
  /* Typeahead — tonal-well input with a lit suggestion popup */

  .tw-typeahead {
    position: relative;
    width: 100%;
  }

  .tw-typeahead__input {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    height: 32px;
    padding: 0 var(--space-3);
    font-family: var(--font-ui);
    font-size: var(--text-md);
    color: var(--ink);
    background: var(--bg-field);
    border: 1px solid transparent;
    border-radius: var(--r-md);
  }

  .tw-typeahead__input:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px var(--ring);
  }

  .tw-typeahead__input:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .tw-typeahead__value {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    font: inherit;
    color: inherit;
  }

  .tw-typeahead__value:focus {
    outline: none;
  }

  .tw-typeahead__value::placeholder {
    color: var(--ink-3);
  }

  .tw-typeahead__spinner {
    width: 14px;
    height: 14px;
    color: var(--ink-3);
    flex-shrink: 0;
    animation: tw-typeahead-spin 0.9s linear infinite;
  }

  .tw-typeahead__popup {
    position: fixed;
    z-index: var(--z-overlay);
    max-height: 240px;
    overflow-y: auto;
    padding: 4px;
    background: var(--surface);
    border: 1px solid var(--line-strong);
    border-radius: var(--r-md);
    box-shadow: var(--shadow-overlay);
    animation: tw-menu-in var(--dur-2) var(--ease-out) both;
    margin: 0;
  }

  .tw-typeahead__option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: 7px 10px;
    border-radius: var(--r-sm);
    font-size: var(--text-md);
    color: var(--ink);
    cursor: pointer;
    transition: background var(--dur-1) var(--ease-out);
  }

  .tw-typeahead__option :global(svg) {
    width: 14px;
    height: 14px;
    color: var(--accent);
    flex-shrink: 0;
  }

  .tw-typeahead__option--active {
    background: var(--bg-band-strong);
  }

  .tw-typeahead__option--selected {
    color: var(--accent);
    font-weight: 600;
  }

  .tw-typeahead__option-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .tw-typeahead__label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tw-typeahead__description {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--text-xs);
    color: var(--ink-3);
  }

  .tw-typeahead__status {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 7px 10px;
    font-size: var(--text-md);
    color: var(--ink-3);
  }

  .tw-typeahead__status :global(svg) {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  @keyframes tw-typeahead-spin {
    to {
      transform: rotate(360deg);
    }
  }
`;
