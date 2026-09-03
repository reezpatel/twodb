import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { customBlockViewStyles } from "./custom-block-view.style";
import type { CustomBlockOptions } from "./custom-block";

export function CustomBlockView({ node, extension }: NodeViewProps) {
	const name = String(node.attrs.name ?? "");
	let props: Record<string, unknown> = {};
	try {
		props = JSON.parse(String(node.attrs.props ?? "{}"));
	} catch {
		props = {};
	}

	const components = (extension.options as CustomBlockOptions).components;
	const Cmp = components[name];

	return (
		<NodeViewWrapper className="tw-block">
			<style jsx>{customBlockViewStyles}</style>
			{Cmp ? (
				<Cmp {...props} />
			) : (
				<div className="tw-block__fallback">
					<span className="tw-block__badge">{name || "block"}</span>
					<span className="tw-block__note">Unknown custom block</span>
				</div>
			)}
		</NodeViewWrapper>
	);
}
