import { useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { Globe } from "lucide-react";
import { useSpaces } from "../../lib/queries";
import { EmptyState, Page, PageHeader, Spinner } from "../../components/Ui";

/** Sites belong to spaces; spaces are managed in the TwoDB console. */
export function HomePage() {
  const { data: spaces, isLoading } = useSpaces();
  const nav = useNavigate();

  useEffect(() => {
    if (!spaces?.length) return;
    const last = localStorage.getItem("twopager.space");
    const target = spaces.find((s) => s.id === last) ?? (spaces.length === 1 ? spaces[0] : null);
    if (target) nav(`/s/${target.id}`, { replace: true });
  }, [spaces, nav]);

  if (isLoading) return <Spinner />;
  return (
    <Page>
      <PageHeader title="Spaces" subtitle="Every space has its own sites. Pick one to publish landing pages and static sites." />
      {!spaces?.length ? <EmptyState title="No spaces yet" hint="Create a space in the TwoDB console, then come back to host your first site." /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {spaces.map((s) => (
            <Link key={s.id} to={`/s/${s.id}`} onClick={() => localStorage.setItem("twopager.space", s.id)} className="flex items-center gap-3 rounded-md border border-outline bg-card p-4 transition-colors hover:border-ion-deep">
              <Globe className="size-5 text-ink-muted" /><span className="font-medium">{s.name}</span>
            </Link>
          ))}
        </div>
      )}
    </Page>
  );
}
