const id = value => String(value ?? "").trim();
export function buildCantAuthoringDockModel({ projection=null, activeObjectId=null, requestedObjectId=null, requestedElementId=null }={}) {
	const objectId=id(activeObjectId), requestedObject=id(requestedObjectId), elementId=id(requestedElementId);
	if(!objectId||(requestedObject&&requestedObject!==objectId)||id(projection?.alignmentId)!==objectId) return Object.freeze({status:"unavailable",objectId:objectId||null,elementId:elementId||null,canCreateInitial:false,canAppendLinear:false,canEditConstant:false,canEditLinear:false,reason:"exact canonical Cant context unavailable"});
	const elements=projection?.selectableElements?.cant??[]; const exact=elementId?elements.filter(e=>id(e?.elementId??e?.id)===elementId):[];
	if(elementId&&exact.length!==1) return Object.freeze({status:"target-missing",objectId,elementId,canCreateInitial:false,canAppendLinear:false,canEditConstant:false,canEditLinear:false,reason:"exact Cant element unavailable"});
	const selected=exact[0]??null, terminal=projection?.terminalCantElement??null; const terminalExact=Boolean(selected&&terminal&&id(terminal.id)===elementId);
	const constant=terminalExact&&selected.type==="constant-cross-level"&&terminal.type==="constant-cross-level";
	const linear=terminalExact&&selected.type==="linear-cross-level"&&terminal.type==="linear-cross-level";
	return Object.freeze({status:selected?"selected":"active",objectId,elementId:selected?elementId:null,
		elements:Object.freeze(elements.map(e=>Object.freeze({elementId:id(e.elementId??e.id),type:e.type??"unknown",startS:e.startS??null,endS:e.endS??null,provenancePresent:Boolean(e.provenance??e.sourceRefs??e.evidenceId)}))),
		canCreateInitial:elements.length===0,canAppendLinear:elements.length>0&&!elementId,canEditConstant:constant,canEditLinear:linear,
		edit:constant?Object.freeze({crossLevel:terminal.startCrossLevel,endS:terminal.endS}):linear?Object.freeze({crossLevelRate:terminal.crossLevelRate,endS:terminal.endS}):null,
		reason:selected&&!terminalExact?"only the exact terminal Cant element is editable":null,
		contract:Object.freeze({quantity:"cross-level",unit:"alignment-length-unit",signConvention:"left-minus-right-viewed-in-increasing-s"})});
}
export default buildCantAuthoringDockModel;
