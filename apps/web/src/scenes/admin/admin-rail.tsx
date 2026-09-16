import { Blocks, KeyRound, LogOut, Puzzle, Server } from "lucide-react";
import { IconButton, NavRail, type NavRailItem } from "@twodb/ui";
import { useAdminRail } from "./hooks/use-admin-rail";

const SECTIONS = [
  { id: "/admin/plugins", label: "Plugins", icon: Blocks },
  { id: "/admin/passkeys", label: "Passkeys", icon: KeyRound },
  { id: "/admin/instance", label: "Instance", icon: Server },
] as const;

export function AdminRail() {
  const { activeId, pluginItems, navigate, logout } = useAdminRail();
  const items: NavRailItem[] = [
    ...SECTIONS.map(({ icon: Icon, ...item }) => ({
      ...item,
      icon: <Icon aria-hidden="true" />,
    })),
    ...pluginItems.map((item) => ({
      ...item,
      icon: <Puzzle aria-hidden="true" />,
    })),
  ];

  return (
    <NavRail
      aria-label="Admin sections"
      items={items}
      value={activeId}
      onValueChange={navigate}
      footer={
        <IconButton
          label="Sign out"
          icon={<LogOut />}
          size="lg"
          disabled={logout.isPending}
          onClick={() => logout.mutate()}
        />
      }
    />
  );
}
