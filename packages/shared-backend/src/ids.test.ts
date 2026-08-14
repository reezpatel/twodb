import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
import test from "node:test";
import { ENTITY_ID_PATTERN } from "@twodb/contracts";
import { newId } from "./ids";

test("newId matches the entity id shape", () => {
	for (const prefix of ["usr", "org", "wks", "rol", "grt", "app"] as const) {
		assert.match(newId(prefix), ENTITY_ID_PATTERN);
		assert.match(newId(prefix), new RegExp(`^${prefix}-`));
	}
});

test("ids are time-ordered across milliseconds", async () => {
	const a = newId("usr");
	await sleep(2);
	const b = newId("usr");
	assert.ok(a < b, `expected ${a} < ${b}`);
});

test("100k generations are unique", () => {
	const seen = new Set<string>();
	for (let i = 0; i < 100_000; i++) seen.add(newId("usr"));
	assert.equal(seen.size, 100_000);
});
