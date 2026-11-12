// Integration test against the dev Postgres (same DATABASE_URL the app uses):
//   pnpm --filter @twodb/app-twothing test
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { sql } from "@twodb/core-data/db";
import { createPgDb } from "@twodb/core-data/db";
import { ulid } from "ulid";
import { applySchema, type TwoThingDb } from "../db/schema.js";
import { loadTwoThingConfig } from "../config.js";
import { generateCodes } from "./code-pool.js";
import { formatCode, normalizeCode } from "./codes.js";

const db = createPgDb<TwoThingDb>({ connectionString: loadTwoThingConfig().DATABASE_URL, schema: "twothing" });
const WS = `test-${ulid()}`;

/** Candidate source that replays a fixed list (cycling), to force collisions. */
const replay = (codes: string[]) => {
  let i = 0;
  return () => codes[i++ % codes.length];
};

before(async () => applySchema(db));
after(async () => {
  for (const t of ["tt_code", "tt_code_batch", "tt_item", "tt_location"] as const) await db.deleteFrom(t).where("workspace_id", "=", WS).execute();
  await db.destroy();
});

describe("normalizeCode", () => {
  test("accepts display, lowercase, look-alikes, prefixes and deep links", () => {
    assert.equal(normalizeCode("k7q-m2x"), "K7QM2X");
    assert.equal(normalizeCode("K7Q M2X"), "K7QM2X");
    assert.equal(normalizeCode("O1L-I23"), "011123");
    assert.equal(normalizeCode("TT:K7QM2X"), "K7QM2X");
    assert.equal(normalizeCode("https://home.lan/apps/twothing/#/c/K7QM2X"), "K7QM2X");
    assert.equal(normalizeCode("4006381333931"), null); // EAN → foreign barcode
    assert.equal(normalizeCode("K7QM2U"), null); // U not in alphabet
    assert.equal(formatCode("K7QM2X"), "K7Q-M2X");
  });
});

describe("generateCodes", () => {
  test("a batch is unique and every code is well-formed", async () => {
    const { codes } = await generateCodes(db, WS, 500);
    assert.equal(codes.length, 500);
    assert.equal(new Set(codes).size, 500);
    for (const c of codes) assert.equal(normalizeCode(c), c);
  });

  test("never re-issues a code generated in the last 7 days", async () => {
    await generateCodes(db, WS, 2, { random: replay(["AAAAAA", "BBBBBB"]) });
    // The source offers the two recent codes first, then fresh ones.
    const { codes } = await generateCodes(db, WS, 2, { random: replay(["AAAAAA", "BBBBBB", "CCCCCC", "DDDDDD"]) });
    assert.deepEqual(codes.sort(), ["CCCCCC", "DDDDDD"]);
  });

  test("never issues a code that is on an item or place, however old", async () => {
    const old = new Date(Date.now() - 400 * 86400_000);
    await db.insertInto("tt_code").values({ workspace_id: WS, code: "EEEEEE", batch_id: null, generated_at: old }).execute();
    await db
      .insertInto("tt_item")
      .values({ id: ulid(), workspace_id: WS, code: "EEEEEE", name: "used", quantity: 1, created_at: old, updated_at: old } as never)
      .execute();
    await db
      .insertInto("tt_location")
      .values({ id: ulid(), workspace_id: WS, code: "FFFFFF", name: "box", kind: "box", parent_id: null, description: "", color: null, image_id: null, created_at: old, updated_at: old })
      .execute();
    const { codes } = await generateCodes(db, WS, 1, { random: replay(["EEEEEE", "FFFFFF", "GGGGGG"]) });
    assert.deepEqual(codes, ["GGGGGG"]);
  });

  test("an unused code older than 7 days may be re-issued (re-stamped to the new batch)", async () => {
    const old = new Date(Date.now() - 8 * 86400_000);
    await db.insertInto("tt_code").values({ workspace_id: WS, code: "HHHHHH", batch_id: null, generated_at: old }).execute();
    const { batchId, codes } = await generateCodes(db, WS, 1, { random: replay(["HHHHHH"]) });
    assert.deepEqual(codes, ["HHHHHH"]);
    const row = await db.selectFrom("tt_code").selectAll().where("workspace_id", "=", WS).where("code", "=", "HHHHHH").executeTakeFirstOrThrow();
    assert.equal(row.batch_id, batchId);
    assert.ok(Date.now() - new Date(row.generated_at).getTime() < 60_000);
  });

  test("gives up cleanly when the candidate source is exhausted", async () => {
    await assert.rejects(generateCodes(db, WS, 1, { random: replay(["AAAAAA"]) }), /code_space_exhausted/);
  });

  test("concurrent batches never overlap (advisory lock)", async () => {
    const [a, b] = await Promise.all([generateCodes(db, WS, 300), generateCodes(db, WS, 300)]);
    const overlap = a.codes.filter((c) => b.codes.includes(c));
    assert.equal(overlap.length, 0);
    const n = await sql<{ n: number }>`select count(*)::int as n from tt_code where workspace_id = ${WS}`.execute(db);
    assert.ok(n.rows[0].n >= 1100);
  });
});
