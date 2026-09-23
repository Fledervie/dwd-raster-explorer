# LILLI Styling Reference

Styling conventions for `frontend/`. No framework requirements — pure CSS classes, tokens, and rules.

---

## Color Tokens

All colors are DaisyUI CSS custom properties. **Never write a raw hex, named color, or `bg-slate-*` class.** Use opacity modifiers (`bg-primary/10`, `hover:bg-accent/50`) for tints and hover states.

### Dark theme (`lilli-dark`)

```css
--color-base-100: oklch(20% 0.02 250);
--color-base-200: oklch(17% 0.018 250);   /* page, modal box */
--color-base-300: oklch(25% 0.025 250);   /* recessed */
--color-base-content: oklch(95% 0.01 250);

--color-primary:   hsl(215, 55%, 52%);   --color-primary-content:   hsl(0, 0%, 100%);
--color-secondary: hsl(195, 45%, 48%);   --color-secondary-content: hsl(0, 0%, 10%);
--color-accent:    hsl(175, 60%, 45%);   --color-accent-content:    hsl(0, 0%, 10%);
--color-neutral:   oklch(30% 0.015 250); --color-neutral-content:   oklch(95% 0.01 250);

--color-info:    hsl(210, 90%, 55%);   --color-info-content:    hsl(0, 0%, 10%);
--color-success: hsl(145, 60%, 45%);   --color-success-content: hsl(0, 0%, 10%);
--color-warning: hsl(40,  90%, 55%);   --color-warning-content: hsl(0, 0%, 10%);
--color-error:   hsl(0,   80%, 58%);   --color-error-content:   hsl(0, 0%, 10%);
```

### Light theme (`lilli-light`)

Chromatic values drop ~10% lightness vs dark to hold AA contrast on a 96% base.

```css
--color-base-100: oklch(96% 0.004 250);
--color-base-200: oklch(92% 0.007 250);
--color-base-300: oklch(88% 0.010 250);
--color-base-content: oklch(18% 0.02 250);

--color-primary:   hsl(215, 65%, 40%);   --color-primary-content:   hsl(0, 0%, 100%);
--color-secondary: hsl(195, 55%, 38%);   --color-secondary-content: hsl(0, 0%, 100%);
--color-accent:    hsl(175, 65%, 34%);   --color-accent-content:    hsl(0, 0%, 100%);
--color-neutral:   oklch(85% 0.007 250); --color-neutral-content:   oklch(20% 0.02 250);

--color-info:    hsl(210, 90%, 40%);   --color-info-content:    hsl(0, 0%, 100%);
--color-success: hsl(145, 60%, 34%);   --color-success-content: hsl(0, 0%, 100%);
--color-warning: hsl(40,  95%, 42%);   --color-warning-content: hsl(0, 0%, 10%);
--color-error:   hsl(0,   75%, 45%);   --color-error-content:   hsl(0, 0%, 100%);
```

### Token usage

| Role | Token |
|---|---|
| Raised / inner surface | `bg-base-100` |
| Page background, modal box | `bg-base-200` |
| Recessed / input background | `bg-base-300` |
| Primary text | `text-base-content` |
| Muted text | `text-base-content/70` |
| Faint / placeholder | `text-base-content/40` |
| Hairline borders | `border-base-content/10` |
| Tinted chip background | `bg-primary/10` |
| Foreground on filled intent surface | matching `-content` token, never `text-white` |

---

## Radii & Sizing

The markedly rounded corners are the recognisable part of the look. Do not override per-component.

```css
--radius-selector: 2rem;   /* pills, badges */
--radius-field:    1rem;   /* inputs */
--radius-box:      2rem;   /* cards, modals */
--border: 1px;
--depth:  1;
--noise:  1;   /* 0 in light theme */
--size-selector: 0.21875rem;
--size-field:    0.21875rem;
```

---

## Global CSS

All rules below belong in `src/index.css`. If you can put the class on the element yourself, do that instead.

### Scrollbars

```css
::-webkit-scrollbar { width: 12px; }
::-webkit-scrollbar-track { background: var(--color-base-200); }
::-webkit-scrollbar-thumb { background: var(--color-secondary); border-radius: 6px; }
::-webkit-scrollbar-thumb:hover { background: var(--color-primary); }
* { scrollbar-width: thin; scrollbar-color: var(--color-secondary) var(--color-base-200); }
```

### Glass overlays (popovers, context menus, dropdowns)

The `!important` flags override Radix inline/base styles — the one place they are acceptable.

