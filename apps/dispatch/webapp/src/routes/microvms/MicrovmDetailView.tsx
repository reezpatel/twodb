import { useParams } from "react-router";
import { useSharedDispatch } from "../../lib/dispatch-context.js";
import { useVmDetail } from "./hooks/useVmDetail.js";
import { VmDetailPanel } from "./partials/VmDetailPanel.js";

/** One microvm's page: exec console + terminal/vscode relays. */
export function MicrovmDetailView() {
  const { identifier } = useParams();
  const id = identifier ? decodeURIComponent(identifier) : "";
  const detail = useVmDetail(id);
  const { microvms } = useSharedDispatch();
  if (!identifier) return null;
  return (
    <VmDetailPanel
      {...detail}
      onBoot={() => microvms.boot({ identifier: id }).then(() => detail.reload())}
      bootBusy={microvms.busy}
    />
  );
}
