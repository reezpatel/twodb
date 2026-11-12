import { Loader2 } from "lucide-react";
import { useParams } from "react-router";
import { useRecord, useTree } from "../lib/queries";
import { HeaderBar } from "../shell/partials/HeaderBar";
import { DocEditor } from "./DocEditor";
import { DatabasePage } from "../database/DatabasePage";

/** /:id → a page or a database. /all → the space's default Notes database. */
export function RecordRoute({ all }: { all?: boolean }) {
  const params = useParams();
  const tree = useTree();
  const id = all ? tree.data?.defaultDatabaseId : params.id;
  const { data, isLoading, error } = useRecord(id);
  return (
    <div className="flex h-full flex-col">
      <HeaderBar record={all ? undefined : data} title={all ? "All docs" : undefined} />
      <div className="min-h-0 flex-1 overflow-y-auto" data-scroll-root>
        {isLoading || (!data && !error) ? (
          <div className="flex h-40 items-center justify-center text-ink-muted">
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : error || !data ? (
          <div className="mx-auto max-w-md py-24 text-center">
            <div className="text-[18px] font-semibold">Page not found</div>
            <p className="mt-1 text-[13.5px] text-ink-muted">It may have been deleted permanently, or it lives in another space.</p>
          </div>
        ) : data.kind === "database" ? (
          <DatabasePage key={data.id} record={data} />
        ) : (
          <DocEditor key={data.id} record={data} />
        )}
      </div>
    </div>
  );
}

