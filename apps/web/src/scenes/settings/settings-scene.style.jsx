import css from "styled-jsx/css";

export const settingsSceneStyles = css`
	.settings__empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		margin-top: var(--space-8);
		padding: var(--space-7);
		border: 1px dashed var(--line);
		border-radius: var(--r-md);
		text-align: center;
	}

	.settings__empty h3 {
		margin: 0;
		font-size: var(--text-md);
		font-weight: 600;
		color: var(--ink-2);
	}

	.settings__empty p {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--ink-3);
	}
`;
