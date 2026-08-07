import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { Avatar } from "./Avatar";
import { IconButton } from "./IconButton";
import { Menu } from "./Menu";

export interface AccountMenuProps {
  name: string;
  /** Secondary line — plan, workspace, role. */
  sub?: string;
  src?: string;
  /** MenuItem / MenuDivider children for the popup. */
  children: ReactNode;
}

export function AccountMenu({ name, sub, src, children }: AccountMenuProps) {
  return (
    <div className="tw-account">
      <Avatar name={name} src={src} size="md" />
      <div className="tw-account__meta">
        <span className="tw-account__name">{name}</span>
        {sub ? <span className="tw-account__sub">{sub}</span> : null}
      </div>
      <Menu
        placement="top-end"
        trigger={<IconButton label={`Account menu for ${name}`} icon={<MoreHorizontal />} />}
      >
        {children}
      </Menu>
    </div>
  );
}
