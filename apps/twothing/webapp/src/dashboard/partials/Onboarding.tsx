import { PackagePlus, QrCode, Warehouse } from "lucide-react";
import { Link } from "../../lib/router";

const STEPS = [
  { icon: QrCode, title: "Print a stack of labels", body: "Random, unique QR codes on sticker sheets or a label roll.", to: "/labels", cta: "Generate labels" },
  { icon: Warehouse, title: "Label your boxes & drawers", body: "Create places (Workshop › Shelf › SMD box) and scan a sticker onto each.", to: "/places/new", cta: "Add a place" },
  { icon: PackagePlus, title: "Add things", body: "Stick a label, scan it, scan the box — done. Or scan the product's own barcode.", to: "/items/new", cta: "Add an item" },
];

export function Onboarding() {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {STEPS.map((s, i) => (
        <div key={s.title} className="relative flex flex-col gap-3 overflow-hidden rounded-[18px] border border-outline bg-card p-5">
          <span className="absolute top-3 right-4 text-5xl font-black text-ink/5">{i + 1}</span>
          <span className="grid size-11 place-items-center rounded-2xl bg-ink text-paper">
            <s.icon className="size-5" />
          </span>
          <div>
            <div className="font-semibold">{s.title}</div>
            <div className="mt-1 text-sm text-ink-muted">{s.body}</div>
          </div>
          <Link to={s.to} className="mt-auto inline-flex w-fit items-center rounded-full border border-outline bg-paper px-4 py-1.5 text-sm font-semibold hover:bg-stone">
            {s.cta} →
          </Link>
        </div>
      ))}
    </div>
  );
}
