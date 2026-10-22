import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Runner } from "./use-runners";

/**
 * Per-runner AWS SSO config: the start-app URL and its region. Used by the
 * AWS widget's device-code login when the runner's ~/.aws/config doesn't
 * already carry an sso-session.
 */
export function RunnerAwsConfig({ runner }: { runner: Runner }) {
  const queryClient = useQueryClient();
  const [startUrl, setStartUrl] = useState(runner.awsStartUrl ?? "");
  const [region, setRegion] = useState(runner.awsSsoRegion ?? "");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setStartUrl(runner.awsStartUrl ?? "");
    setRegion(runner.awsSsoRegion ?? "");
  }, [runner.id, runner.awsStartUrl, runner.awsSsoRegion]);

  const save = useMutation({
    mutationFn: () =>
      api(`/api/runners/${runner.id}/aws-config`, {
        method: "PATCH",
        body: JSON.stringify({ startUrl: startUrl.trim() || null, ssoRegion: region.trim() || null }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["runners"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    },
  });

  return (
    <div className="border-muted mt-2 rounded-lg border p-3">
      <div className="mb-2 text-xs font-semibold">AWS SSO</div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input className="grow font-mono text-xs" placeholder="https://d-xxxxxxxxx.awsapps.com/start" value={startUrl} onChange={(e) => setStartUrl(e.target.value)} />
        <Input className="w-full font-mono text-xs sm:w-40" placeholder="us-east-1" value={region} onChange={(e) => setRegion(e.target.value)} />
        <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : saved ? "Saved" : "Save"}
        </Button>
      </div>
      <p className="text-muted-foreground/70 mt-1.5 text-[11px]">
        Start-app URL for this runner's SSO device-code login. Overrides the runner's ~/.aws/config sso-session when set.
      </p>
    </div>
  );
}
