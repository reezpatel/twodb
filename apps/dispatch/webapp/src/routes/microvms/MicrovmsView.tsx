import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@twodb/blocks";
import { useSharedDispatch } from "../../lib/dispatch-context.js";
import { MicrovmsTable } from "./partials/MicrovmsTable.js";
import { BootVmDialog } from "./partials/BootVmDialog.js";
import { useNavigate } from "react-router";

/** Microvms page: lifecycle cards + boot launcher. */
export function MicrovmsView() {
  const { runners, microvms } = useSharedDispatch();
  const navigate = useNavigate();
  const [bootOpen, setBootOpen] = useState(false);

  useEffect(() => {
    void microvms.refresh();
    void runners.refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 text-[13px] text-ink-muted">
          Lightweight virtual machines running on your runners.
        </p>
        <Button size="sm" variant="primary" onClick={() => setBootOpen(true)}>
          <Plus className="size-3.5" />
          Boot microvm
        </Button>
      </div>
      {microvms.error ? <p className="text-[13px] text-destructive">{microvms.error}</p> : null}
      <MicrovmsTable
        vms={microvms.microvms}
        busy={microvms.busy}
        onOpen={(vm) => navigate(`/microvms/${encodeURIComponent(vm.identifier)}`)}
        onBoot={(vm) => void microvms.boot({ identifier: vm.identifier })}
        onShutdown={(vm, archive) => void microvms.shutdown(vm.identifier, archive)}
      />
      {bootOpen ? (
        <BootVmDialog
          runners={runners.runners.filter((r) => r.kind === "microvm-host" && r.status === "online")}
          busy={microvms.busy}
          onClose={() => setBootOpen(false)}
          onBoot={async (input) => {
            const vm = await microvms.boot(input);
            setBootOpen(false);
            navigate(`/microvms/${encodeURIComponent(vm.identifier)}`);
          }}
        />
      ) : null}
    </div>
  );
}
