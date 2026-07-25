# Domain-to-representation matrix

Legend: `P` primary, `C` contextual, `X` comparative, `D` diagnostic, `E`
expert-only. “Home” means mainView home framing, not a separate data owner.

| Subject | Primary user question | Initial / secondary representations | Essential interactions | Misinterpretation danger | Progressive detail | Home |
|---|---|---|---|---|---|---|
| Alignment / network | What exists and where does it lead? | plan or local plane `P`; network graph `C`; sequence `D` | find, select, focus, open | rendered line mistaken for identity | sequence, relations, provenance | mainView; Objects for locating |
| Straight/arc/transition | What constructive part is this? | curvature band + plan `P`; sequence/table `D` | select, inspect, edit | sampled geometry treated as construction | exact law, parameters, neighbors | mainView + Cockpit; editor |
| Intrinsic order / position | Where am I along the subject? | station cursor and sequence `P`; table `D` | scrub, range-select, focus | external station label confused with intrinsic `s` | address mappings and equations | shared focus state |
| Curvature / derivatives | Is the horizontal evolution viable? | curvature band `P`; plan `C`; technical plot `D/E` | scrub, constrain, compare, edit | visually smooth mistaken for admissible | exact κ, κ′, κ″, continuity | CurvatureBand / TransEd |
| Vertical geometry | What happens in profile? | longitudinal profile `P`; plan `C`; table `D` | focus, edit, compare | vertical exaggeration hidden | scale, gradients, constraints | profile tool |
| Cant / speed laws | What operational consequence follows? | synchronized bands `P`; profile/plan `C`; table `D` | inspect, compare, calculate | laws shown as identity | assumptions, applicability | analysis tool |
| Local placement | Can I work without geography? | local engineering plane `P`; axes/grid `C` | frame, attach context | “unreferenced” read as incomplete | frame, units, precision | mainView |
| CRS/geographic placement | Where is this realized geographically? | geographic map `P`; context badge `C`; transform report `D` | attach context, compare | CRS treated as identity or complete realization | operator, epoch, accuracy | mainView + evidence |
| Metric/physical realization | Which measurable state is shown? | labelled realization overlay `P`; comparison `X`; report `D` | switch, compare, trace | target/realized/observed collapsed | context and limitations | mainView + tool |
| Source evidence | What did the source actually contain? | evidence tree `P`; preview overlay `C`; raw table `D` | reveal, inspect, transfer | preview mistaken for admitted object | raw bytes/rows/messages | Import Workbench |
| Unresolved/rejected evidence | What was preserved but not interpreted? | evidence queue/tree `P`; notice `C`; raw detail `D` | classify, retain, trace | “rejected” read as deleted/false | reason, actor, timestamp | Workbench; Cockpit notice |
| Target/actual observations | Where and how do they differ? | spatial comparison `P`; residual band `X`; table `D` | compare, focus, trace | observation treated as truth without uncertainty | method, covariance, provenance | comparison tool |
| Transition functions / DB | Which law is suitable? | function plot/catalogue `P`; formula/table `E` | find, compare, transfer | catalogue record treated as applied element | domain, derivatives, source | TransEd |
| AXTRAN problem/candidates | Which candidate satisfies what? | candidate comparison `P`; residual plot `X`; table `D` | calculate, rank, preview, apply/reject | solver success treated as decision | constraints, residuals, assumptions | candidate review |
| SPOT identity/state | Is this a durable admitted object? | object card/list `P`; relation graph `D` | find, open, trace | store key/view model treated as identity | provenance and relations | Objects + Cockpit |
| Derived object/dependency | What depends on the Alignment? | plan/profile representation `P`; dependency graph `C/D`; delta `X` | derive, place, compare, update | generated geometry treated as independent | governing relation, stale cause | mainView + derived tool |
| Applicability/provenance/authority | Can this result be used, why, and by whom? | state token `P`; concise notice `C`; timeline/evidence `D` | inspect, trace, apply/record | one green check collapsing distinct states | scope, actor, decision evidence | Cockpit + evidence |

## Representation roles

- **Primary:** mainView plane/map for spatial questions; CurvatureBand/profile/
  comparison/evidence view when the active task is intrinsically analytic.
- **Contextual:** Cockpit brief, miniature locator, dependency cue, station
  cursor, layer legend.
- **Comparative:** alternatives, before/after, target/observed, candidate/base.
- **Diagnostic:** residuals, continuity, transform report, state timeline,
  evidence/dependency graph.
- **Expert-only by default:** technical tables, raw source, formulas, full
  derivative and solver diagnostics.

No representation is permanently visible solely because data exists.

