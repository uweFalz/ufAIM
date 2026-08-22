export const ALIGNMENT_PROFILE_STATE_READER_PORT_VERSION =
	"aim-core/alignment-profile-state-reader-port/0.1";

export function assertAlignmentProfileStateReaderPort(reader) {
	const operations = [
		"loadVerticalByAlignmentId",
		"loadCantByAlignmentId",
		"loadChainageMappingsByAlignmentId",
	];
	if (
		!reader ||
		typeof reader !== "object" ||
		operations.some((operation) => typeof reader[operation] !== "function")
	) {
		throw new TypeError(
			"AlignmentProfileStateReaderPort requires loadVerticalByAlignmentId, loadCantByAlignmentId, and loadChainageMappingsByAlignmentId"
		);
	}
	return reader;
}
