import { describe, expect, it } from "vitest";
import { setTimeout as sleep } from "node:timers/promises";
import { ENTITY_ID_PATTERN } from "@twodb/contracts";
import { newId } from "./ids";

describe("newId", () => {
	it("matches the entity id shape for every prefix", () => {
		for (const prefix of ["usr", "org", "wks", "rol", "grt", "app"] as const) {
			expect(newId(prefix)).toMatch(ENTITY_ID_PATTERN);
			expect(newId(prefix)).toMatch(new RegExp(`^${prefix}-`));
		}
	});

	it("ids are time-ordered across milliseconds", async () => {
		const a = newId("usr");
		await sleep(2);
		const b = newId("usr");
		expect(a < b).toBe(true);
	});

	it("100k generations are unique", () => {
		const seen = new Set<string>();
		for (let i = 0; i < 100_000; i++) seen.add(newId("usr"));
		expect(seen.size).toBe(100_000);
	});
});
