# Track-Network Topology v0.1

Status: App architecture contract, not Knowledge Kernel approval.

Contract version:

```text
aim-core/track-network-topology/0.1
```

## Scope

This contract defines the smallest browser-independent topology model for
multiple existing Alignment engineering objects. Topology exists only through
explicit stable node, edge, Alignment, incidence, and orientation identities.

Geometric coincidence does not imply topology. Shared coordinates, proximity,
CRS placement, names, stationing, chainage, file rows, GND keys, geometry, and
import order neither create nor imply nodes, edges, or incidence.

## Normative envelope

```js
{
  contractVersion: "aim-core/track-network-topology/0.1",
  type: "TrackNetworkTopology",
  id: "non-empty string",
  nodes: [
    {
      id: "non-empty string"
    }
  ],
  edges: [
    {
      id: "non-empty string",
      alignmentId: "non-empty string",
      fromNodeId: "non-empty string",
      toNodeId: "non-empty string",
      orientation: "forward" | "reverse"
    }
  ]
}
```

Unknown JSON-compatible members are accepted and preserved by successful
operations. They do not participate in identity, incidence, or orientation.

Node IDs are unique. Edge IDs are unique. An Alignment ID occurs on at most one
edge. Every endpoint references an existing node. A self-loop is permitted only
when explicitly declared.

Node and edge array order is serialization order only. It creates no additional
topology.

## Identity, incidence, and orientation

- Node identity is intrinsic to topology and stable across immutable updates.
- Edge identity is intrinsic to topology and stable across immutable updates.
- `alignmentId` references an existing Alignment engineering object; Alignment
  geometry is not copied into topology.
- `fromNodeId` and `toNodeId` explicitly constitute edge incidence.
- `orientation: "forward"` means traversal from `fromNodeId` to `toNodeId`
  follows the Alignment's intrinsic longitudinal orientation.
- `orientation: "reverse"` means that traversal opposes it.

Only `connectAlignmentEdge` creates incidence. The operation accepts explicit
identities and never accepts coordinates or infers endpoints.

## Domain API

```js
TRACK_NETWORK_TOPOLOGY_VERSION
isTrackNetworkTopology(value)
assertTrackNetworkTopology(value, context = "TrackNetworkTopology")
createTrackNetworkTopology({ id })
addTopologyNode(topology, { nodeId })
connectAlignmentEdge(topology, {
  edgeId,
  alignmentId,
  fromNodeId,
  toNodeId,
  orientation = "forward"
})
removeAlignmentEdge(topology, { edgeId })
removeTopologyNode(topology, { nodeId })
getIncidentAlignmentEdges(topology, { nodeId })
getTraversableAlignmentEdges(topology, {
  nodeId,
  direction = "outgoing"
})
```

`isTrackNetworkTopology` validates the normative envelope, uniqueness, and
endpoint references without inspecting geometry-like extension members.

`assertTrackNetworkTopology` returns the identical reference on success and
otherwise throws a `TypeError` beginning:

```text
<context>: invalid TrackNetworkTopology
```

`createTrackNetworkTopology` creates a valid empty topology. Node and edge
addition and removal are immutable. Removing a node with incident edges is
rejected and never cascades.

`getIncidentAlignmentEdges` returns a new array in serialization order.
`getTraversableAlignmentEdges` supports `incoming`, `outgoing`, and `both` and
returns only explicit edge, Alignment, endpoint, and orientation identities. It
does not load geometry or derive route continuation.

## Immutability

Every successful mutator returns frozen top-level, node-array, edge-array,
node-record, and edge-record values. Unknown nested extension values need not be
deep-frozen. Inputs are never mutated. Unchanged frozen records and members
retain their references where possible.

Every rejected operation leaves its input byte-equivalent and
reference-identical.

## Structured errors

`TrackNetworkTopologyError` carries exactly one of:

```text
INVALID_TOPOLOGY
INVALID_ID
NODE_ALREADY_EXISTS
NODE_NOT_FOUND
NODE_HAS_INCIDENT_EDGES
EDGE_ALREADY_EXISTS
EDGE_NOT_FOUND
ALIGNMENT_ALREADY_CONNECTED
INVALID_ORIENTATION
INVALID_DIRECTION
```

## Dependency boundary

`TrackNetworkTopology.js` has zero imports.

It has no dependency on App/UI, SPOT, Shared Worker, Messaging, storage, GND,
MDB, XLSX, LandXML, import, geometry, projection, coordinates, tolerances, CRS,
horizontal realization, vertical, cant, chainage, speed, AXTRAN, or
transitionDB.

No productive module imports this topology model in Package 4.

## Deferred scope

Deferred and non-normative here:

- UI or network editing;
- SPOT relation mapping and repositories;
- persistence and serialization technology;
- import/export and GND interpretation;
- endpoint inference, snapping, proximity, or tolerances;
- route finding or continuation;
- vertical profile, cant, chainage, speed, and CRS;
- AXTRAN and transitionDB behavior.

No placeholder for those responsibilities is created.

## Evidence mapping

| Evidence | Role |
|---|---|
| `e06712f1c377b8acbc6fca4582ebfccc260a7c60` | Explicit Alignment identity and repository seam |
| `b227b27e0461d74b9e8e2ba6f3b4d49a18afe5d9` | Productive explicit-ID arc authoring |
| `ed377e85adfafaf3e6a7f906e430237cb8feca31` | Constructive horizontal Alignment state |
| Existing GND relations and parser knowledge | Comparison evidence only; outside AIM Core |

This document is an App architecture contract. It records implementation scope
and dependency direction but does not itself approve or redefine Knowledge
Kernel content.
