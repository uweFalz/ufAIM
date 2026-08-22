/**
 * Deliberate public AIM Core Root API.
 *
 * Area barrels own their implementations. Root API changes require an
 * architect-owned update to public-api-manifest.js and its freeze gate.
 */
export * from "./alignment/profile/index.js";
export * from "./alignment/topology/index.js";
export * from "./alignment/authoring/index.js";
export * from "./alignment/aggregate/index.js";
export * from "./transition/index.js";
export * from "./geometry/index.js";
