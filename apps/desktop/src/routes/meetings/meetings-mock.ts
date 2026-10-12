// Placeholder participants, transcript and summary until recordings are
// transcribed — the same content as the original mock (/apps/meetings-old).

function ph(c1: string, c2: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='400'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs><rect width='640' height='400' fill='url(#g)'/><circle cx='500' cy='90' r='80' fill='rgba(255,255,255,0.14)'/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export interface MockParticipant {
  name: string;
  img: string;
  micOff: boolean;
}

export const MOCK_PARTICIPANTS: MockParticipant[] = [
  { name: "Ravi Kumar", img: ph("#0d2b26", "#0f9d8f"), micOff: false },
  { name: "Meera Iyer", img: ph("#2b1526", "#c2285a"), micOff: false },
  { name: "You", img: ph("#241d10", "#d9a03f"), micOff: true },
  { name: "Dev Patel", img: ph("#131320", "#5c5b6e"), micOff: true },
];

export interface MockLine {
  speaker: string;
  /** Seconds from the start of the recording; scaled to its real length. */
  at: number;
  text: string;
}

export const MOCK_SCRIPT: MockLine[] = [
  { speaker: "Ravi Kumar", at: 0, text: "New patient intake at 12:30 — Sana Sheikh. Consent forms are printed and at the desk." },
  { speaker: "Dev Patel", at: 1, text: "I'll take the invoice wording. Also confirming Tuesday's visiting hours with the front desk this afternoon." },
  {
    speaker: "Dr. Asha Verma",
    at: 2,
    text: "Good. Six invoices crossed thirty days this week — the reminders are drafted, someone review the wording before they send.",
  },
  {
    speaker: "Meera Iyer",
    at: 3,
    text: "Stock check: gauze and medium gloves are below the reorder line. The order went out Thursday, arriving Monday.",
  },
  {
    speaker: "Ravi Kumar",
    at: 4,
    text: "The lab flagged Meera Iyer's lipid panel overnight. I've attached the report to her chart for the 9:40 review.",
  },
  {
    speaker: "Dr. Asha Verma",
    at: 5,
    text: "Ward 4 first — Ravi Kumar's discharge summary is ready, but the medication dosage needs one correction before it goes out.",
  },
];

export const MOCK_OVERVIEW =
  "Morning rounds for ward 4: one discharge correction, one flagged lab panel, stock order arriving Monday, and invoice reminders pending a wording review.";

export const MOCK_KEY_POINTS = [
  "Correct Ravi Kumar's dosage before the summary goes out.",
  "Review Meera Iyer's flagged lipid panel before 9:40.",
  "Stock order arrives Monday — confirm quantities at intake.",
  "Dev reviews invoice reminder wording today.",
  "Tuesday visiting hours to be confirmed by the front desk.",
];

export const initials = (name: string) =>
  name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
