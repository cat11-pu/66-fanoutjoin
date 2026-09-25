import assert from "node:assert";
import { advance } from "../align.js";
import { joinStreams } from "../join.js";
import { render } from "../app.js";

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

const left = [{ id: "l0", k: "a", t: 0 }];

check("advance returns watermark", () => {
  assert.strictEqual(typeof advance([left], 5).watermark, "number");
});

check("advance returns states", () => {
  assert.ok(Array.isArray(advance([left], 5).states));
});

check("joinStreams returns pairs", () => {
  assert.ok(Array.isArray(joinStreams(left, [], 0).pairs));
});

check("joinStreams reports late", () => {
  assert.ok(Array.isArray(joinStreams(left, [], 0).late));
});

check("render exposes state_size", () => {
  assert.strictEqual(typeof render({ left: left, right: [], step: 5, gap_limit: 2 }).state_size, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
