import { getAuthTables } from "better-auth/db";
import { auth } from "../src/auth";

const tables = getAuthTables(auth.options);
for (const [, table] of Object.entries(tables)) {
  console.log(`TABLE ${table.modelName}`);
  for (const [fname, f] of Object.entries(table.fields) as [string, any][]) {
    const parts = [Array.isArray(f.type) ? f.type.join("|") : f.type];
    if (f.required) parts.push("required");
    if (f.unique) parts.push("unique");
    if (f.references) parts.push(`ref:${f.references.model}.${f.references.field}:${f.references.onDelete ?? ""}`);
    if (f.defaultValue !== undefined) parts.push(`default:${typeof f.defaultValue === "function" ? "fn" : f.defaultValue}`);
    console.log(`  ${f.fieldName ?? fname} :: ${parts.join(" ")}`);
  }
}
process.exit(0);
