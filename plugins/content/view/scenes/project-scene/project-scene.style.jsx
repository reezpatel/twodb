import css from "styled-jsx/css";

export const projectSceneStyles = css`
  .project-scene {
    grid-column: 2 / -1;
    grid-row: 1 / 3;
    display: grid;
    grid-template-rows: 40px auto minmax(0, 1fr);
    min-width: 0;
    min-height: 0;
    background: var(--bg);
  }

  .project-scene__body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 280px;
    min-width: 0;
    min-height: 0;
  }

  .project-scene__main {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .project-scene__tabs {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 0 24px 12px;
    border-bottom: 1px solid var(--line);
  }

  .project-scene__tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 0;
    border: 0;
    background: transparent;
    color: var(--ink-2);
    font: inherit;
    font-size: var(--text-sm);
    cursor: pointer;
    position: relative;
  }

  .project-scene__tab:hover {
    color: var(--ink);
  }

  .project-scene__tab.is-active {
    color: var(--ink);
    font-weight: 500;
  }

  .project-scene__tab.is-active::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: -12px;
    height: 2px;
    background: var(--accent);
    border-radius: 1px;
  }

  .project-scene__tab-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 18px;
    padding: 0 6px;
    border-radius: var(--r-sm);
    background: var(--bg-band);
    font-size: 11px;
    font-weight: 600;
    color: var(--ink-2);
  }

  .project-scene__table {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .project-scene__table-head {
    display: grid;
    grid-template-columns: minmax(300px, 1fr) 110px 100px 100px;
    gap: 8px;
    align-items: center;
    padding: 10px 24px;
    border-bottom: 1px solid var(--line);
    background: var(--bg-band);
    font-family: var(--font-cue);
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: var(--tracking-cue);
    text-transform: uppercase;
    color: var(--ink-3);
  }

  .project-scene__table-body {
    display: flex;
    flex-direction: column;
  }

  .project-scene__empty {
    padding: var(--space-6) var(--space-3);
    color: var(--ink-3);
    font-size: var(--text-sm);
    text-align: center;
  }

  @media (max-width: 900px) {
    .project-scene__body {
      grid-template-columns: minmax(0, 1fr);
    }

    .project-scene__body > :global(aside) {
      display: none;
    }
  }
`;
