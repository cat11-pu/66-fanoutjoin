// align.js：水位推进。水位取两条流已见时间（各自最大事件时间）的较小者，
// 同一条推进链上水位只进不退；states 为每条流留在水位窗口 [wm-step, +∞) 内的条数。
let lastWatermark = 0;
let lastStep = 1;

export function currentStep() {
  return lastStep;
}

export function advance(streams, step) {
  const size = step > 0 ? step : 1;
  lastStep = size;

  let watermark = null;
  for (const stream of streams) {
    let latest = null;
    for (const rec of stream) {
      if (latest === null || rec.t > latest) latest = rec.t;
    }
    if (latest !== null) watermark = watermark === null ? latest : Math.min(watermark, latest);
  }

  if (watermark === null) watermark = lastWatermark;
  if (watermark < lastWatermark) watermark = lastWatermark;
  lastWatermark = watermark;

  const cutoff = watermark - size;
  const states = streams.map((stream) => {
    let kept = 0;
    for (const rec of stream) if (rec.t >= cutoff) kept += 1;
    return kept;
  });

  return { watermark, states };
}
