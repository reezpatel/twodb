import { Loader2 } from "lucide-react";
import { useOrgPicker } from "./use-org-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export function OrgPickerPage() {
  const { orgs, error, selectOrg, createForm } = useOrgPicker();

  return (
    <div className="bg-muted/40 flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Choose an organization</CardTitle>
          <CardDescription>your workspaces, scoped per team</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}

          {orgs.isPending ? (
            <div className="flex justify-center py-8">
              <Loader2 className="text-muted-foreground size-6 animate-spin" />
            </div>
          ) : orgs.data && orgs.data.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {orgs.data.map((org) => (
                <li key={org.id}>
                  <button
                    className="hover:bg-accent flex w-full flex-col items-start rounded-md border border-transparent px-3 py-2 text-left transition-colors hover:border-border"
                    onClick={() => selectOrg(org.id)}
                  >
                    <span className="text-sm font-medium">{org.name}</span>
                    <span className="text-muted-foreground text-xs">{org.slug}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">You're not a member of any organization yet. Create one below.</p>
          )}

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-muted-foreground text-xs uppercase">create new</span>
            <Separator className="flex-1" />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              createForm.handleSubmit();
            }}
            className="flex flex-col gap-4"
          >
            <createForm.Field name="name">
              {(field) => (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="org-name">Organization name</Label>
                  <Input
                    id="org-name"
                    placeholder="Acme Inc"
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
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="animate-spin" />}
                  Create
                </Button>
              )}
            </createForm.Subscribe>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
