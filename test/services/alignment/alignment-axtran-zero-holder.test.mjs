import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
await import('../../axtran2/corpus/loadTraAlignment.mjs');
const { AlignmentAxtranEvidenceService } = await import('../../../src/services/alignment/AlignmentAxtranEvidenceService.js');
const { materializeAlignmentDataFromSparse } = await import('../../../src/domain/alignment/editor/materializeAlignmentDataFromSparse.js');
const { createMetricContext } = await import('../../../src/domain/optimization/alignment/MetricContext.js');
const { parseTraGraAuto } = await import('../../../src/import/parsers/technet/vermEsn/parseTRA_GRA.js');
const { buildSparseFromLandFAT } = await import('../../../src/import/build/buildSparseFromLandFAT.js');
function fixture(curvature = 0.002) {
 return { type: 'AlignmentData', id: 'holders', editModel: { startPose: { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } }, elements: [
  { id: 'A', type: 'arc', parameters: { length: 50, curvature: 0.001 } },
  { id: 'T1', type: 'transition', parameters: { length: 40, transitionType: 'clothoid' } },
  { id: 'H', type: curvature === 0 ? 'straight' : 'arc', meta: { zeroLength: true }, parameters: { length: 0, ...(curvature === 0 ? {} : { curvature }) } },
  { id: 'T2', type: 'transition', parameters: { length: 40, transitionType: 'clothoid' } },
  { id: 'B', type: 'arc', parameters: { length: 50, curvature: 0.001 } },
 ] } };
}
const evaluate = (before, after = before, extra = {}) => new AlignmentAxtranEvidenceService().evaluateChange({ beforeAlignmentData: before, afterAlignmentData: after, sampleCount: 6, maxIterations: 0, ...extra });
for (const curvature of [0, 0.002, -0.002]) {
 test(`holder ${curvature} stays in candidate chain with no free quantity`, () => {
  const input = fixture(curvature); const before = structuredClone(input);
  const result = evaluate(input);
  assert.equal(result.status, 'evidence-only'); assert.equal(result.admissible, false);
  assert.equal(result.proposalStatus, 'max_iterations');
  assert.equal(result.diagnostics.interactiveBudget.freeVariables, 6);
  assert.ok(!result.candidate.names.some(n => n.startsWith('H.')));
  assert.equal(result.candidate.overlay.H, undefined, 'held quantities have no free-variable overlay');
  assert.deepEqual(result.heldElements, [], 'existing result field retains explicit user-held IDs');
  assert.deepEqual(input, before);
  assert.ok(result.diagnostics.endPoseDistance < 1e-10);
  assert.equal(result.diagnostics.alignmentLength, 180);
 });
}

test('ordinary zero and falsely marked positive/malformed holders fail closed', () => {
 const before = fixture();
 for (const change of [
  h => { delete h.meta; }, h => { h.meta.zeroLength = 'true'; },
  h => { h.parameters.length = 1; }, h => { h.parameters.length = -1; },
  h => { h.parameters.length = NaN; }, h => { h.parameters.length = Infinity; },
  h => { h.parameters.length = '0'; }, h => { h.type = 'transition'; h.parameters.transitionType = 'immediate'; },
 ]) {
  const after = structuredClone(before); change(after.editModel.elements[2]);
  assert.throws(() => evaluate(before, after), /finite native horizontal|marked fixed holder/);
 }
});

test('explicit held elements and holder-pose constraints remain supported', () => {
 const input = fixture();
 const result = evaluate(input, input, { heldElements: ['A'], heldPoses: [{ afterElement: 'H', hold: ['theta'] }] });
 assert.deepEqual(result.heldElements, ['A']);
 assert.equal(result.heldPoses[0].afterElement, 'H');
 assert.equal(result.diagnostics.interactiveBudget.freeVariables, 4);
 assert.ok(!result.candidate.names.some(n => n.startsWith('A.') || n.startsWith('H.')));
 assert.throws(() => evaluate(input, input, { heldElements: ['missing'] }), /not a declared element/);
});

