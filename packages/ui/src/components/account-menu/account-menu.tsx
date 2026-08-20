import type {} from "styled-jsx";
import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { Avatar } from "../avatar";
import { IconButton } from "../icon-button";
import { Menu } from "../menu";
import { accountMenuStyles } from "./account-menu.style";

export interface AccountMenuProps {
	name: string;
	sub?: string;
	src?: string;
	children: ReactNode;
}

export function AccountMenu({ name, sub, src, children }: AccountMenuProps) {
	return (
		<div className="tw-account">
			<style jsx>{accountMenuStyles}</style>
			<Avatar name={name} src={src} size="md" />
			<div className="tw-account__meta">
				<span className="tw-account__name">{name}</span>
				{sub ? <span className="tw-account__sub">{sub}</span> : null}
			</div>
			<Menu
				placement="top-end"
				trigger={
					<IconButton
						label={`Account menu for ${name}`}
						icon={<MoreHorizontal />}
					/>
				}
			>
				{children}
			</Menu>
		</div>
	);
}
