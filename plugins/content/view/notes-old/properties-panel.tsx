/* Properties panel region — owns its chrome segment (only rendered while the
   panel is open) and the properties body: property rows + relation sections. */

import {
	Calendar,
	ChevronDown,
	ExternalLink,
	Hash,
	Link2,
	PanelLeft,
	Plus,
	Smile,
	StickyNote,
	Tag,
	X,
} from "lucide-react";
import type { ReactNode } from "react";
import {
	propertiesPanelStyles,
	propDotStyles,
	propRowStyles,
	relationSectionStyles,
} from "./properties-panel.style";
import { useShellState } from "../../shell/state";

function PropRow({
	icon,
	label,
	children,
}: {
	icon: ReactNode;
	label: string;
	children: ReactNode;
}) {
	return (
		<div className="shell__proprow">
			<style jsx>{propRowStyles}</style>
			<span className="shell__proplabel">
				{icon}
				{label}
			</span>
			<span className="shell__propval">{children}</span>
		</div>
	);
}

function RelationSection({
	label,
	children,
}: {
	label: string;
	children?: ReactNode;
}) {
	return (
		<section className="shell__rel">
			<style jsx>{relationSectionStyles}</style>
			<h4 className="shell__rellabel">{label}</h4>
			{children}
			<button type="button" className="shell__dashed">
				Add
			</button>
		</section>
	);
}

/* tiny inline icon not worth a lucide lookup */
function CircleDotIcon() {
	return (
		<>
			<style jsx>{propDotStyles}</style>
			<span className="shell__propdot" />
		</>
	);
}

export function PropertiesPanel() {
	const { openDoc, panelOpen, extraRels, setPanelOpen, addRelation } =
		useShellState();

	if (!panelOpen) return null;

	return (
		<>
			<style jsx>{propertiesPanelStyles}</style>
			{/* top bar — properties segment */}
			<div className="shell__chrome shell__chrome--props">
				<PanelLeft size={14} />
				<strong>Properties</strong>
				<span className="shell__chromespacer" />
				<button
					type="button"
					className="shell__barbtn"
					aria-label="Close properties"
					onClick={() => setPanelOpen(false)}
				>
					<X size={14} />
				</button>
			</div>

			<aside className="shell__props" aria-label="Note properties">
				<div className="shell__propscroll">
					<div className="shell__proprows">
						<PropRow icon={<Tag size={13} />} label="Type">
							<span className="shell__valuechip">
								<span className="shell__doctypeicon">{openDoc.typeIcon}</span>
								{openDoc.type}
								<ChevronDown size={11} />
							</span>
						</PropRow>
						<PropRow icon={<CircleDotIcon />} label="Status">
							<span className="shell__statusval">
								<i /> {openDoc.status}
							</span>
						</PropRow>
						<PropRow icon={<Calendar size={13} />} label="Date">
							{openDoc.date}
						</PropRow>
						<PropRow icon={<Hash size={13} />} label="Notion id">
							<span className="shell__mono">{openDoc.notionId}</span>
						</PropRow>
						<PropRow icon={<Link2 size={13} />} label="URL">
							{openDoc.url}
						</PropRow>
						<PropRow icon={<Smile size={13} />} label="Icon">
							—
						</PropRow>
						<button type="button" className="shell__ghostrow">
							<Plus size={13} /> Add property
						</button>
					</div>

					<RelationSection label="Belongs to">
						{openDoc.belongsTo && (
							<span
								className={`shell__relchip shell__chip--${openDoc.belongsTo.tone}`}
							>
								<Tag size={11} />
								{openDoc.belongsTo.label}
								<span className="shell__relopen">
									<ExternalLink size={11} />
								</span>
							</span>
						)}
					</RelationSection>

					<RelationSection label="Has Notes">
						{openDoc.hasNotes.map((h) => (
							<span key={h} className="shell__relchip shell__chip--green">
								<StickyNote size={11} />
								{h}
								<span className="shell__relopen">
									<ExternalLink size={11} />
								</span>
							</span>
						))}
					</RelationSection>

					<RelationSection label="Belongs to" />
					<RelationSection label="Related to" />
					<RelationSection label="Has" />
					{Array.from({ length: extraRels }, (_, i) => (
						<RelationSection key={`new-${i}`} label="New relation" />
					))}

					<button type="button" className="shell__addrel" onClick={addRelation}>
						<Plus size={13} /> Add relationship
					</button>

					<RelationSection label="Children" />
				</div>
			</aside>
		</>
	);
}
