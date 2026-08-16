import css from "styled-jsx/css";

const loaderStyles = css`
	.loader {
		display: grid;
		place-items: center;
		min-height: 100dvh;
		background: var(--bg);
	}

	.loader__mark {
		display: grid;
		justify-items: center;
		gap: var(--space-4);
		color: var(--ink);
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

	.loader__line {
		width: 120px;
		height: 1px;
		background: var(--line);
		overflow: hidden;
	}

	.loader__line::after {
		content: "";
		display: block;
		width: 40%;
		height: 100%;
		background: var(--wash);
		animation: loader-sweep 1.2s var(--ease-out) infinite;
	}

	@keyframes loader-sweep {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(300%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.loader__line::after {
			animation: none;
			width: 100%;
		}
	}
`;

export function FullPageLoader() {
	return (
		<div className="loader" role="status" aria-label="Loading">
			<style jsx>{loaderStyles}</style>
			<div className="loader__mark">
				<svg
					width={28}
					height={28}
					viewBox="0 0 24 24"
					fill="none"
					aria-hidden="true"
				>
					<defs>
						<linearGradient id="twdb-loader-wash" x1="0" y1="1" x2="1" y2="0">
							<stop offset="0" className="wash-a" />
							<stop offset="0.55" className="wash-b" />
							<stop offset="1" className="wash-c" />
						</linearGradient>
					</defs>
					<path
						d="M6 15a6 6 0 0 1 12 0"
						stroke="url(#twdb-loader-wash)"
						strokeWidth="1.6"
						strokeLinecap="round"
					/>
					<line
						x1="3"
						y1="15"
						x2="21"
						y2="15"
						stroke="currentColor"
						strokeWidth="1.4"
						strokeLinecap="round"
					/>
					<line
						x1="7"
						y1="19"
						x2="17"
						y2="19"
						stroke="currentColor"
						strokeWidth="1.4"
						strokeLinecap="round"
						opacity="0.45"
					/>
				</svg>
				<div className="loader__line" />
			</div>
		</div>
	);
}
