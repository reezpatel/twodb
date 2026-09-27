export function HomePage() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="bg-card w-full max-w-md rounded-xl border p-8 shadow-sm">
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-xl font-semibold">Welcome to twodb</h2>
          <p className="text-muted-foreground text-sm">Pick an app from the rail to get started.</p>
        </div>
      </div>
    </div>
  );
}
