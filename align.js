// align.js：水位推进（按各自支流起点对齐步长，取较小者，不回退）
export function advance(streams, step) {
  const stepSize = Number.isFinite(step) && step > 0 ? step : 1;
  let watermark = null;
  for (const stream of streams) {
    if (!stream.length) continue;
    let lo = Infinity;
    let hi = -Infinity;
    for (const rec of stream) {
      if (rec.t < lo) lo = rec.t;
      if (rec.t > hi) hi = rec.t;
    }
    const aligned = lo + Math.floor((hi - lo) / stepSize) * stepSize;
    if (watermark === null || aligned < watermark) watermark = aligned;
  }
  if (watermark === null) watermark = 0;
  const floor = watermark - stepSize;
  const states = streams.map((stream) => {
    let kept = 0;
    for (const rec of stream) if (rec.t >= floor) kept += 1;
    return kept;
  });
  return { watermark: watermark, states: states };
}
