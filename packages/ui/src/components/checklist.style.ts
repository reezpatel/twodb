import css from "styled-jsx/css";

export const checklistStyles = css`
.tw-checklist {
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.tw-checkitem {
	position: relative;
	display: flex;
	align-items: center;
	gap: 10px;
	min-width: 0;
	padding: 8px 2px;
	color: var(--ink);
	cursor: pointer;
	user-select: none;
}

.tw-checkitem__input {
	position: absolute;
	inset: 0;
	margin: 0;
	opacity: 0;
	cursor: pointer;
}

.tw-checkitem__box {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 16px;
	height: 16px;
	flex-shrink: 0;
	padding: 0;
	border: 1.5px solid var(--line-strong);
	border-radius: 4px;
	background: transparent;
	box-sizing: border-box;
	color: var(--accent-ink);
	transition:
		border-color var(--dur-1) var(--ease-out),
		background var(--dur-1) var(--ease-out),
		box-shadow var(--dur-1) var(--ease-out),
		transform var(--dur-1) var(--ease-out);
}

.tw-checkitem__mark {
	width: 11px;
	height: 11px;
	opacity: 0;
	transform: scale(0.75);
	transition:
		opacity var(--dur-1) var(--ease-out),
		transform var(--dur-1) var(--ease-out);
}

.tw-checkitem__content {
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 0;
}

.tw-checkitem__label {
	font-size: var(--text-md);
	line-height: 1.35;
	color: var(--ink);
	transition:
		color var(--dur-1) var(--ease-out),
		text-decoration-color var(--dur-1) var(--ease-out);
}

.tw-checkitem__description {
	font-size: var(--text-sm);
	line-height: 1.35;
	color: var(--ink-3);
}

.tw-checkitem--p1 .tw-checkitem__box {
	border-color: var(--danger-ink);
}

.tw-checkitem--p2 .tw-checkitem__box {
	border-color: var(--warning-ink);
}

.tw-checkitem--p3 .tw-checkitem__box {
	border-color: var(--accent);
}

.tw-checkitem:hover .tw-checkitem__box {
	border-color: var(--accent);
}

.tw-checkitem__input:checked + .tw-checkitem__box,
.tw-checkitem__input:indeterminate + .tw-checkitem__box {
	border-color: var(--accent);
	background: var(--accent);
}

.tw-checkitem__input:checked + .tw-checkitem__box .tw-checkitem__mark,
.tw-checkitem__input:indeterminate + .tw-checkitem__box .tw-checkitem__mark {
	opacity: 1;
	transform: scale(1);
}

.tw-checkitem__input:focus-visible + .tw-checkitem__box {
	box-shadow: 0 0 0 3px var(--ring);
}

.tw-checkitem__input:active + .tw-checkitem__box {
	transform: scale(0.94);
}

.tw-checkitem__input:checked ~ .tw-checkitem__content .tw-checkitem__label {
	color: var(--ink-3);
	text-decoration: line-through;
	text-decoration-color: var(--line-strong);
}

.tw-checkitem__input:disabled {
	cursor: not-allowed;
}

.tw-checkitem:has(.tw-checkitem__input:disabled) {
	cursor: not-allowed;
	opacity: 0.48;
}
`;
