import type { EndpointSpec } from "../../../lib/gateway-client.js";
import { SchemaView } from "./SchemaView.js";
import { MethodChip } from "./EndpointListItem.js";

/** Dumb presentational detail pane for one endpoint — schemas + try-it wiring comes from the parent. */
export function EndpointDetail({
  appSlug,
  basePath,
  endpoint,
}: {
  appSlug: string;
  basePath: string;
  endpoint: EndpointSpec;
}) {
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
        <MethodChip method={endpoint.method} />
        <code style={{ fontSize: 15 }}>
          {basePath === "/" ? "" : basePath}
          {endpoint.path}
        </code>
        {endpoint.streaming ? <span style={{ fontSize: 11, opacity: 0.6 }}>streams</span> : null}
      </div>
      <p style={{ opacity: 0.75, fontSize: 13, maxWidth: 720 }}>{endpoint.description}</p>
      <p style={{ fontSize: 12, opacity: 0.6 }}>
        auth: <code>{endpoint.auth}</code> · via gateway: <code>/apps/{appSlug}{endpoint.path}</code>
      </p>
      {endpoint.request ? <SchemaView schema={endpoint.request} title="Request" /> : null}
      {endpoint.response ? <SchemaView schema={endpoint.response} title="Response" /> : null}
    </div>
  );
}
