import { Button, Chip } from "@twodb/blocks";
import type { RegisteredAppSummary } from "../../../lib/gateway-client.js";

export interface AppRowProps {
  app: RegisteredAppSummary;
  provisioning: boolean;
  onProvision: () => void;
}

/** Dumb/presentational only. */
export function AppRow(props: AppRowProps) {
  return (
    <tr>
      <td>{props.app.name}</td>
      <td>
        <code>{props.app.slug}</code>
      </td>
      <td>
        <code>{props.app.basePath}</code>
      </td>
      <td>
        <Chip tone={props.app.status === "active" ? "success" : "warning"}>{props.app.status}</Chip>
      </td>
      <td>
        <Button size="sm" disabled={props.provisioning} onClick={props.onProvision}>
          {props.provisioning ? "Provisioning…" : "Provision DB"}
        </Button>
      </td>
    </tr>
  );
}
