// src/domain/optimization/alignment/ProductionAlignment.js
//
// AXTRAN2 Calculation Kernel - the kernel's element sequence as the
// production Alignment2D, which is what the foot-point projector and the
// end-pose check need. Lifted from test/axtran2/corpus/loadTraAlignment.mjs
// on 2026-10-12; the solver's scenario and the adapter build from here.

import { makeAlignment2DFromSparse } from "../../../aim-core/alignment/aggregate/AlignmentFactory.js";
import * as sw from "../../../import/build/sparseWriter.js";

/**
 * The same element sequence as an Alignment2D, which is what the residual
 * builder needs for world2Track. The editor path cannot express it - it wants
 * strictly alternating fixed/transition elements of positive length, and a
 * real alignment has compound curves, curves meeting straights without a
 * transition, and the held junction arcs above - so the sparse is written the
 * way the LandFAT bridge writes it, with enforceAlternation filling the gaps
 * with zero-length immediates. The factory chains from startPose and reads a
 * transition's exit curvature from the next fixed stub; per-element anchors
 * are not needed.
 *
 * @param {object} input
 * @param {Array} input.elements   kernel elements, as loadTraAlignment returns them
 * @param {{x,y,theta}} input.startPose
 * @param {object} input.deps      { descriptorResolver, kappaBuilder }
 */
export function buildProductionAlignment({ elements, startPose, deps }) {
	const raw = elements.map((e) => {
		if (e.type === "transition") return sw.transition({ poseA: null, arcLength: e.length, transType: e.family });
		// the sparse model carries a kink's turn as its unit vector, as the
		// LandFAT bridge writes it; a turn of exactly zero is nothing
		if (e.type === "kink") return e.deltaDir
			? sw.kink({ poseA: null, deltaDir: { x: Math.cos(e.deltaDir), y: Math.sin(e.deltaDir) }, meta: { sourceType: "Kink" } })
			: sw.zeroFixed({ poseA: null, curvature: 0 });
		const curvature = e.type === "arc" ? e.curvature : 0;
		return e.length > 0
			? sw.fixed({ poseA: null, arcLength: e.length, curvature })
			: sw.zeroFixed({ poseA: null, curvature });
	});
	const sparse = sw.enforceAlternation(raw).map((el, i) => ({ id: el.id ?? `S${i}`, ...el }));
	const pose = { p: { x: startPose.x, y: startPose.y }, t: { x: Math.cos(startPose.theta), y: Math.sin(startPose.theta) } };
	return makeAlignment2DFromSparse({ startPose: pose, sparse, ...deps }).alignment;
}

