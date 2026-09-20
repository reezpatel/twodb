export type GoogleVertexConnectionConfig = {
  project: string;
  location: string;
  service_account_json: string;
};

export const DEFAULT_GOOGLE_VERTEX_CONFIG: GoogleVertexConnectionConfig = {
  project: "",
  location: "us-central1",
  service_account_json: "",
};
