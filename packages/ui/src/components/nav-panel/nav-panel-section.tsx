import type {} from "styled-jsx";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { navPanelSectionStyles } from "./nav-panel-section.style";

export interface NavPanelSectionProps {
	label: string;
	meta?: ReactNode;
	onAdd?: () => void;
}

export function NavPanelSection({ label, meta, onAdd }: NavPanelSectionProps) {
	return (
		<div className="tw-navpanel__section">
			<style jsx>{navPanelSectionStyles}</style>
			<span className="tw-navpanel__sectionlabel">{label}</span>
			<span className="tw-navpanel__sectionmeta">{meta}</span>
			{onAdd ? (
				<button
					type="button"
					className="tw-navpanel__sectionadd"
					aria-label={`Add to ${label}`}
					onClick={onAdd}
				>
					<Plus size={13} />
				</button>
			) : null}
		</div>
	);
}
