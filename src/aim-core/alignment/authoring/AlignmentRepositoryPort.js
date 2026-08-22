export const ALIGNMENT_REPOSITORY_PORT_VERSION =
	"aim-core/alignment-repository-port/0.1";

export function assertAlignmentRepositoryPort(repository) {
	if (
		repository == null ||
		typeof repository !== "object" ||
		typeof repository.loadById !== "function" ||
		typeof repository.saveById !== "function"
	) {
		throw new TypeError(
			"AlignmentRepositoryPort requires loadById() and saveById()"
		);
	}

	return repository;
}
