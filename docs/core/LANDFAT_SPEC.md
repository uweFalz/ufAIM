# landFAT Specification

landFAT is the intermediate alignment representation used by ufAIM.

It acts as a rich import container between external data formats and the internal sparse alignment kernel.


---

## Purpose

landFAT exists to:

- unify alignment data from different formats
- preserve rich metadata from source formats
- support inspection and preview
- provide a stable bridge to the sparse alignment kernel


---

## Design principles

landFAT follows these principles:

- compatible with LandXML alignment concepts
- extended for transition curves
- JSON-native structure
- tolerant of incomplete data
- suitable for inspection and debugging


---

## Typical pipeline

TRA / GRA / LandXML / IFC / other
↓
landFAT
↓
sparse alignment

External formats are parsed into landFAT first.

The sparse alignment model is then derived from landFAT.


---

## Core structure

A typical landFAT container contains:

```json
{
  "type": "landFAT",
  "meta": {
    "sourceFormat": "LandXML",
    "sourceFile": "example.xml"
  },
  "alignments": [
    {
      "name": "Alignment1",
      "elements": [...]
    }
  ]
}

The container may also include additional data such as terrain or reference objects.

⸻

Alignment elements

Alignment elements typically correspond to railway design primitives:
	•	straight segments
	•	circular arcs
	•	transition curves
	•	stationing definitions

Exact element structures may vary depending on the input format.

⸻

Transition curves

landFAT explicitly supports transition curves.

Examples include:
	•	clothoids
	•	polynomial transition curves
	•	custom transition definitions

Transition definitions may include lookup tables or parametric descriptions.

⸻

Relationship to sparse alignment

The sparse alignment kernel is derived from landFAT.

During this step:
	•	redundant metadata is removed
	•	transition definitions are normalised
	•	geometric continuity is verified

The sparse model contains only the information required for computation.

⸻

Non-alignment data

landFAT may also contain other infrastructure-related information:
	•	terrain models
	•	reference geometries
	•	coordinate system hints
	•	BIM references

Such data may be used by other subsystems but does not belong to the sparse kernel.

⸻

Status

landFAT is an internal working format and may evolve as ufAIM develops.

Backward compatibility is desirable but not guaranteed during early development stages.

