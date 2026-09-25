// join.js：水位连接。两条流各扫一次（O(n+m)，无嵌套重扫）。
// - 同键且时间差不超过步长的记录配对，每条记录至多参与一次配对；
// - t < watermark-step 的记录记为迟到并丢弃，不参与配对；
// - 同一键时间跨度超过 gapLimit*step 记缺口；缺口条数（跨度内缺的步长档数）
//   超过 gapLimit 时抛 E_GAP_TOO_BIG，不返回配对结果。
import { currentStep } from "./align.js";

export function joinStreams(left, right, watermark, gapLimit, step) {
  const size = step > 0 ? step : currentStep();
  const limit = gapLimit === undefined || gapLimit === null ? 2 : gapLimit;
  const cutoff = watermark - size;

  const late = [];
  const pending = new Map();
  const minT = new Map();
  const maxT = new Map();
  const keyOrder = [];

  const observe = (k, t) => {
    if (!minT.has(k)) {
      minT.set(k, t);
      maxT.set(k, t);
      keyOrder.push(k);
    } else {
      if (t < minT.get(k)) minT.set(k, t);
      if (t > maxT.get(k)) maxT.set(k, t);
    }
  };

  for (const rec of left) {
    observe(rec.k, rec.t);
    if (rec.t < cutoff) {
      late.push(rec.id);
      continue;
    }
    let bucket = pending.get(rec.k);
    if (!bucket) {
      bucket = { rows: [], ptr: 0 };
      pending.set(rec.k, bucket);
    }
    bucket.rows.push(rec);
  }

  const pairs = [];
  for (const rec of right) {
    observe(rec.k, rec.t);
    if (rec.t < cutoff) {
      late.push(rec.id);
      continue;
    }
    const bucket = pending.get(rec.k);
    if (!bucket) continue;
    while (bucket.ptr < bucket.rows.length) {
      const cand = bucket.rows[bucket.ptr++];
      if (Math.abs(cand.t - rec.t) <= size) {
        pairs.push([cand.id, rec.id]);
        break;
      }
    }
  }

  const gaps = [];
  let missing = 0;
  for (const k of keyOrder) {
    const span = maxT.get(k) - minT.get(k);
    if (span > limit * size) {
      gaps.push(k);
      missing += Math.max(0, Math.floor(span / size) - 1);
    }
  }

  if (missing > limit) {
    const error = new Error("E_GAP_TOO_BIG");
    error.code = "E_GAP_TOO_BIG";
    throw error;
  }

  return { pairs, late, gaps };
}
