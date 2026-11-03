import type { ComponentProps, ReactNode } from "react";
import { AppNavList } from "./app-nav-list";
import { AppNavSection } from "./app-nav-section";

export interface AppNavLinksProps extends Omit<ComponentProps<"div">, "title"> {
  title: string;
  defaultExpanded?: boolean;
  actions?: ReactNode;
}

/** Section type #1: a titled, collapsible group of links. Holds <AppNavLink> / <AppNavLinkFolder> children. */
export function AppNavLinks({ children, ...props }: AppNavLinksProps) {
  return (
    <AppNavSection data-slot="app-nav-links" {...props}>
      <AppNavList>{children}</AppNavList>
    </AppNavSection>
  );
}
