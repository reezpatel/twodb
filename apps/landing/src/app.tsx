import { useReveal } from "./hooks/use-reveal";
import { Nav } from "./components/nav";
import { Hero } from "./components/hero";
import { Beat } from "./components/beat";
import { CtaBand } from "./components/cta-band";
import { Close } from "./components/close";
import { InboxScene } from "./components/scenes/inbox-scene";
import { AutomationScene } from "./components/scenes/automation-scene";
import { AskScene } from "./components/scenes/ask-scene";
import { MiniAppScene } from "./components/scenes/mini-app-scene";

export function App() {
	useReveal();

	return (
		<div id="top">
			<Nav />
			<Hero />
			<div className="daybreak" aria-hidden="true" />
			<main className="wrap thread dayfield">
				<Beat
					id="beat-morning"
					cue="Act 02 — Morning"
					title="Every inbox is one inbox."
					story="Email, WhatsApp, the team thread — all of it lands in a single morning queue. Your one WhatsApp number belongs to the whole shop: everyone answers from the same place, and you can always see who's replying to whom."
					scene={<InboxScene />}
					vignette={{
						who: "For the content creator",
						line: "You post on three channels. Every reply, from every channel, is in the same queue — so the morning is for answering, not hunting.",
					}}
				/>
				<Beat
					id="beat-midday"
					cue="Act 03 — Midday"
					title="The boring work does itself."
					story="Reminders go out on their own. A new row in a spreadsheet can kick off anything — a welcome email, a follow-up, a reorder. Each one is described in plain words. Never a node graph."
					scene={<AutomationScene />}
					vignette={{
						who: "For the sales agent",
						line: "You're in sales. A new lead in your contacts started the welcome sequence before your first coffee. The follow-up you usually forget is already drafted.",
					}}
					flip
				/>
				<CtaBand />
				<Beat
					id="beat-afternoon"
					cue="Act 04 — Afternoon"
					title="Ask your business anything."
					story="Not a search box — a question, answered from your own records, with the receipts. ‘Which customers haven't paid?’ is an answer, not an afternoon."
					scene={<AskScene />}
					vignette={{
						who: "For the marketer",
						line: "You do the marketing. Ask how the month went; the numbers become a board-ready deck in your brand voice — no late night before the meeting.",
					}}
				/>
				<Beat
					id="beat-evening"
					cue="Act 05 — Evening"
					title="The tool you needed didn't exist. Now it does."
					story="No off-the-shelf app fits every odd job. Describe it in a sentence, and twodb builds a small app around your own data. Tonight it's a weekend delivery board. Tomorrow, whatever the day calls for."
					scene={<MiniAppScene />}
					vignette={{
						who: "For the indie creator",
						line: "You work alone. Your notes link into a map of everything you know, progress lives on a board, and the odd tool you need gets built — no developer hired.",
					}}
					flip
				/>
			</main>
			<Close />
		</div>
	);
}
