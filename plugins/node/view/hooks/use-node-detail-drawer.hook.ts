import { useEffect, useState } from "react";
import { useNodeDetail } from "./use-node-detail.hook";
import { useNodeMutations } from "./use-node-mutations.hook";
import type { RevealedSecret } from "../lib/types";

export function useNodeDetailDrawer(nodeId: string | null) {
	const detail = useNodeDetail(nodeId);
	const { rename, remove, createSecret, revokeSecret } = useNodeMutations();
	const [revealed, setRevealed] = useState<RevealedSecret | null>(null);

	useEffect(() => {
		setRevealed(null);
	}, [nodeId]);

	return {
		detail,
		rename,
		remove,
		createSecret,
		revokeSecret,
		revealed,
		setRevealed,
	};
}