```css
[data-slot="popover-content"],
[data-slot="context-menu-content"] {
    border-radius: 20px !important;
    isolation: isolate !important;
    -webkit-backdrop-filter: blur(6px) saturate(120%) !important;
    backdrop-filter: blur(6px) saturate(120%) !important;
    box-shadow: 0 4px 20px rgba(0,0,0,.15), inset 0 .5px 0 rgba(255,255,255,.15) !important;
    border: .5px solid rgba(255,255,255,.08) !important;
    background: transparent !important;
}

.glassmorphism {
    background: rgba(255,255,255,.1);
    backdrop-filter: blur(12px) saturate(180%);
    -webkit-backdrop-filter: blur(12px) saturate(180%);
    border: 1px solid rgba(255,255,255,.2);
}
```

No `.liquid-glass` SVG distortion filter — legibility of a form record beats novelty.

### Layout shell

```css
.sidebar-aware-spacing {
    @media (min-width: 640px) { margin-left: 5rem; }   /* icon-only sidebar */
    @media (min-width: 768px) { margin-left: 12rem; }  /* full sidebar */
}
body.sidebar-collapsed .sidebar-aware-spacing {
    @media (min-width: 768px) { margin-left: 5rem; }
}
body.sidebar-hidden .sidebar-aware-spacing {
    @media (min-width: 640px) { margin-left: 0; }
}
```

Z-index layers: TopNav `z-50` fixed `h-16`, SideNav `z-40` fixed left full height.  
Main content: `pt-24 p-4 min-h-[calc(100vh-3.5rem)] transition-all duration-300`.  
Route content wrapper: `container mx-auto py-10`.

### Theme switching (blocking inline script in `index.html`)

```html
<script>
  (function () {
    var t = localStorage.getItem('theme') || 'lilli-dark';
    document.documentElement.setAttribute('data-theme', t);
  })();
</script>
```

Every rule must work in both themes. Scope exceptions: `[data-theme="lilli-dark"] .thing { … }`.

---

## Typography

Font: **Inter**, latin subset, self-hosted via `@fontsource/inter`. Do not link Google Fonts (deployment target may be offline).

| Usage | Classes |
|---|---|
| Modal titles | `text-2xl font-bold` |
| Section headings | `text-lg font-semibold` |
| Labels, emphasised numerals | `font-medium` |
| Table, helper text | `text-sm` |

### Icon sizes

| Class | Size | Context |
|---|---|---|
| `h-4 w-4` | 16px | Inline, in-button |
| `h-5 w-5` | 20px | Section headings, close buttons |
| `h-6 w-6` | 24px | Modal header chips |

---

## Forms

Section shell — icon, heading, bordered inner surface:

```
bg-base-100 border border-base-content/10 rounded-box p-4
```

| Element | Classes |
|---|---|
| Field wrapper | `form-control` |
| Label | `label` → inner `label-text font-medium` |
| Required mark | `text-error` on `<span>*</span>` (per-transition, not static) |
| Text input | `input input-bordered w-full` |
| Textarea | `textarea textarea-bordered w-full` (rows={4}) |
| Select | `select select-bordered w-full` |
| Checkbox | `checkbox checkbox-primary` in `label.label.cursor-pointer.justify-start.gap-4` |
| Radio | `radio radio-primary`, same wrapper |
| Validation error | `label-text-alt text-error mt-1` |
| `?` tooltip trigger | `btn btn-ghost btn-xs btn-circle` in `div.tooltip.tooltip-right` |
| Two-column section | `grid grid-cols-2 gap-4` |
| Form / preview split | `grid grid-cols-1 lg:grid-cols-2 gap-6` |
| Vertical rhythm | `space-y-4` inside sections, `mb-5` / `gap-6` between |

---

## Buttons

Disabled state: use the `disabled` attribute — DaisyUI's disabled styling is the greying, do not hand-roll opacity. Loading spinner goes *inside* the button alongside the label; button is also `disabled`.

| Class | Intent |
|---|---|
| `btn btn-primary` | Primary forward transition |
| `btn btn-warning` | Send-back / reject |
| `btn btn-error` | Archive as Noted, destructive |
| `btn btn-ghost` · `btn` | Save progress (no validation), cancel — visually subordinate |
| `btn btn-ghost btn-xs btn-circle` | Icon-only utility (tooltip trigger, close) |

Loading state:
```jsx
<button class="btn btn-primary" disabled>
    <span class="loading loading-spinner loading-sm" />
    Submitting…
</button>
```

---

## Modals

`BaseModal` wraps `<dialog class="modal modal-open">` with:
- `modal-box bg-base-200 shadow-sm {sizeClass} w-full`
- Backdrop: `modal-backdrop bg-base-200/30 backdrop-blur-xs`
- Footer: `modal-action mt-6` — Cancel first, primary action last

### Size map

