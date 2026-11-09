import { ArrowLeft } from "lucide-react";
import { useRunnerTerminal } from "@/lib/use-runner-terminal";
import { Button } from "@/components/ui/button";

interface RunnerTerminalProps {
  runnerId: string;
  runnerName: string;
  onClose: () => void;
}

export function RunnerTerminal({ runnerId, runnerName, onClose }: RunnerTerminalProps) {
  const { containerRef: terminalRef } = useRunnerTerminal(runnerId);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft />
          Back
        </Button>
        <h3 className="text-lg font-medium">Terminal — {runnerName}</h3>
      </div>
      <div ref={terminalRef} className="bg-muted min-h-0 flex-1 overflow-hidden rounded-lg border p-2" />
    </div>
  );
}
