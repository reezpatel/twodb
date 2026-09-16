import { Button } from "@twodb/ui";
import { useCopy } from "../hooks/use-copy.hook";
import { secretRevealStyles } from "./secret-reveal.style";

type SecretRevealProps = {
	plaintext: string;
};

export function SecretReveal({ plaintext }: SecretRevealProps) {
	const { copied, copy } = useCopy();

	return (
		<div className="node-secret">
			<style jsx>{secretRevealStyles}</style>
			<div className="node-secret__warning" role="alert">
				<svg
					width="14"
					height="14"
					viewBox="0 0 16 16"
					aria-hidden="true"
					fill="none"
				>
					<path
						d="M8 1.75 15 14H1L8 1.75Z"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinejoin="round"
					/>
					<path
						d="M8 6v3.5"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
					/>
					<circle cx="8" cy="11.8" r="0.85" fill="currentColor" />
				</svg>
				<div>
					<strong>Save this secret now</strong>
					<p>
						It is shown only once and cannot be recovered. You will not see it
						again.
					</p>
				</div>
			</div>
			<div className="node-secret__value-row">
				<code className="node-secret__value">{plaintext}</code>
				<Button
					variant="secondary"
					size="sm"
					onClick={() => copy(plaintext)}
					aria-label="Copy secret to clipboard"
				>
					{copied ? "Copied" : "Copy"}
				</Button>
			</div>
		</div>
	);
}
