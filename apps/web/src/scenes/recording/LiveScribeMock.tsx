import { useEffect, useRef, useState } from "react";
import { Avatar, Button, IconButton, Tabs } from "@twodb/ui";
import {
	Bell,
	ChevronDown,
	ClipboardList,
	Mic,
	MicOff,
	MonitorUp,
	MoreHorizontal,
	PhoneOff,
	Search,
	Sparkles,
	Video,
	VideoOff,
	Waves,
} from "lucide-react";
import { liveScribeStyles } from "./LiveScribeMock.style.jsx";

/* synthetic video placeholders — labelled, on-world hues */
function ph(c1: string, c2: string): string {
	const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='400'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs><rect width='640' height='400' fill='url(#g)'/><circle cx='500' cy='90' r='80' fill='rgba(255,255,255,0.14)'/></svg>`;
	return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const STAGE_IMG = ph("#1a2450", "#3a55ff");
const TILE_IMGS = [
	ph("#0d2b26", "#0f9d8f"),
	ph("#2b1526", "#c2285a"),
	ph("#241d10", "#d9a03f"),
	ph("#131320", "#5c5b6e"),
];

const PARTICIPANTS = [
	{ name: "Ravi Kumar", img: TILE_IMGS[0], micOff: false },
	{ name: "Meera Iyer", img: TILE_IMGS[1], micOff: false },
	{ name: "You", img: TILE_IMGS[2], micOff: true },
	{ name: "Dev Patel", img: TILE_IMGS[3], micOff: true },
];

const SCRIPT: { speaker: string; time: string; text: string }[] = [
	{
		speaker: "Dr. Asha Verma",
		time: "12:22",
		text: "Ward 4 first — Ravi Kumar's discharge summary is ready, but the medication dosage needs one correction before it goes out.",
	},
	{
		speaker: "Ravi Kumar",
		time: "12:21",
		text: "The lab flagged Meera Iyer's lipid panel overnight. I've attached the report to her chart for the 9:40 review.",
	},
	{
		speaker: "Meera Iyer",
		time: "12:19",
		text: "Stock check: gauze and medium gloves are below the reorder line. The order went out Thursday, arriving Monday.",
	},
	{
		speaker: "Dr. Asha Verma",
		time: "12:17",
		text: "Good. Six invoices crossed thirty days this week — the reminders are drafted, someone review the wording before they send.",
	},
	{
		speaker: "Dev Patel",
		time: "12:15",
		text: "I'll take the invoice wording. Also confirming Tuesday's visiting hours with the front desk this afternoon.",
	},
	{
		speaker: "Ravi Kumar",
		time: "12:12",
		text: "New patient intake at 12:30 — Sana Sheikh. Consent forms are printed and at the desk.",
	},
];

export function LiveScribeMock() {
	const [micOn, setMicOn] = useState(true);
	const [camOn, setCamOn] = useState(true);
	const [listening, setListening] = useState(true);
	const [lineCount, setLineCount] = useState(3);
	const [sideTab, setSideTab] = useState("summary");
	const [openKey, setOpenKey] = useState<string | null>("overview");
	const scrollRef = useRef<HTMLDivElement>(null);

	/* the live part: transcript lines arrive while listening */
	useEffect(() => {
		if (!listening) return;
		const t = setInterval(() => {
			setLineCount((n) => (n < SCRIPT.length ? n + 1 : n));
		}, 3200);
		return () => clearInterval(t);
	}, [listening]);

	useEffect(() => {
		scrollRef.current?.scrollTo({
			top: scrollRef.current.scrollHeight,
			behavior: "smooth",
		});
	}, [lineCount]);

	const lines = SCRIPT.slice(0, lineCount);
	const done = lineCount >= SCRIPT.length;

	return (
		<>
			<style jsx>{liveScribeStyles}</style>
			<div className="mock-ls">
				{/* top bar */}
				<header className="mock-ls__bar">
					<div className="mock-ls__title">
						<h2>Ward 4 — Morning Rounds</h2>
						<span>City Clinic weekly review</span>
					</div>
					<div className="mock-ls__baractions">
						<IconButton
							icon={<Search />}
							label="Search"
							variant="ghost"
							size="sm"
						/>
						<IconButton
							icon={<Bell />}
							label="Notifications"
							variant="ghost"
							size="sm"
						/>
						<span className="mock-ls__host">
							<Avatar name="Asha Verma" size="sm" />
							Dr. Asha Verma
						</span>
					</div>
				</header>

				<div className="mock-ls__grid">
					{/* left: stage + live transcript */}
					<div className="mock-ls__left">
						<div className="mock-ls__stage">
							<img
								src={STAGE_IMG}
								alt="Synthetic video placeholder — cobalt stage"
							/>
							<span className="mock-ls__speaker">
								<Avatar name="Asha Verma" size="sm" /> Dr. Asha Verma
							</span>
							<span
								className={listening ? "mock-ls__rec is-live" : "mock-ls__rec"}
							>
								<i />{" "}
								{listening
									? "Transcribing"
									: done
										? "Transcript ready"
										: "Paused"}
							</span>
							<div className="mock-ls__controls">
								<button
									className={micOn ? "mock-ls__ctl" : "mock-ls__ctl is-off"}
									onClick={() => setMicOn((v) => !v)}
									aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
									aria-pressed={!micOn}
								>
									{micOn ? (
										<Mic aria-hidden="true" />
									) : (
										<MicOff aria-hidden="true" />
									)}
								</button>
								<button
									className={camOn ? "mock-ls__ctl" : "mock-ls__ctl is-off"}
									onClick={() => setCamOn((v) => !v)}
									aria-label={camOn ? "Turn camera off" : "Turn camera on"}
									aria-pressed={!camOn}
								>
									{camOn ? (
										<Video aria-hidden="true" />
									) : (
										<VideoOff aria-hidden="true" />
									)}
								</button>
								<button
									className="mock-ls__ctl mock-ls__ctl--end"
									aria-label="Leave call"
								>
									<PhoneOff aria-hidden="true" />
								</button>
								<button className="mock-ls__ctl" aria-label="Share screen">
									<MonitorUp aria-hidden="true" />
								</button>
								<button className="mock-ls__ctl" aria-label="More options">
									<MoreHorizontal aria-hidden="true" />
								</button>
							</div>
						</div>

						{/* live transcription card */}
						<div className="mock-ls__scribe">
							<div className="mock-ls__scribehead">
								<span className="mock-ls__ai">
									<Waves aria-hidden="true" />
									<span>
										<strong>AI Scribe</strong>
										<em>
											{listening ? "Listening…" : done ? "Finished" : "Paused"}
										</em>
									</span>
								</span>
								<span
									className={
										listening ? "mock-ls__wave is-live" : "mock-ls__wave"
									}
									aria-hidden="true"
								>
									{Array.from({ length: 28 }, (_, i) => (
										<i
											key={i}
											style={{ animationDelay: `${(i % 9) * 0.12}s` }}
										/>
									))}
								</span>
								<Button
									size="sm"
									variant={listening ? "secondary" : "primary"}
									onClick={() => setListening((v) => !v)}
								>
									{listening ? "Pause" : done ? "Replay" : "Resume"}
								</Button>
							</div>
							<div className="mock-ls__langs">
								<span className="mock-ls__lang">
									English <ChevronDown aria-hidden="true" />
								</span>
								<span className="mock-ls__swap">
									<Sparkles aria-hidden="true" />
								</span>
								<span className="mock-ls__lang">
									हिन्दी <ChevronDown aria-hidden="true" />
								</span>
							</div>
							<div className="mock-ls__lines" ref={scrollRef}>
								{lines.map((l, i) => (
									<div className="mock-ls__line" key={i}>
										<Avatar name={l.speaker} size="sm" />
										<div>
											<span className="mock-ls__lmeta">
												<strong>{l.speaker}</strong> · {l.time}
											</span>
											<p>{l.text}</p>
										</div>
									</div>
								))}
								{listening && !done ? (
									<div className="mock-ls__line mock-ls__line--pending">
										<span className="mock-ls__dots">
											<i />
											<i />
											<i />
										</span>
									</div>
								) : null}
							</div>
						</div>
					</div>

					{/* right: participants + summary */}
					<aside className="mock-ls__right">
						<div className="mock-ls__panel">
							<div className="mock-ls__panelhead">
								<h3>Participants</h3>
								<span className="mock-ls__showall">Show all (6)</span>
							</div>
							<div className="mock-ls__tiles">
								{PARTICIPANTS.map((p) => (
									<div className="mock-ls__tile" key={p.name}>
										<img
											src={p.img}
											alt={`Synthetic video placeholder — ${p.name}`}
										/>
										<span className="mock-ls__tname">
											<Avatar name={p.name} size="sm" /> {p.name}
										</span>
										{p.micOff ? (
											<span className="mock-ls__tmic">
												<MicOff aria-hidden="true" />
											</span>
										) : null}
									</div>
								))}
							</div>
						</div>

						<Tabs
							aria-label="Summary or transcript"
							items={[
								{ id: "summary", label: "Summary" },
								{ id: "transcript", label: "Transcript" },
							]}
							value={sideTab}
							onValueChange={setSideTab}
						/>

						{sideTab === "summary" ? (
							<>
								<div className="mock-ls__panel">
									<button
										className="mock-ls__acc"
										aria-expanded={openKey === "overview"}
										onClick={() =>
											setOpenKey(openKey === "overview" ? null : "overview")
										}
									>
										<ClipboardList aria-hidden="true" /> Overview
										<ChevronDown aria-hidden="true" />
									</button>
									{openKey === "overview" ? (
										<p className="mock-ls__accbody">
											Morning rounds for ward 4: one discharge correction, one
											flagged lab panel, stock order arriving Monday, and
											invoice reminders pending a wording review.
										</p>
									) : null}
								</div>
								<div className="mock-ls__panel">
									<button
										className="mock-ls__acc"
										aria-expanded={openKey === "points"}
										onClick={() =>
											setOpenKey(openKey === "points" ? null : "points")
										}
									>
										<Sparkles aria-hidden="true" /> Key points
										<ChevronDown aria-hidden="true" />
									</button>
									{openKey === "points" ? (
										<ol className="mock-ls__points">
											<li>
												Correct Ravi Kumar's dosage before the summary goes out.
											</li>
											<li>
												Review Meera Iyer's flagged lipid panel before 9:40.
											</li>
											<li>
												Stock order arrives Monday — confirm quantities at
												intake.
											</li>
											<li>Dev reviews invoice reminder wording today.</li>
											<li>
												Tuesday visiting hours to be confirmed by the front
												desk.
											</li>
										</ol>
									) : null}
								</div>
							</>
						) : (
							<div className="mock-ls__panel mock-ls__side">
								{lines.map((l, i) => (
									<div className="mock-ls__sline" key={i}>
										<span className="mock-ls__stime">{l.time}</span>
										<p>
											<strong>{l.speaker}:</strong> {l.text}
										</p>
									</div>
								))}
								{!lines.length ? (
									<p className="mock-ls__accbody">Nothing transcribed yet.</p>
								) : null}
							</div>
						)}
					</aside>
				</div>
			</div>
		</>
	);
}
