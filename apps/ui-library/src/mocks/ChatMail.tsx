import { useMemo, useState } from "react";
import {
	Avatar,
	Badge,
	IconButton,
	Switch,
	ChatList,
	MessageGroup,
	ChatMessage,
	TextMessage,
	DocumentMessage,
	ChatComposer,
} from "@twodb/ui";
import {
	Archive,
	BadgeCheck,
	Inbox as InboxIcon,
	MailPlus,
	MessageSquareHeart,
	MoreHorizontal,
	Paperclip,
	Pin,
	Send,
	Sparkles,
	Star,
	Trash2,
	UserPlus,
} from "lucide-react";
import "./ChatMail.css";

/* ---------- data ---------- */

interface MailMessage {
	from: string;
	time: string;
	self?: boolean;
	text: string;
	doc?: { name: string; meta: string };
}

interface Conversation {
	id: string;
	name: string;
	address: string;
	subject: string;
	snippet: string;
	date: string;
	unread: number;
	starred?: boolean;
	verified?: boolean;
	clip?: boolean;
	category: "primary" | "updates";
	summary: string;
	quickAnswers: string[];
	messages: MailMessage[];
}

const CONVERSATIONS: Conversation[] = [
	{
		id: "c1",
		name: "City Diagnostics Lab",
		address: "reports@citydiagnostics.in",
		subject: "Overnight reports: 3 ready for review",
		snippet: "The following reports have been attached to the right charts…",
		date: "06:12",
		unread: 3,
		verified: true,
		clip: true,
		category: "primary",
		summary:
			"Three lab reports came back overnight. Two are within range and already filed; Meera Iyer's lipid panel carries one flag and is attached below for review before her 9:40 appointment.",
		quickAnswers: ["Forward to Dr. Rao", "Mark all reviewed", "Thanks, received"],
		messages: [
			{
				from: "City Diagnostics Lab",
				time: "Sat, 06:12",
				text: "Good morning — three reports from yesterday's draws are ready. Two are within reference range and have been filed to the charts automatically.",
			},
			{
				from: "City Diagnostics Lab",
				time: "Sat, 06:12",
				text: "Meera Iyer's fasting lipid panel carries one flag (LDL above range). Attaching the report for review before her appointment today.",
				doc: { name: "Meera-Iyer-lipid-panel.pdf", meta: "PDF · 184 KB" },
			},
			{
				from: "You",
				time: "Sat, 06:47",
				text: "Received. I'll review the flagged panel at 9:00 and call if anything changes before her slot.",
				self: true,
			},
		],
	},
	{
		id: "c2",
		name: "Meera Iyer",
		address: "meera.iyer@mail.in",
		subject: "Question about invoice INV-1042",
		snippet: "The amount seems higher than what the front desk quoted…",
		date: "Fri",
		unread: 1,
		category: "primary",
		summary:
			"Meera is asking why INV-1042 (₹850) is higher than the front-desk quote. The difference is the fasting panel added during her visit; a plain-language breakdown is ready to send.",
		quickAnswers: ["Send the breakdown", "Apply concession", "Call her instead"],
		messages: [
			{
				from: "Meera Iyer",
				time: "Fri, 14:20",
				text: "Hello — the invoice I received (INV-1042) shows ₹850 but the front desk quoted ₹500. Could you help me understand the difference?",
			},
			{
				from: "You",
				time: "Fri, 15:02",
				text: "Sorry about the confusion! The ₹350 difference is the fasting lipid panel the doctor added during your visit. I'll send a plain breakdown in a moment.",
				self: true,
			},
			{
				from: "Meera Iyer",
				time: "Fri, 15:10",
				text: "That makes sense, thank you. Please do send the breakdown.",
			},
		],
	},
	{
		id: "c3",
		name: "Ravi Kumar",
		address: "ravi.k@mail.in",
		subject: "Discharge summary — one correction",
		snippet: "The summary says twice daily, but you mentioned once…",
		date: "Fri",
		unread: 0,
		starred: true,
		category: "primary",
		summary:
			"Ravi spotted a dosage inconsistency in his discharge summary: the document says twice daily, the verbal instruction was once. Confirm with Dr. Rao before reissuing.",
		quickAnswers: ["Reissue corrected copy", "Confirming with Dr. Rao"],
		messages: [
			{
				from: "Ravi Kumar",
				time: "Fri, 11:36",
				text: "The discharge summary lists the medication twice daily, but I was told once a day after food. Which one should I follow?",
			},
		],
	},
	{
		id: "c4",
		name: "PharmaSupply Co",
		address: "orders@pharmasupply.co",
		subject: "Order #1042 dispatched — arrives Monday",
		snippet: "Gauze rolls (100) and nitrile gloves (12 boxes) are on the way…",
		date: "Thu",
		unread: 0,
		clip: true,
		category: "updates",
		summary:
			"The stock order from the morning brief has shipped: 100 gauze rolls and 12 boxes of medium nitrile gloves, arriving Monday before noon. Invoice attached.",
		quickAnswers: ["Acknowledge", "Share with the lab"],
		messages: [
			{
				from: "PharmaSupply Co",
				time: "Thu, 17:44",
				text: "Your order #1042 has been dispatched: gauze rolls, sterile (100) and nitrile gloves, medium (12 boxes). Expected Monday before noon.",
				doc: { name: "Invoice-1042.pdf", meta: "PDF · 92 KB" },
			},
		],
	},
	{
		id: "c5",
		name: "Sana Sheikh",
		address: "sana.s@mail.in",
		subject: "Tuesday visiting hours?",
		snippet: "My mother is admitted in ward 2 — when can we visit…",
		date: "Thu",
		unread: 0,
		category: "updates",
		summary:
			"Sana is asking about Tuesday visiting hours for ward 2. The roster confirmation is one of today's open tasks — answer once the front desk confirms.",
		quickAnswers: ["10 am – 12 noon", "Will confirm by evening"],
		messages: [
			{
				from: "Sana Sheikh",
				time: "Thu, 09:15",
				text: "My mother was admitted to ward 2 yesterday. What are the visiting hours on Tuesday, and do we need to register at the desk first?",
			},
		],
	},
];

