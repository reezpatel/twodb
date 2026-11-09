import { useAppPage } from "./use-app-page";

export function AppPage() {
  const { app } = useAppPage();

  if (!app) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Unknown app</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <app.icon size={48} className="text-muted-foreground/50" />
      <h1 className="text-2xl font-bold">{app.label}</h1>
      <p className="text-muted-foreground">Nothing here yet.</p>
    </div>
  );
}
