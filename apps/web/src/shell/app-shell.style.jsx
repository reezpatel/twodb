import css from "styled-jsx/css";

export const appShellStyles = css`
	.shell {
		--shell-red: #c2334d;
		--shell-red-bg: rgb(194 51 77 / 0.1);
		--shell-purple: #7c4dcc;
		--shell-purple-bg: rgb(124 77 204 / 0.12);
		--shell-blue: #3563d9;
		--shell-blue-bg: rgb(53 99 217 / 0.1);
		--shell-green: #1e7d46;
		--shell-green-bg: rgb(30 125 70 / 0.12);
		--shell-orange: #e8890c;
		--shell-amber: #d9930d;

		display: grid;
		grid-template-columns: var(--shell-columns, 212px minmax(0, 1fr));
		grid-template-rows: 40px minmax(0, 1fr) 27px;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: var(--bg);
		color: var(--ink);
		font-family: var(--font-ui);
		font-size: var(--text-md);
	}


	.shell[data-phase="night"] {
		--shell-red: #ff8fa5;
		--shell-red-bg: rgb(255 143 165 / 0.12);
		--shell-purple: #c4a5f5;
		--shell-purple-bg: rgb(196 165 245 / 0.14);
		--shell-blue: #8fb0ff;
		--shell-blue-bg: rgb(143 176 255 / 0.14);
		--shell-green: #7fd6a4;
		--shell-green-bg: rgb(127 214 164 / 0.14);
		--shell-orange: #f0b25a;
		--shell-amber: #e8c47a;
	}
`;
