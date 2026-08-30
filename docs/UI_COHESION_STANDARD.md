# Sensum Dashboard UI Cohesion Standard

Status: Required project standard  
Owner: Sensum OSRS Dashboard  
Introduced: V2.78  

## Product structure

- Overview is the command center and may combine account context with immediate actions.
- Every other primary tab has one visually distinct page banner followed by a light content workspace.
- Page banners contain an eyebrow, a short title, one explanatory sentence, and only page-level controls.
- Content-specific controls belong beside the content they change, not in the global banner.

## Visual hierarchy

1. Page banner: identifies the workspace.
2. Workspace navigation: switches between peer views, such as the Money sub-tabs.
3. Section card: groups one task or one set of related information.
4. Detail row: presents values, actions, or supporting explanation.

Cards must not visually merge into the page banner. Nested cards should use lighter borders and less shadow than their parent.

## Language

- Use direct nouns for destinations: `Skills`, `Quests`, `Bosses`, `Money`, `Data & Sync`.
- Use verbs for actions: `Refresh prices`, `Plan tonight`, `Confirm completion`, `Make active`.
- Use `Ready` only when every mandatory condition is met.
- Use `Projected` for calculated future values and `Realized` for recorded completed transactions.
- Explain estimates and unavailable data without implying certainty.

## Controls and feedback

- Primary actions use the dark brown/gold treatment; destructive actions use red only.
- Every saved or remotely loaded change must show a busy state and a success or error result.
- Expandable sections use the same chevron behavior and preserve a minimum clickable header height.
- Empty states explain what is missing and, when possible, name the action that fills the section.
- Modals must have a visible close control, Escape support, focus trapping, and restored focus on close.

## Responsive and accessibility rules

- Preserve readable order when grids collapse to one column.
- Never depend on color alone for status; include a label or icon.
- Keep keyboard focus visible.
- Do not hide data in Compact layout; only reduce spacing.
- Respect Reduce motion for nonessential animation and smooth scrolling.

## Definition of done for future UI work

- Reuses an existing page, card, modal, button, pill, loading, or empty-state pattern.
- Introduces a new pattern only when no existing pattern fits, then adds it to this standard.
- Works at desktop and narrow mobile widths.
- Preserves the current tab and relevant local workspace state after refresh.
- Passes `dashboard-check.js` and JavaScript syntax validation.
- Is visually checked in the deployed Apps Script web app.
