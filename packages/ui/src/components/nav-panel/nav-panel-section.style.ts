import css from "styled-jsx/css";

export const navPanelSectionStyles = css`
  .tw-navpanel__section {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: var(--space-1) 8px 3px;
  }

  .tw-navpanel__sectionlabel {
    font-family: var(--font-cue);
    font-size: 10px;
    font-weight: 550;
    letter-spacing: var(--tracking-narrow);
    text-transform: uppercase;
    color: var(--ink-3);
  }

  .tw-navpanel__sectionmeta {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
    font-size: var(--text-xs);
    color: var(--ink-3);
    text-align: right;
  }

  .tw-navpanel__sectiontools {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .tw-navpanel__sectionadd {
    display: grid;
    place-items: center;
    width: 17px;
    height: 17px;
    border: 0;
    border-radius: var(--r-sm);
    background: transparent;
    color: var(--ink-3);
    cursor: pointer;
    padding: 0;
  }

  .tw-navpanel__sectionadd:hover {
    background: var(--bg-band-strong);
    color: var(--ink);
  }
`;
