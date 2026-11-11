import { useParams } from "react-router";
import { useVmDetail } from "./hooks/useVmDetail.js";
import { VmDetailPanel } from "./partials/VmDetailPanel.js";

/** One microvm's page: exec console + terminal/vscode relays. */
export function MicrovmDetailView() {
  const { identifier } = useParams();
  const detail = useVmDetail(identifier ? decodeURIComponent(identifier) : "");
  if (!identifier) return null;
  return <VmDetailPanel {...detail} />;
}
