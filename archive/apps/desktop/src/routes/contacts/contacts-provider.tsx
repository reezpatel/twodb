import { createContext, useContext, type ReactNode } from "react";
import { Calendar, Loader2, Mail } from "lucide-react";
import { SideNav, SideNavGroup, SideNavHeader, SideNavItem } from "@/components/side-nav";
import { useContactsScene } from "./use-contacts-scene";

/** Contacts scene state — owned here so the shell-rendered sidenav and the
 * content share one instance. */
export const ContactsContext = createContext<ReturnType<typeof useContactsScene> | null>(null);

export function ContactsProvider({ children }: { children: ReactNode }) {
  const s = useContactsScene();
  return <ContactsContext.Provider value={s}>{children}</ContactsContext.Provider>;
}

export function useContacts() {
  const s = useContext(ContactsContext);
  if (!s) throw new Error("useContacts must be used within ContactsProvider");
  return s;
}

/** The contacts sidebar — rendered by the app shell (desktop column / mobile drawer). */
export function ContactsSidenav() {
  const s = useContacts();
  const books = s.books.data ?? [];

  return (
    <SideNav>
      <SideNavHeader title="Contacts" description="Learned from your mail and meetings — one list per account." />
      <SideNavGroup label="Accounts">
        {books
          .filter((b) => b.kind === "account")
          .map((b) => (
            <SideNavItem key={b.id} label={b.label} icon={Mail} count={b.count} active={b.id === s.bookId} onSelect={() => s.selectBook(b.id)} />
          ))}
      </SideNavGroup>
      <SideNavGroup label="twodb" separated>
        {books
          .filter((b) => b.kind === "local")
          .map((b) => (
            <SideNavItem key={b.id} label="twodb calendars" icon={Calendar} count={b.count} active={b.id === s.bookId} onSelect={() => s.selectBook(b.id)} />
          ))}
      </SideNavGroup>
      {s.book?.learnState === "running" ? (
        <p className="text-muted-foreground mt-auto flex items-center gap-1.5 px-2 text-xs">
          <Loader2 size={12} className="animate-spin" /> Learning from stored mail · {s.book.learnProgress.done?.toLocaleString() ?? 0}
          {s.book.learnProgress.total ? ` / ${s.book.learnProgress.total.toLocaleString()}` : ""}
        </p>
      ) : null}
    </SideNav>
  );
}
