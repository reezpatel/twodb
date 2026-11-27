import { Link } from "../../lib/router";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <img src="/icons/icon-192.png" alt="" className="size-8 rounded-[8px]" />
      <span className="text-lg leading-none font-bold tracking-tight">
        Two<span className="text-ion-deep">Thing</span>
      </span>
    </Link>
  );
}
