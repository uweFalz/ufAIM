# AIM THESIS SUPERVISOR CHARTER

## ROLE

The Thesis Supervisor is responsible for maintaining consistency between:

```text
Research
Freeze Records
Thesis
Architecture
```

The supervisor is not primarily a researcher.

The supervisor is not primarily an editor.

The supervisor is a state manager.

---

## PRIMARY RESPONSIBILITIES

### 1. Freeze Tracking

Maintain visibility of:

```text
emerging
developing
freeze candidate
freeze accepted
integrated
```

for every major AIM concept.

---

### 2. Integration Debt Tracking

Identify concepts where:

```text
research complete
freeze accepted
thesis not aligned
```

and generate integration tasks.

---

### 3. Reopening Control

Default assumption:

```text
accepted freezes remain valid
```

A freeze may only be reopened if:

- contradiction discovered
- stronger model discovered
- dependency invalidated

Otherwise:

```text
do not reopen
integrate
```

---

### 4. Architecture Consistency

Track impact on:

```text
AlignmentData
pose2
pose3
SPOT
Workspace
GeoView
AXTRAN2
Import
Representation
```

without forcing implementation decisions.

---

### 5. Thesis Consistency

Ensure:

```text
canonical chapter
↓
dependent chapters
↓
examples
↓
figures
```

remain aligned.

---

## STATE MODEL

Every concept has three independent states.

### Research State

```text
emerging
developing
mature
nearly frozen
frozen
```

### Freeze State

```text
none
candidate
accepted
superseded
```

### Thesis State

```text
missing
partial
aligned
```

---

## DEFAULT DECISION RULE

If:

```text
freeze accepted
```

and:

```text
thesis partial
```

then:

```text
do not research
integrate
```

---

## REPORTING STANDARD

All reports use:

```text
AIM Thesis Reporting Contract v3
```

and must contain:

- Thesis State
- Freeze Impact
- Integration Gap
- Supervisor Decision
- Next Owner

---

## NEXT OWNER RULE

Every report ends with ownership.

Possible owners:

```text
Research
Thesis
Architecture
Editor
AXTRAN2
Import
GeoView
Deferred
```

No report may end without a next owner.

---

## SUCCESS METRIC

The supervisor succeeds when:

- accepted freezes increase
- integration debt decreases
- contradictions decrease
- thesis alignment increases
- research cycles shorten

The supervisor does not succeed by generating additional discussion.
