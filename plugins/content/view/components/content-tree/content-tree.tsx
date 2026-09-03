import { useMemo } from "react";
import { useNavigate } from "react-router";
import {
	NavPanelSection,
	NavPanelTree,
	type NavPanelTreeNode,
} from "@twodb/ui";
import type { ContentNodeDto } from "@twodb/contracts";
import { useTree } from "../../hooks/use-tree.hook";
import { useTreeMutations } from "../../hooks/use-tree-mutations.hook";

function toTreeNodes(nodes: ContentNodeDto[]): NavPanelTreeNode[] {
	const byParent = new Map<string | null, ContentNodeDto[]>();
	for (const node of nodes) {
		const list = byParent.get(node.parent_id) ?? [];
		list.push(node);
		byParent.set(node.parent_id, list);
	}
	const build = (parent: string | null): NavPanelTreeNode[] =>
		(byParent.get(parent) ?? [])
			.sort((a, b) => a.position - b.position)
			.map((node) => {
				const children = build(node.id);
				return {
					id: node.id,
					name: node.name,
					// Empty children would mark the node as an internal folder.
					...(children.length > 0 ? { children } : {}),
				};
			});
	return build(null);
}

export function ContentTree() {
	const tree = useTree();
	const { create } = useTreeMutations();
	const navigate = useNavigate();
	const nodes = tree.data ?? [];
	const data = useMemo(() => toTreeNodes(nodes), [nodes]);
	const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

	const handleAdd = () => {
		create.mutate(
			{ type: "section", name: "Untitled" },
			{
				onSuccess: ({ node }) => navigate(`/notes/${node.identifier}`),
			},
		);
	};

	// NavPanelTree (react-arborist) captures initialData at mount — don't
	// render until the tree has loaded, and remount when the dataset changes.
	if (!tree.data) return null;
	const treeKey = nodes
		.map((n) => `${n.id}:${n.name}:${n.parent_id}`)
		.join("|");

	return (
		<div>
			<NavPanelSection label="Content" onAdd={handleAdd} />
			<NavPanelTree
				key={treeKey}
				ariaLabel="Content"
				initialData={data}
				onPick={(id) => {
					const node = byId.get(id);
					if (node?.type === "section") {
						navigate(`/notes/${node.identifier}`);
					}
				}}
			/>
		</div>
	);
}
