import fs from "node:fs";
import { advance } from "./align.js";
import { joinStreams } from "./join.js";
import { render } from "./app.js";

// 验收断言：上面每条值收进 emit，最后与期望值逐项比对，不符就非零退出。
const __lines = [];
function emit(label, value) { __lines.push([String(label).replace(/ =$/, ""), value]); }


const spec = JSON.parse(fs.readFileSync(process.argv[2] || "sample/aligned.json", "utf8"));
const aligned = advance([spec.left || [], spec.right || []], spec.step);
const joined = joinStreams(spec.left || [], spec.right || [], aligned.watermark, spec.gap_limit, spec.step);
const view = render(spec);

emit("水位 =", aligned.watermark);
emit("连接结果 =", JSON.stringify(joined.pairs));
emit("迟到丢弃的记录 =", JSON.stringify(joined.late));
emit("检测到的缺口 =", JSON.stringify(joined.gaps));
emit("窗口里的条数 =", aligned.states[0]);
emit("水位步长 =", spec.step);


// ---- 异常路径探针：真调用实现，看它报出什么码（不是从样例里抄）----
try {
  const bad = joinStreams([{ id: "l0", k: "a", t: 0 }], [{ id: "r0", k: "a", t: 99 }], 0, 2);
  emit("缺口过大的错误码", bad.gaps.length > 2 ? "no-error" : (bad.code || "no-error"));
} catch (error) {
  emit("缺口过大的错误码", error.code || error.message);
}


// ---- 期望值（参考模型算出，与题面给的验收数值一致）----
const EXPECTED = {
  "水位": 4,
  "连接结果": [
    [
      "l1",
      "r1"
    ]
  ],
  "迟到丢弃的记录": [
    "l0"
  ],
  "检测到的缺口": [
    "a"
  ],
  "窗口里的条数": 2,
  "水位步长": 3
};
// 有的值在收进来之前已经 stringify 过，比较前先试着解析回来，避免类型错配把正确实现判成不过。
function __same(got, want) {
  if (typeof got === "string") {
    try { const parsed = JSON.parse(got); if (JSON.stringify(parsed) === JSON.stringify(want)) return true; } catch (error) { /* 不是 JSON 就按原文比 */ }
  }
  return JSON.stringify(got) === JSON.stringify(want);
}
let __bad = 0;
for (const [label, want] of Object.entries(EXPECTED)) {
  const found = __lines.find((pair) => pair[0] === label);
  if (!found) { __bad += 1; console.log("缺失验收项 " + label); continue; }
  const got = found[1];
  if (__same(got, want)) { console.log("一致 " + label + " = " + JSON.stringify(got)); }
  else { __bad += 1; console.log("不一致 " + label + " 期望 " + JSON.stringify(want) + " 实际 " + JSON.stringify(got)); }
}
console.log("验收项 " + (Object.keys(EXPECTED).length - __bad) + "/" + Object.keys(EXPECTED).length + " 通过");
process.exit(__bad === 0 ? 0 : 1);
