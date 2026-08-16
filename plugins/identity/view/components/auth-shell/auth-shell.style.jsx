import css from "styled-jsx/css";

export const authShellStyles = css.global`
  .auth {
    display: grid;
    place-items: center;
    min-height: 100dvh;
    padding: var(--space-5);
    background: var(--bg);
  }

  .auth__sheet {
    display: grid;
    grid-template-columns: minmax(420px, 1fr) 1fr;
    width: min(1120px, 100%);
    min-height: 620px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-lg);
    overflow: hidden;
  }

  /* --- working half --- */
  .auth__panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    padding: var(--space-7);
  }

  .auth__wordmark {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-family: var(--font-cue);
    font-size: var(--text-lg);
    font-weight: 400;
    letter-spacing: var(--tracking-narrower);
    color: var(--ink);
    text-decoration: none;
  }

  .auth__body {
    margin: auto 0;
    display: grid;
    gap: var(--space-5);
  }

  .auth__panel header {
    display: grid;
    gap: var(--space-1);
  }

  .auth__panel h1 {
    margin: 0;
    font-size: var(--text-xl);
    font-weight: 500;
    line-height: 1.1;
    letter-spacing: var(--tracking-narrowest);
    text-wrap: balance;
  }

  .auth__panel p.lede {
    margin: 0;
    color: var(--ink-3);
    line-height: 1.55;
    max-width: 38ch;
    font-size: var(--text-md);
  }

  .auth__panel form {
    display: grid;
    gap: var(--space-4);
  }

  /* --- the ledger: fields as ruled rows, no boxes --- */
  .auth__ledger {
    display: grid;
  }

  /* re-grid the standard tw-field: label left, control flush right */
  .auth__panel .auth__ledger .tw-field {
    display: grid;
    grid-template-columns: 128px 1fr;
    align-items: baseline;
    gap: var(--space-1) var(--space-3);
    padding: var(--space-3) 0;
    // border-top: 1px solid var(--line-strong);
  }

  .auth__panel .auth__ledger .tw-field:last-child {
    // border-bottom: 1px solid var(--line-strong);
  }

  .auth__panel .auth__ledger .tw-field__label {
    font-family: var(--font-cue);
    letter-spacing: var(--tracking-narrower);
    color: var(--ink-1);
  }

  .auth__panel .auth__ledger .tw-field__hint,
  .auth__panel .auth__ledger .tw-field__error {
    grid-column: 2;
    font-size: var(--text-xs);
  }

  .auth__actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }

  .auth__switch-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--space-3);
    padding-top: var(--space-4);
    border-top: 1px solid var(--line);
    color: var(--ink-3);
    font-size: var(--text-sm);
  }

  .auth__switch-row a {
    color: var(--accent);
    text-decoration: none;
    font-weight: 550;
  }

  .auth__switch-row a:hover {
    text-decoration: underline;
  }

  .auth__panel p.alert {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    background: var(--danger-bg);
    color: var(--danger-ink);
    border-radius: var(--r-sm);
    font-size: var(--text-sm);
  }

  .auth__panel p.hint {
    margin: 0;
    color: var(--ink-3);
    font-size: var(--text-sm);
  }

  /* --- brand half: the dawn field --- */
  .auth__brand {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--space-6);
    padding: var(--space-7);
    background: var(--bg-band);
    border-left: 1px solid var(--line);
  }

  .auth__horizon {
    width: 100%;
    height: auto;
    display: block;
  }

  .auth__brand-copy {
    display: grid;
    gap: var(--space-3);
  }

  .auth__brand-copy h2 {
    margin: 0;
    font-size: var(--text-2xl);
    font-weight: 500;
    line-height: 1.2;
    letter-spacing: -0.01em;
    text-wrap: balance;
    max-width: 22ch;
  }

  .auth__brand-copy > p {
    margin: 0;
    color: var(--ink-2);
    line-height: 1.55;
    max-width: 46ch;
    font-size: var(--text-lg);
  }

  .auth__capabilities {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
  }

  .auth__capabilities li {
    display: grid;
    grid-template-columns: 96px 1fr;
    align-items: baseline;
    gap: var(--space-4);
    padding: var(--space-3) 0;
    border-top: 1px solid var(--line);
  }

  .auth__capabilities li:last-child {
    border-bottom: 1px solid var(--line);
  }

  .auth__capabilities strong {
    font-family: var(--font-cue);
    font-size: var(--text-xxs);
    font-weight: 600;
    letter-spacing: var(--tracking-narrower);
    text-transform: uppercase;
    color: var(--ink);
  }

  .auth__capabilities span {
    font-size: var(--text-sm);
    color: var(--ink-3);
    line-height: 1.5;
  }

  .wash-a {
    stop-color: var(--twdb-cobalt);
  }

  .wash-b {
    stop-color: var(--twdb-rose);
  }

  .wash-c {
    stop-color: var(--twdb-rose-light);
  }

  @media (max-width: 880px) {
    .auth {
      padding: var(--space-4);
    }

    .auth__sheet {
      grid-template-columns: 1fr;
      max-width: 480px;
      min-height: 0;
    }

    .auth__brand {
      display: none;
    }

    .auth__panel {
      padding: var(--space-6);
    }

    .auth__panel .auth__ledger .tw-field {
      grid-template-columns: 1fr;
    }

    .auth__panel .auth__ledger .tw-field__hint,
    .auth__panel .auth__ledger .tw-field__error {
      grid-column: 1;
    }
  }
`;
