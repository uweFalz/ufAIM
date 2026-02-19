// evalAst.js
const TAU = 2 * Math.PI;

function evalPoly(coeff, u) {
	let acc = 0;
	for (let i = coeff.length - 1; i >= 0; i--) acc = acc * u + coeff[i];
	return acc;
}

function applyAffine(u, affine) {
	return affine.alpha * u + affine.beta;
}

export function makeEvalFn(ast) {
	function ev(node, u) {
		switch (node.type) {
			case "const": return node.value;
			case "var": return u;

			case "add": return ev(node.a, u) + ev(node.b, u);
			case "mul": return ev(node.a, u) * ev(node.b, u);

			case "poly": return evalPoly(node.coeff, u);

			case "sin0": return Math.sin(TAU * u);
			case "cos0": return Math.cos(TAU * u);

			case "sin":  return Math.sin(ev(node.arg, u));
			case "cos":  return Math.cos(ev(node.arg, u));

			case "compose": {
				const uu = applyAffine(u, node.affine);
				return ev(node.expr, uu);
			}

			default:
			throw new Error(`evalAst: unsupported node "${node.type}"`);
		}
	}

	return (u) => ev(ast, Number(u));
}