test('external-observation evaluatedInput retains original geometry and explicit options', () => {
 const input = fixture();
 const metricContext = createMetricContext({ id: 'holder-local', lengthAuthority: 'ground', unit: 'm', referenceFrame: 'local-survey-plane', distanceOperator: 'euclidean', angleConvention: 'mathematical', provenance: { source: 'synthetic' }, tolerancePolicy: { unit: 'm' } });
 const pointObservationInput = { observationSet: { id: 'P', revision: '1', source: { kind: 'synthetic', reference: 'holder-test' }, metricContext, points: [{ id: 'P1', x: 25, y: 1 }] }, assignments: [{ pointId: 'P1', target: 0, tolerance: 0.1, enforcement: 'soft', reason: 'synthetic test' }], alignmentMetricContext: metricContext };
 const result = evaluate(input, input, { pointObservationInput });
 assert.deepEqual(result.pointObservation.evaluatedInput.beforeAlignmentData, input);
 assert.deepEqual(result.pointObservation.evaluatedInput.afterAlignmentData, input);
 assert.deepEqual(result.pointObservation.evaluatedInput.options.heldElements, []);
 assert.deepEqual(result.pointObservation.evaluatedInput.pointObservationInput.observationSet.points, pointObservationInput.observationSet.points);
 assert.equal(Object.isFrozen(result.pointObservation.evaluatedInput), true);
 assert.equal(result.candidate.overlay.H, undefined);
});

test('physical 69-element import yields bounded maxIterations0 evidence with all five held holders', async context => {
 let bytes; try { bytes = await readFile(new URL('../../samples/Landshut/5500R074-082.TRA', import.meta.url)); } catch (e) { if (e.code === 'ENOENT') return context.skip('local TRA corpus unavailable'); throw e; }
 const doc = await parseTraGraAuto({ name: '5500R074-082.TRA', arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
 const kernel = buildSparseFromLandFAT(doc.alignments[0]);
 const before = materializeAlignmentDataFromSparse({ id: 'physical69', data: { kernel } });
 const after = structuredClone(before); after.editModel.elements[0].parameters.curvature = -1 / 840;
 const result = evaluate(before, after);
 assert.equal(result.proposalStatus, 'max_iterations'); assert.equal(result.admissible, false);
 assert.equal(result.diagnostics.interactiveBudget.freeVariables, 67);
 assert.ok(result.diagnostics.interactiveBudget.freeVariables <= 96);
 const holders = after.editModel.elements.filter(e => e.meta?.zeroLength === true);
 assert.equal(holders.length, 5);
 for (const h of holders) {
  assert.ok(!result.candidate.names.some(n => n.startsWith(`${h.id}.`)));
  assert.equal(result.candidate.overlay[h.id], undefined);
  assert.equal(h.parameters.length, 0);
 }
 assert.equal(Object.keys(result.candidate.overlay).length, 47, 'overlay contains only elements with free quantities; held holders have no patch');
 assert.equal(result.diagnostics.iterations, 0);
});


test('held dual-field curvature follows production radius authority through real iterations', () => {
 const before = fixture(); before.editModel.elements[2].parameters.radius = 250;
 const after = structuredClone(before); after.editModel.elements[0].parameters.curvature = 1 / 1100;
 const original = structuredClone({ before, after });
 const normalizedBefore = structuredClone(before), normalizedAfter = structuredClone(after);
 normalizedBefore.editModel.elements[2].parameters.curvature = 0.004;
 normalizedAfter.editModel.elements[2].parameters.curvature = 0.004;
 const actual = evaluate(before, after, { maxIterations: 3 });
 const expected = evaluate(normalizedBefore, normalizedAfter, { maxIterations: 3 });
 assert.deepEqual(actual.candidate, expected.candidate);
 assert.deepEqual(actual.diagnostics, expected.diagnostics);
 assert.equal(actual.proposalStatus, expected.proposalStatus);
 assert.equal(actual.admissible, false);
 assert.deepEqual({ before, after }, original);
 assert.ok(!actual.candidate.names.some(n => n.startsWith('H.')));
});

test('invalid explicit holder radius cannot fall back to a finite curvature', () => {
 const before = fixture();
 for (const radius of [0, NaN, Infinity, -Infinity, Number.MIN_VALUE]) {
  for (const position of ['parameters', 'element']) {
   const after = structuredClone(before); const holder = after.editModel.elements[2];
   if (position === 'parameters') holder.parameters.radius = radius;
   else holder.radius = radius;
   assert.throws(() => evaluate(before, after), /finite non-zero holder curvature and radius/);
  }
 }
});
