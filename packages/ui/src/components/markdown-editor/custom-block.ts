import type { ComponentType } from "react";
import { Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CustomBlockView } from "./custom-block-view";

export interface CustomBlockOptions {
	/** React renderers by component name (slash items + ::directive blocks). */
	components: Record<string, ComponentType<Record<string, unknown>>>;
}

declare module "@tiptap/core" {
	interface Commands<ReturnType> {
		customBlock: {
			/** Insert a custom component block, e.g. insertCustomBlock({ name: "map" }) */
			insertCustomBlock: (attrs: {
				name: string;
				props?: Record<string, unknown>;
			}) => ReturnType;
		};
	}
}

/** Markdown identity: a one-line directive — ::map{"lat":12.97,"lng":77.59} */
const DIRECTIVE_RE = /^::([a-z][a-z0-9-]*)(\{.*\})?\s*$/;

export const CustomBlock = Node.create<CustomBlockOptions>({
	name: "customBlock",
	group: "block",
	atom: true,
	selectable: true,

	addOptions() {
		return { components: {} };
	},

	addAttributes() {
		return {
			name: { default: "" },
			/** Component props, kept as a JSON string for round-trip fidelity. */
			props: { default: "{}" },
		};
	},

	parseHTML() {
		return [
			{
				tag: "div[data-custom-block]",
				getAttrs: (el) => ({
					name: el.dataset.customBlock ?? "",
					props: el.dataset.props ?? "{}",
				}),
			},
		];
	},

	renderHTML({ node, HTMLAttributes }) {
		return [
			"div",
			{
				...HTMLAttributes,
				"data-custom-block": node.attrs.name,
				"data-props": node.attrs.props,
			},
		];
	},

	addCommands() {
		return {
			insertCustomBlock:
				(attrs) =>
				({ commands }) =>
					commands.insertContent({
						type: this.name,
						attrs: {
							name: attrs.name,
							props: JSON.stringify(attrs.props ?? {}),
						},
					}),
		};
	},

	addNodeView() {
		return ReactNodeViewRenderer(CustomBlockView);
	},
});

// @tiptap/markdown reads these from the extension config; they aren't part
// of the typed NodeConfig, so attach them after creation (configure()
// shallow-copies config, so they survive into the configured child).
Object.assign(CustomBlock.config, {
	markdownTokenName: "customBlock",

	markdownTokenizer: {
		name: "customBlock",
		level: "block",
		start: (src: string) => src.indexOf("::"),
		tokenize: (src: string) => {
			const match = src.match(DIRECTIVE_RE);
			if (!match) return undefined;
			return {
				type: "customBlock",
				raw: match[0],
				name: match[1],
				props: match[2] ?? "{}",
			};
		},
	},

	parseMarkdown: (token: { name: string; props: string }) => ({
		type: "customBlock",
		attrs: { name: token.name, props: token.props },
	}),

	renderMarkdown: (node: { attrs: { name: string; props: string } }) =>
		`::${node.attrs.name}${
			node.attrs.props && node.attrs.props !== "{}" ? node.attrs.props : ""
		}`,
});
