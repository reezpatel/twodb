import css from "styled-jsx/css";

export const skeletonStyles = css`
/* Skeleton — the band warming up before the content arrives */

.tw-skeleton {
  border-radius: var(--r-sm);
  background: linear-gradient(
    90deg,
    var(--bg-band) 25%,
    var(--bg-band-strong) 50%,
    var(--bg-band) 75%
  );
  background-size: 200% 100%;
  animation: tw-skeleton-warm 1.4s var(--ease-out) infinite;
}

@keyframes tw-skeleton-warm {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .tw-skeleton { animation: none; }
}
`;
