import { useState } from "react";
import { AppShell, AppShellBody, AppShellMain, AppShellHeader, AppShellContent, Tabs, TabsList, TabsTrigger, TabsContent } from "@twodb/blocks";
import { RequireAuth } from "./routes/auth/RequireAuth.js";
import { AppsRegistry } from "./routes/registry/AppsRegistry.js";
import { GatewayExplorer } from "./routes/explorer/GatewayExplorer.js";

export function App() {
  const [tab, setTab] = useState("explorer");

  return (
    <RequireAuth>
      <AppShell>
        <AppShellBody>
          <AppShellMain>
            <AppShellHeader>TwoDB — control plane</AppShellHeader>
            <AppShellContent>
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                  <TabsTrigger value="explorer">Gateway explorer</TabsTrigger>
                  <TabsTrigger value="registry">Apps</TabsTrigger>
                </TabsList>
                <TabsContent value="explorer">
                  <GatewayExplorer />
                </TabsContent>
                <TabsContent value="registry">
                  <AppsRegistry />
                </TabsContent>
              </Tabs>
            </AppShellContent>
          </AppShellMain>
        </AppShellBody>
      </AppShell>
    </RequireAuth>
  );
}
