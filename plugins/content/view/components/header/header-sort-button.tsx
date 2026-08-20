import { ArrowDownNarrowWide, ArrowUpWideNarrow } from "lucide-react";
import { useSection } from "../../provider/section-provider";

export const HeaderSortButton = () => {
  const { activeViewConfig, setActiveViewConfig } = useSection();

  const onToggleSort = () => {
    setActiveViewConfig({
      ...activeViewConfig,
      sorts: [],
    });
  };

  const sortDesc = false;

  return (
    <>
      <button
        type="button"
        className="shell__sort"
        onClick={onToggleSort}
        title="Sort by modified"
      >
        {sortDesc ? (
          <ArrowDownNarrowWide size={13} />
        ) : (
          <ArrowUpWideNarrow size={13} />
        )}
        Modified
      </button>
      <style jsx>{`
        .shell__sort {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 7px;
          border: 0;
          border-radius: var(--r-sm);
          background: transparent;
          font-size: var(--text-sm);
          color: var(--ink-3);
          cursor: pointer;
          white-space: nowrap;
          transition:
            background var(--dur-1) var(--ease-out),
            color var(--dur-1) var(--ease-out);
        }

        .shell__sort:hover {
          background: var(--bg-band-strong);
          color: var(--ink);
        }
      `}</style>
    </>
  );
};
