import { useCallback, useState } from "react";

export function useCodeHeader() {
	const [projectSelectorOpen, setProjectSelectorOpen] = useState(false);

	const openProjectSelector = useCallback(
		() => setProjectSelectorOpen(true),
		[],
	);
	const closeProjectSelector = useCallback(
		() => setProjectSelectorOpen(false),
		[],
	);

	return {
		projectSelectorOpen,
		openProjectSelector,
		closeProjectSelector,
	};
}
