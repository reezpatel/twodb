import { useState } from "react";
import {
	Avatar,
	Badge,
	Button,
	Dialog,
	IconButton,
	Input,
	Menu,
	MenuDivider,
	MenuItem,
	NavPanelGroup,
	NavPanelItem,
	SearchInput,
	Textarea,
	Tooltip,
} from "@twodb/ui";
import {
	Archive,
	Bell,
	ChevronLeft,
	ChevronRight,
	Clock,
	CornerUpLeft,
	CornerUpRight,
	FileText,
	Inbox as InboxIcon,
	Pencil,
	Pin,
	Reply,
	Send,
	ShieldAlert,
	Sparkles,
	Star,
	Trash2,
} from "lucide-react";

/* ---------------- data ---------------- */

interface Thread {
	id: string;
	from: string;
	count?: number;
	time: string;
	snippet: string;
	pinned?: boolean;
	unread?: boolean;
}

const THREADS: Thread[] = [
	{
		id: "sitemap",
		from: "Ava, Ethan, Sophia, Me",
		count: 12,
		time: "10:15",
		snippet: "Hello Design Team,…",
		pinned: true,
		unread: true,
	},
	{
		id: "oliver",
		from: "Oliver from Nissan",
		count: 5,
		time: "10:45",
		snippet: "Let's finalize these details during o…",
		pinned: true,
	},
	{
		id: "luna",
		from: "Luna from BrightCo",
		count: 15,
		time: "09:30",
		snippet: "Hi! I've just uploaded the newest b…",
		pinned: true,
	},
	{
		id: "liam",
		from: "Liam",
		count: 10,
		time: "09:50",
		snippet: "It's still a bit rough, but I'm open to…",
		unread: true,
	},
	{
		id: "helena",
		from: "Helena Ross",
		count: 4,
		time: "09:50",
		snippet: "Sorry, my bad. Those projects wer…",
	},
	{
		id: "coinbase",
		from: "Coinbase",
		time: "15 Jun",
		snippet: "You have received a transfer from…",
	},
	{
		id: "wise",
		from: "Wise",
		time: "09:55",
		snippet: "You received an incoming transfer…",
	},
	{
		id: "tripadvisor",
		from: "TripAdvisor",
		time: "8 Jun",
		snippet: "Good news incoming",
	},
	{
		id: "figma",
		from: "Figma",
		time: "09:40",
		snippet: "Your request to view “Coptera” ha…",
	},
	{
		id: "webflow",
		from: "Webflow",
		time: "15 Jun",
		snippet: "Exciting news ahead! Your templa…",
	},
	{
		id: "binance",
		from: "Binance",
		time: "8 Jun",
		snippet: "You received an incoming transfer…",
	},
];

interface Message {
	id: string;
	author: string;
	email: string;
	time: string;
	to: string[];
	cc?: string[];
	body: string;
	attachments?: { name: string; size: string }[];
}

const SITEMAP_MESSAGES: Message[] = [
	{
		id: "m1",
		author: "Ava Thompson",
		email: "ava.thompson@uxerflow.com",
		time: "10:15",
		to: ["Ethan"],
		cc: ["Sophia", "Liam"],
		body: "Hello Team, I have gathered the latest updates regarding our project based on the recent feedback from our users. The focus is on enhancing usability, minimizing clutter, and ensuring a seamless experience for our primary users. I look forward to your thoughts and any additional suggestions for improvement.",
		attachments: [
			{ name: "user-feedback.pdf", size: "1.5 MB" },
			{ name: "project-overview.fig", size: "5.2 MB" },
		],
	},
	{
		id: "m2",
		author: "Ethan Carter",
		email: "ethan.carter@uxerflow.com",
		time: "10:24",
		to: ["Me"],
		cc: ["Sophia", "Liam"],
		body: "Hi everyone, I've revamped the navigation layout and introduced a new section for quick access to frequently used features. I also adjusted the margins to align with our updated design standards. Please review and share your feedback before we proceed!",
		attachments: [
			{ name: "frequently used features.pdf", size: "1.5 MB" },
			{ name: "navigation flow & scenario.pdf", size: "1.5 MB" },
		],
	},
	{
		id: "m3",
		author: "Sophia Lee",
		email: "sophia.lee@uxerflow.com",
		time: "10:30",
		to: ["Me", "Ethan"],
		cc: ["Liam"],
		body: "Looks good to me. The quick-access section reads clearly on mobile now — ship it after Liam's pass on the margins.",
	},
];

const FOLDERS = [
	{ id: "inbox", label: "Inbox", icon: <InboxIcon />, count: 340 },
	{ id: "starred", label: "Starred", icon: <Star />, count: 3 },
	{ id: "sent", label: "Sent", icon: <Send /> },
	{ id: "drafts", label: "Drafts", icon: <FileText />, count: 8 },
	{ id: "scheduled", label: "Scheduled", icon: <Clock /> },
	{ id: "archive", label: "Archive", icon: <Archive /> },
	{ id: "spam", label: "Spam", icon: <ShieldAlert /> },
	{ id: "trash", label: "Trash", icon: <Trash2 /> },
];

