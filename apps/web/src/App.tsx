import { useState } from "react";
import { Button, Card, Input, Badge } from "@twodb/ui";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export default function App() {
  const [apiResult, setApiResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function pingApi() {
    setLoading(true);
    setApiResult(null);
    try {
      const res = await fetch(`${API_URL}/api/hello`);
      const data = await res.json();
      setApiResult(data.message);
    } catch {
      setApiResult("Could not reach twodb-api — is it running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <header className="page__header">
        <h1>twodb web app</h1>
        <Badge tone="success">React + Vite</Badge>
      </header>

      <Card title="Components from @twodb/ui">
        <div className="row">
          <Button onClick={pingApi} disabled={loading}>
            {loading ? "Pinging…" : "Ping API"}
          </Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
        </div>
        {apiResult && <p className="api-result">{apiResult}</p>}
      </Card>

      <Card title="Form example">
        <div className="row">
          <Input label="Name" placeholder="Ada Lovelace" />
          <Input label="Email" type="email" placeholder="ada@example.com" />
        </div>
      </Card>
    </main>
  );
}
