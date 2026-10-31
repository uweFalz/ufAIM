import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
await import('../axtran2/corpus/loadTraAlignment.mjs');
const { AlignmentApplicationService } = await import('../../src/services/alignment/AlignmentApplicationService.js');
const { materializeAlignmentDataFromSparse } = await import('../../src/domain/alignment/editor/materializeAlignmentDataFromSparse.js');
const { buildSparseFromEditModel } = await import('../../src/domain/alignment/editor/buildSparseAlignment.js');
const { createAlignmentSpotObject } = await import('../../src/model/spot/model/createAlignmentSpotObject.js');
const { parseTraGraAuto } = await import('../../src/import/parsers/technet/vermEsn/parseTRA_GRA.js');
const { buildSparseFromLandFAT } = await import('../../src/import/build/buildSparseFromLandFAT.js');

const pose = { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } };
function fixture(curvature = 0.002) {
 const kernel = { type: 'sparseAlignment', startPose: pose, sparse: [
  { id: 'A', type: 'fixed', arcLength: 50, curvature: 0.001 },
  { id: 'T1', type: 'transition', arcLength: 40, transType: 'clothoid' },
  { id: 'H', type: 'fixed', arcLength: 0, curvature, meta: { zeroLength: true, insertedBy: 'enforceAlternation', provenance: { source: 'fixture' } } },
  { id: 'T2', type: 'transition', arcLength: 40, transType: 'clothoid' },
  { id: 'B', type: 'fixed', arcLength: 50, curvature: 0.001 },
 ] };
 return createAlignmentSpotObject({ id: 'imported', kernel });
}
function memory(object) {
 let stored = structuredClone(object); let saves = 0;
 const service = () => new AlignmentApplicationService({ store: { getState: () => ({ workspace_selection: { primaryId: stored.id } }) }, spotGateway: {
  getActiveAlignment: async () => structuredClone(stored),
  getObjectById: async () => structuredClone(stored),
  saveObject: async object => { saves++; stored = structuredClone(object); return structuredClone(stored); },
 } });
 return { service, get: () => structuredClone(stored), saves: () => saves };
}
const holders = sparse => sparse.filter(e => e.meta?.zeroLength === true).map(e => ({ id: e.id, length: e.arcLength, curvature: e.curvature }));

for (const curvature of [0, 0.002, -0.002]) {
 test(`unrelated arc edit/save/fresh materialization preserves holder ${curvature}`, async () => {
  const source = fixture(curvature); const expected = holders(source.data.kernel.sparse);
  const mem = memory(source);
  const first = await mem.service().updateArc({ elementId: 'A', length: 50, radius: 1100 });
  assert.equal(first.changed, true, first.reason);
  assert.deepEqual(holders(mem.get().data.kernel.sparse), expected);
  const fresh = materializeAlignmentDataFromSparse(mem.get());
  assert.deepEqual(fresh.editModel.elements.find(e => e.id === 'H').meta.provenance, { source: 'fixture' });
  assert.deepEqual(holders(buildSparseFromEditModel(fresh).sparse), expected);
  const stored = mem.get(); stored.data.alignmentData = fresh;
  const restarted = memory(stored);
  const second = await restarted.service().updateArc({ elementId: 'A', length: 50, radius: 1200 });
  assert.equal(second.changed, true, second.reason);
  assert.deepEqual(holders(restarted.get().data.kernel.sparse), expected);
  assert.equal(mem.saves(), 1); assert.equal(restarted.saves(), 1);
  assert.equal(source.data.kernel.sparse[0].curvature, 0.001);
 });
}

for (const curvature of [0, 0.002]) {
 test(`marked holder ${curvature} cannot become a positive segment through existing edit handlers`, async () => {
  const mem = memory(fixture(curvature)); const before = mem.get();
  const result = curvature === 0
   ? await mem.service().updateStraightLength({ elementId: 'H', length: 5 })
   : await mem.service().updateArc({ elementId: 'H', length: 5, radius: 500 });
  assert.equal(result.ok, false); assert.match(result.reason, /zero-length holder must remain zero/);
  assert.equal(mem.saves(), 0); assert.deepEqual(mem.get(), before);
 });
}

test('ordinary fixed elements reject zero/negative/nonfinite lengths including measure wrappers', () => {
 for (const curvature of [0, 0.002]) for (const value of [0, -1, NaN, Infinity, { value: 0 }, { value: -1 }, { value: Infinity }]) {
  const native = materializeAlignmentDataFromSparse(fixture(curvature));
  const holder = native.editModel.elements.find(e => e.id === 'H');
  delete holder.meta.zeroLength; holder.length = holder.parameters.length = value;
  assert.throws(() => buildSparseFromEditModel(native), /positive number/);
 }
});

test('marked holders require exactly numeric zero and retain finite nonzero arc curvature', () => {
 for (const value of [1, -1, NaN, Infinity, '0', { value: 0 }]) {
  const native = materializeAlignmentDataFromSparse(fixture());
  const holder = native.editModel.elements.find(e => e.id === 'H');
  holder.length = holder.parameters.length = value;
  assert.throws(() => buildSparseFromEditModel(native), /zero-length holder must remain zero/);
 }
 for (const curvature of [0, NaN, Infinity]) {
  const native = materializeAlignmentDataFromSparse(fixture());
  const holder = native.editModel.elements.find(e => e.id === 'H');
  holder.curvature = holder.parameters.curvature = curvature;
  assert.throws(() => buildSparseFromEditModel(native), /curvature must be finite and non-zero/);
 }
});

test('metadata is cloned rather than shared with imported sparse source', () => {
 const source = fixture(); const native = materializeAlignmentDataFromSparse(source);
 native.editModel.elements[2].meta.provenance.source = 'changed';
 assert.equal(source.data.kernel.sparse[2].meta.provenance.source, 'fixture');
});

test('physical 5500R074-082 import with 69 elements permits unrelated radius save and second edit', async context => {
 const path = new URL('../samples/Landshut/5500R074-082.TRA', import.meta.url);
 let bytes; try { bytes = await readFile(path); } catch (error) { if (error.code === 'ENOENT') return context.skip('local TRA corpus unavailable'); throw error; }
 const document = await parseTraGraAuto({ name: '5500R074-082.TRA', arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
 const kernel = buildSparseFromLandFAT(document.alignments[0]);
 assert.equal(kernel.sparse.length, 69); assert.equal(holders(kernel.sparse).length, 5);
 const expected = holders(kernel.sparse);
 const mem = memory(createAlignmentSpotObject({ id: 'physical69', kernel }));
 const first = await mem.service().updateArc({ elementId: 'el_0001', length: 296.51112786, radius: -840 });
 assert.equal(first.changed, true, first.reason);
 assert.deepEqual(holders(mem.get().data.kernel.sparse), expected);
 const stored = mem.get(); stored.data.alignmentData = materializeAlignmentDataFromSparse(stored);
 const reopened = memory(stored);
 const second = await reopened.service().updateArc({ elementId: 'el_0001', length: 296.51112786, radius: -845 });
 assert.equal(second.changed, true, second.reason);
 assert.deepEqual(holders(reopened.get().data.kernel.sparse), expected);
 assert.equal(reopened.get().data.kernel.sparse.length, 69);
 assert.equal(reopened.get().data.kernel.sparse[0].curvature, -1 / 845);
});
