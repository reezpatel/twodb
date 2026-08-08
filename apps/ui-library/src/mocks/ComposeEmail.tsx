import type { ReactNode } from "react";
import { Avatar, Button } from "@twodb/ui";
import {
	AtSign,
	CalendarPlus,
	ChevronDown,
	ExternalLink,
	FileArchive,
	FileText,
	Link,
	MailPlus,
	Paperclip,
	Smile,
	Trash2,
	Type,
	X,
} from "lucide-react";
import "./ComposeEmail.css";

const RECIPIENTS = [
	{ name: "Sam Jones", email: "samjones@gmail.com" },
	{ name: "Mike Mints", email: "mikemints@gmail.com" },
];

const ATTACHMENTS = [
	{ name: "Design Draft.fig", size: "2 MB", kind: "figma" },
	{ name: "Product Flow.blend", size: "48 MB", kind: "blend" },
	{ name: "Presentation.pdf", size: "2 MB", kind: "pdf" },
];

function Pill({
	person,
	removable = true,
}: {
	person: { name: string; email: string };
	removable?: boolean;
}) {
	return (
		<span className="mock-compose__pill">
			<Avatar name={person.name} size="sm" />
			<strong>{person.email}</strong>
			{removable ? (
				<button type="button" aria-label={`Remove ${person.email}`}>
					<X aria-hidden="true" />
				</button>
			) : null}
		</span>
	);
}

function FileMark({ kind }: { kind: string }) {
	if (kind === "figma") {
		return (
			<span
				className="mock-compose__filemark mock-compose__filemark--figma"
				aria-label="Figma file"
			>
				<i />
				<i />
				<i />
				<i />
			</span>
		);
	}
	if (kind === "blend") {
		return (
			<span
				className="mock-compose__filemark mock-compose__filemark--blend"
				aria-label="Blender file"
			>
				<FileArchive aria-hidden="true" />
			</span>
		);
	}
	return (
		<span
			className="mock-compose__filemark mock-compose__filemark--pdf"
			aria-label="PDF file"
		>
			<FileText aria-hidden="true" />
		</span>
	);
}

function Attachment({ item }: { item: (typeof ATTACHMENTS)[number] }) {
	return (
		<div className="mock-compose__attachment">
			<FileMark kind={item.kind} />
			<span>
				<strong>{item.name}</strong>
				<em>{item.size}</em>
			</span>
		</div>
	);
}

function RoundButton({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<button type="button" className="mock-compose__round" aria-label={label}>
			{children}
		</button>
	);
}

export function ComposeEmailMock() {
	return (
		<div className="mock-compose" aria-label="Compose new email mock">
			<section className="mock-compose__window">
				<header className="mock-compose__top">
					<div>
						<span className="mock-compose__mail-icon">
							<MailPlus aria-hidden="true" />
						</span>
						<h2>Compose New Email</h2>
					</div>
					<div className="mock-compose__window-actions">
						<RoundButton label="Open full screen">
							<ExternalLink aria-hidden="true" />
						</RoundButton>
						<RoundButton label="Close compose">
							<X aria-hidden="true" />
						</RoundButton>
					</div>
				</header>

				<div className="mock-compose__paper">
					<div className="mock-compose__address">
						<span className="mock-compose__field-label">From</span>
						<Pill
							person={{ name: "Alex White", email: "alex.white@gmail.com" }}
						/>
						<button
							type="button"
							className="mock-compose__small-chevron"
							aria-label="Choose sender"
						>
							<ChevronDown />
						</button>
					</div>
					<div className="mock-compose__address">
						<span className="mock-compose__field-label">To</span>
						{RECIPIENTS.map((person) => (
							<Pill key={person.email} person={person} />
						))}
						<div className="mock-compose__cc">
							<Button size="sm" variant="secondary">
								Cc
							</Button>
							<Button size="sm" variant="secondary">
								Bcc
							</Button>
						</div>
					</div>
					<div className="mock-compose__divider" />

					<article className="mock-compose__body">
						<h3>Research Result and Attached Files for the Call</h3>
						<p>Hey Mike,</p>
						<p>
							Regarding our latest call, I&rsquo;ve done research and collected
							all the base that we need to proceed on this product. I&rsquo;m
							sending you all the materials in the attached files below, so you
							could take a closer look and get prepared for the upcoming catch
							up.
						</p>
						<p>Looking forward to moving this forward!</p>
						<p>
							Best regards,
							<br />
							Tim
						</p>
					</article>

					<div className="mock-compose__attachments">
						{ATTACHMENTS.map((item) => (
							<Attachment key={item.name} item={item} />
						))}
					</div>
				</div>

				<footer className="mock-compose__footer">
					<div className="mock-compose__tools">
						<RoundButton label="Formatting">
							<Type aria-hidden="true" />
						</RoundButton>
						<RoundButton label="Attach file">
							<Paperclip aria-hidden="true" />
						</RoundButton>
						<RoundButton label="Insert link">
							<Link aria-hidden="true" />
						</RoundButton>
						<RoundButton label="Emoji">
							<Smile aria-hidden="true" />
						</RoundButton>
						<RoundButton label="Schedule">
							<CalendarPlus aria-hidden="true" />
						</RoundButton>
					</div>
					<Button className="mock-compose__send">Send email</Button>
					<RoundButton label="Discard draft">
						<Trash2 aria-hidden="true" />
					</RoundButton>
				</footer>
				<div className="mock-compose__assist">
					<AtSign aria-hidden="true" /> Draft ready · 3 files attached
				</div>
			</section>
		</div>
	);
}
