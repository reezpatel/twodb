# twodb Landing Page — Design Brief

Surface: marketing landing page (route TBD, e.g. `/` of a future `apps/landing`)
Mode: **Persuade** — the visitor decides and acts.
Status: direction brief — approved inputs below, no layout/code yet.

This is the surface brief for the landing page. Global product truth lives in
`PRODUCT.md`; the durable visual system lives in `DESIGN.md` (Cyclorama Dawn)
and is **inherited, not reinvented** — this page is a new surface inside an
established world.

## 1. Confirmed inputs (owner decisions)

- **Primary action: "Join the waitlist."** Email capture is the conversion;
  the page's job is to earn the email. No signup flow exists yet.
- **Proof strategy: story-led with UI support.** A narrative carries the
  page; the real product UI illustrates each beat. No fabricated
  testimonials, metrics, or logos (PRODUCT.md: "Evidence on Hand — None").
- **Audiences (expanded 2026-08-14):** small business owners first, and
  explicitly also **indie creators, content creators, sales agents, and
  marketers** — one-person companies and tiny teams who feel the same pain.
  The page must impress all five without splitting into five thin pages.

## 2. The problem (the page's opening wound)

Small businesses and solo operators are locked out of the AI wave, twice
over:

1. **AI is hard to use.** The tools that could help assume technical comfort
   — prompts, APIs, node graphs, integrations to configure. A clinic owner or
   a sales agent doesn't have a developer, and shouldn't need one.
2. **Their tools don't talk to each other.** Either there are *no* tools —
   paper registers, memory, WhatsApp — or there are *too many*: email here, a
   spreadsheet there, notes in a third app, files in a fourth, customer chats
   in a fifth. Nothing is connected, so nothing compounds. Every evening the
   day's knowledge evaporates; every morning starts from zero.

The pain is not "missing features." It's that the work of *running* the
business eats the work *of* the business.

## 3. What twodb is

**twodb is the everything app for small business: one calm umbrella where
your inboxes, chats, notes, files, calendar, and customer data already live
together — with an AI that works inside your business, and mini apps built
around your data when no off-the-shelf tool fits.**

Under the umbrella (all present in the running app, `apps/web` + the
ui-library showcases):

- **Every inbox, one place** — multiple email inboxes, customer chats, and
  team conversations land in a single morning queue. "Reply to patients and
  customers from one inbox" (ChatMail mock). Mail that files itself; threads
  with AI summaries on top.
- **Notes & knowledge that connect** — capture anything, and everything
  links: people deduplicated and linked, docs and databases in one place
  (KnowledgeGraph mock). Share notes with the team; track progress together.
- **Communication built in** — chat and comments where the work is, so a
  team solves problems together instead of forwarding screenshots.
- **Files on one calm shelf** — attach without moving, merge/split/sign
  documents in place, OCR scanner and PDF toolkit pull paper into the brain.
- **Automations in plain language** — day-to-day tasks run themselves:
  reminders go out, invoices get chased, stock gets reordered, a new row in a
  spreadsheet can kick off anything. Described in words, never node graphs.
- **Email meets spreadsheet** — the tools finally interconnect: a new lead
  in your contacts can update a sheet, notify a chat, and draft a follow-up.
  (The AutomationBuilder trigger catalogue already spans Google Sheets,
  Contacts, Calendar, Drive, Forms, Office 365, HubSpot, Salesforce,
  Airtable, Mailchimp — plus Notion import, an S3 backup, webhooks to any
  URL, and a Zapier bridge for everything else.)

## 4. The signature difference: mini apps

When no tool fits, twodb **builds one for you** — small, purpose-made apps
generated around the business's own data and needs, by describing what's
wanted in plain words:

- **Raw documents → formal reports.** Drop in rough notes, exports, or
  scans; get a structured, branded report back.
- **Presentations on demand** — "impactful slideshows made easy" (AIEditor
  mock): a deck from your data, in your brand voice.
- **LLM working on your data** — drafts, summaries, analysis, and commands
  against the business's own records; dictate notes and get them transcribed
  and filed.
- **Any app the day calls for** — the ui-library already carries the proof
  gallery: a sales pipeline (SalesMate Pro), a finance dashboard, a clock
  planner, a ticket creator, a table reservation plan, an issue kanban, a
  habit tracker, an ecommerce dashboard. Each is a mini app a business would
  otherwise buy, bolt on, or do without.

Mini apps are the answer to the question every competitor makes the user
answer: "which of our features matches your need?" twodb asks back: "what do
you need?" — and builds it.

## 5. Story spine (story-led, UI supports each beat)

One day in the life of a small business, five beats. Each beat: a short
narrative passage, then the real scene UI at scale (rendered markup or
faithful screenshots, synthetic data labeled).

1. **6:30 am — "Your day is already planned."** The Morning Brief drafts
   itself overnight: today's appointments, open tasks, overnight reports,
   low stock, and *the one thing*. The hero moment — the brief visibly
   assembles itself (the system's cue-up entrance, bands rising at 45ms
   stagger).
2. **Morning — "Every inbox is one inbox."** Email, customer chats, team
   threads — summarized, prioritized, answerable from a single queue.
3. **Midday — "The boring work does itself."** Automations fire in plain
   sight: a new spreadsheet row triggers a follow-up, reminders go out, the
   invoice that crossed 30 days gets chased.
