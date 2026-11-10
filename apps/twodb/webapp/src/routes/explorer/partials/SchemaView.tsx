/** Renders a JSON Schema as a compact, readable field tree — the Swagger
 * "model" view equivalent for our endpoint.json contracts. Deliberately
 * dumb: no state, no fetching. */

interface JsonSchemaNode {
  type?: string | string[];
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  items?: JsonSchemaNode;
  enum?: unknown[];
  anyOf?: JsonSchemaNode[];
  description?: string;
  $ref?: string;
}

function typeLabel(schema: JsonSchemaNode): string {
  if (schema.$ref) return schema.$ref.replace(/^#\/definitions\//, "");
  if (schema.enum) return schema.enum.map((v) => JSON.stringify(v)).join(" | ");
  if (schema.anyOf) return schema.anyOf.map(typeLabel).join(" | ");
  if (Array.isArray(schema.type)) return schema.type.join(" | ");
  if (schema.type === "array" && schema.items) return `${typeLabel(schema.items)}[]`;
  return schema.type ?? "any";
}

function SchemaFields({ schema, depth }: { schema: JsonSchemaNode; depth: number }) {
  if (!schema.properties) return null;
  return (
    <div style={{ marginLeft: depth > 0 ? 12 : 0 }}>
      {Object.entries(schema.properties).map(([key, value]) => {
        const required = schema.required?.includes(key);
        return (
          <div key={key} style={{ padding: "2px 0", fontFamily: "monospace", fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>{key}</span>
            {required ? <span style={{ color: "var(--destructive, #c00)" }}>*</span> : null}
            <span style={{ opacity: 0.6 }}>: {typeLabel(value)}</span>
            {value.description ? <span style={{ opacity: 0.5 }}> — {value.description}</span> : null}
            {value.properties ? <SchemaFields schema={value} depth={depth + 1} /> : null}
            {value.type === "array" && value.items?.properties ? (
              <SchemaFields schema={value.items} depth={depth + 1} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function SchemaView({ schema, title }: { schema: unknown; title: string }) {
  if (!schema) return null;
  const node = schema as JsonSchemaNode;
  if (!node.properties && !node.type) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <h4 style={{ margin: "8px 0 4px", fontSize: 13, textTransform: "uppercase", opacity: 0.7 }}>{title}</h4>
      <SchemaFields schema={node} depth={0} />
      <details style={{ marginTop: 4 }}>
        <summary style={{ fontSize: 12, opacity: 0.6, cursor: "pointer" }}>raw schema</summary>
        <pre style={{ fontSize: 11, overflow: "auto", maxHeight: 300 }}>{JSON.stringify(schema, null, 2)}</pre>
      </details>
    </div>
  );
}