const FILTERS = [
	{ id: "all", label: "All" },
	{ id: "primary", label: "Primary" },
	{ id: "updates", label: "Updates" },
] as const;

/* ---------- the mock ---------- */

export function ChatMailMock() {
	const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
	const [selectedId, setSelectedId] = useState("c1");
	const [smartReplies, setSmartReplies] = useState(true);
	const [read, setRead] = useState<Record<string, boolean>>({});
	const [starred, setStarred] = useState<Record<string, boolean>>(
		Object.fromEntries(CONVERSATIONS.filter((c) => c.starred).map((c) => [c.id, true])),
	);
	const [sent, setSent] = useState<Record<string, MailMessage[]>>({});

	const visible = useMemo(
		() => CONVERSATIONS.filter((c) => filter === "all" || c.category === filter),
		[filter],
	);

	const selected = CONVERSATIONS.find((c) => c.id === selectedId)!;
	const messages = [...selected.messages, ...(sent[selected.id] ?? [])];
	const isStarred = !!starred[selected.id];

	function open(id: string) {
		setSelectedId(id);
		setRead((r) => ({ ...r, [id]: true }));
	}

	function send(text: string) {
		if (!text.trim()) return;
		setSent((s) => ({
			...s,
			[selected.id]: [
				...(s[selected.id] ?? []),
				{ from: "You", time: "now", text, self: true },
			],
		}));
	}

	return (
		<div className="mock-cm">
			{/* ------- folders rail ------- */}
			<nav className="mock-cm__nav">
				<div className="mock-cm__account">
					<Avatar name="Asha Verma" size="sm" />
					<div className="mock-cm__acctext">
						<span className="mock-cm__accname">Asha Verma</span>
						<span className="mock-cm__accmail">asha@cityclinic.in</span>
					</div>
				</div>
				<div className="mock-cm__views">
					<button className="mock-cm__view is-active">
						<InboxIcon aria-hidden="true" /> Inbox
						<span className="mock-cm__count">12</span>
					</button>
					<button className="mock-cm__view">
						<Star aria-hidden="true" /> Starred
						<span className="mock-cm__count">4</span>
					</button>
					<button className="mock-cm__view">
						<Send aria-hidden="true" /> Sent
					</button>
				</div>
				<div className="mock-cm__labels">
					<span className="tw-cue">Labels</span>
					<button className="mock-cm__view">
						<i className="mock-cm__dot mock-cm__dot--cobalt" /> Patients
						<span className="mock-cm__count">8</span>
					</button>
					<button className="mock-cm__view">
						<i className="mock-cm__dot mock-cm__dot--rose" /> Suppliers
						<span className="mock-cm__count">3</span>
					</button>
				</div>
				<div className="mock-cm__navfoot">
					<button className="mock-cm__footrow">
						<MessageSquareHeart aria-hidden="true" /> Leave feedback
					</button>
					<button className="mock-cm__footrow">
						<UserPlus aria-hidden="true" /> Invite a colleague
					</button>
				</div>
			</nav>

			{/* ------- thread list ------- */}
			<section className="mock-cm__list">
				<header className="mock-cm__listhead">
					<h2>Inbox</h2>
					<IconButton icon={<MailPlus />} label="New email" variant="ghost" size="sm" />
				</header>
				<div className="mock-cm__chips" role="tablist" aria-label="Category">
					{FILTERS.map((f) => (
						<button
							key={f.id}
							role="tab"
							aria-selected={filter === f.id}
							className={
								filter === f.id ? "mock-cm__chip is-active" : "mock-cm__chip"
							}
							onClick={() => setFilter(f.id)}
						>
							{f.label}
						</button>
					))}
				</div>
				<div className="mock-cm__smart">
					<Sparkles aria-hidden="true" />
					<div>
						<strong>Smart replies</strong>
						<span>Draft answers in your voice</span>
					</div>
					<Switch
						checked={smartReplies}
						onChange={(e) => setSmartReplies(e.target.checked)}
						aria-label="Smart replies"
					/>
				</div>
				<div className="mock-cm__threads">
					{visible.map((c) => {
						const unread = c.unread && !read[c.id] ? c.unread : 0;
						return (
							<button
								key={c.id}
								className={
									selectedId === c.id
										? "mock-cm__thread is-selected"
										: "mock-cm__thread"
								}
								onClick={() => open(c.id)}
							>
								<Avatar name={c.name} size="sm" />
								<span className="mock-cm__tbody">
									<span className="mock-cm__trow1">
										<span className="mock-cm__tname">
											{c.name}
											{c.verified ? (
												<BadgeCheck aria-hidden="true" className="mock-cm__verified" />
											) : null}
										</span>
										<span className="mock-cm__tdate">{c.date}</span>
									</span>
									<span className="mock-cm__tsubject">{c.subject}</span>
									<span className="mock-cm__trow3">
										<span className="mock-cm__tsnippet">{c.snippet}</span>
										{c.clip ? <Paperclip aria-hidden="true" /> : null}
										{unread ? (
											<Badge size="sm" tone="go">
												{unread}
											</Badge>
										) : null}
									</span>
								</span>
							</button>
						);
					})}
				</div>
			</section>

			{/* ------- reading pane: the email as a chat ------- */}
			<section className="mock-cm__read">
				<header className="mock-cm__toolbar">
					<IconButton icon={<Archive />} label="Archive" variant="ghost" size="sm" />
					<IconButton icon={<Trash2 />} label="Delete" variant="ghost" size="sm" />
					<IconButton
						icon={<Star />}
						label={isStarred ? "Unstar" : "Star"}
						variant="ghost"
						size="sm"
						onClick={() =>
							setStarred((s) => ({ ...s, [selected.id]: !isStarred }))
						}
						className={isStarred ? "mock-cm__starred" : undefined}
					/>
					<IconButton icon={<Pin />} label="Pin" variant="ghost" size="sm" />
					<span className="mock-cm__pager">2 of 12</span>
					<IconButton icon={<MoreHorizontal />} label="More" variant="ghost" size="sm" />
				</header>

				<div className="mock-cm__scroll">
					<h3 className="mock-cm__subject">{selected.subject}</h3>

					<div className="mock-cm__summary">
						<span className="mock-cm__sumhead">
							<Sparkles aria-hidden="true" /> Summary
						</span>
						<p>{selected.summary}</p>
					</div>

					<ChatList>
						{messages.map((m, i) => (
							<MessageGroup
								key={i}
								author={m.from}
								time={m.time}
							>
								<ChatMessage>
									<TextMessage>{m.text}</TextMessage>
								</ChatMessage>
								{m.doc ? (
									<ChatMessage>
										<DocumentMessage name={m.doc.name} meta={m.doc.meta} />
									</ChatMessage>
								) : null}
							</MessageGroup>
						))}
					</ChatList>
				</div>

				{smartReplies ? (
					<div className="mock-cm__quick">
						<span className="tw-cue">Quick answers</span>
						<div className="mock-cm__quickrow">
							{selected.quickAnswers.map((q) => (
								<button
									key={q}
									className="mock-cm__quickchip"
									onClick={() => send(q)}
								>
									{q}
								</button>
							))}
						</div>
					</div>
				) : null}

				<div className="mock-cm__composer">
					<span className="mock-cm__to">
						To <strong>{selected.address}</strong>
					</span>
					<ChatComposer
						placeholder={`Reply to ${selected.name}…`}
						onSend={send}
					/>
				</div>
			</section>
		</div>
	);
}