4. **Afternoon — "Ask your business anything."** Chat over the business's
   own data: "Which customers haven't paid?" — answered, not searched.
5. **Evening — "The tool you needed didn't exist. Now it does."** A mini
   app appears for the business's own odd job — built from a sentence,
   running on the day's data.

Close: the day ends; tomorrow's brief is already drafting. Waitlist.

## 6. Persona moments (five audiences, one spine)

The day-in-the-life spine stays single; each beat carries one rotating
**persona vignette** — a concrete, recognizable moment per audience, each
grounded in an existing scene or mock. Never five homepages; five proofs
that the same umbrella covers their world.

| Persona | Their moment on the page | Grounded in |
| --- | --- | --- |
| **Small business owner** | The clinic/shop morning brief: appointments prepped, stock below the reorder line flagged, six overdue invoices drafted into reminders | MorningBrief |
| **Sales agent** | The pipeline that follows up on itself: deals, quota, commissions, expiring contracts and overdue follow-ups surfaced before the first coffee; a new lead in contacts triggers the welcome sequence | SalesMatePro, AutomationBuilder |
| **Marketer** | Campaigns that run on rails: new subscriber in Mailchimp → sheet → welcome email → report; monthly numbers turn into a board-ready deck without a late night | FinanceDashboard, AIEditor |
| **Content creator** | Raw recording in → transcript, draft, and publish-ready post out; the deck and the newsletter share one brand voice; every channel's inbox in one place | Recording scene, AIEditor, ChatMail |
| **Indie creator** | One person runs a whole company: notes link into a knowledge graph, progress is tracked on a kanban, and the odd tool they need gets built as a mini app — no developer hired | KnowledgeGraph, IssueKanban, app builder |

## 7. Visitor journey & conversion

- Single action everywhere: **Join the waitlist** — email field + one solid
  cobalt button (the One Lit Control Rule made literal: the only
  solid-filled control in any viewport is the waitlist action).
- CTA at the end of the hero, after beat 3, and as the closing section.
  Nav is wordmark + the action, nothing else.
- Secondary action (ghost): "See how it works" → smooth-scrolls into the
  story. No pricing, no tiers, no fake social proof, no logo soup.
- Form states designed, not defaulted: success = quiet confirmation in the
  page's own grammar ("You're on the list. We'll write when it's your
  turn."); error = plain-language retry.

## 8. Visual direction (inherit Cyclorama Dawn, scale it up)

Binding rules from DESIGN.md apply verbatim — the page must be recognizable
as the same world with all content removed:

- **Day phase is the landing phase** (`#F5F5F7` ground, white surfaces,
  hairlines). Night phase appears once: the overnight moment — the brief
  drafting itself in the dark, light literally rising. Candidate signature
  image.
- **Flat Calm Rule:** no gradient fills on controls, no glow, no colored
  shadows. The cobalt→rose wash is identity material only — allowed at
  marketing scale (a full-width horizon band behind the hero or the close),
  never on a button or card.
- **Two Lights Rule:** cobalt = visitor action; rose = the AI acting. Rose
  appears exactly where the story says the AI did something — "Drafted
  06:30", an automation firing, an answer arriving.
- **Type:** IBM Plex Sans tracked caps for section markers — the day's hours
  are natural cues (`6:30 AM`, `MORNING`, `MIDDAY`…); Outfit for headlines
  and body. Marketing display scale (~72–96px) is new to the system and
  belongs to this surface — record it in DESIGN.md at finish.
- **Grain** over large fields; one exponential ease-out; cue-up stagger as
  hero choreography; `prefers-reduced-motion` honored.
- UI evidence is honest: real scene markup or faithful screenshots,
  "synthetic data" labels anywhere mock content could be mistaken for a
  live customer story.

## 9. Copy rules

- Plain language always (Product Principle 1): "reminders go out on their
  own", never "automated workflow engine"; "every inbox in one place",
  never "unified communication layer".
- Short sentences, low reading age. Calm product, calmer copy; no
  exclamation-mark hype — the page impresses by recognition, not volume.
- Never invent numbers, customers, or endorsements. "Six invoices crossed
  30 days" is fine — it's the product's own illustrative content, labeled.
- "AI" appears sparingly; the rose light and the behavior say it.
- Speak to the five personas in second person within their vignettes;
  everywhere else, "your business".

## 10. Open decisions (owner)

- **Waitlist mechanics** — where captured emails go (a `twodb.identity`
  waitlist table? an external list tool?). Needed before build.
- **Domain/hosting** for the landing page relative to the app.
- **PRODUCT.md reconciliation** — positioning line now reads "second brain";
  this brief leads with "everything app for small business" per owner
  direction. Update PRODUCT.md or keep both framings?
- **Pricing posture** — silence (recommended at waitlist stage) or seed
  "free while in early access".
- **Language(s)** — English only at launch, or a second language early for
  the wide-literacy audience?

## 11. Success criteria

A first-time visitor, within seconds: knows twodb is one app that runs a
small business's whole day; believes it's built for someone like them; can
join the waitlist without scrolling back. A sales agent and a content
creator each find *their* moment without scrolling past three beats. An
hour later, the visitor describes the **brief drafting itself at 6:30 am**
and the **app that got built from a sentence** — mechanisms, not a mood.
