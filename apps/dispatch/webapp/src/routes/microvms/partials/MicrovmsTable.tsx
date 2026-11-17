import { Play } from "lucide-react";
import { Button } from "@twodb/blocks";
import { Badge } from "../../../lib/badge.js";
import type { Microvm } from "../../../lib/dispatch-client.js";
import { DataTable, TableCard, TableEmpty, Td, Tr } from "../../../lib/data-table.js";
import { formatRelative } from "../../../lib/format.js";

export interface MicrovmsTableProps {
  vms: Microvm[];
  busy: boolean;
  onOpen: (vm: Microvm) => void;
  onBoot: (vm: Microvm) => void;
  onShutdown: (vm: Microvm, archive: boolean) => void;
}

/** Dumb microvm table: identifier, lifecycle status, boots, actions. */
export function MicrovmsTable(props: MicrovmsTableProps) {
  return (
    <TableCard>
      {!props.vms.length ? (
        <TableEmpty>No MicroVMs yet.</TableEmpty>
      ) : (
        <DataTable columns={["Identifier", "Status", { label: "Runner", mobile: false }, { label: "Boots", mobile: false }, { label: "Last active", mobile: false }, ""]}>
          {props.vms.map((vm) => {
            const tone = vm.status === "running" ? "success" : vm.status === "failed" ? "danger" : "neutral";
            return (
              <Tr key={vm.id} onClick={() => props.onOpen(vm)}>
                <Td className="font-medium text-ink">{vm.identifier}</Td>
                <Td><Badge tone={tone}>{vm.status}</Badge></Td>
                <Td hideOnMobile className="text-ink-muted">{vm.runnerName ?? vm.runnerId}</Td>
                <Td hideOnMobile className="text-ink-muted">{vm.bootCount}</Td>
                <Td hideOnMobile className="text-ink-muted">{formatRelative(vm.lastActiveAt)}</Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    {vm.status === "running" ? (
                      <>
                        <Button size="sm" variant="ghost" disabled={props.busy} onClick={() => props.onShutdown(vm, true)}>Stop & archive</Button>
                        <Button size="sm" variant="ghost" disabled={props.busy} onClick={() => props.onShutdown(vm, false)}>Stop</Button>
                      </>
                    ) : (
                      // Boot on the same identifier = resume with /app restored.
                      <Button size="sm" variant="primary" disabled={props.busy} onClick={() => props.onBoot(vm)}>
                        <Play className="size-3.5" />
                        {vm.status === "idle-stopped" ? "Resume" : "Boot"}
                      </Button>
                    )}
                  </div>
                </Td>
              </Tr>
            );
          })}
        </DataTable>
      )}
    </TableCard>
  );
}
