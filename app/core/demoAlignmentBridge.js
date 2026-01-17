// app/core/demoAlignmentBridge.js

import { clamp01 } from "../transitionModel.js";

import { makeAlignment } from "../model/alignment/alignmentModel.js";
import { makeLine, makeArc, makeTransition } from "../model/alignment/elements.js";
import { sampleAlignmentModel } from "../model/alignment/sample.js";
import { evalAlignmentAt } from "../model/alignment/eval.js";

import { getTransitionFamily } from "../transition/transitionFamily.js";

export function buildDemoAlignmentFromState(st) {
    const kA = 0;
    const kE = 1 / Math.max(1e-9, st.R);

    return makeAlignment({
        start: { x: 0, y: 0, heading: 0 },
        segments: [
        makeLine({ length: st.lead }),
        makeTransition({
            length: st.L,
            kA,
            kE,
            familyId: st.te_family,
            params: { w1: st.te_w1, w2: st.te_w2, m: st.te_m ?? 1.0 }
        }),
        makeArc({ length: st.arcLen, curvature: kE })
        ]
    });
}

export function sampleAndEvalDemo(alignment, st) {
    const sampled = sampleAlignmentModel(alignment, { ds: 2.0 });

    const station = Number.isFinite(st.s)
  ? st.s
  : (st.lead + clamp01(st.u) * st.L);

const u = clamp01((station - st.lead) / Math.max(1e-9, st.L));

    const ev = evalAlignmentAt(alignment, station, { ds: 0.75 });

    // compute normalized κ(u) for readout (using family)
    const k0 = 0;
    const k1 = 1 / Math.max(1e-9, st.R);

    const fam = getTransitionFamily(st.te_family) || getTransitionFamily("linear-clothoid");
    const def = fam.defaults();
    const p = {
        w1: st.te_w1 ?? def.w1,
        w2: st.te_w2 ?? def.w2,
        m: st.te_m ?? def.m ?? 1.0
    };

    const kap = fam.kappa(u, p);
    const kappaNorm = Number.isFinite(kap) ? kap : 0;

    return {
        pts: sampled.pts.map(p => ({ x: p.x, y: p.y, z: 0 })),
        marker: { x: ev.x, y: ev.y, z: 0, s: station, heading: ev.heading, curvature: ev.curvature },
        k0,
        k1,
        kappaNorm
    };
}
