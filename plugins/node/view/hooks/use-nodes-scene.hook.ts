import { useCallback, useState } from "react";
import { useSearchParams } from "react-router";
import { useNodes } from "./use-nodes.hook";

export function useNodesScene() {
	const nodes = useNodes();
	const [searchParams, setSearchParams] = useSearchParams();
	const [createOpen, setCreateOpen] = useState(false);

	const selectedId = searchParams.get("node");

	const select = useCallback(
		(id: string | null) => {
			setSearchParams(
				(prev) => {
					const next = new URLSearchParams(prev);
					if (id) next.set("node", id);
					else next.delete("node");
					return next;
				},
				{ replace: true },
			);
		},
		[setSearchParams],
	);

	const onlineCount =
		nodes.data?.filter((node) => node.status === "online").length ?? 0;

	return {
		nodes,
		selectedId,
		select,
		createOpen,
		setCreateOpen,
		onlineCount,
	};
}
