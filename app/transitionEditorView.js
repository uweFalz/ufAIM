// transitionEditorView.js
// Normierter Transition-Editor: u∈[0,1], κ(u)∈[0,1]
// Stückweise: halfWave1 auf [0,w1], linear (clothoid in k-space) auf [w1,w2], halfWave2 auf [w2,1]

function clamp01(x){ return Math.max(0, Math.min(1, x)); }

// halfWave1: f(0)=0,f(1)=1,f'(0)=0,f'(1)=1
function halfIn(t){ return -t*t*t + 2*t*t; }
function halfIn1(t){ return -3*t*t + 4*t; }
function halfIn2(t){ return -6*t + 4; }

// halfWave2: g(0)=0,g(1)=1,g'(0)=1,g'(1)=0
function halfOut(t){ return -t*t*t + t*t + t; }
function halfOut1(t){ return -3*t*t + 2*t + 1; }
function halfOut2(t){ return -6*t + 2; }

export function makeTransitionEditorView(store){
	let board = null;
	let curve = null;
	let vline1 = null, vline2 = null;
	let hline0 = null, hline1 = null;
	let cursor = null;

	function kappa(u, w1, w2){
		u = clamp01(u);
		w1 = clamp01(w1);
		w2 = clamp01(w2);
		if(w2 < w1){ const tmp=w1; w1=w2; w2=tmp; }

		// special: if middle collapsed (bloss-like), we still define piecewise with join at w1==w2
		if(u <= w1){
			if(w1 <= 1e-9) return 0;
			const t = u / w1;
			return w1 * halfIn(t);
		}
		if(u >= w2){
			if((1 - w2) <= 1e-9) return 1;
			const t = (u - w2) / (1 - w2);
			return w2 + (1 - w2) * halfOut(t);
		}
		// middle linear: κ(u)=u  (clothoid in curvature space)
		return u;
	}

	// Derivatives (for later toggles); kept here for Berlin-dogma diagnostics
	function kappa1(u, w1, w2){
		u = clamp01(u);
		w1 = clamp01(w1);
		w2 = clamp01(w2);
		if(w2 < w1){ const tmp=w1; w1=w2; w2=tmp; }

		if(u <= w1){
			if(w1 <= 1e-9) return 1;
			const t = u / w1;
			return halfIn1(t); // chain cancels as: d/du [w1*halfIn(u/w1)] = halfIn'(t)
		}
		if(u >= w2){
			if((1 - w2) <= 1e-9) return 1;
			const t = (u - w2) / (1 - w2);
			return halfOut1(t);
		}
		return 1;
	}

	function kappa2(u, w1, w2){
		u = clamp01(u);
		w1 = clamp01(w1);
		w2 = clamp01(w2);
		if(w2 < w1){ const tmp=w1; w1=w2; w2=tmp; }

		if(u <= w1){
			if(w1 <= 1e-9) return 0;
			const t = u / w1;
			return halfIn2(t) / w1; // chain rule: second derivative brings 1/w1
		}
		if(u >= w2){
			if((1 - w2) <= 1e-9) return 0;
			const t = (u - w2) / (1 - w2);
			return halfOut2(t) / (1 - w2);
		}
		return 0;
	}

	async function init(){
		const JXG = await new Promise((resolve)=>{
			const tick=()=> (window.JXG ? resolve(window.JXG) : requestAnimationFrame(tick));
			tick();
		});

		board = JXG.JSXGraph.initBoard("transBoard", {
			boundingbox: [-0.05, 1.05, 1.05, -0.05],
			axis: true,
			showNavigation: false,
			showCopyright: false
		});

		// Main κ(u) curve
		curve = board.create("curve", [
		(t)=>{
			const st = store.getState();
			return t;
		},
		(t)=>{
			const st = store.getState();
			return kappa(t, st.te_w1, st.te_w2);
		},
		0, 1
		], { strokeWidth: 3 });

		// Domain split lines
		vline1 = board.create("line", [
		()=>[store.getState().te_w1, 0],
		()=>[store.getState().te_w1, 1]
		], { straightFirst:false, straightLast:false, dash:2 });

		vline2 = board.create("line", [
		()=>[store.getState().te_w2, 0],
		()=>[store.getState().te_w2, 1]
		], { straightFirst:false, straightLast:false, dash:2 });

		// Image lines (0 and 1 as frame; later: add image splits)
		hline0 = board.create("line", [[0,0],[1,0]], { straightFirst:false, straightLast:false, dash:1 });
		hline1 = board.create("line", [[0,1],[1,1]], { straightFirst:false, straightLast:false, dash:1 });

		// Cursor point at (u, κ(u))
		cursor = board.create("point", [
		()=>store.getState().u,
		()=>{
			const st = store.getState();
			return kappa(st.u, st.te_w1, st.te_w2);
		}
		], { name:"", size:4, fixed:true });

		store.subscribe(()=> board.update(), { immediate:true });
	}

	return {
		init,
		// export functions for later diagnostics toggles
		kappa, kappa1, kappa2
	};
}
