// src/import/domain/normalizeLandFATToSparse.js

function dist(a,b) {

	const dx = b.x - a.x;
	const dy = b.y - a.y;

	return Math.sqrt(dx*dx + dy*dy);

}

function direction(a,b) {

	const dx = b.x - a.x;
	const dy = b.y - a.y;

	const len = Math.sqrt(dx*dx + dy*dy);

	return {
		dx: dx/len,
		dy: dy/len
	};

}

//
// ...
//
export function normalizeLandFATToSparse(data) {

	const sparse = {
		type: "alignment2D",
		name: fatAlignment.name,
		elements: []
	};

	let pose = null;

	for (const seg of fatAlignment.coordGeom) {

		if (seg.type === "Line") {

			const len = dist(seg.start, seg.end);

			const dir = direction(seg.start, seg.end);

			if (!pose) {
				pose = { x: seg.start.x, y: seg.start.y, dir };
			}

			sparse.elements.push({
				type: "fix",
				poseA: pose,
				arcLength: len,
				curvature: 0
			});

			pose = {
				x: seg.end.x,
				y: seg.end.y,
				dir
			};

		}

		else if (seg.type === "Curve") {

			const len = dist(seg.start, seg.end); // placeholder

			const dir = direction(seg.start, seg.end);

			const k = 1 / seg.radius;

			if (!pose) {
				pose = { x: seg.start.x, y: seg.start.y, dir };
			}

			sparse.elements.push({
				type: "fix",
				poseA: pose,
				arcLength: len,
				curvature: k
			});

			pose = {
				x: seg.end.x,
				y: seg.end.y,
				dir
			};

		}

		else if (seg.type === "Spiral") {

			const len = seg.length;

			const dir = direction(seg.start, seg.end);

			if (!pose) {
				pose = { x: seg.start.x, y: seg.start.y, dir };
			}

			sparse.elements.push({
				type: "transition",
				poseA: pose,
				arcLength: len,
				transType: "clothoid"
			});

			pose = {
				x: seg.end.x,
				y: seg.end.y,
				dir
			};

		}

	}

	return enforceAlternation(sparse);
}

function enforceAlternation(sparse) {

	const out = [];

	let expectFix = true;

	for (const el of sparse.elements) {

		if (expectFix && el.type !== "fix") {

			out.push({
				type: "fix",
				poseA: el.poseA,
				arcLength: 0,
				curvature: 0
			});

		}

		if (!expectFix && el.type !== "transition") {

			out.push({
				type: "transition",
				poseA: el.poseA,
				arcLength: 0,
				transType: "clothoid"
			});

		}

		out.push(el);

		expectFix = el.type !== "fix";

	}

	sparse.elements = out;

	return sparse;

}

