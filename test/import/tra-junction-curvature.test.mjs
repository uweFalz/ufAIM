import assert from 'node:assert/strict';
import test from 'node:test';
await import('../axtran2/corpus/loadTraAlignment.mjs');
const { buildSparseFromLandFAT } = await import('../../src/import/build/buildSparseFromLandFAT.js');
const { makeAlignment2DFromSparse } = await import('../../src/aim-core/alignment/aggregate/AlignmentFactory.js');
const { deps } = await import('../../src/domain/optimization/alignment/SolverDependencies.js');

const base = { start: { easting: 0, northing: 0 }, length: 40,
 direction: { value: 0, unit: 'radian', orientation: 'ccw', origin: 'east' } };
const spiral = (a, b, extra = {}) => ({ ...base, type: 'Spiral', spiType: 'clothoid', radiusStart: a, radiusEnd: b,
 extras: { sourceSemantics: { formatClass: 'tra-like' } }, ...extra });
const curve = (radius) => ({ ...base, type: 'Curve', radius });
const build = (elements, extra = {}) => buildSparseFromLandFAT({ coordGeom: { elements }, ...extra });
const close = (a, b, tolerance = 1e-12) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

for (const sign of [1, -1]) {
 test(`two transitions preserve signed peak ${sign} through actual production geometry`, () => {
  const input = [spiral(0, sign * 500), spiral(sign * 500, 0)];
  const before = structuredClone(input);
  const sparse = build(input);
  assert.deepEqual(input, before);
  assert.equal(sparse.sparse.length, 5);
  assert.deepEqual(sparse.sparse.filter(e => e.type === 'fixed').map(e => e.curvature), [0, -sign / 500, 0]);
  assert.equal(sparse.sparse[2].arcLength, 0);
  const geometry = makeAlignment2DFromSparse({ ...deps, startPose: sparse.startPose, sparse: sparse.sparse }).alignment;
  close(geometry.arcLength, 80);
  // Independent linear-clothoid curvature and integrated heading.
  for (const s of [10, 20, 30, 50, 60, 70]) {
   close(geometry.curvatureAt(s), -sign / 500 * (s < 40 ? s / 40 : (80 - s) / 40));
  }
  const end = geometry.poseAt(80, { quality: 'exact' });
  close(end.t.x, Math.cos(-sign * 0.08));
  close(end.t.y, Math.sin(-sign * 0.08));
 });
 test(`open nonzero boundaries preserve signed radii ${sign}`, () => {
  const result = build([spiral(sign * 1000, sign * 500)]);
  close(result.sparse[0].curvature, -sign / 1000);
  close(result.sparse[2].curvature, -sign / 500);
 });
 test(`matching fixed neighbors accepted ${sign}`, () => {
  assert.equal(build([curve(sign * 1000), spiral(sign * 1000, sign * 500), curve(sign * 500)]).sparse.length, 3);
 });
}

// The file's R1/R2 win over the neighbour: a zero-length holder carries the transition's
// curvature at the junction, the immediate between the two fixed elements is the curvature
// step the file states (the solver's reader does the same since 2026-11-09).
const shape = sparse => sparse.map(e => e.type === 'fixed' ? [e.arcLength, e.curvature, e.meta?.insertedBy ?? 'source'] : e.transType);
test('a transition whose R1/R2 the neighbour does not have gets a holder with the file curvature', () => {
 const cases = [
  [[spiral(0, 500), spiral(600, 0)], [[0, 0, 'enforceAlternation'], 'clothoid', [0, -1 / 500, 'traLikeJunction'], 'immediate', [0, -1 / 600, 'traLikeJunction'], 'clothoid', [0, 0, 'enforceAlternation']]],
  [[curve(600), spiral(500, 0)], [[40, -1 / 600, 'source'], 'immediate', [0, -1 / 500, 'traLikeJunction'], 'clothoid', [0, 0, 'enforceAlternation']]],
  [[spiral(0, 500), curve(-500)], [[0, 0, 'enforceAlternation'], 'clothoid', [0, -1 / 500, 'traLikeJunction'], 'immediate', [40, 1 / 500, 'source']]],
  [[{ ...base, type: 'Line' }, spiral(500, 0)], [[40, 0, 'source'], 'immediate', [0, -1 / 500, 'traLikeJunction'], 'clothoid', [0, 0, 'enforceAlternation']]],
 ];
 for (const [elements, expected] of cases) {
  const result = build(elements);
  assert.deepEqual(shape(result.sparse), expected);
  for (const holder of result.sparse.filter(e => e.meta?.insertedBy === 'traLikeJunction')) {
   assert.equal(holder.meta.zeroLength, true);
   assert.equal(holder.meta.sourceType, 'Spiral');
   assert.ok(['start', 'end'].includes(holder.meta.junction));
   assert.equal(elements[holder.meta.sourceIndex].type, 'Spiral');
  }
  assert.ok(result.sparse.every((e, i) => i === 0 || (e.type === 'fixed') !== (result.sparse[i - 1].type === 'fixed')), 'alternation holds');
 }
});

