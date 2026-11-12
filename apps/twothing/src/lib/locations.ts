import type { Kysely } from "@twodb/core-data/db";
import type { LocationRow, TwoThingDb } from "../db/schema.js";
import { formatCode } from "./codes.js";

export const LOCATION_KINDS = ["room", "cabinet", "shelf", "rack", "drawer", "bin", "box", "organizer", "bag", "other"] as const;

export interface Crumb {
  id: string;
  name: string;
  kind: string;
}

export interface LocationDto {
  id: string;
  code: string | null;
  codeDisplay: string | null;
  name: string;
  kind: string;
  parentId: string | null;
  description: string;
  color: string | null;
  imageId: string | null;
  path: Crumb[];
  depth: number;
  itemCount: number;
  totalItemCount: number;
  childCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * In-memory view over a workspace's location tree. A personal inventory has
 * at most a few thousand places, so loading them all per request is cheap and
 * keeps tree maths (paths, descendants, cycle checks) trivial and correct.
 */
export class LocationTree {
  readonly byId = new Map<string, LocationRow>();
  readonly children = new Map<string | null, LocationRow[]>();
  private direct = new Map<string, number>();

  constructor(rows: LocationRow[], itemCounts: { location_id: string | null; n: number }[] = []) {
    for (const r of rows) this.byId.set(r.id, r);
    for (const r of rows) {
      const p = r.parent_id && this.byId.has(r.parent_id) ? r.parent_id : null;
      if (!this.children.has(p)) this.children.set(p, []);
      this.children.get(p)!.push(r);
    }
    for (const list of this.children.values()) list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
    for (const c of itemCounts) if (c.location_id) this.direct.set(c.location_id, Number(c.n));
  }

  static async load(db: Kysely<TwoThingDb>, workspaceId: string, withCounts = false) {
    const rows = await db.selectFrom("tt_location").selectAll().where("workspace_id", "=", workspaceId).execute();
    const counts = withCounts
      ? await db
          .selectFrom("tt_item")
          .select(["location_id", (eb) => eb.fn.countAll<number>().as("n")])
          .where("workspace_id", "=", workspaceId)
          .groupBy("location_id")
          .execute()
      : [];
    return new LocationTree(rows, counts);
  }

  path(id: string | null | undefined): Crumb[] {
    const out: Crumb[] = [];
    const seen = new Set<string>();
    let cur = id ? this.byId.get(id) : undefined;
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      out.unshift({ id: cur.id, name: cur.name, kind: cur.kind });
      cur = cur.parent_id ? this.byId.get(cur.parent_id) : undefined;
    }
    return out;
  }

  pathText(id: string | null | undefined): string {
    return this.path(id)
      .map((c) => c.name)
      .join(" › ");
  }

  /** id plus every descendant id. */
  descendants(id: string): string[] {
    const out: string[] = [];
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop()!;
      if (out.includes(cur)) continue;
      out.push(cur);
      for (const c of this.children.get(cur) ?? []) stack.push(c.id);
    }
    return out;
  }

  totalItems(id: string): number {
    return this.descendants(id).reduce((n, d) => n + (this.direct.get(d) ?? 0), 0);
  }

  toDto(r: LocationRow): LocationDto {
    const path = this.path(r.id);
    return {
      id: r.id,
      code: r.code,
      codeDisplay: r.code ? formatCode(r.code) : null,
      name: r.name,
      kind: r.kind,
      parentId: r.parent_id,
      description: r.description,
      color: r.color,
      imageId: r.image_id,
      path,
      depth: path.length - 1,
      itemCount: this.direct.get(r.id) ?? 0,
      totalItemCount: this.totalItems(r.id),
      childCount: (this.children.get(r.id) ?? []).length,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
    };
  }

  /** Depth-first (tree order) flat list — what the UI renders as an indented tree. */
  ordered(): LocationDto[] {
    const out: LocationDto[] = [];
    const walk = (parent: string | null) => {
      for (const r of this.children.get(parent) ?? []) {
        out.push(this.toDto(r));
        walk(r.id);
      }
    };
    walk(null);
    return out;
  }
}
