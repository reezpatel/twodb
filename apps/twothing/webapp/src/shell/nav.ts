import { History, LayoutDashboard, Package, QrCode, Settings2, Warehouse, type LucideIcon } from "lucide-react";

export interface NavEntry {
  id: string;
  to: string;
  label: string;
  icon: LucideIcon;
  mobile?: boolean;
}

export const NAV: NavEntry[] = [
  { id: "", to: "/", label: "Home", icon: LayoutDashboard, mobile: true },
  { id: "items", to: "/items", label: "Items", icon: Package, mobile: true },
  { id: "places", to: "/places", label: "Places", icon: Warehouse, mobile: true },
  { id: "labels", to: "/labels", label: "Labels", icon: QrCode, mobile: true },
  { id: "activity", to: "/activity", label: "Activity", icon: History },
  { id: "settings", to: "/settings", label: "Import & export", icon: Settings2 },
];
