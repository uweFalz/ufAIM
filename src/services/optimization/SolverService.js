// src/services/optimization/SolverService.js

export function createSolverService({ router, debug } = {}) {
	return {
		async ping({ message } = {}) {
			debug?.log?.("SolverService.ping", { message });

			return {
				ok: true,
				service: "SolverService",
				message: message ?? null,
				ts: Date.now(),
			};
		},

		async runDummy({ payload } = {}) {
			debug?.log?.("SolverService.runDummy", { payload });

			router?.emitEvt?.("Solver.Progress", {
				phase: "dummy",
				progress01: 0.5,
				message: "dummy solver progress",
				payload: payload ?? null,
				ts: Date.now(),
			});

			return {
				ok: true,
				status: "dummy_done",
				result: {
					iterations: 0,
				},
				ts: Date.now(),
			};
		},
	};
}
