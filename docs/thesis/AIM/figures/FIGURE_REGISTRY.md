# AIM Figure Registry

This registry tracks the canonical figure inventory of the AIM thesis.

Status values:

- `draft`: available and used
- `todo`: planned but not yet integrated
- `active`: canonical and currently used
- `archive`: kept for reference only

## Canonical Figures

| ID | Title | File | Type | Status | Used in |
|---|---|---|---|---|---|
| FIG-001 | AIM Overview | overview/aim_overview.tex | F1 Overview | draft | executive_summary |
| FIG-002 | State Trajectory Design | overview/state_trajectory_design.tex | F1 Overview | draft | core_thesis |
| FIG-003 | State Hierarchy | foundations/state_hierarchy.tex | F2 Architecture | draft | state/state_taxonomy |
| FIG-004 | System Layers | foundations/system_layers.tex | F2 Architecture | todo | foundations/system_layers |
| FIG-005 | Curvature to pose2 | geometry/curvature_to_pose2.tex | F3 Mathematical | todo | geometry/curvature_space |
| FIG-006 | pose2 to pose3 | geometry/pose2_to_pose3.tex | F3 Mathematical | todo | state/pose3_and_cant |
| FIG-007 | Runtime Pipeline | runtime/runtime_pipeline.tex | F4 Process | draft | runtime/runtime_services |
| FIG-008 | Realization Pipeline | runtime/realization_pipeline.tex | F4 Process | draft | runtime/runtime_services / reality/construction_and_realization |
| FIG-009 | Vehicle Space | runtime/vehicle_space.tex | F2 Architecture | archive | replaced by FIG-013 |
| FIG-010 | Schwerpunkt Concept | runtime/schwerpunkt_concept.tex | F1 Overview | draft | dynamics/schwerpunkt_state |
| FIG-011 | Runtime Optimization | optimization/state_space_optimization.tex | F4 Process | todo | dynamics/optimization_in_state_space |
| FIG-012 | AXTRAN to AIM | optimization/axtran_to_aim.tex | F1 Overview | todo | dynamics/optimization_in_state_space |
| FIG-013 | Track-Vehicle Relation | dynamics/track_vehicle_relation.tex | F2 Architecture | active | dynamics/vehicle_space |
| FIG-014 | Runtime Dynamics | dynamics/runtime_dynamics.tex | F4 Process | active | dynamics/runtime_dynamics |
| FIG-015 | Realization-Aware Dynamics | dynamics/realization_aware_dynamics.tex | F4 Process | active | dynamics/realization_aware_dynamics |
| FIG-016 | Dynamic Balance Relation | dynamics/dynamic_balance_relation.tex | F3 Mathematical | active | dynamics/dynamic_balance |

## Phase D Imported Figures

Canonical TikZ import folder:

```text
figures/phase_d/

## Graphics Pass 2

| ID | Title | File | Type | Status | Suggested use |
|---|---|---|---|---|---|
| FIG-017 | World-to-Track Transformation | reality/world_to_track_transformation.tex | F4 Process | active | state/world_to_track |
| FIG-018 | Target vs Realized Geometry | reality/target_vs_realized_geometry.tex | F4 Process | active | reality/construction_and_realization |
| FIG-019 | Cant Interpretation | state/cant_interpretation.tex | F3 Mathematical | active | state/pose3_and_cant |
| FIG-020 | Schwerpunkt Trajectory | dynamics/schwerpunkt_trajectory.tex | F1 Overview | active | dynamics/schwerpunkt_state / modeling/schwerpunkt_trassierung |
| FIG-021 | Sparse Model Structure | modeling/sparse_model_structure.tex | F2 Architecture | active | modeling/sparse |
