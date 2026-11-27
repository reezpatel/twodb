import { NavSidebar, useLargeViewport, type NavGroupData } from "@twodb/blocks";
import type { ComponentProps } from "react";
import { useTwoDbAuth } from "@twodb/twodb-shared-frontend";
import { Download, Layers, LogOut } from "lucide-react";
import { CATEGORIES } from "../../lib/catalog";
import { navigate } from "../../lib/router";
import { toast } from "../../lib/toast";
import { useInstallPrompt } from "../hooks/useInstallPrompt";
import { NAV } from "../nav";

const CAT = "cat:";

/** Category icons tinted with the category color (built once so they don't remount). */
const CATEGORY_ITEMS = [
  { id: CAT + "all", title: "All", icon: Layers },
  ...CATEGORIES.map((c) => ({
    id: CAT + c.id,
    title: c.short,
    icon: (props: ComponentProps<typeof c.icon>) => <c.icon {...props} style={{ color: c.color }} />,
  })),
];

/** Build-time constant, so the hook call is stable; no provider exists in direct dev mode. */
const useLogout = () => (__TWOTHING_NO_AUTH__ ? undefined : useTwoDbAuth().logout);

export function SideNav({
  section,
  activeCategory,
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: string;
  activeCategory: string | null;
}) {
  const large = useLargeViewport();
  const logout = useLogout();
  const install = useInstallPrompt();
  const groups: NavGroupData[] = [
    { items: NAV.filter((n) => n.id !== "items").map((n) => ({ id: n.id || "home", title: n.label, icon: n.icon })) },
    { heading: "Categories", items: CATEGORY_ITEMS },
  ];
  const activeId = activeCategory ? CAT + activeCategory : section === "items" ? CAT + "all" : section || "home";

  return (
    <NavSidebar
      variant="responsive"
      open={open}
      onOpenChange={onOpenChange}
      resizable={false}
      defaultWidth={240}
      groups={groups}
      footerItems={[
        ...(install.visible ? [{ id: "install", title: "Install app", icon: Download }] : []),
        ...(logout ? [{ id: "logout", title: "Sign out", icon: LogOut }] : []),
      ]}
      activeId={activeId}
      onSelect={(id) => {
        // floating sheet below lg: close it once something is picked
        if (!large) onOpenChange(false);
        if (id === "install")
          return void install.install().then((r) => {
            if (r === "manual")
              toast("To install TwoThing, open the browser's share menu and choose “Add to Home Screen” or “Install app”.", { tone: "info", ms: 8000 });
          });
        if (id === "logout") return void logout?.();
        if (id === CAT + "all") return navigate("/items");
        if (id.startsWith(CAT)) return navigate(`/items?category=${id.slice(CAT.length)}`);
        navigate(NAV.find((n) => (n.id || "home") === id)?.to ?? "/");
      }}
    />
  );
}
