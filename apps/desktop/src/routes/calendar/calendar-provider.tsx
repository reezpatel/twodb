import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { AlertTriangle, CloudUpload, Loader2, Plus, Search, Settings, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SideNav, SideNavFooter, SideNavGroup, SideNavItem } from "@/components/side-nav";
import { toWall } from "./calendar-api";
import { CalendarList } from "./sidebar/calendar-list";
import { MiniMonth } from "./views/mini-month";
import { useCalendarScene } from "./use-calendar-scene";

/** Calendar scene state — owned here so the shell-rendered sidenav and the
 * content share one instance. */
export const CalendarContext = createContext<ReturnType<typeof useCalendarScene> | null>(null);

export function CalendarProvider({ children }: { children: ReactNode }) {
  const s = useCalendarScene();
  return <CalendarContext.Provider value={s}>{children}</CalendarContext.Provider>;
}

export function useCalendar() {
  const s = useContext(CalendarContext);
  if (!s) throw new Error("useCalendar must be used within CalendarProvider");
  return s;
}

/** The calendar sidebar — rendered by the app shell (desktop column / mobile drawer). */
export function CalendarSidenav() {
  const s = useCalendar();
  const [miniMonth, setMiniMonth] = useState<string | null>(null);
  const busyDays = useMemo(() => new Set(s.items.map((o) => (o.isAllDay ? o.startDate! : toWall(o.startAt, s.tz).date))), [s.items, s.tz]);

  if (s.calendars.isLoading || s.settings.isLoading) {
    return (
      <SideNav className="w-[240px] items-center">
        <Loader2 className="text-muted-foreground animate-spin" />
      </SideNav>
    );
  }

  const pendingTotal = (s.pendingCount.data?.awaiting ?? 0) + (s.pendingCount.data?.failed ?? 0);

  return (
    <SideNav className="w-[240px]">
      <Button onClick={() => s.openEditor({})} disabled={!s.writableCalendars.length}>
        <Plus /> Create
      </Button>
      <MiniMonth
        month={miniMonth ?? s.cursor}
        today={s.today}
        weekStart={s.weekStart}
        selected={s.view === "month" || s.view === "year" ? null : s.range}
        busyDays={busyDays}
        onMonth={setMiniMonth}
        onPick={(day) => {
          s.setCursor(day);
          setMiniMonth(null);
          if (s.view === "year" || s.panel !== "calendar") s.setView("day");
        }}
      />
      <SideNavGroup separated>
        <SideNavItem
          label="Pending push"
          icon={CloudUpload}
          count={pendingTotal || undefined}
          active={s.panel === "pending"}
          onSelect={() => s.setPanel(s.panel === "pending" ? "calendar" : "pending")}
          className={s.pendingCount.data?.failed ? "text-destructive" : undefined}
        />
        <SideNavItem label="Search" icon={Search} active={s.panel === "search"} onSelect={() => s.setPanel(s.panel === "search" ? "calendar" : "search")} />
        <SideNavItem label="Trash" icon={Trash2} active={s.panel === "trash"} onSelect={() => s.setPanel(s.panel === "trash" ? "calendar" : "trash")} />
        <SideNavItem label="People" icon={Users} to="/apps/contacts" />
      </SideNavGroup>
      <CalendarList
        calendars={s.calendars.data ?? []}
        accounts={s.meta.data?.accounts ?? []}
        onToggle={(id, hidden) => s.toggleCalendar.mutate({ id, hidden })}
      />
      <SideNavFooter>
        {(s.meta.data?.accounts ?? []).some((a) => a.calendarState === "reauth_required") ? (
          <Link to="/apps/settings/accounts" className="text-destructive flex items-center gap-1.5 px-2 py-1 text-xs">
            <AlertTriangle size={12} /> An account needs reconnecting
          </Link>
        ) : null}
        <SideNavItem label="Calendar settings" icon={Settings} to="/apps/settings/calendar" />
      </SideNavFooter>
    </SideNav>
  );
}
