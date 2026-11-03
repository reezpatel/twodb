import assert from "node:assert/strict";
import { test } from "node:test";
import { CODE_ALPHABET, CODE_LENGTH, formatCode, generateCode, normalizeCode } from "./inventory-codes";
import { parseCsv, toCsv } from "./csv";

test("generated codes use the unambiguous alphabet", () => {
  for (let i = 0; i < 500; i++) {
    const code = generateCode();
    assert.equal(code.length, CODE_LENGTH);
    for (const ch of code) assert.ok(CODE_ALPHABET.includes(ch));
  }
});

test("normalizeCode tolerates case, separators and look-alikes", () => {
  assert.equal(normalizeCode("abcd-efgh"), "ABCDEFGH");
  assert.equal(normalizeCode("0123 4567"), "01234567");
  assert.equal(normalizeCode("OIL00000"), "01100000");
  assert.equal(normalizeCode("ABCDEFG"), null);
  assert.equal(normalizeCode("ABCDEFGU"), null);
  assert.equal(formatCode("ABCDEFGH"), "ABCD-EFGH");
});

test("csv round-trips quotes, commas and newlines", () => {
  const rows = [["a", 'he said "hi"', "x,y"], ["multi\nline", "", "z"]];
  assert.deepEqual(parseCsv(toCsv(rows)), rows);
  assert.deepEqual(parseCsv("\uFEFFa,b\r\n1,2"), [["a", "b"], ["1", "2"]]);
});
