// symDiff.js
const TAU = 2 * Math.PI;

function c(v) { return { type: "const", value: v }; }
function add(a,b){ return { type:"add", a, b }; }
function mul(a,b){ return { type:"mul", a, b }; }

export function diffExpr(ast) {
	switch (ast.type) {
		case "const": return c(0);
		case "var": return c(1);

		case "add": return add(diffExpr(ast.a), diffExpr(ast.b));
		case "mul":
		// (ab)' = a'b + ab'
		return add(mul(diffExpr(ast.a), ast.b), mul(ast.a, diffExpr(ast.b)));

		case "poly": {
			const cc = ast.coeff || [0];
			if (cc.length <= 1) return c(0);
			const d = [];
			for (let i = 1; i < cc.length; i++) d.push(i * cc[i]);
			return { type: "poly", coeff: d };
		}

		case "sin0": return mul(c(TAU), { type:"cos0" });
		case "cos0": return mul(c(-TAU), { type:"sin0" });

		case "sin": return mul(diffExpr(ast.arg), { type:"cos", arg: ast.arg });
		case "cos": return mul(diffExpr(ast.arg), mul(c(-1), { type:"sin", arg: ast.arg }));

		case "compose": {
			// d/du f(a u + b) = a * f'(a u + b)
			const a = Number(ast.affine.alpha);
			return mul(c(a), { type:"compose", expr: diffExpr(ast.expr), affine: ast.affine });
		}

		default:
		throw new Error(`symDiff: unsupported "${ast.type}"`);
	}
}
