import { useRef, useState, type ReactNode } from "react";
import { chatSceneStyles } from "./ChatScene.style.jsx";
import { Avatar, Badge, Button, IconButton, Tabs, Tooltip } from "@twodb/ui";
import {
	AtSign,
	Bookmark,
	Box,
	FileText,
	Inbox,
	Link2,
	Mic,
	Paperclip,
	Pin,
	Plus,
	Search,
	Smile,
	Sparkles,
	User,
	Zap,
} from "lucide-react";

interface Member {
	name: string;
	role: string;
	team: "Design" | "Management" | "Development";
	online?: boolean;
}

const MEMBERS: Member[] = [
	{
		name: "Daniel Anderson",
		role: "Art director",
		team: "Design",
		online: true,
	},
	{
		name: "Andrew Miller",
		role: "Product owner",
		team: "Management",
		online: true,
	},
	{
		name: "William Johnson",
		role: "UX/UI designer",
		team: "Design",
		online: true,
	},
	{ name: "Emily Davis", role: "Front-end dev", team: "Development" },
	{ name: "Diana Taylor", role: "UI designer", team: "Design", online: true },
	{ name: "Sophia Wilson", role: "UX lead", team: "Design" },
	{
		name: "Liam Chen",
		role: "Front-end dev",
		team: "Development",
		online: true,
	},
	{ name: "Priya Nair", role: "QA engineer", team: "Development" },
	{ name: "Noah Reed", role: "Strategy", team: "Management" },
];

const CHANNELS = [
	{ id: "general", label: "General", depth: 0, count: 1 },
	{ id: "frontend", label: "Front-end", depth: 0, count: 4 },
	{ id: "website", label: "Website", depth: 0 },
	{ id: "v30", label: "v3.0", depth: 1 },
	{ id: "wireframe", label: "Wireframe", depth: 2 },
	{ id: "design", label: "Design", depth: 2 },
	{ id: "uikit", label: "UI-kit design", depth: 2 },
	{ id: "v20", label: "v2.0 — actual version", depth: 1 },
	{ id: "strategy", label: "Strategy", depth: 0 },
	{ id: "events", label: "Events", depth: 0 },
	{ id: "announcements", label: "Announcements", depth: 0 },
	{ id: "uiux", label: "UI/UX", depth: 0, count: 2 },
];

const ACTIVITY = [
	0.15, 0.3, 0.15, 0.55, 0.3, 0.7, 0.15, 0.4, 0.85, 0.3, 0.55, 0.15, 0.7, 0.4,
	0.15, 0.9, 0.55, 0.3, 0.15, 0.7,
];

interface Post {
	id: string;
	author: string;
	when: string;
	body: ReactNode;
	reactions?: { emoji: string; count: number }[];
	linkCard?: { title: string; url: string };
}

function withMentions(text: string) {
	const parts = text.split(/(@[A-Z][\w/.]+(?:\s[A-Z]\.)?)/g);
	return parts.map((p, i) =>
		p.startsWith("@") ? (
			<span key={i} className="mock-dd__mention">
				<style jsx>{chatSceneStyles}</style>
				{p}
			</span>
		) : (
			p
		),
	);
}

function ReactionChip({ emoji, count }: { emoji: string; count: number }) {
	const [active, setActive] = useState(false);
	return (
		<button
			type="button"
			className={
				active
					? "mock-dd__reaction mock-dd__reaction--active"
					: "mock-dd__reaction"
			}
			onClick={() => setActive((a) => !a)}
		>
			<style jsx>{chatSceneStyles}</style>
			{emoji} <b className="tw-tnum">{count + (active ? 1 : 0)}</b>
		</button>
	);
}

function Post({ post, last }: { post: Post; last?: boolean }) {
	return (
		<article
			className={last ? "mock-dd__post mock-dd__post--last" : "mock-dd__post"}
		>
			<style jsx>{chatSceneStyles}</style>
			<Avatar name={post.author} size="md" />
			<div className="mock-dd__post-main">
				<header className="mock-dd__post-head">
					<strong>{post.author}</strong>
					<span className="tw-tnum">{post.when}</span>
				</header>
				<p>{post.body}</p>
				{post.linkCard ? (
					<div className="mock-dd__linkcard">
						<span className="mock-dd__linkicon">
							<Link2 size={14} aria-hidden="true" />
						</span>
						<div className="mock-dd__linktext">
							<strong>{post.linkCard.title}</strong>
							<span>{post.linkCard.url}</span>
						</div>
						<Button size="sm" variant="secondary">
							Quick view
						</Button>
					</div>
				) : null}
				{post.reactions ? (
					<div className="mock-dd__reactions">
						{post.reactions.map((r) => (
							<ReactionChip key={r.emoji} emoji={r.emoji} count={r.count} />
						))}
					</div>
				) : null}
			</div>
		</article>
	);
}

