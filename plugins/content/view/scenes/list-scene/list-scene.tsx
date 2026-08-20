import { useState } from "react";
import { ContentHeader } from "../../components/header/content-header";
import { useSection } from "../../provider/section-provider";
import { NoteListBody } from "./note-list-body";
import { IconButton } from "@twodb/ui";
import { Inbox, Search } from "lucide-react";
import { HeaderContentMenu } from "../../components/header/header-content-menu";
import { HeaderSortButton } from "../../components/header/header-sort-button";
import { HeaderSearchButton } from "../../components/header/header-search-button";
import { noteListBodyStyles } from "./list-scene.style";
import { NoteSearchRow } from "../../notes-old/notes-list/note-search-row";
import { NoteListItem } from "../../notes-old/notes-list/note-list-item";
import { useQuery } from "@tanstack/react-query";
import { PLUGIN_ID } from "../../../shared/constants";
import { rowsApi } from "../../api";
import { ListItem } from "../../components/list-item/list-item";

export const NoteListScene = () => {
  const { views, section } = useSection();
  const { activeViewConfig, setActiveViewConfig } = useSection();
  const [openId, setOpenId] = useState<string | null>(null);

  const defaultView = views.find((v) => v.is_default) ?? views[0];

  const { data, isLoading } = useQuery({
    queryKey: [PLUGIN_ID, "note-list", section?.id, activeViewConfig],
    enabled: !!section?.id,
    queryFn: () =>
      rowsApi.list(section?.id ?? "", {
        limit: 10000,
        search: activeViewConfig.search,
      }),
  });

  if (!defaultView) {
    return null;
  }

  return (
    <>
      <ContentHeader title={section?.name}>
        <HeaderSearchButton />
        <HeaderSortButton />
        <HeaderContentMenu />
      </ContentHeader>

      <div>
        {activeViewConfig.showSearch && (
          <NoteSearchRow
            query={activeViewConfig.search}
            onQueryChange={(e) =>
              setActiveViewConfig({
                ...activeViewConfig,
                search: e ?? "",
              })
            }
          />
        )}
        {!isLoading && data?.rows.length === 0 ? (
          <div className="shell__empty">
            <Inbox size={20} />
            <p>
              {activeViewConfig.search
                ? `No notes match “${activeViewConfig.search}”.`
                : "Nothing here yet."}
            </p>
          </div>
        ) : (
          data?.rows?.map((note) => (
            <ListItem
              key={note.id}
              note={note}
              open={openId === note.id}
              onOpen={() => setOpenId(note.id)}
            />
          ))
        )}
      </div>

      <style jsx>{noteListBodyStyles}</style>
    </>
  );
};