test('the holder geometry follows the file: step at the junction, linear clothoid from R1', () => {
 const geometry = elements => makeAlignment2DFromSparse({ ...deps, startPose: build(elements).startPose, sparse: build(elements).sparse }).alignment;
 const stepped = geometry([curve(600), spiral(500, 0)]);
 close(stepped.arcLength, 80);
 close(stepped.curvatureAt(20), -1 / 600);
 close(stepped.curvatureAt(60), -1 / 1000);
 const twoSpirals = geometry([spiral(0, 500), spiral(600, 0)]);
 close(twoSpirals.arcLength, 80);
 close(twoSpirals.curvatureAt(20), -1 / 1000);
 close(twoSpirals.curvatureAt(60), -1 / 1200);
});

test('radii within the kernel junction tolerance are the same curvature and get no holder', async () => {
 const { JUNCTION_CURVATURE_TOLERANCE } = await import('../../src/domain/optimization/alignment/CurvatureJunction.js');
 const off = (delta) => 1 / (1 / 1000 - delta);
 assert.equal(build([curve(1000), spiral(off(JUNCTION_CURVATURE_TOLERANCE / 2), 500), curve(500)]).sparse.length, 3);
 assert.equal(build([curve(1000), spiral(off(JUNCTION_CURVATURE_TOLERANCE * 2), 500), curve(500)]).sparse.length, 5);
});

test('a corpus file with R1 unlike its arc imports and reaches its recorded end', async context => {
 const { readFile } = await import('node:fs/promises');
 const { parseTraGraAuto } = await import('../../src/import/parsers/technet/vermEsn/parseTRA_GRA.js');
 const { traAlignmentFromBytes } = await import('../../src/import/parsers/technet/vermEsn/traAlignment.js');
 const name = '5632R000-002.TRA';
 let bytes; try { bytes = await readFile(new URL(`../samples/Landshut/${name}`, import.meta.url)); } catch (e) { if (e.code === 'ENOENT') return context.skip('local TRA corpus unavailable'); throw e; }
 const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
 const document = await parseTraGraAuto({ name, arrayBuffer: async () => buffer });
 const sparse = buildSparseFromLandFAT(document.alignments[0]);
 const holders = sparse.sparse.filter(e => e.meta?.insertedBy === 'traLikeJunction');
 assert.equal(holders.length, 1);
 assert.deepEqual([holders[0].meta.sourceIndex, holders[0].meta.junction, holders[0].arcLength], [4, 'start', 0]);
 const at = sparse.sparse.indexOf(holders[0]);
 assert.equal(sparse.sparse[at - 1].transType, 'immediate');
 assert.equal(sparse.sparse[at - 2].meta.sourceType, 'Curve');
 assert.ok(Math.abs(sparse.sparse[at - 2].curvature - holders[0].curvature) > 1e-3);
 const { alignment } = makeAlignment2DFromSparse({ ...deps, startPose: sparse.startPose, sparse: sparse.sparse });
 const reader = await traAlignmentFromBytes(new Uint8Array(buffer), name);
 const end = alignment.poseAt(alignment.arcLength, { quality: 'exact' });
 assert.ok(Math.hypot(end.p.x - reader.endPoint.x, end.p.y - reader.endPoint.y) < 1e-3);
});

for (const field of ['radiusStart', 'radiusEnd']) {
 test(`missing and invalid ${field} never silently become zero`, () => {
  for (const value of [undefined, null, '', '500', false, NaN, Infinity, -Infinity, Number.MIN_VALUE]) {
   assert.throws(() => build([spiral(0, 500, { [field]: value })]), /invalid TRA-like/);
  }
 });
}

test('zero radius is explicitly straight and continuous', () => {
 assert.deepEqual(build([spiral(500, 0), spiral(0, -500)]).sparse.filter(e => e.type === 'fixed').map(e => e.curvature), [-0.002, 0, 0.002]);
});

test('neighbor-driven LandXML without endpoint radii remains unchanged', () => {
 const source = spiral(undefined, undefined, { extras: {}, rot: 'ccw' });
 const result = build([curve(1000), source, curve(500)]);
 assert.deepEqual(result.sparse.filter(e => e.type === 'fixed').map(e => e.curvature), [-0.001, -0.002]);
});

test('explicit unresolved type8 stays unresolved for the production build guard', () => {
 const source = spiral(null, null, { spiType: 'unresolved_technet_type8', extras: {
  sourceSemantics: { formatClass: 'tra-like' }, transitionResolution: { status: 'unresolved' } } });
 const result = build([source]);
 assert.throws(() => makeAlignment2DFromSparse({ ...deps, startPose: result.startPose, sparse: result.sparse }),
  error => error.code === 'ALIGNMENT_TRANSITION_BUILD_FAILED');
});

test('holder count, source metadata, IDs and cant references are preserved', () => {
 const elements = [curve(1000), spiral(1000, 500), spiral(500, 1000), curve(1000)];
 const cant = { elements: [{ cGeomSourceIndex: 3, startCant: 0.1, endCant: 0.2 }] };
 const result = build(elements, { cant });
 const legacy = build(elements.map(e => ({ ...e, extras: {} })), { cant });
 assert.deepEqual(result.bands, legacy.bands);
 assert.deepEqual(result.sparse.map(e => [e.id, e.meta]), legacy.sparse.map(e => [e.id, e.meta]));
 assert.equal(result.bands.cant.elements[0].cGeomSourceIndex, 3);
});
