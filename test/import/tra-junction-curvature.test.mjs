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

test('inconsistent transition junction and fixed neighbors fail closed', () => {
 for (const elements of [
  [spiral(0, 500), spiral(600, 0)],
  [curve(600), spiral(500, 0)],
  [spiral(0, 500), curve(-500)],
  [{ ...base, type: 'Line' }, spiral(500, 0)],
 ]) assert.throws(() => build(elements), /inconsistent TRA-like/);
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
