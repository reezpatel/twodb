import {
	createContext,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from "react";
import type {
	ContentNodeDto,
	ContentSchemaColumn,
	ContentViewConfig,
	ContentViewDto,
} from "@twodb/contracts";
import { useQuery } from "@tanstack/react-query";
import { PLUGIN_ID } from "../../shared/constants";
import { schemaApi, viewsApi } from "../api";

export interface SectionContextValue {
	isLoading: boolean;
	section?: ContentNodeDto;
	columns: ContentSchemaColumn[];
	views: ContentViewDto[];
	activeViewConfig: ActiveViewConfig;
	setActiveViewConfig: React.Dispatch<React.SetStateAction<ActiveViewConfig>>;
	openNoteId: string | null;
	setOpenNoteId: (id: string | null) => void;
}

export type ActiveViewConfig = ContentViewConfig & {
	showSearch: boolean;
};

const SectionContext = createContext<SectionContextValue>({
	isLoading: false,
	section: undefined,
	columns: [],
	views: [],
	activeViewConfig: { showSearch: false, type: "list" },
	setActiveViewConfig: () => {},
	openNoteId: null,
	setOpenNoteId: () => {},
});

export function SectionProvider({
	children,
	sectionId,
}: {
	children: ReactNode;
	sectionId: string;
}) {
	const [activeViewConfig, setActiveViewConfig] = useState<ActiveViewConfig>({
		showSearch: false,
		type: "list",
	});
	const [openNoteId, setOpenNoteId] = useState<string | null>(null);

	useEffect(() => {
		setOpenNoteId(null);
	}, [sectionId]);

	const { data: schema, isLoading } = useQuery({
		queryKey: [PLUGIN_ID, "schema", sectionId],
		enabled: !!sectionId,
		queryFn: () => schemaApi.get(sectionId),
	});

	const { data: view } = useQuery({
		queryKey: [PLUGIN_ID, "view", sectionId],
		// TODO: implement pagination
		queryFn: () => viewsApi.list(sectionId),
	});

	return (
		<SectionContext.Provider
			value={{
				isLoading,
				section: schema?.section,
				columns: schema?.columns ?? [],
				views: view?.views ?? [],
				activeViewConfig,
				setActiveViewConfig,
				openNoteId,
				setOpenNoteId,
			}}
		>
			{children}
		</SectionContext.Provider>
	);
}

export function useSection(): SectionContextValue {
	return useContext(SectionContext);
}
