import css from "styled-jsx/css";

export const tagChipStyles = css`
  .tw-tag-chip {
    --tw-tag-chip-color: var(--accent);
    --tw-tag-chip-bg: color-mix(
      in srgb,
      var(--tw-tag-chip-color) 12%,
      transparent
    );
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2.5px 8px;
    border-radius: var(--r-sm);
    background: var(--tw-tag-chip-bg);
    color: var(--tw-tag-chip-color);
    font-size: var(--text-xs);
    font-weight: 400;
    white-space: nowrap;
  }

  .tw-tag-chip :global(svg) {
    width: 10px;
    height: 10px;
    flex: none;
  }
`;
