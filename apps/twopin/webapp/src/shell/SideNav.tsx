import { NavSidebar, useLargeViewport, type NavGroupData } from "@twodb/blocks";
import { useTwoDbAuth } from "@twodb/twodb-shared-frontend";
import { Bookmark, Download, Globe, LayoutGrid, LogOut, Plus, Settings } from "lucide-react";
import { navigate } from "../lib/router.js";
import { useTwoPin } from "../state/TwoPinProvider.js";
import { useInstallPrompt } from "./hooks/useInstallPrompt.js";

const BOARD = "board:";

/**
 * App sidebar. Top-level: Bookmarks + Settings nav-items. Below them a "Boards"
 * section whose heading carries a + button to create a board, with "All pins"
 * first and then one item per board.
 */
export function SideNav({ open, onOpenChange, section }: { open: boolean; onOpenChange: (open: boolean) => void; section: string }) {
  const large = useLargeViewport();
  const { logout } = useTwoDbAuth();
  const tp = useTwoPin();
  const install = useInstallPrompt();

  const groups: NavGroupData[] = [
    {
      items: [
        { id: "bookmarks", title: "Bookmarks", icon: Bookmark },
        { id: "settings", title: "Settings", icon: Settings },
      ],
    },
    {
      heading: "Boards",
      headingAction: { icon: Plus, label: "New board", onClick: () => tp.setCreateBoardOpen(true) },
      items: [
        { id: "boards", title: "All pins", icon: Globe },
        ...tp.boards.map((b) => ({ id: BOARD + b.id, title: b.name, icon: LayoutGrid, badge: b.pinCount || undefined })),
      ],
    },
  ];

  // Active id derives from the route: /bookmarks, /settings, /boards (all), /boards/:id.
  const activeId =
    section === "bookmarks" || section === "settings" ? section : tp.selectedBoardId ? BOARD + tp.selectedBoardId : "boards";

  const footerItems = [
    ...(install.visible ? [{ id: "install", title: "Install app", icon: Download }] : []),
    { id: "logout", title: "Sign out", icon: LogOut },
  ];

  return (
    <NavSidebar
      variant="responsive"
      open={open}
      onOpenChange={onOpenChange}
      resizable={false}
      defaultWidth={240}
      groups={groups}
      footerItems={footerItems}
      activeId={activeId}
      onSelect={(id) => {
        if (!large) onOpenChange(false);
        if (id === "logout") return void logout?.();
        if (id === "install")
          return void install.install().then((result) => {
            if (result === "manual") window.alert("Use your browser's menu to install this app.");
          });
        if (id === "bookmarks") return navigate("/bookmarks");
        if (id === "settings") return navigate("/settings");
        if (id === "boards") return navigate("/boards");
        if (id.startsWith(BOARD)) return navigate(`/boards/${id.slice(BOARD.length)}`);
      }}
    />
  );
}