function Composer({ onSend }: { onSend: (text: string) => void }) {
	const [text, setText] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	const atMatch = text.match(/@(\w*)$/);
	const suggestions = atMatch
		? MEMBERS.filter((m) =>
				m.name.toLowerCase().includes(atMatch[1].toLowerCase()),
			).slice(0, 4)
		: [];

	function insertMention(name: string) {
		setText((t) => t.replace(/@(\w*)$/, `@${name.split(" ")[0]} `));
		inputRef.current?.focus();
	}

	function send() {
		if (!text.trim()) return;
		onSend(text.trim());
		setText("");
	}

	return (
		<div className="mock-dd__composer">
			<style jsx>{chatSceneStyles}</style>
			{suggestions.length ? (
				<div className="mock-dd__mentions">
					<span className="tw-cue">Members</span>
					{suggestions.map((m) => (
						<button
							key={m.name}
							type="button"
							className="mock-dd__mention-row"
							onClick={() => insertMention(m.name)}
						>
							<Avatar name={m.name} size="sm" />
							{m.name}
						</button>
					))}
				</div>
			) : null}
			<div className="mock-dd__composer-bar">
				<IconButton label="AI assist" icon={<Sparkles />} />
				<IconButton label="Mention" icon={<AtSign />} />
				<IconButton label="Quick action" icon={<Zap />} />
				<IconButton label="Emoji" icon={<Smile />} />
				<IconButton label="Attach" icon={<Paperclip />} />
				<IconButton label="Voice" icon={<Mic />} />
				<input
					ref={inputRef}
					className="mock-dd__input"
					placeholder="Write a reply… try typing @"
					value={text}
					onChange={(e) => setText(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") send();
					}}
					aria-label="Write a reply"
				/>
				<Button
					size="sm"
					variant="ghost"
					className="mock-dd__discard"
					onClick={() => setText("")}
				>
					Discard
				</Button>
				<Button
					size="sm"
					className="mock-dd__send"
					onClick={send}
					disabled={!text.trim()}
				>
					Send
				</Button>
			</div>
		</div>
	);
}

