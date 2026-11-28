import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanRelPath, outputKey, defaultOutputPrefix, cleanPrefix, RunRegistry } from "./runs.js";

test("cleanRelPath rejects escapes and junk", () => {
  for (const bad of ["", "..", "../x", "a/../b", "/abs/../x", "a//b", "./a", "a/.", "a\0b", "x".repeat(600), "..\\x"]) {
    assert.equal(cleanRelPath(bad), null, JSON.stringify(bad));
  }
});

test("cleanRelPath normalises", () => {
  assert.equal(cleanRelPath("/frames/001.jpg"), "frames/001.jpg");
  assert.equal(cleanRelPath("a\\b.txt"), "a/b.txt");
});

test("outputKey stays inside the run prefix", () => {
  const run = { outputPrefix: "twodrive/u1/video.frames-ab12cd34/" };
  assert.equal(outputKey(run, "frames/001.jpg"), "twodrive/u1/video.frames-ab12cd34/frames/001.jpg");
  assert.equal(outputKey(run, "../other.txt"), null);
  assert.equal(outputKey(run, "/etc/passwd"), "twodrive/u1/video.frames-ab12cd34/etc/passwd");
});

test("defaultOutputPrefix sits next to the reference asset in a fresh folder", () => {
  assert.equal(defaultOutputPrefix("twochat/a/b/clip.final.mp4", "video_to_frames", "abcdef1234567"), "twochat/a/b/clip.final.video_to_frames-abcdef12/");
  assert.equal(defaultOutputPrefix("clip.mp4", "p", "12345678zz"), "clip.p-12345678/");
});

test("cleanPrefix", () => {
  assert.equal(cleanPrefix("out/x"), "out/x/");
  assert.equal(cleanPrefix("out/x///"), "out/x/");
  assert.equal(cleanPrefix("../x"), null);
  assert.equal(cleanPrefix(""), null);
});

test("RunRegistry lifecycle", () => {
  const r = new RunRegistry();
  const run = r.create({ workspaceId: "w", instanceId: "i", pipeline: "p", outputPrefix: "a/" });
  assert.equal(r.get(run.id)?.workspaceId, "w");
  r.finish(run.id);
  assert.equal(r.get(run.id), undefined);
});
