// align.js：水位推进（基线：不用水位、全量配对）
export function advance(streams, step) {
  return { watermark: 0, states: streams.map((stream) => stream.length) };
}
