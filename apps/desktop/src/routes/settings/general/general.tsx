import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function GeneralSection() {
  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>General</CardTitle>
        <CardDescription>appearance and app preferences</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Theme</p>
            <p className="text-muted-foreground text-xs">Oldworld (dark) — the app is dark-only for now.</p>
          </div>
          <span className="bg-muted rounded-md px-2 py-1 font-mono text-xs">#aca1cf</span>
        </div>
      </CardContent>
    </Card>
  );
}
