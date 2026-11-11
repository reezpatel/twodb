import { useParams } from "react-router";
import { useJobDetail } from "./hooks/useJobDetail.js";
import { JobDetailPanel } from "./partials/JobDetailPanel.js";

/**
 * One job's page: live tailed output, stdin feed box, terminate. The tail
 * follows via SSE while running; buffered tail otherwise.
 */
export function JobDetailView() {
  const { id } = useParams();
  const detail = useJobDetail(id ?? "");
  if (!id) return null;
  return <JobDetailPanel {...detail} />;
}
