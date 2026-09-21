import type { CodeSession, CodeSessionEvent } from "../../../shared/api";
import { sidebarStyles } from "./sidebar.style";

export function Sidebar({
  session,
  events,
  connectionName,
}: {
  session: CodeSession | null;
  events: CodeSessionEvent[];
  connectionName: string | null;
}) {
  const toolCalls = events.filter((event) => event.type === "tool_call");
  const commands = events.filter((event) => event.type === "tool_result" && event.name === "command");
  const errors = events.filter((event) => event.type === "error" || (event.type === "tool_result" && !event.ok));

  return (
    <aside className="code-sidebar">
      <style jsx>{sidebarStyles}</style>
      <section className="code-sidebar__section">
        <h3 className="code-sidebar__heading">Session</h3>
        {session ? (
          <dl className="code-sidebar__meta">
            <dt>Title</dt>
            <dd>{session.title}</dd>
            <dt>Folder</dt>
            <dd className="code-sidebar__mono">{session.folder}</dd>
            <dt>Node</dt>
            <dd className="code-sidebar__mono">{session.node_id.slice(0, 8)}</dd>
            <dt>Model</dt>
            <dd>{connectionName ?? "Workspace default"}</dd>
            <dt>Created</dt>
            <dd>{new Date(session.created_at).toLocaleString()}</dd>
          </dl>
        ) : (
          <p className="code-sidebar__empty">No session selected.</p>
        )}
      </section>

      <section className="code-sidebar__section">
        <h3 className="code-sidebar__heading">Activity</h3>
        <dl className="code-sidebar__meta">
          <dt>Tool calls</dt>
          <dd>{toolCalls.length}</dd>
          <dt>Commands</dt>
          <dd>{commands.length}</dd>
          <dt>Errors</dt>
          <dd>{errors.length}</dd>
        </dl>
      </section>
    </aside>
  );
}
