// join.js：连接与缺口（基线：全配对、不判迟到）
export function joinStreams(left, right, watermark) {
  const pairs = [];
  for (const one of left) {
    for (const other of right) {
      if (one.k === other.k) pairs.push([one.id, other.id]);
    }
  }
  return { pairs: pairs, late: [], gaps: [] };
}
