const os = require("os");

export const CONTROLLER_URL =
  process.env.TWO_DB_CONTROLLER_URL || "http://localhost:3000";
export const NODE_SECRET = process.env.TWO_DB_NODE_SECRET || "";