const LABELS = [
	{
		id: "marketing",
		label: "Marketing",
		count: 35,
		tone: "var(--twdb-cobalt)",
	},
	{ id: "finance", label: "Finance", count: 20, tone: "var(--twdb-rose)" },
	{
		id: "operation",
		label: "Operation",
		count: 14,
		tone: "var(--twdb-rose-light)",
	},
];

/* ---------------- pieces ---------------- */

function ThreadRow({
	thread,
	active,
	onSelect,
}: {
	thread: Thread;
	active: boolean;
	onSelect: () => void;
}) {
	return (
		<button
			type="button"
			className={
				active ? "mock-in__thread mock-in__thread--active" : "mock-in__thread"
			}
			onClick={onSelect}
		>
			<Avatar name={thread.from} size="md" />
			<span className="mock-in__thread-main">
				<span className="mock-in__thread-top">
					<strong>{thread.from}</strong>
					{thread.count ? <Badge size="sm">{thread.count}</Badge> : null}
					<span className="mock-in__thread-time tw-tnum">{thread.time}</span>
				</span>
				<span className="mock-in__thread-snippet">{thread.snippet}</span>
			</span>
			{thread.unread ? (
				<i className="mock-in__unread" aria-label="Unread" />
			) : null}
		</button>
	);
}

function MessageBlock({ message }: { message: Message }) {
	const [starred, setStarred] = useState(false);
	return (
		<article className="mock-in__msg">
			<header className="mock-in__msg-head">
				<Avatar name={message.author} size="md" />
				<div className="mock-in__msg-who">
					<strong>{message.author}</strong>
					<span>{message.email}</span>
				</div>
				<span className="mock-in__msg-time tw-tnum">{message.time}</span>
				<IconButton
					size="sm"
					label={starred ? "Unstar" : "Star"}
					icon={<Star fill={starred ? "currentColor" : "none"} />}
					className={starred ? "mock-in__starred" : ""}
					onClick={() => setStarred((s) => !s)}
				/>
				<IconButton size="sm" label="Reply" icon={<Reply />} />
				<Menu
					placement="bottom-end"
					trigger={
						<IconButton
							size="sm"
							label="More actions"
							icon={<CornerUpRight />}
						/>
					}
				>
					<MenuItem icon={<CornerUpLeft />}>Reply all</MenuItem>
					<MenuItem icon={<Pin />}>Pin message</MenuItem>
					<MenuDivider />
					<MenuItem icon={<Trash2 />} danger>
						Delete
					</MenuItem>
				</Menu>
			</header>
			<div className="mock-in__msg-recips">
				<span className="mock-in__recip-label">To</span>
				{message.to.map((t) => (
					<span key={t} className="mock-in__chip">
						<Avatar name={t} size="sm" /> {t}
					</span>
				))}
				{message.cc ? (
					<>
						<span className="mock-in__recip-label">Cc</span>
						{message.cc.map((t) => (
							<span key={t} className="mock-in__chip">
								<Avatar name={t} size="sm" /> {t}
							</span>
						))}
					</>
				) : null}
			</div>
			<p className="mock-in__msg-body">{message.body}</p>
			{message.attachments ? (
				<div className="mock-in__attach">
					{message.attachments.map((a) => (
						<span key={a.name} className="mock-in__chip mock-in__chip--file">
							<FileText size={13} aria-hidden="true" />
							{a.name}
							<em className="tw-tnum">{a.size}</em>
						</span>
					))}
				</div>
			) : null}
		</article>
	);
}

/* ---------------- main ---------------- */

