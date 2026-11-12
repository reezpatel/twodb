import { useEffect, useState } from "react";
import { artisanClient, type ModelInfo, type RunnerInfo } from "../../../lib/artisan-client.js";

/** Model + runner pickers' data source (proxied TwoRoute + Dispatch). */
export function useCatalog() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [runners, setRunners] = useState<RunnerInfo[]>([]);

  useEffect(() => {
    void artisanClient.listModels().then(setModels).catch(() => {});
    const t = setInterval(() => {
      void artisanClient.listRunners().then(setRunners).catch(() => {});
    }, 10_000);
    void artisanClient.listRunners().then(setRunners).catch(() => {});
    return () => clearInterval(t);
  }, []);

  return { models, runners };
}
