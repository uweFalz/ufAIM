# ufAIM Mission Report Policy

## Purpose

Every Codex mission must end with one self-contained, structured mission report.

The report is the authoritative handover between Uwe, Rock, Grey, and the
specialized `app`, `thesis`, `research`, and `trace` missions. Chat UI summaries,
diff widgets, elapsed-time notices, and tool output are not mission reports.

## Mission Roles

- `app`: changes the Reference Implementation and delivers working code.
- `thesis`: changes the AIM Thesis and delivers buildable thesis text.
- `research`: investigates questions and delivers evidence, counterexamples,
  and candidates; it does not approve Kernel content.
- `trace`: performs read-only inventory, conformance, provenance, and impact
  analysis; it does not edit repository content unless a separate editing
  mission explicitly authorizes it.
- `Rock`: maintains the cross-mission view, resolves scheduling and scope
  conflicts, and prepares decisions for Uwe.
- `Grey`: provides independent review or arbitration when requested.
- `Uwe Falz`: provides project direction and the human decisions required by
  Kernel Governance.

## Required Report

Use exactly these top-level headings, in this order:

```text
# MISSION REPORT

## 1. Mission
## 2. Status
## 3. Baseline and Scope
## 4. Work Performed
## 5. Changed Files
## 6. Evidence and Validation
## 7. Kernel and Architecture Impact
## 8. Conflicts, Risks, and Open Decisions
## 9. Handover
```

### 1. Mission

State:

- mission name,
- responsible stream: `app`, `thesis`, `research`, or `trace`,
- requested objective,
- package identifier when one exists.

### 2. Status

Use exactly one status:

- `complete`: the authorized objective is finished and validated; no required
  work or decision remains.
- `partial`: useful work is complete, but authorized work remains.
- `blocked`: work cannot continue safely because of a concrete blocker.
- `decision-required`: technical work reached a decision boundary owned by Uwe
  or Kernel Governance.
- `review-required`: the work is ready but requires an explicitly requested
  independent review before acceptance.

Do not report `complete` when approval, validation, required work, or a blocking
decision is still outstanding. Content completion and Governance approval are
separate states and must be reported separately.

### 3. Baseline and Scope

Report:

- repository root,
- branch and baseline commit,
- relevant pre-existing working-tree changes,
- authorized directories or files,
- explicit exclusions.

If the working tree changed during the mission because another mission was
running in parallel, say so and identify the overlap check performed.

### 4. Work Performed

Describe concrete results, not intentions or a chronological tool log.

For `research`, include the question, tests performed, counterexamples, result,
and confidence. Clearly distinguish findings from candidates.

For `trace`, include inventory scope, discovered correspondences, uncertainties,
and whether each statement is observed or inferred.

### 5. Changed Files

List every file changed by the mission, grouped as:

- added,
- modified,
- moved or renamed,
- deleted.

Use `None` when the mission made no changes. Never attribute pre-existing or
parallel changes to the mission. A UI message such as `Edited 5 files` is not a
sufficient file report.

### 6. Evidence and Validation

For every validation, state:

- what was checked,
- the command or method,
- result: `passed`, `failed`, or `not run`,
- limitations.

Do not say `validation successful` without naming the checks. Research and
read-only trace missions must also report that no files were changed.

### 7. Kernel and Architecture Impact

Use these exact fields:

```text
Kernel impact: none | conforming | candidate | conflict | unknown
Architecture impact: none | conforming | candidate | conflict | unknown
RefImpl impact: none | changed | follow-up-required | unknown
Thesis impact: none | changed | follow-up-required | unknown
```

Explain every value other than `none`. No mission may silently redefine Kernel
meaning. Research findings and implementation behavior are evidence, not
approval.

### 8. Conflicts, Risks, and Open Decisions

Report:

- contradictions found,
- identifier or terminology collisions,
- conflicts with parallel missions,
- unresolved risks,
- decisions required from Uwe, each with a stable local identifier and explicit
  options when practical.

Use `None` when no item exists. Do not bury decision requests inside narrative
text.

### 9. Handover

State:

- the next safe step,
- its prerequisites,
- the files or areas it may touch,
- whether another stream can proceed independently,
- the exact done criterion for the next package.

Recommendations do not authorize a new mission.

## Stream-Specific Completion Rules

### app

`complete` requires working code plus validation proportional to the change.
The report must name the implemented behavior and the tests or runtime checks.

### thesis

`complete` requires updated source and a successful relevant build, unless the
mission explicitly authorized text-only work without a build. Kernel concepts
must be explained, not redefined.

### research

`complete` means the research question was investigated to its declared done
criterion. It does not mean the result is approved or canonical. The report must
state one outcome: `eliminated`, `survives`, `survives with reformulation`, or
`inconclusive`.

### trace

`complete` requires a read-only evidence-backed assessment of the declared
scope. Trace must not mix historical baselines with current state without dates
and commit identifiers.

## Parallel-Work Rules

- One mission owns a file at a time unless shared editing was explicitly agreed.
- Before editing, record the baseline and inspect existing changes.
- Preserve changes belonging to other missions.
- If overlap is discovered, stop editing the overlapping file and report the
  conflict to Rock.
- Reports must distinguish observed repository state from changes produced by
  the reporting mission.
- No structural move, merge, or cleanup may run in parallel with semantic Kernel
  work unless Rock explicitly coordinates it.

## Prohibited Report Content

Do not include:

- ChatGPT or Codex UI chrome,
- `Worked for ...` messages,
- `Review changes`, `Undo`, or editor action labels,
- raw diff summaries without interpretation,
- pasted output from a different mission,
- unsupported claims of approval,
- hidden follow-up work behind a `complete` status.

## Acceptance Rule

A mission without a conforming report is not accepted as handed over, even when
its file changes appear useful. Rock may return the mission for report repair
without rejecting the underlying work.
