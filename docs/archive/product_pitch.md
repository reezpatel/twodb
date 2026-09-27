# twodb — Product Pitch

## The problem

The people who need a second brain most can't have one.

A doctor running a small clinic juggles ward notes, lab reports, stock orders, invoices, and a phone full of voice memos. A shop owner's entire business lives in a notebook and a WhatsApp thread. Their knowledge is scattered across paper, chat apps, and memory — and the tools that promise to fix this were not built for them.

Notion gives you docs but expects you to be your own IT department. Obsidian's power hides behind plugins and markdown. n8n's automation assumes you think in node graphs. AI app builders assume you can read code. Every one of these tools answers to a developer's mental model — and quietly excludes the billions of professionals who don't share it.

## The insight

Non-technical professionals don't lack discipline or data. They lack a tool that meets them where they are: **capture in plain language, recall without filing, and action without configuration.**

The next great knowledge product won't win on features. It will win by removing the developer from the loop entirely — the product itself becomes the technical co-founder.

## The product

**twodb is a second brain for people who are not technical.**

One calm, Notion-simple surface where a professional can:

- **Capture** — notes, docs, files, meetings. Dump it in; no folder taxonomy required.
- **Connect** — everything links to everything: a patient, an invoice, a meeting, a note.
- **Recall** — ask in plain language, get answers from *your* data.
- **Act** — automations you describe in a sentence, not a flowchart.
- **Build** — small purpose-built apps, generated for you by the built-in AI. No code, ever.

### A day with twodb

Dr. Asha Verma starts morning rounds. Her meeting is already recording — twodb transcribes every voice, live, in English and Hindi. By the time rounds end, there's a summary: one discharge correction, one flagged lab panel, stock arriving Monday, six invoices past thirty days. The action items are already tasks. The invoice reminders are drafted. She never opened a settings page, wrote a formula, or configured an integration. She just worked — and the second brain kept up.

This isn't a render on a slide. This exact scene is the product's working prototype today.

## Why now

1. **AI crossed the usability threshold.** Transcription, summarization, and code generation are finally good enough to hide entirely behind plain language. The interface for automation is no longer a node graph — it's a sentence.
2. **The incumbents can't follow.** Notion, Obsidian, and n8n are structurally committed to their power-user bases. Stripping their products down to non-technical simplicity would cannibalize what their users pay for. Simplicity-for-everyone is a claim they cannot truthfully copy.
3. **The audience is the majority.** Technical knowledge workers are a rounding error next to the world's doctors, shop owners, teachers, and contractors — and nobody is building the full stack for them.

## The moat

**Architecture as empathy.** twodb isn't a wrapper on someone else's AI. It's a plugin platform — identity, content, calendar, chat, meetings, storage, agents, and a distributed node fleet for storage, code execution, and background jobs — unified by one typed event fabric. Every capability shares the same data and context, so the AI layer doesn't just chat: it acts across the whole product. Each feature we ship makes every other feature smarter.

Competitors can copy a feature. They can't copy the compound effect of one brain with many skills.

## Where we are

The platform is real and running:

- **Working end-to-end:** multi-workspace identity with permissions, chat, configurable AI agents with threads and usage tracking, and a fleet of child nodes that register, authenticate, and stream liveness.
- **Real backends, prototype UI:** structured content (Notion-style databases), calendar with Google/Microsoft/CalDAV sync, file storage, and meetings — with multi-track recording, live transcripts, and AI summaries.
- **A binding design language** built for calm: no glow, no clutter, plain language everywhere — approachability enforced as a system rule, not a guideline.

## What's next

1. **Wire the intelligence loop:** live meeting transcripts streaming to the UI, action items flowing into tasks, summaries triggering automations.
2. **Automations in plain language:** "every Friday, remind me about unpaid invoices" becomes a running job on the node fleet.
3. **The app builder:** the agent layer graduates from answering to building — small tools, generated on request.
4. **Trust features for regulated users:** recording consent, retention policies, and audit trails — the features that make a clinic say yes.

## The ask

We're building the second brain for the other 99%. If you're an investor, a design partner, or a professional who lives the problem above — we want to talk. The clinic scenario isn't our marketing story; it's our test suite. Come see it run.

---

*twodb — one brain, many skills. Built for people who have better things to do than configure software.*
