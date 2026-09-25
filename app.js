// app.js：渲染结果
import { advance } from "./align.js";
import { joinStreams } from "./join.js";

export function render(spec) {
  const left = spec.left || [];
  const right = spec.right || [];
  const aligned = advance([left, right], spec.step);
  const joined = joinStreams(left, right, aligned.watermark, spec.gap_limit, spec.step);
  return { pairs: joined.pairs, watermark: aligned.watermark, late: joined.late,
           gaps: joined.gaps, state_size: aligned.states[0] };
}
