# RESEARCH-BERLINISH-AXTRAN-001 — Implementation Gap Matrix

This matrix accompanies the full reconstruction. “Original” means surviving historical/intended evidence, not an assertion that a complete axtranNew executable survives.

| Capability | Original evidence | Current DB | Current evaluator | TransEd | AXTRAN | Thesis | Disposition |
|---|---|---|---|---|---|---|---|
| Five-level function grammar | Heritage derivative/function analysis | Five named levels | Resolves levels 2–5 | Browsable | Consumes transition descriptors | Explained partially | preserved |
| Reusable constants | Named mathematical coefficients implied | 5 records | Not resolved/validated | Read-only display | None | Formulae inline | preserved but inaccessible |
| Elementary polynomial/trig functions | Heritage tables/formulae | 20 records | AST refs execute | Read-only display | Indirect | Explained | preserved |
| Parameterized prototypes | General `(a+s)^m s^n(b-s)^m` concept | 28 enumerated expressions | Embedded constants only | Read-only | Indirect | Discussed | reduced |
| Derivative-source functions | κ, κ′, κ″ analyses | halfwave `source` supports κ/κ1/κ2/κInt | Symbolic integrate/differentiate | Plots κ/κ′/κ″ | κ consumed | Discussed | preserved |
| Halfwave identity and role | Heritage start condition and transform | 28 records, role implicit | Entry + fixed reverse exit | Browsable | Indirect | Explained broadly | reduced |
| `Hin + C + Hout` | Explicit Berlin-Dogma | two halfwaves + 3 partition; core implicit | Fixed clothoCore | Three partition controls | Indirect | Current narrative | preserved but inaccessible |
| Different entry/exit sources | Explicitly permitted | Mieloko/Okoleim/test | Supported | View/compare | Supported through preset | Mentioned | preserved |
| Zero outer component | Clothoid special case | `[0,1,0]` | Supported | Editable | Supported | Mentioned | preserved |
| Zero core | Helmert/Bloss/cosine special cases | `[.5,0,.5]` etc. | Supported | Editable | Supported | Mentioned | preserved |
| Zero physical transition length | Historical exceptional case | Not a grammar record | Endpoint curvature/zero derivative behavior | Not clearly modeled | Sparse zero-length types exist | Partial | reduced |
| Explicit component list/core choice | General grammar | Fixed three fields, implicit core | No arbitrary list | No | No | Conceptual | missing |
| `w1,w2` cuts/length variables | Reconstructed composition role | Derived from partition | Accepted overrides | Editable | Alignment option, not generally solved | Figure/narrative | reduced |
| Boundary-condition metadata | Historical smoothness discussion | Absent | Normalization implicit | Not editable | End pose in one problem | Mathematical narrative | missing |
| Join continuity solve/diagnostics | “smooth joins” intent | Absent | Heuristic anchors; C1 helper disconnected | No residuals | No general solve | Conceptual | contradictory |
| Clothoid/Helmert/Ruch/Gubar | Heritage formulae | Named records | Executable | View/compare | Consumable | Explained | preserved |
| Bloss/Watorek/Mieloszyk | Heritage formulae | Named/source-order records | Executable | View/compare | Consumable | Explained | preserved |
| Vienna2–7 | Heritage formulae/examples | Named records; V6/part-V6 duplicate | Executable | View/compare | Consumable | Discussed | preserved / duplicated |
| Sine/cosine | Heritage formulae | `sine`, `cose` variants | Executable | View/compare | Consumable | Discussed | renamed |
| Klauder family generator | Heritage `pol_m_n` | Five `pol_2_n` instances | Executable instances | View/compare | Consumable | Discussed | reduced |
| Regular3/4 transitions | Function hierarchy evidence | Halfwaves exist, no transition records | Buildable only through custom descriptor | No named preset | No named preset | Sparse | preserved but inaccessible |
| Physical κ scaling and κ′/κ″ | Classical formula/current lineage | No units | Full in TransitionElement | Normalized plots only | Used | Explained | preserved |
| Independent cant law | Heritage dynamic/Vienna discussion | Absent | Absent | Absent | Absent | Intended/future | missing |
| Optional κ/cant coupling | Heritage balance/Vienna relations | Absent | Legacy experiment only | Absent | Absent | Intended/future | missing |
| Durable grammar editing | Computational grammar intent | Static JSON | Read-only definitions | Only runtime transition partitions | None | N/A | missing |
| Family comparison | Historical comparison motivation | Catalogue | Samples | Two-preset compare | Objective library absent | Narrative | reduced |
| General boundary-condition calculation | axtranNew intent | No problem schema | Geometry primitives | No | One line–transition–arc problem | Intended | reduced |
| Free/fixed/derived/constrained variables | axtranNew intent | No metadata | Three hard-coded length variables in one problem | No | Bounded SQP path | Intended | missing |
| Transition/family selection optimization | axtranNew intent | IDs available | Resolver available | Manual select | Type fixed per problem | Intended | missing |
| Editable calculated candidate | axtranNew intent | N/A | Sparse recalculation | Working copies | Partial editor path | Intended | reduced |
| Provenance and authority | Research/Kernel boundary | Absent | Absent | Generic DB label | Candidate boundary documented | Explained | missing |

## Disposition summary

The curvature catalogue and evaluator are stronger than a minimal preset list: they preserve derivative-defined families, mixed Vienna expressions, asymmetric halfwaves, and zero-length component reductions. The principal restoration work is semantic—typed parameters, explicit components and conditions, continuity diagnostics, provenance, independent cant laws, and a general calculation problem/candidate contract—rather than replacement of the working curvature evaluator.

