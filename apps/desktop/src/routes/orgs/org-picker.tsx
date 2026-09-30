import { Loader2 } from "lucide-react";
import { useOrgPicker } from "./use-org-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SignInLayout } from "@/components/ui/sign-in-page";
import { WorkspaceSelector } from "@/components/ui/workspace-selector";

export function OrgPickerPage() {
  const { orgs, error, selectOrg, createOrg, createForm } = useOrgPicker();

  return (
    <SignInLayout>
      <div className="mb-8">
        <h1 className="text-foreground mb-2 text-xl font-base">Choose an organization</h1>
        <p className="text-muted-foreground">your workspaces, scoped per team</p>
      </div>

      {error && (
        <p className="text-destructive mb-4 text-sm" role="alert">
          {error}
        </p>
      )}

      {orgs.isPending ? (
        <div className="flex justify-center py-8">
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        </div>
      ) : orgs.data && orgs.data.length > 0 ? (
        <WorkspaceSelector workspaces={orgs.data} onSelect={selectOrg} onCreate={createOrg} maxVisible={5} />
      ) : (
        <p className="text-muted-foreground text-sm">You're not a member of any organization yet. Create one below.</p>
      )}

      <div className="my-6 flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-muted-foreground text-xs uppercase">create new</span>
        <Separator className="flex-1" />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          createForm.handleSubmit();
        }}
        className="flex flex-col gap-6"
      >
        <createForm.Field name="name">
          {(field) => (
            <div className="flex flex-col gap-3">
              <Label htmlFor="org-name">Organization name</Label>
              <Input
                id="org-name"
                placeholder="Acme Inc"
                className="px-4 py-3"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                required
              />
            </div>
          )}
        </createForm.Field>
        <createForm.Subscribe selector={(s) => s.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" className="w-full py-3" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Create
            </Button>
          )}
        </createForm.Subscribe>
      </form>
    </SignInLayout>
  );
}
