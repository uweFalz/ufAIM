// app/model/routeProjectChecks.js

export function getRouteProjectCompleteness(rp) {
	const right = rp?.slots?.right ?? {};
	const left  = rp?.slots?.left ?? {};
	const km    = rp?.slots?.km ?? {};

	return {
		hasRightAlignment: !!right.alignmentArtifactId,
		hasRightProfile: !!right.profileArtifactId,
		hasLeftAlignment: !!left.alignmentArtifactId,
		hasLeftProfile: !!left.profileArtifactId,
		hasKmLine: !!km.alignmentArtifactId,
	};
}
