import type { MessagesJson } from "../../../lib/gateway-client.js";
import { SchemaView } from "./SchemaView.js";

/** Dumb presentational view of an app's jobs + broadcast events contract. */
export function MessagesView({ messages }: { messages: MessagesJson }) {
  if (messages.jobs.length === 0 && messages.events.length === 0) {
    return <p style={{ opacity: 0.6, fontSize: 13 }}>This app declares no queue jobs or broadcast events.</p>;
  }
  return (
    <div>
      {messages.jobs.length > 0 ? (
        <>
          <h4 style={{ fontSize: 13, textTransform: "uppercase", opacity: 0.7 }}>Queue jobs</h4>
          {messages.jobs.map((job) => (
            <div key={job.type} style={{ marginBottom: 12 }}>
              <code style={{ fontWeight: 600 }}>{job.type}</code>{" "}
              <span style={{ fontSize: 11, opacity: 0.6 }}>({job.direction})</span>
              <p style={{ fontSize: 13, opacity: 0.75, margin: "2px 0" }}>{job.description}</p>
              <SchemaView schema={job.payload} title="Payload" />
            </div>
          ))}
        </>
      ) : null}
      {messages.events.length > 0 ? (
        <>
          <h4 style={{ fontSize: 13, textTransform: "uppercase", opacity: 0.7 }}>Broadcast events</h4>
          {messages.events.map((evt) => (
            <div key={evt.event} style={{ marginBottom: 12 }}>
              <code style={{ fontWeight: 600 }}>{evt.event}</code>{" "}
              <span style={{ fontSize: 11, opacity: 0.6 }}>({evt.direction})</span>
              <p style={{ fontSize: 13, opacity: 0.75, margin: "2px 0" }}>{evt.description}</p>
              <SchemaView schema={evt.payload} title="Payload" />
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}
