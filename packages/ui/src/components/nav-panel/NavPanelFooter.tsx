import type {} from "styled-jsx";
import type { ReactNode } from "react";
import { navPanelFooterStyles } from "./NavPanelFooter.style";

export interface NavPanelFooterProps {
	children: ReactNode;
}

export function NavPanelFooter({ children }: NavPanelFooterProps) {
	return (
		<div className="tw-navpanel__footer">
			<style jsx>{navPanelFooterStyles}</style>
			{children}
		</div>
	);
}
