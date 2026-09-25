// app.js：渲染结果
import { advance } from "./align.js";
import { joinStreams } from "./join.js";

export function render(spec) {
  const aligned = advance([spec.left || [], spec.right || []], spec.step);
  const joined = joinStreams(spec.left || [], spec.right || [], aligned.watermark, spec.gap_limit, spec.step);
  return { pairs: joined.pairs, watermark: aligned.watermark, late: joined.late,
           gaps: joined.gaps, state_size: aligned.states[0] };
}
