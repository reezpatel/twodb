import { Outlet, useLocation, useNavigate } from "react-router";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = ["connections", "skills", "agents", "memories", "instructions"] as const;

export function LlmLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const active = pathname.split("/").pop() ?? "connections";

  return (
    <div>
      <Tabs value={active} onValueChange={(tab) => navigate(`/apps/settings/llm/${tab}`)}>
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="capitalize">
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="pt-4">
        <Outlet />
      </div>
    </div>
  );
}
