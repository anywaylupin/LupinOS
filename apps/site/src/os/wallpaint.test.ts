import assert from "node:assert/strict";
import { test } from "node:test";
import { parseWall } from "./wallpaint.ts";

test("reads the radial blobs and linear base of a theme wallpaper, top layer first", () => {
  const layers = parseWall(
    "radial-gradient(70% 80% at 88% 10%, #e8956f 0%, transparent 60%), radial-gradient(80% 90% at 8% 95%, #3a1f3d 0%, transparent 65%), linear-gradient(155deg, #c4605a 0%, #9a3a48 42%, #2a1b2e 100%)",
  );
  assert.equal(layers.length, 3);
  assert.deepEqual(layers[0], { kind: "radial", rx: 0.7, ry: 0.8, x: 0.88, y: 0.1, stops: [{ color: "#e8956f", at: 0 }, { color: "transparent", at: 0.6 }] });
  assert.equal(layers[2].kind, "linear");
  assert.equal(layers[2].kind === "linear" && layers[2].angle, 155);
  assert.equal(layers[2].stops.length, 3);
});

test("skips layers it does not understand", () => {
  assert.deepEqual(parseWall("url(a.png), conic-gradient(red, blue)"), []);
});
