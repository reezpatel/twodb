import { describe, expect, it } from "vitest";
import { parseJsonArray } from "./utils";

describe("parseJsonArray", () => {
	it("parses string arrays", () => {
		expect(parseJsonArray('["internal","usb"]')).toEqual(["internal", "usb"]);
	});

	it.each([null, "", "not-json", "{}", '["usb",1]'])(
		"returns undefined for %j",
		(raw) => {
			expect(parseJsonArray(raw)).toBeUndefined();
		},
	);
});