export function InboxMock() {
	const [folder, setFolder] = useState("inbox");
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState<string | null>("sitemap");
	const [composeOpen, setComposeOpen] = useState(false);

	const q = query.trim().toLowerCase();
	const visible = THREADS.filter((t) => !q || t.from.toLowerCase().includes(q));
	const pinned = visible.filter((t) => t.pinned);
	const rest = visible.filter((t) => !t.pinned);

	return (
		<div className="mock-in">
			{/* folders rail */}
			<aside className="mock-in__folders">
				<div className="mock-in__account">
					<Avatar name="Uxerflow" size="md" />
					<div className="mock-in__account-text">
						<strong>Uxerflow</strong>
						<span>uxerflow@gmail.design</span>
					</div>
				</div>
				<Button onClick={() => setComposeOpen(true)}>
					<Pencil size={14} aria-hidden="true" />
					Compose
				</Button>
				<NavPanelGroup>
					{FOLDERS.map((f) => (
						<NavPanelItem
							key={f.id}
							icon={f.icon}
							label={f.label}
							active={f.id === folder}
							onClick={() => setFolder(f.id)}
							meta={
								f.count ? (
									<span className="tw-tnum mock-in__count">{f.count}</span>
								) : undefined
							}
						/>
					))}
				</NavPanelGroup>
				<div className="mock-in__labels">
					<div className="mock-in__labels-head">
						<span className="tw-cue">Labels</span>
					</div>
					{LABELS.map((l) => (
						<span key={l.id} className="mock-in__label">
							<i style={{ background: l.tone }} />
							{l.label}
							<b className="tw-tnum">{l.count}</b>
						</span>
					))}
				</div>
				<div className="mock-in__folders-foot">
					<NavPanelGroup>
						<NavPanelItem icon={<Sparkles />} label="Settings" />
						<NavPanelItem icon={<Bell />} label="Help Center" />
					</NavPanelGroup>
				</div>
			</aside>

			{/* thread list */}
			<section className="mock-in__list">
				<header className="mock-in__list-head">
					<h3>
						{FOLDERS.find((f) => f.id === folder)?.label ?? "Inbox"}
						<span className="tw-tnum">340 messages</span>
					</h3>
				</header>
				<SearchInput
					placeholder="Search"
					aria-label="Search messages"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
				/>
				<div className="mock-in__threads">
					{pinned.length ? (
						<>
							<span className="mock-in__group tw-cue">
								<Pin size={10} aria-hidden="true" /> Pinned
							</span>
							{pinned.map((t) => (
								<ThreadRow
									key={t.id}
									thread={t}
									active={selected === t.id}
									onSelect={() => setSelected(t.id)}
								/>
							))}
						</>
					) : null}
					{rest.length ? (
						<>
							<span className="mock-in__group tw-cue">Primary</span>
							{rest.map((t) => (
								<ThreadRow
									key={t.id}
									thread={t}
									active={selected === t.id}
									onSelect={() => setSelected(t.id)}
								/>
							))}
						</>
					) : null}
				</div>
			</section>

			{/* reading pane */}
			<section className="mock-in__read">
				{selected === "sitemap" ? (
					<>
						<div className="mock-in__toolbar">
							<IconButton label="Reply" icon={<Reply />} />
							<IconButton label="Reply all" icon={<CornerUpLeft />} />
							<Tooltip tip="Summarize with AI">
								<IconButton label="AI summary" icon={<Sparkles />} />
							</Tooltip>
							<IconButton label="Pin" icon={<Pin />} />
							<IconButton label="Star" icon={<Star />} />
							<IconButton label="Snooze" icon={<Clock />} />
							<IconButton label="Delete" icon={<Trash2 />} />
							<span className="mock-in__pager tw-tnum">
								1 from 340
								<IconButton
									size="sm"
									variant="secondary"
									label="Newer"
									icon={<ChevronLeft />}
								/>
								<IconButton
									size="sm"
									variant="secondary"
									label="Older"
									icon={<ChevronRight />}
								/>
							</span>
							<IconButton
								label="Close conversation"
								icon={<ChevronRight />}
								onClick={() => setSelected(null)}
							/>
						</div>

						<div className="mock-in__scroll">
							<span className="mock-in__date tw-tnum">
								June 24, 2026 · 10:15 AM
							</span>
							<h3 className="mock-in__subject">
								Re: Sitemap Refinements <Badge>10</Badge>
							</h3>

							<div className="mock-in__summary">
								<span className="mock-in__summary-label">
									<Sparkles size={13} aria-hidden="true" /> Summary
								</span>
								<p>
									The navigation layout has been revamped, and a new section for
									quick access to frequently used features has been added.
									Margins have been adjusted to meet updated design standards.
									Feedback is requested before moving forward.
								</p>
							</div>

							{SITEMAP_MESSAGES.map((m) => (
								<MessageBlock key={m.id} message={m} />
							))}
						</div>
					</>
				) : selected ? (
					<div className="mock-in__empty">
						<p>
							<strong>{THREADS.find((t) => t.id === selected)?.from}</strong> —
							this conversation's messages come with the mail connection. The
							sitemap thread is fully mocked.
						</p>
						<Button
							size="sm"
							variant="secondary"
							onClick={() => setSelected("sitemap")}
						>
							Open the sitemap thread
						</Button>
					</div>
				) : (
					<div className="mock-in__empty">
						<p>No conversation selected.</p>
						<Button
							size="sm"
							variant="secondary"
							onClick={() => setSelected("sitemap")}
						>
							Open the sitemap thread
						</Button>
					</div>
				)}
			</section>

			<Dialog
				open={composeOpen}
				onClose={() => setComposeOpen(false)}
				title="New message"
				footer={
					<>
						<Button variant="ghost" onClick={() => setComposeOpen(false)}>
							Discard
						</Button>
						<Button onClick={() => setComposeOpen(false)}>
							<Send size={14} aria-hidden="true" />
							Send
						</Button>
					</>
				}
			>
				<div className="mock-in__compose">
					<Input label="To" placeholder="ethan@uxerflow.com" />
					<Input label="Subject" placeholder="What's this about?" />
					<Textarea label="Message" placeholder="Write it like you'd say it…" />
				</div>
			</Dialog>
		</div>
	);
}
