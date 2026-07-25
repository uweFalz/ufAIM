export function installSelectionDiagnostics(contract, { target = globalThis } = {}) {
	if (!contract?.diagnostics) throw new TypeError("Selection diagnostics require a semantic selection contract");
	const inspection = Object.freeze({
		read: () => contract.diagnostics(),
	});
	Object.defineProperty(target, "__uiSemanticSelectionDiagnostics", {
		configurable: true,
		enumerable: false,
		value: inspection,
	});
	return () => {
		if (target.__uiSemanticSelectionDiagnostics === inspection) {
			delete target.__uiSemanticSelectionDiagnostics;
		}
	};
}
