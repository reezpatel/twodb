import { createContext, useContext, type ReactNode } from "react";
import type { ContentNodeDto } from "@twodb/contracts";
import { useTree } from "../hooks/use-tree.hook";

export interface ContentContextValue {
	nodes: ContentNodeDto[];
	isLoading: boolean;
	sections: ContentNodeDto[];
}

const ContentContext = createContext<ContentContextValue>({
	nodes: [],
	isLoading: true,
	sections: [],
});

export function TwoDbContentProvider({ children }: { children: ReactNode }) {
	const tree = useTree();
	const nodes = tree.data ?? [];
	return (
		<ContentContext.Provider
			value={{
				nodes,
				isLoading: tree.isLoading,
				sections: nodes.filter((n) => n.type === "section"),
			}}
		>
			{children}
		</ContentContext.Provider>
	);
}

export function useTwoDbContent(): ContentContextValue {
	return useContext(ContentContext);
}