export function ChatScene() {
	const [channel, setChannel] = useState("uikit");
	const [infoTab, setInfoTab] = useState("info");
	const [posts, setPosts] = useState<Post[]>([
		{
			id: "p1",
			author: "Andrew Miller",
			when: "2d ago",
			body: withMentions(
				"Hey team, I wanted to discuss the custom UI-kit we're developing for the site redesign. We need to finalize some components and make key design decisions to ensure consistency across the board. Let's make sure we cover colors, typography, buttons, and any other essential UI elements. @UX/UI @Sophia",
			),
			reactions: [{ emoji: "✌️", count: 2 }],
		},
		{
			id: "p2",
			author: "Diana Taylor",
			when: "2d ago",
			body: withMentions(
				"I have already prepared all styles and components according to our standards during the design phase, so the UI kit is 90% complete. All that remains is to add some states to the interactive elements and prepare the Lottie files for animations. @Emily D., please take a look and let me know if you have any questions.",
			),
			linkCard: { title: "Conceptzilla website v.3.0", url: "www.figma.com" },
			reactions: [{ emoji: "❤️", count: 1 }],
		},
		{
			id: "p3",
			author: "Daniel Anderson",
			when: "3h ago",
			body: withMentions(
				"Okay, keep me updated. @Diana T. I also wanted to remind you to keep the layers organized.",
			),
			reactions: [{ emoji: "💪", count: 2 }],
		},
	]);

	function send(text: string) {
		setPosts((cur) => [
			...cur,
			{
				id: `p${Date.now()}`,
				author: "You",
				when: "now",
				body: withMentions(text),
			},
		]);
	}

	return (
		<div className="mock-dd">
			<style jsx>{chatSceneStyles}</style>
			{/* channels sidebar */}
			<aside className="mock-dd__side">
				<div className="mock-dd__workspace">
					<strong>Conceptzilla</strong>
					<IconButton size="sm" label="Search workspace" icon={<Search />} />
				</div>
				<nav className="mock-dd__quick">
					<span className="mock-dd__quickitem">
						<Sparkles size={15} /> Assistant{" "}
						<Badge tone="rose" size="sm">
							New
						</Badge>
					</span>
					<span className="mock-dd__quickitem">
						<FileText size={15} /> Drafts
					</span>
					<span className="mock-dd__quickitem">
						<Bookmark size={15} /> Saved items
					</span>
					<span className="mock-dd__quickitem">
						<Inbox size={15} /> Inbox <b className="tw-tnum">8</b>
					</span>
					<span className="mock-dd__quickitem">
						<User size={15} /> Direct messages <b className="tw-tnum">1</b>
					</span>
				</nav>
				<div className="mock-dd__chanhead">
					<span className="tw-cue">Channels</span>
					<IconButton size="sm" label="Add channel" icon={<Plus />} />
				</div>
				<nav className="mock-dd__channels">
					{CHANNELS.map((c) => (
						<button
							key={c.id}
							type="button"
							className={
								c.id === channel
									? "mock-dd__chan mock-dd__chan--active"
									: "mock-dd__chan"
							}
							style={{ paddingLeft: 8 + c.depth * 16 }}
							onClick={() => setChannel(c.id)}
						>
							{c.depth === 0 ? (
								<span className="mock-dd__hash">#</span>
							) : (
								<span className="mock-dd__hash">↳</span>
							)}
							{c.label}
							{c.count ? <b className="tw-tnum">{c.count}</b> : null}
						</button>
					))}
				</nav>
			</aside>

			{/* thread */}
			<section className="mock-dd__thread">
				<header className="mock-dd__thread-head">
					<span className="mock-dd__crumbs">
						<span className="mock-dd__hash">#</span> Website / v3.0 /{" "}
						<strong>UI-kit design</strong>
					</span>
					<Tooltip tip="9 members">
						<span className="mock-dd__facepile">
							{MEMBERS.slice(0, 4).map((m) => (
								<Avatar key={m.name} name={m.name} size="sm" />
							))}
						</span>
					</Tooltip>
				</header>

				<div className="mock-dd__posts">
					{posts.map((p, i) => (
						<Post key={p.id} post={p} last={i === posts.length - 1} />
					))}
				</div>

				<Composer onSend={send} />
			</section>

			{/* info panel */}
			<aside className="mock-dd__info">
				<Tabs
					aria-label="Thread info"
					value={infoTab}
					onValueChange={setInfoTab}
					items={[
						{ id: "info", label: "Info" },
						{ id: "pins", label: "Pins" },
						{ id: "files", label: "Files" },
						{ id: "links", label: "Links" },
					]}
				/>

				{infoTab === "info" ? (
					<>
						<section className="mock-dd__infosec">
							<h4>Main info</h4>
							<dl className="mock-dd__meta">
								<div>
									<dt>Creator</dt>
									<dd>Andrew M.</dd>
								</div>
								<div>
									<dt>Date of creation</dt>
									<dd className="tw-tnum">28 May</dd>
								</div>
								<div>
									<dt>Status</dt>
									<dd>
										<Badge tone="go" size="sm">
											Active
										</Badge>
									</dd>
								</div>
								<div>
									<dt>Tags</dt>
									<dd className="tw-tnum">13</dd>
								</div>
								<div>
									<dt>Tasks</dt>
									<dd className="tw-tnum">4</dd>
								</div>
							</dl>
						</section>

						<section className="mock-dd__infosec">
							<h4>Linked threads</h4>
							<div className="mock-dd__linked">
								<span>
									<span className="mock-dd__hash">#</span> Front-end{" "}
									<b className="tw-tnum">4</b>
								</span>
								<span>
									<span className="mock-dd__hash">#</span> UI-kit design
									standards
								</span>
							</div>
						</section>

						<section className="mock-dd__infosec">
							<h4>Thread activity</h4>
							<div className="mock-dd__activity">
								{ACTIVITY.map((v, i) => (
									<i key={i} style={{ opacity: v }} />
								))}
							</div>
						</section>

						<section className="mock-dd__infosec">
							<h4>
								Members <b className="tw-tnum">9</b>
							</h4>
							<div className="mock-dd__members">
								{MEMBERS.map((m) => (
									<div key={m.name} className="mock-dd__member">
										<span className="mock-dd__member-avatar">
											<Avatar name={m.name} size="md" />
											{m.online ? <i className="mock-dd__online" /> : null}
										</span>
										<div className="mock-dd__member-text">
											<strong>{m.name}</strong>
											<span>{m.role}</span>
										</div>
										<Badge
											size="sm"
											tone={
												m.team === "Design"
													? "go"
													: m.team === "Management"
														? "warning"
														: "rose"
											}
										>
											{m.team}
										</Badge>
									</div>
								))}
							</div>
						</section>
					</>
				) : infoTab === "pins" ? (
					<div className="mock-dd__alt">
						<div className="mock-dd__linkcard">
							<span className="mock-dd__linkicon">
								<Pin size={14} />
							</span>
							<div className="mock-dd__linktext">
								<strong>UI-kit is 90% complete</strong>
								<span>Diana Taylor · pinned 2d ago</span>
							</div>
						</div>
					</div>
				) : infoTab === "files" ? (
					<div className="mock-dd__alt">
						{["Lottie-animations.zip · 4.1 MB", "ui-kit-v3.fig · 12 MB"].map(
							(f) => (
								<div key={f} className="mock-dd__linkcard">
									<span className="mock-dd__linkicon">
										<FileText size={14} />
									</span>
									<div className="mock-dd__linktext">
										<strong>{f.split(" · ")[0]}</strong>
										<span>{f.split(" · ")[1]}</span>
									</div>
								</div>
							),
						)}
					</div>
				) : (
					<div className="mock-dd__alt">
						<div className="mock-dd__linkcard">
							<span className="mock-dd__linkicon">
								<Box size={14} />
							</span>
							<div className="mock-dd__linktext">
								<strong>Conceptzilla website v.3.0</strong>
								<span>www.figma.com</span>
							</div>
						</div>
					</div>
				)}
			</aside>
		</div>
	);
}
