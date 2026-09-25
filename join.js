// join.js：水位窗口连接（同键、时间差不超过步长、每条只配一次）
// 迟到（早于水位减步长）显式丢弃；同键时间跨度超阈值记缺口，缺口条数超限报 E_GAP_TOO_BIG。
const GAP_CODE = "E_GAP_TOO_BIG";

// 每个键桶一套前后继并查集，跳过高已配对的槽位，保证均摊近 O(1)、不嵌套重扫。
function makeSlots(size) {
  const succ = new Array(size + 1);
  const pred = new Array(size + 1);
  for (let i = 0; i <= size; i += 1) { succ[i] = i; pred[i] = i; }
  function findSucc(x) { while (succ[x] !== x) { succ[x] = succ[succ[x]]; x = succ[x]; } return x; }
  function findPred(x) { while (pred[x] !== x) { pred[x] = pred[pred[x]]; x = pred[x]; } return x; }
  return {
    next(i) { return i > size ? size : findSucc(i); },
    prev(i) { return i < 0 ? -1 : findPred(i + 1) - 1; },
    occupy(i) { succ[i] = findSucc(i + 1); pred[i + 1] = findPred(i); }
  };
}

export function joinStreams(left, right, watermark, gapLimit, step) {
  const stepSize = Number.isFinite(step) && step > 0 ? step : 1;
  const limit = Number.isFinite(gapLimit) ? gapLimit : Infinity;
  const floor = watermark - stepSize;

  // 第一遍：迟到拆分 + 按键统计时间跨度（两条流各扫一次）
  const late = [];
  const leftLive = [];
  const rightLive = [];
  const spans = new Map();
  function see(rec) {
    const span = spans.get(rec.k);
    if (span) {
      if (rec.t < span[0]) span[0] = rec.t;
      if (rec.t > span[1]) span[1] = rec.t;
    } else {
      spans.set(rec.k, [rec.t, rec.t]);
    }
  }
  for (const rec of left) {
    see(rec);
    if (rec.t < floor) late.push(rec.id); else leftLive.push(rec);
  }
  for (const rec of right) {
    see(rec);
    if (rec.t < floor) late.push(rec.id); else rightLive.push(rec);
  }

  // 缺口：同键跨度超过 阈值*步长 记缺口；缺口条数（跨度折合阈值的份数）超限则报错，不静默配对
  const gaps = [];
  if (limit !== Infinity) {
    let gapUnits = 0;
    for (const entry of spans) {
      const span = entry[1][1] - entry[1][0];
      if (span > limit * stepSize) {
        gaps.push(entry[0]);
        gapUnits += Math.floor(span / (limit * stepSize));
      }
    }
    if (gapUnits > limit) {
      const error = new Error(GAP_CODE);
      error.code = GAP_CODE;
      throw error;
    }
  }

  // 右流按键分桶，桶内按 (时间, 到达序号) 排序
  const buckets = new Map();
  rightLive.forEach((rec, idx) => {
    let bucket = buckets.get(rec.k);
    if (!bucket) { bucket = { items: [], slots: null }; buckets.set(rec.k, bucket); }
    bucket.items.push({ rec: rec, idx: idx });
  });
  for (const bucket of buckets.values()) {
    bucket.items.sort((a, b) => (a.rec.t - b.rec.t) || (a.idx - b.idx));
    bucket.slots = makeSlots(bucket.items.length);
  }

  // 第二遍：每条左流记录在对应键桶内二分定位窗口，取时间最近的未配对右流记录（平手取先到者）
  const pairs = [];
  for (const rec of leftLive) {
    const bucket = buckets.get(rec.k);
    if (!bucket) continue;
    const items = bucket.items;
    let lo = 0;
    let hi = items.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (items[mid].rec.t < rec.t) lo = mid + 1; else hi = mid;
    }
    const winLo = rec.t - stepSize;
    const winHi = rec.t + stepSize;
    let best = -1;
    const rSlot = bucket.slots.next(lo);
    if (rSlot < items.length && items[rSlot].rec.t <= winHi) best = rSlot;
    const lSlot = bucket.slots.prev(lo - 1);
    if (lSlot >= 0 && items[lSlot].rec.t >= winLo) {
      if (best === -1) {
        best = lSlot;
      } else {
        const dRight = items[best].rec.t - rec.t;
        const dLeft = rec.t - items[lSlot].rec.t;
        if (dLeft < dRight || (dLeft === dRight && items[lSlot].idx < items[best].idx)) best = lSlot;
      }
    }
    if (best === -1) continue;
    bucket.slots.occupy(best);
    pairs.push([rec.id, items[best].rec.id]);
  }

  return { pairs: pairs, late: late, gaps: gaps };
}
