export {
	HALFWAVE_QUANTITIES,
	USER_LIBRARY_KIND,
	USER_LIBRARY_LEVELS,
	createTransitionLibraryService,
} from "./createTransitionLibraryService.js";
export {
	DEFAULT_COUPLING_ASSUMPTION,
	DEFAULT_END_SLOPE_TOLERANCE,
	DEFAULT_REQUIRED_SMOOTHNESS_ORDER,
	SMOOTHNESS_ORDER_MAX,
	assessCouplingSuitability,
	cantFromCurvature,
	couplingEpsilon,
	curvatureFromCant,
} from "./cantCurvatureCoupling.js";
export { FUNCTION_SERIES, PLOT_SERIES, couplingPlotSvg, formatRange, functionPlotSvg, plotParameterAt, plotSeries, transitionPlotSvg } from "./transitionPlot.js";
export { KLAUDER_EXPONENT_MAX, KLAUDER_INTERVAL, KLAUDER_SOURCE, klauderName, klauderPrototype, klauderRecords, klauderTerms } from "./klauderFamily.js";
