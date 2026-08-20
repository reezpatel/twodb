import css from "styled-jsx/css";

export const noteMarkerStyles = css`
  .shell__mark {
    flex: none;
  }

  .shell__mark--orange {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--shell-orange);
  }

  .shell__mark--glyph {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: var(--r-sm);
    background: var(--bg-band-strong);
    color: var(--ink-2);
    font-size: 14px;
  }

  .shell__mark--image {
    width: 15px;
    height: 15px;
    border-radius: var(--r-sm);
    background:
      linear-gradient(135deg, var(--shell-blue-bg), var(--shell-purple-bg)),
      var(--bg-band-strong);
    box-shadow: inset 0 0 0 1px var(--line);
  }
`;
