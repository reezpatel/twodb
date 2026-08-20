import { createContext, useContext, useState, type ReactNode } from "react";
import type {
  ContentNodeDto,
  ContentRowDto,
  ContentViewConfig,
  ContentViewDto,
} from "@twodb/contracts";
import { useTree } from "../hooks/use-tree.hook";
import { useQuery } from "@tanstack/react-query";
import { PLUGIN_ID } from "../../shared/constants";
import { rowsApi, schemaApi, viewsApi } from "../api";

export interface SectionContextValue {
  isLoading: boolean;
  section?: ContentNodeDto;
  views: ContentViewDto[];
  activeViewConfig: ActiveViewConfig;
  setActiveViewConfig: React.Dispatch<React.SetStateAction<ActiveViewConfig>>;
}

export type ActiveViewConfig = ContentViewConfig & {
  showSearch: boolean;
};

const SectionContext = createContext<SectionContextValue>({
  isLoading: false,
  section: undefined,
  views: [],
  activeViewConfig: { showSearch: false, type: "list" },
  setActiveViewConfig: () => {},
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

  const { data: section, isLoading } = useQuery({
    queryKey: [PLUGIN_ID, "schema", sectionId],
    enabled: !!sectionId,
    queryFn: () => schemaApi.get(sectionId),
  });

  const { data: view, isLoading: isViewLoading } = useQuery({
    queryKey: [PLUGIN_ID, "view", sectionId],
    // TODO: implement pagination
    queryFn: () => viewsApi.list(sectionId),
  });

  return (
    <SectionContext.Provider
      value={{
        isLoading,
        section: section?.section,
        views: view?.views ?? [],
        activeViewConfig,
        setActiveViewConfig,
      }}
    >
      {children}
    </SectionContext.Provider>
  );
}

export function useSection(): SectionContextValue {
  return useContext(SectionContext);
}
