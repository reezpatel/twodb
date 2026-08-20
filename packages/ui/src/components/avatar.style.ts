import css from "styled-jsx/css";

export const avatarStyles = css`
/* Avatar — a soft dawn token for a person */

.tw-avatar {
	position: relative;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	border-radius: var(--r-pill);
	background: var(--bg-band-strong);
	border: 1px solid var(--line);
	color: var(--ink-2);
	font-weight: 600;
	font-size: var(--text-sm);
	letter-spacing: 0.02em;
	user-select: none;
}

.tw-avatar img {
	width: 100%;
	height: 100%;
	object-fit: cover;
	border-radius: var(--r-pill);
}

.tw-avatar--sm {
	width: 24px;
	height: 24px;
	font-size: 10px;
}
.tw-avatar--md {
	width: 32px;
	height: 32px;
	font-size: var(--text-sm);
}
.tw-avatar--lg {
	width: 44px;
	height: 44px;
	font-size: var(--text-lg);
}

/* Presence — a small state light on the bottom-right edge,
   ringed with the surface so it reads over the photo. */
.tw-avatar__presence {
	position: absolute;
	right: -1px;
	bottom: -1px;
	width: 25%;
	min-width: 8px;
	aspect-ratio: 1;
	border-radius: var(--r-pill);
	box-shadow: 0 0 0 2px var(--surface);
}

.tw-avatar--sm .tw-avatar__presence {
	min-width: 7px;
}
.tw-avatar--lg .tw-avatar__presence {
	min-width: 11px;
}

.tw-avatar__presence--online {
	background: #12b76a;
}
.tw-avatar__presence--away {
	background: #f79009;
}
.tw-avatar__presence--busy {
	background: #f04438;
}
.tw-avatar__presence--offline {
	background: var(--ink-3);
}
`;
