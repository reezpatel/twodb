import type {} from "styled-jsx";
import type { ReactNode } from "react";
import { navPanelGroupStyles } from "./nav-panel-group.style";

export interface NavPanelGroupProps {
	children: ReactNode;
}

export function NavPanelGroup({ children }: NavPanelGroupProps) {
	return (
		<div className="tw-navpanel__group">
			<style jsx>{navPanelGroupStyles}</style>
			{children}
		</div>
	);
}
