import test from 'node:test';
import assert from 'node:assert/strict';

import { RegistryResolver } from '../../src/domain/transition/registry/RegistryResolver.js';
import transitionLookup from '../../src/domain/transition/transitionLookup.json' with { type: 'json' };
import { KappaFcnBuilder } from '../../src/domain/transition/build/KappaFcnBuilder.js';

import {
  evaluateLineBlossArc,
  buildChangeTransitionTypeProblem,
} from '../../src/domain/optimization/alignment/buildChangeTransitionTypeProblem.js';

function approxEqual(actual, expected, tol, message) {
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${message}: expected ${expected}, got ${actual}, tol=${tol}`
  );
}

function integrate01(fn, steps = 20000) {
  let sum = 0;
  for (let i = 0; i < steps; i++) {
    const u = (i + 0.5) / steps;
    sum += fn(u);
  }
  return sum / steps;
}

function wrapAngle(a) {
  let x = Number(a) || 0;
  while (x > Math.PI) x -= 2 * Math.PI;
  while (x < -Math.PI) x += 2 * Math.PI;
  return x;
}

test('legacy Bloss normalized curvature vector parity', () => {
  const resolver = new RegistryResolver(transitionLookup);
  const descriptor = resolver.resolveTransitionDescriptor('bloss');
  const preset = KappaFcnBuilder.buildPresetFromDescriptor(descriptor);

  const vectors = [
    { u: 0.25, expected: 3 * 0.25 ** 2 - 2 * 0.25 ** 3 },
    { u: 0.50, expected: 3 * 0.50 ** 2 - 2 * 0.50 ** 3 },
    { u: 0.75, expected: 3 * 0.75 ** 2 - 2 * 0.75 ** 3 },
  ];

  for (const v of vectors) {
    approxEqual(
      preset.kappa(v.u),
      v.expected,
      1e-10,
      `bloss kappa(u) mismatch at u=${v.u}`
    );
  }

  approxEqual(preset.kappa(0), 0, 1e-12, 'bloss start curvature should be 0');
  approxEqual(preset.kappa(1), 1, 1e-12, 'bloss end curvature should be 1');

  const integral = integrate01((u) => preset.kappa(u));
  approxEqual(integral, 1 / 2, 2e-6, 'bloss integral over [0,1] should be 1/2');
});

test('line-transition-arc heading is consistent with legacy Bloss normalization', () => {
  const poseA = { p: { x: 0, y: 0 }, theta: 0 };
  const kB = 1 / 300;

  const out = evaluateLineBlossArc({
    poseA,
    Lg: 80,
    Lu: 60,
    Lb: 120,
    kB,
    transitionType: 'bloss',
  });

  const expectedHeading = kB * ((60 * 0.5) + 120);
  approxEqual(
    out.endPose.theta,
    expectedHeading,
    5e-4,
    'end heading mismatch for line-bloss-arc composition'
  );
});

test('custom transition shape propagates into theta Jacobian term', () => {
  const poseA = { p: { x: 0, y: 0 }, theta: 0 };
  const poseE = { p: { x: 0, y: 0 }, theta: 0 };
  const kB = 0.002;

  const problem = buildChangeTransitionTypeProblem({
    poseA,
    poseE,
    initial: { Lg: 100, Lu: 50, Lb: 100 },
    kB,
    transitionKappa01: (u) => u * u,
  });

  const snap = problem.snapshot();

  // Integral of u^2 from 0..1 is 1/3, so d(theta)/d(Lu) = kB / 3.
  approxEqual(
    snap.JG[2][1],
    kB / 3,
    1e-4,
    'theta Jacobian w.r.t Lu should respect custom transition integral'
  );
  approxEqual(snap.JG[2][2], kB, 1e-12, 'theta Jacobian w.r.t Lb should stay kB');
});

test('signed curvature behavior preserves heading sign and orientation', () => {
  const poseA = { p: { x: 0, y: 0 }, theta: 0 };

  const pos = evaluateLineBlossArc({
    poseA,
    Lg: 40,
    Lu: 30,
    Lb: 80,
    kB: 1 / 250,
    transitionType: 'bloss',
  });

  const neg = evaluateLineBlossArc({
    poseA,
    Lg: 40,
    Lu: 30,
    Lb: 80,
    kB: -1 / 250,
    transitionType: 'bloss',
  });

  assert.ok(pos.endPose.theta > 0, 'positive curvature case should end with positive heading');
  assert.ok(neg.endPose.theta < 0, 'negative curvature case should end with negative heading');
  approxEqual(wrapAngle(pos.endPose.theta + neg.endPose.theta), 0, 1e-3, 'signed cases should be heading-mirrored');
  approxEqual(pos.endPose.p.x, neg.endPose.p.x, 0.2, 'signed cases should preserve x approximately');
  approxEqual(pos.endPose.p.y, -neg.endPose.p.y, 0.5, 'signed cases should mirror y approximately');
});

test('asymmetric transition partition changes profile but keeps normalized integral', () => {
  const resolver = new RegistryResolver(transitionLookup);
  const descriptor = resolver.resolveTransitionDescriptor('bloss');

  const presetSym = KappaFcnBuilder.buildPresetFromDescriptor(descriptor);
  const presetAsym = KappaFcnBuilder.buildPresetFromDescriptor(descriptor, { w1: 0.2, w2: 0.85 });

  approxEqual(presetAsym.cuts01.w1, 0.2, 1e-12, 'asymmetric preset w1 mismatch');
  approxEqual(presetAsym.cuts01.w2, 0.85, 1e-12, 'asymmetric preset w2 mismatch');

  assert.ok(Math.abs(presetAsym.kappa(0.5) - presetSym.kappa(0.5)) > 1e-3, 'asymmetric split should alter mid-profile');

  const intSym = integrate01((u) => presetSym.kappa(u));
  const intAsym = integrate01((u) => presetAsym.kappa(u));

  approxEqual(intSym, 0.5, 2e-6, 'symmetric bloss integral mismatch');
  assert.ok(Number.isFinite(intAsym), 'asymmetric bloss integral should be finite');
  assert.ok(Math.abs(intAsym - intSym) > 1e-3, 'asymmetric bloss integral should differ from symmetric integral');
});

test('optimization Jacobian remains finite-difference consistent for transition family', () => {
  const poseA = { p: { x: 0, y: 0 }, theta: 0 };
  const poseE = { p: { x: 170, y: 15 }, theta: 0.18 };

  const problem = buildChangeTransitionTypeProblem({
    poseA,
    poseE,
    initial: { Lg: 90, Lu: 50, Lb: 90 },
    kB: 1 / 400,
    transitionType: 'clothoid',
  });

  const snap = problem.snapshot();
  const h = 1e-5;

  for (let j = 0; j < 3; j++) {
    const vp = [...snap.v];
    const vm = [...snap.v];
    vp[j] += h;
    vm[j] -= h;

    const gp = problem.G(vp);
    const gm = problem.G(vm);

    for (let i = 0; i < 3; i++) {
      const fd = (gp[i] - gm[i]) / (2 * h);
      const jac = snap.JG[i][j];
      const tol = i < 2 ? 3e-2 : 5e-3;
      assert.ok(Math.abs(fd - jac) < tol, `JG mismatch row=${i} col=${j}: fd=${fd}, jac=${jac}`);
    }
  }
});
