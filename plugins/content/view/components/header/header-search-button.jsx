import { ArrowDownNarrowWide, ArrowUpWideNarrow, Search } from "lucide-react";
import { useSection } from "../../provider/section-provider";
import { IconButton } from "@twodb/ui";

export const HeaderSearchButton = () => {
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
      <IconButton
        active={activeViewConfig.showSearch}
        className="shell__barbtn"
        icon={<Search size={14} />}
        label="Search notes"
        onClick={() =>
          setActiveViewConfig({
            ...activeViewConfig,
            showSearch: !activeViewConfig.showSearch,
          })
        }
        size="sm"
      />
    </>
  );
};
