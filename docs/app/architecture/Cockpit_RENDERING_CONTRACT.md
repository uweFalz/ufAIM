# Cockpit Rendering Contract

## STATUS

Cockpit rendering is fenced but not yet technologically changed.

`renderCockpitHtml(...)` remains the temporary string layout renderer.

No Node renderer, framework, ShadowDOM, virtual DOM, SPOT change or UX redesign is introduced.

---

## CURRENT RENDERING FLOW

```text
CockpitController
  -> buildUiState()
  -> renderCockpitRoot(rootEl, uiState)
  -> renderCockpitHtml(uiState)
  -> rootEl.innerHTML = html
```

---

## DOM OWNERSHIP

### CockpitController owns

- orchestration
- refresh timing
- event delegation setup
- uiState construction

### renderCockpitRoot owns

- the Cockpit DOM write boundary
- the only allowed `root.innerHTML = ...` for Cockpit

### renderCockpitHtml owns

- Cockpit markup generation
- layout structure
- CSS class placement
- data attributes required for event delegation

---

## TEXT RESPONSIBILITY

### Recommendation

```text
Controller provides raw UI state.
Renderer derives display text.
```

### Reason

- Controller should not become a formatting layer.
- Renderer owns presentation.
- Later replacement by Node renderer remains possible.
- uiState stays closer to application state.

### Allowed in uiState

```text
ids
labels from domain objects
status codes
booleans
counts
modes
CRS information
```

### Avoid in uiState

```text
localized messages
HTML fragments
button captions
markup
formatted display strings
```

---

## I18N RESPONSIBILITY

### Recommendation

Short term:

```text
renderCockpitHtml may resolve i18n.
```

Long term:

```text
renderCockpitHtml(uiState, textApi)
```

Example:

```text
renderCockpitHtml(uiState, cockpitText)
```

where `cockpitText` owns:

```text
button labels
empty-state messages
status messages
warnings
UI wording
```

### Important

Domain code must not become responsible for localization.

The following layers should remain language-neutral:

```text
SPOT
Import
Projection
Alignment
CRS model
Messaging
```

They may provide:

```text
codes
ids
flags
diagnostics
```

but not localized user-facing text.

---

## EVENT WIRING BOUNDARY

### CockpitController owns

```text
event listeners
delegation
action dispatch
```

### renderCockpitHtml may emit

```html
data-cockpit-action
data-object-id
data-cockpit-preview
data-cockpit-accept
data-cockpit-activate
```

### renderCockpitHtml must not

```text
attach listeners
own controller logic
perform actions
```

### renderCockpitRoot must not

```text
attach listeners
dispatch actions
```

---

## RECOMMENDED CONTRACT

```text
CockpitController
    ->
    build uiState
    ->
    renderCockpitRoot(rootEl, uiState)

renderCockpitRoot
    ->
    write DOM root
    ->
    renderCockpitHtml(uiState)

renderCockpitHtml
    ->
    generate layout
    ->
    resolve presentation text
    ->
    emit stable data-* hooks
```

---

## RISKS

### Existing violations

Some controller code still contains presentation text:

```text
"Keine aktive Szene"
"Vorschau geleert"
"Ziehe Daten in die Szene ..."
```

These belong closer to rendering/text ownership.

### Future risk

`renderCockpitHtml` may become too smart if:

```text
business logic
selection logic
state mutation
workflow decisions
```

move into the renderer.

Renderer must remain presentation-only.

---

## DONE CRITERIA

- App boots unchanged.
- Cockpit output remains unchanged.
- CockpitController contains no direct `innerHTML` write.
- renderCockpitRoot is the only Cockpit DOM write boundary.
- renderCockpitHtml remains replaceable later.
- Event wiring stays in CockpitController.
- Layout ownership is explicit.
- Text ownership is documented.
- No framework lock-in introduced.
