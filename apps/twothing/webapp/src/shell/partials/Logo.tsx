import { Link } from "../../lib/router";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="relative grid size-8 place-items-center rounded-[10px] bg-ink text-paper">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3 3 7.5v9L12 21l9-4.5v-9L12 3Z" />
          <path d="M3 7.5 12 12l9-4.5M12 12v9" />
        </svg>
        <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-card bg-emerald-400" />
      </span>
      <span className="text-lg leading-none font-bold tracking-tight">
        Two<span className="text-ion-deep">Thing</span>
      </span>
    </Link>
  );
}
