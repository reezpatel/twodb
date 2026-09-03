import { FileText, LayoutGrid, Paperclip, X } from "lucide-react";
import { projectPropertiesPanelStyles } from "./project-properties-panel.style";

const COMMENTS = [
	{
		author: "David Lee",
		initials: "DL",
		color: "teal",
		text: "Have you considered AI-driven task prioritization?",
	},
	{
		author: "Priya Sharma",
		initials: "PS",
		color: "purple",
		text: "Don't forget to add accessibility features in the design phase.",
	},
];

// Mocked panel — not yet wired to the selected row.
export function ProjectPropertiesPanel() {
	return (
		<aside className="project-panel">
			<style jsx>{projectPropertiesPanelStyles}</style>

			<div className="project-panel__head">
				<span className="project-panel__title">Properties</span>
				<button className="project-panel__close">
					<X aria-hidden="true" />
				</button>
			</div>

			<div className="project-panel__props">
				<div className="project-panel__prop">
					<span className="project-panel__prop-label">Progress</span>
					<span className="project-panel__prop-value">
						<span className="project-panel__prop-icon project-panel__prop-icon--blue">
							⚡
						</span>
						Ongoing
					</span>
				</div>
				<div className="project-panel__prop">
					<span className="project-panel__prop-label">Category</span>
					<span className="project-panel__prop-value">
						<span className="project-panel__prop-icon project-panel__prop-icon--file">
							<FileText aria-hidden="true" />
						</span>
						API Documentation
					</span>
				</div>
				<div className="project-panel__prop">
					<span className="project-panel__prop-label">Task owner</span>
					<span className="project-panel__prop-value">
						<span className="project-panel__assignee project-panel__assignee--purple">
							PS
						</span>
						Priya
					</span>
				</div>
				<div className="project-panel__prop">
					<span className="project-panel__prop-label">Urgency</span>
					<span className="project-panel__prop-value">
						<span className="project-panel__prop-icon project-panel__prop-icon--red">
							<span style={{ display: "flex", gap: 1 }}>
								<span
									style={{
										width: 2,
										height: 10,
										background: "currentColor",
										borderRadius: 1,
									}}
								/>
								<span
									style={{
										width: 2,
										height: 10,
										background: "currentColor",
										borderRadius: 1,
									}}
								/>
								<span
									style={{
										width: 2,
										height: 10,
										background: "currentColor",
										borderRadius: 1,
									}}
								/>
							</span>
						</span>
						Critical
					</span>
				</div>
				<div className="project-panel__prop">
					<span className="project-panel__prop-label">Department</span>
					<span className="project-panel__prop-value">
						<span className="project-panel__prop-icon project-panel__prop-icon--purple">
							<LayoutGrid aria-hidden="true" />
						</span>
						Engineering
					</span>
				</div>
				<div className="project-panel__prop">
					<span className="project-panel__prop-label">Date added</span>
					<span className="project-panel__prop-value">March 15, 2025</span>
				</div>
				<div className="project-panel__prop">
					<span className="project-panel__prop-label">Deadline</span>
					<span className="project-panel__prop-value">May 15, 2025</span>
				</div>
			</div>

			<div className="project-panel__section">
				<div className="project-panel__section-title">Tags</div>
				<div className="project-panel__tags">
					<span className="project-panel__tag project-panel__tag--blue">
						Features
					</span>
					<span className="project-panel__tag project-panel__tag--red">
						Bugs
					</span>
					<span className="project-panel__tag project-panel__tag--green">
						Improvements
					</span>
				</div>
			</div>

			<div className="project-panel__section">
				<div className="project-panel__section-title">Attachments</div>
				<div className="project-panel__attachments">
					<div className="project-panel__attachment">
						<span className="project-panel__attachment-icon">
							<Paperclip aria-hidden="true" />
						</span>
						<div className="project-panel__attachment-info">
							<div className="project-panel__attachment-name">
								Client_Proposal.xls
							</div>
							<div className="project-panel__attachment-meta">Today · 4 MB</div>
						</div>
					</div>
					<div className="project-panel__attachment">
						<span className="project-panel__attachment-icon">
							<FileText aria-hidden="true" />
						</span>
						<div className="project-panel__attachment-info">
							<div className="project-panel__attachment-name">PRD.docx</div>
							<div className="project-panel__attachment-meta">
								Yesterday · Google Docs
							</div>
						</div>
					</div>
				</div>
			</div>

			<div className="project-panel__section">
				<div className="project-panel__section-title">Discussion</div>
				<div className="project-panel__discussion">
					{COMMENTS.map((c, i) => (
						<div key={i} className="project-panel__comment">
							<span
								className={`project-panel__comment-avatar project-panel__assignee--${c.color}`}
							>
								{c.initials}
							</span>
							<div className="project-panel__comment-content">
								<div className="project-panel__comment-author">{c.author}</div>
								<p className="project-panel__comment-text">{c.text}</p>
							</div>
						</div>
					))}
				</div>
				<div className="project-panel__comment-input">Write a comment</div>
			</div>
		</aside>
	);
}
