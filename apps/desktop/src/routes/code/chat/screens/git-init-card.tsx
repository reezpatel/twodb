import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GitBranch, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ERRORS: Record<string, string> = {
  runner_offline: "Runner is offline — start it and try again.",
  directory_missing: "This directory no longer exists on the runner.",
  git_failed: "git failed on the runner.",
};

interface GitInitCardProps {
  directoryId: string;
  cwd: string;
}

export function GitInitCard({ directoryId, cwd }: GitInitCardProps) {
  const [branch, setBranch] = useState("main");
  const [origin, setOrigin] = useState("");

  const qc = useQueryClient();
  const init = useMutation({
    mutationFn: () => api(`/api/code/directories/${directoryId}/git-init`, { method: "POST", body: JSON.stringify({ branch, origin }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["code", "directories", directoryId, "git"] }),
  });

  return (
    <Card className="mx-auto mt-16 w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch size={16} aria-hidden="true" /> Initialize git
        </CardTitle>
        <CardDescription>
          This needs a git repository. Initialize one in <span className="font-mono">{cwd}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="git-branch">Default branch</Label>
          <Input id="git-branch" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" className="h-8" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="git-origin">Origin (optional)</Label>
          <Input id="git-origin" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="git@github.com:you/repo.git" className="h-8" />
        </div>
        {init.isError && <p className="text-destructive text-xs">{ERRORS[(init.error as Error).message] ?? (init.error as Error).message}</p>}
        <Button size="sm" className="w-fit" onClick={() => init.mutate()} disabled={init.isPending || !branch.trim()}>
          {init.isPending ? <Loader2 size={14} className="animate-spin" /> : <GitBranch size={14} />}
          Initialize repository
        </Button>
      </CardContent>
    </Card>
  );
}
