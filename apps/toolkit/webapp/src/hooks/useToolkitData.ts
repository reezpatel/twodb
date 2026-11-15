import { useCallback, useEffect, useState } from "react";
import { toolkitClient, type AgentInfo, type ConnectorInstance, type ConnectorTemplate, type McpServer, type Space } from "../lib/toolkit-client.js";

/** Shared state for both tabs: spaces (control plane) + agents (artisan) + templates/instances/MCP servers. */
export function useToolkitData() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [templates, setTemplates] = useState<ConnectorTemplate[]>([]);
  const [instances, setInstances] = useState<ConnectorInstance[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [spacesR, agentsR, templatesR, instancesR, mcpR] = await Promise.allSettled([
      toolkitClient.listSpaces(),
      toolkitClient.listAgents(),
      toolkitClient.listTemplates(),
      toolkitClient.listInstances(),
      toolkitClient.listMcp(),
    ]);
    if (spacesR.status === "fulfilled") setSpaces(spacesR.value.spaces);
    if (agentsR.status === "fulfilled") setAgents(agentsR.value);
    if (templatesR.status === "fulfilled") setTemplates(templatesR.value);
    if (instancesR.status === "fulfilled") setInstances(instancesR.value);
    if (mcpR.status === "fulfilled") setMcpServers(mcpR.value);
    // agents come from artisan — being down is not fatal for the rest
    const firstError = [spacesR, templatesR, instancesR, mcpR].find((r) => r.status === "rejected");
    if (firstError && firstError.status === "rejected") setError(String((firstError.reason as Error)?.message ?? firstError.reason));
    setLoading(false);
  }, []);

  const refreshInstances = useCallback(async () => {
    try {
      setInstances(await toolkitClient.listInstances());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const refreshMcp = useCallback(async () => {
    try {
      setMcpServers(await toolkitClient.listMcp());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { spaces, agents, templates, instances, mcpServers, loading, error, refresh, refreshInstances, refreshMcp, setError };
}

export type ToolkitData = ReturnType<typeof useToolkitData>;
