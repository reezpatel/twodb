import css from "styled-jsx/css";

export const fieldStyles = css`
  /* Fields — muted tonal wells; focus is a ring of light. */

  .tw-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .tw-field__label {
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-2);
  }

  .tw-field__hint {
    font-size: var(--text-sm);
    color: var(--ink-3);
  }

  .tw-field__error {
    font-size: var(--text-sm);
    color: var(--danger-ink);
  }

  .tw-input,
  .tw-textarea {
    font-family: var(--font-ui);
    font-size: var(--text-md);
    color: var(--ink);
    background: var(--bg-field);
    border: 1px solid transparent;
    border-radius: var(--r-sm);
    height: 32px;
    padding: 0 var(--space-3);
    transition:
      background var(--dur-1) var(--ease-out),
      box-shadow var(--dur-1) var(--ease-out);
  }

  .tw-textarea {
    height: auto;
    min-height: 84px;
    padding: 10px var(--space-3);
    resize: vertical;
    line-height: 1.5;
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

  .tw-input::placeholder,
  .tw-textarea::placeholder {
    color: var(--ink-3);
  }

  .tw-input:hover,
  .tw-textarea:hover,
  .tw-select__trigger:hover {
    background: var(--bg-field-hover);
  }

  .tw-input:focus,
  .tw-textarea:focus {
    outline: none;
    background: var(--bg-field);
    box-shadow: 0 0 0 3px var(--ring);
  }

  .tw-input[aria-invalid="true"],
  .tw-textarea[aria-invalid="true"] {
    border-color: var(--danger-ink);
  }
  .tw-input[aria-invalid="true"]:focus,
  .tw-textarea[aria-invalid="true"]:focus {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger-ink) 20%, transparent);
  }

  /* Select — custom listbox: tonal-well trigger, lit popup panel */

  .tw-select {
    position: relative;
    width: 100%;
  }

  .tw-select__trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
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
    cursor: pointer;
    transition:
      background var(--dur-1) var(--ease-out),
      box-shadow var(--dur-1) var(--ease-out);
  }

  .tw-select__trigger:focus-visible,
  .tw-select__trigger[aria-expanded="true"] {
    outline: none;
    box-shadow: 0 0 0 3px var(--ring);
  }

  .tw-select__trigger[aria-invalid="true"] {
    border-color: var(--danger-ink);
  }

  .tw-select__trigger:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .tw-select__value {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tw-select__value--placeholder {
    color: var(--ink-3);
  }

  .tw-select__chevron {
    width: 15px;
    height: 15px;
    color: var(--ink-3);
    flex-shrink: 0;
    transition: transform var(--dur-1) var(--ease-out);
  }

  .tw-select__trigger[aria-expanded="true"] .tw-select__chevron {
    transform: rotate(180deg);
  }

  .tw-select__popup {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(100% + 6px);
    z-index: var(--z-overlay);
    max-height: 240px;
    overflow-y: auto;
    padding: 4px;
    background: var(--surface);
    border: 1px solid var(--line-strong);
    border-radius: var(--r-md);
    box-shadow: var(--shadow-overlay);
    animation: tw-menu-in var(--dur-2) var(--ease-out) both;
  }

  .tw-select__popup--top {
    top: auto;
    bottom: calc(100% + 6px);
  }

  .tw-select__option {
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

  .tw-select__option :global(svg) {
    width: 14px;
    height: 14px;
    color: var(--accent);
    flex-shrink: 0;
  }

  .tw-select__option--active {
    background: var(--bg-band-strong);
  }

  .tw-select__option--selected {
    color: var(--accent);
    font-weight: 600;
  }

  .tw-choice {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-md);
    color: var(--ink);
    cursor: pointer;
    user-select: none;
  }

  .tw-checkbox-choice {
    align-items: flex-start;
    gap: 8px;
    font-size: var(--text-sm);
    line-height: 1.35;
    color: var(--ink-2);
  }

  .tw-checkbox {
    position: relative;
    display: inline-flex;
    width: 16px;
    height: 16px;
    margin-top: 1px;
    flex-shrink: 0;
  }

  .tw-checkbox input {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  .tw-checkbox__box {
    display: grid;
    place-items: center;
    width: 16px;
    height: 16px;
    border: 1px solid var(--line-strong);
    border-radius: var(--r-sm);
    background: var(--surface);
    box-sizing: border-box;
    color: var(--accent-ink);
    pointer-events: none;
    transition:
      background var(--dur-1) var(--ease-out),
      border-color var(--dur-1) var(--ease-out),
      box-shadow var(--dur-1) var(--ease-out),
      transform var(--dur-1) var(--ease-out);
  }

  .tw-checkbox-choice:hover .tw-checkbox__box,
  .tw-choice:hover .tw-checkbox__box {
    border-color: var(--ink-3);
  }

  .tw-checkbox input:checked + .tw-checkbox__box,
  .tw-checkbox input:indeterminate + .tw-checkbox__box {
    background: var(--go);
    border-color: var(--go);
  }

  .tw-checkbox input:focus-visible + .tw-checkbox__box {
    box-shadow: 0 0 0 3px var(--ring);
  }

  .tw-checkbox input:active + .tw-checkbox__box {
    transform: scale(0.94);
  }

  .tw-checkbox input:disabled + .tw-checkbox__box,
  .tw-checkbox input:disabled ~ .tw-checkbox__label {
    opacity: 0.45;
  }

  .tw-checkbox input:disabled {
    cursor: not-allowed;
  }

  .tw-checkbox__label {
    min-width: 0;
  }

  .tw-checkbox__mark,
  .tw-checkbox__dash {
    grid-area: 1 / 1;
    width: 11px;
    height: 11px;
  }

  .tw-checkbox__mark path {
    stroke-dasharray: 12;
    stroke-dashoffset: 12;
    transition: stroke-dashoffset var(--dur-2) var(--ease-out);
  }

  .tw-checkbox input:checked + .tw-checkbox__box .tw-checkbox__mark path {
    stroke-dashoffset: 0;
  }

  .tw-checkbox__dash path {
    opacity: 0;
    transition: opacity var(--dur-1) var(--ease-out);
  }

  .tw-checkbox input:indeterminate + .tw-checkbox__box .tw-checkbox__dash path {
    opacity: 1;
  }

  /* Radio — the lit dot */

  .tw-radio {
    appearance: none;
    width: 17px;
    height: 17px;
    flex-shrink: 0;
    margin: 0;
    background: var(--surface);
    border: 1px solid var(--line-strong);
    border-radius: var(--r-pill);
    cursor: pointer;
    transition:
      background var(--dur-1) var(--ease-out),
      border-color var(--dur-1) var(--ease-out),
      box-shadow var(--dur-1) var(--ease-out);
  }

  .tw-radio:hover {
    border-color: var(--ink-3);
  }

  .tw-radio:checked {
    border: 5.5px solid var(--action);
  }

  .tw-radio:focus-visible,
  .tw-switch:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px var(--ring);
  }

  .tw-radio:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  /* Switch — the track itself lights flat cobalt when on */
  .tw-switch {
    appearance: none;
    position: relative;
    width: 38px;
    height: 21px;
    flex-shrink: 0;
    margin: 0;
    background: var(--bg-band-strong);
    border: 1px solid var(--line-strong);
    border-radius: var(--r-pill);
    box-sizing: border-box;
    cursor: pointer;
    transition:
      background var(--dur-2) var(--ease-out),
      border-color var(--dur-2) var(--ease-out),
      box-shadow var(--dur-1) var(--ease-out);
  }

  .tw-switch::after {
    content: "";
    position: absolute;
    top: 1px;
    left: 1px;
    width: 15px;
    height: 15px;
    border-radius: var(--r-pill);
    background: #ffffff;
    border: 1px solid var(--line-strong);
    transition: transform var(--dur-2) var(--ease-out);
  }

  .tw-switch:checked {
    background: var(--action);
    border-color: transparent;
  }

  .tw-switch:checked::after {
    transform: translateX(17px);
  }

  .tw-switch:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  /* PasswordInput — the eye sits inside the field */

  .tw-pass {
    position: relative;
    display: block;
  }

  .tw-pass > .tw-input {
    width: 100%;
    padding-right: 40px;
  }

  .tw-pass > :global(.tw-icon-btn) {
    position: absolute;
    right: 3px;
    top: 50%;
    transform: translateY(-50%);
  }

  /* CodeInput — a row of boxes, one digit each */

  .tw-codeinput {
    display: flex;
    gap: var(--space-2);
  }

  .tw-codeinput__box {
    width: 40px;
    height: 46px;
    text-align: center;
    font-family: var(--font-ui);
    font-size: var(--text-xl);
    font-weight: 600;
    color: var(--ink);
    background: var(--bg-field);
    border: 1px solid transparent;
    border-radius: var(--r-md);
    caret-color: var(--accent);
    transition:
      background var(--dur-1) var(--ease-out),
      box-shadow var(--dur-1) var(--ease-out);
  }

  .tw-codeinput__box:hover {
    background: var(--bg-field-hover);
  }

  .tw-codeinput__box:focus {
    outline: none;
    box-shadow: 0 0 0 3px var(--ring);
  }

  .tw-codeinput--error .tw-codeinput__box {
    border-color: var(--danger-ink);
  }

  .tw-codeinput--error .tw-codeinput__box:focus {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger-ink) 20%, transparent);
  }
`;
