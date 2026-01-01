// app/model/projectModel.js
// Minimal persistent project container (v0)

export function createProjectModel(initialData) {
	let data = structuredClone(initialData);

	return {
		get() {
			return data;
		},
		set(nextData) {
			data = structuredClone(nextData);
		}
	};
}