| Key | Class | Width |
|---|---|---|
| small | `max-w-md` | 448px — confirmations |
| medium | `max-w-2xl` | 672px |
| large | `max-w-5xl` | 1024px — default |
| xlarge | `max-w-6xl` | 1152px — two-column (merge) |
| full | `max-w-7xl` | |

### Header pattern

```
flex items-center justify-between mb-4
  → icon chip: bg-primary/10 p-2 rounded-lg  (icon h-6 w-6 text-primary)
  → title: font-bold text-2xl
  → close: btn btn-ghost btn-circle btn-sm  (aria-label="Close")
```

`ConfirmModal` `variant: 'danger' | 'warning'` → icon `text-error / text-warning`, button `btn-error / btn-primary`.  
Set `closeOnBackdropClick=false` for any modal containing a form.

---

## Tables

| Element / State | Classes |
|---|---|
| Outer wrapper | `relative overflow-x-auto` |
| Table | `table w-full`, `tableLayout: 'fixed'` |
| Row hover | `hover:bg-base-200/50 transition-colors` |
| De-emphasised row | `opacity-50 text-base-content/40` |
| Empty state | single cell `h-24 text-center`, plain sentence |
| Sortable header | `btn btn-ghost` + ArrowUpDown icon |
| Row action trigger | `btn btn-ghost btn-xs` |
| Dropdown wrapper | `dropdown dropdown-end` (+ `dropdown-top` near bottom) |
| Dropdown menu | `dropdown-content menu p-2 shadow-lg bg-base-200 rounded-box w-52 z-[100]` |
| Destructive menu item | `text-error hover:bg-error hover:text-error-content` |
| Footer row | `flex items-center justify-between py-4` |
| Footer counts | `text-sm text-base-content/70`, `font-medium` numerals |
| Refetch overlay | `absolute inset-0 bg-base-100/80 z-50 backdrop-blur-sm flex items-center justify-center` |

Default sort: oldest-first. Use `font-variant-numeric: tabular-nums` for digit columns.

---

## Status Badges

One component, one mapping table — never inlined per view. Status is never colour-alone; the letter is always present. Both validation states render `V`; a tooltip distinguishes them.

| State | Letter | Badge class |
|---|---|---|
| OBSERVE | O | `badge badge-ghost` |
| ANALYSE | A | `badge badge-info` |
| DECIDE | D | `badge badge-info` |
| IMPLEMENT | I | `badge badge-warning` |
| VALIDATE_TA / VALIDATE_OS | V | `badge badge-warning` |
| ARCHIVED_LEARNED | LL | `badge badge-success` |
| ARCHIVED_NOTED | N | `badge badge-neutral` |
| MERGED | M | `badge badge-ghost` |

---

## Ageing States

Escalate on the text, not the row background — avoids fighting the status badge. Thresholds are server-owned (`ageing.warn.days`, `ageing.critical.days`) from `GET /api/settings/public`. The 14/28-day defaults belong in the seed migration, not here.

```ts
const age = (d: number, warn: number, critical: number) =>
    d >= critical ? "text-error font-semibold"
  : d >= warn     ? "text-warning font-medium"
  : "text-base-content/70";
```

---

## Feedback

### Toasts

```jsx
<Toaster expand visibleToasts={9} position="top-right" richColors />
```

`richColors` drives per-intent glass tinting via `[data-sonner-toast][data-type="…"]` global CSS rules (port from spyfox as-is).

- Use for outcomes of user actions ("Submitted to Tasking Authority").
- Do **not** use for validation errors — those belong under the field.
- A 409 concurrent transition is an `error` toast: *"This observation was changed by someone else. Reloading."*

### Loading

| Context | Treatment |
|---|---|
| Route-level | Shared `PageLoading` suspense fallback |
| In-place refetch / polling | Dimming overlay over table — table never unmounts, it dims |
| First paint of card grids | `skeleton` class / `SkeletonCard` |
| Button pending | `loading loading-spinner loading-sm` inside button + `disabled` |

### Empty & error states

```
bg-base-100 rounded-box p-8 text-center text-base-content/70
```

Corrective action as `btn btn-primary` beneath where one exists.

---

## Accessibility

- Every icon-only button gets `aria-label`. DaisyUI `tooltip` is not an accessible name.
- Modals get `aria-labelledby` on the title and an `sr-only` description; close button is reachable; Escape closes via a `keydown` listener bound only while open.
- Required inputs get `aria-invalid` when errored; error message associated via `aria-describedby`.
- Status is never colour-alone — badges carry a letter.
- Light theme chromatic values are intentionally darker (~10% lightness) to hold AA contrast on a 96% base. Check new colours in both themes before committing.
