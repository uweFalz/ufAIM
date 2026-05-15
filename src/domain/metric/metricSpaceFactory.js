// src/domain/metric/metricSpaceFactory.js
//
// Creates metric operator backends.
//
// Default must remain Euclidean to avoid breaking current engineering CRS behavior.

import { EuclideanMetricSpace } from "./EuclideanMetricSpace.js";

export function createMetricSpace(config = {}) {
	const type = config?.type ?? "euclidean";

	switch (type) {
		case "euclidean":
		case "engineeringCRS":
		case "engCRS":
			return new EuclideanMetricSpace(config);

		default:
			console.warn(
				`createMetricSpace: unknown metric type "${type}", falling back to EuclideanMetricSpace`
			);
			return new EuclideanMetricSpace({
				id: "metric:euclidean:fallback",
				label: "Euclidean Engineering Metric fallback",
			});
	}
}

export function createDefaultMetricSpace() {
	return new EuclideanMetricSpace();
}
