enum JobType {
  SCRIPT_JAVASCRIPT = "script_javascript",
}

export type JobManifest = {
  type: JobType;
  tags: string[];
};

export class Job {
  constructor(private manifest: JobManifest) {}
}
