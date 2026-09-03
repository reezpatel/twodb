import { useCallback, useMemo } from "react";
import type { ContentRowDto } from "@twodb/contracts";
import { DataTable, IconButton } from "@twodb/ui";
import { Plus } from "lucide-react";
import { ContentHeader } from "../../components/header/content-header";
import { HeaderContentMenu } from "../../components/header/header-content-menu";
import { HeaderSearchButton } from "../../components/header/header-search-button";
import { HeaderSortButton } from "../../components/header/header-sort-button";
import { useSectionRowMutations } from "../../hooks/use-section-row-mutations.hook";
import { useSectionRows } from "../../hooks/use-section-rows.hook";
import { useSection } from "../../provider/section-provider";
import { tableSceneStyles } from "./table-scene.style";
import { useTableColumns } from "./use-table-columns.hook";
import { NoteSearchRow } from "../../components/note-search/note-search-row";

export const TableScene = () => {
  const {
    section,
    activeViewConfig,
    setActiveViewConfig,
    openNoteId,
    setOpenNoteId,
  } = useSection();
  const { create, update, remove } = useSectionRowMutations();
  const { data, isLoading } = useSectionRows();
  const rows = useMemo(() => data?.rows ?? [], [data]);

  const handleDeleteRow = useCallback(
    (rowId: string) => {
      if (openNoteId === rowId) setOpenNoteId(null);
      remove.mutate(rowId);
    },
    [openNoteId, remove, setOpenNoteId],
  );

  const columns = useTableColumns(handleDeleteRow);

  const handleRowsChange = useCallback(
    (next: ContentRowDto[]) => {
      next
        .filter((n) => {
          const cur = rows.find((r) => r.id === n.id);
          return cur !== undefined && cur !== n;
        })
        .forEach((changed) =>
          update.mutate({
            rowId: changed.id,
            body: {
              title: changed.title,
              preview: changed.preview,
              completed: changed.completed,
              tags: changed.tags,
              values: changed.values,
            },
          }),
        );
    },
    [rows, update],
  );

  const emptyMessage = isLoading
    ? "Loading…"
    : activeViewConfig.search
      ? `No notes match “${activeViewConfig.search}”.`
      : "Nothing here yet.";

  return (
    <section className="table-scene" aria-label="Notes table">
      <style jsx>{tableSceneStyles}</style>

      <ContentHeader title={section?.name}>
        <IconButton
          className="shell__barbtn"
          icon={<Plus size={14} />}
          label="New note"
          onClick={() => create.mutate({ title: "Untitled" })}
          size="sm"
        />
        <HeaderSearchButton />
        <HeaderSortButton />
        <HeaderContentMenu />
      </ContentHeader>

      <div className="table-scene__body">
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
        <DataTable
          aria-label={`${section?.name ?? "Notes"} table`}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          searchText={(row) => `${row.title} ${row.preview}`}
          searchPlaceholder="Search notes…"
          pageSize={25}
          pageSizeOptions={[25, 50, 100]}
          emptyMessage={emptyMessage}
          editable
          onRowsChange={handleRowsChange}
        />
      </div>
    </section>
  );
};
