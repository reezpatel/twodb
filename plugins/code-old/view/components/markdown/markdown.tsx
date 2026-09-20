import { Streamdown } from "streamdown";
import { markdownStyles } from "./markdown.style";

export function Markdown({ children }: { children: string }) {
	return (
		<div className="md">
			<style jsx global>
				{markdownStyles}
			</style>
			<Streamdown>{children}</Streamdown>
		</div>
	);
}
