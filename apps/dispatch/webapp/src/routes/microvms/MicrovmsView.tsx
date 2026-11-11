import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@twodb/blocks";
import { useSharedDispatch } from "../../lib/dispatch-context.js";
import { MicrovmCard } from "./partials/MicrovmCard.js";
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
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-ink-muted">
          Ephemeral Firecracker microvms — same identifier resumes with its /app restored.
        </p>
        <Button size="sm" variant="primary" onClick={() => setBootOpen(true)}>
          <Plus className="size-3.5" />
          Boot microvm
        </Button>
      </div>
      {microvms.error ? <p className="text-[13px] text-destructive">{microvms.error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {microvms.microvms.map((vm) => (
          <MicrovmCard
            key={vm.id}
            vm={vm}
            busy={microvms.busy}
            onOpen={() => navigate(`/microvms/${encodeURIComponent(vm.identifier)}`)}
            onBoot={() => void microvms.boot({ identifier: vm.identifier })}
            onShutdown={(archive) => void microvms.shutdown(vm.identifier, archive)}
          />
        ))}
      </div>
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
