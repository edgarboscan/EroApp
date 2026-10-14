
### 📄 Contenido

```markdown
# Design Tokens (Tailwind Mapping)

Complete semantic-to-Tailwind mapping for the ERP UI Kit. Use these classes consistently across all components. Do not introduce colors, radii, or spacing values outside this table.

## Colors

| Semantic | Tailwind Class | Usage |
|----------|---------------|-------|
| Surface | `bg-white` | Cards, table backgrounds, sidebar |
| Surface muted | `bg-gray-50` | Page background, hover rows, zebra stripes |
| Surface active | `bg-gray-100` | Active nav link, pressed states |
| Border default | `border-gray-200` | Dividers, card borders, input borders |
| Border subtle | `border-gray-100` | Table row separators |
| Text primary | `text-gray-900` | Headings, key values, table cells |
| Text secondary | `text-gray-700` | Labels, descriptive text |
| Text muted | `text-gray-500` | Table headers, hints |
| Text disabled | `text-gray-400` | Placeholder, disabled text |
| Accent (primary) | `bg-blue-600` / `text-blue-600` | Primary buttons, links, focus rings |
| Accent hover | `bg-blue-700` | Primary button hover |
| Accent ring | `ring-blue-500` | Focus visible state |
| Danger | `bg-red-600` / `text-red-600` | Destructive buttons, error text |
| Danger border | `border-red-500` | Invalid input borders |
| Success | `text-green-600` | Positive status text |
| Warning | `text-amber-600` | Warning status text |

## Spacing

| Semantic | Tailwind Class | Usage |
|----------|---------------|-------|
| Tight | `gap-1` / `p-1` | Icon-to-label spacing |
| Base | `gap-2` / `p-2` | Inline elements, table cell padding |
| Comfortable | `gap-4` / `p-4` | Card padding, form field spacing |
| Section | `gap-6` / `p-6` | Page section padding, main content |

## Radius

| Semantic | Tailwind Class | Usage |
|----------|---------------|-------|
| Small | `rounded` | Badges, tags, small pills |
| Default | `rounded-lg` | Buttons, inputs, cards, modals |
| Full | `rounded-full` | Avatars, circular icon buttons |

Rule: never mix `rounded`, `rounded-md`, `rounded-lg` in the same view. Pick `rounded-lg` as default and use `rounded-full` only for circular elements.

## Typography

| Semantic | Tailwind Class | Usage |
|----------|---------------|-------|
| Page title | `text-2xl font-semibold text-gray-900` | Top-level page heading |
| Section title | `text-lg font-medium text-gray-900` | Card headings, section headers |
| Body | `text-sm text-gray-900` | Table cells, general text |
| Label | `text-sm font-medium text-gray-700` | Form labels, table headers |
| Helper | `text-xs text-gray-500` | Hints, descriptions |
| Error | `text-xs text-red-500` | Validation messages |
| Metric | `text-2xl font-semibold text-gray-900` | Dashboard KPI values |

## Borders

| Semantic | Tailwind Class | Usage |
|----------|---------------|-------|
| Default | `border border-gray-200` | Cards, inputs, dividers |
| Subtle | `border-b border-gray-100` | Table rows |
| None | `border-0` | Elements without borders |

## Shadows

The ERP design language is **flat**. Shadows are used only for floating overlays.

| Semantic | Tailwind Class | Usage |
|----------|---------------|-------|
| Overlay | `shadow-sm` | Modals, dropdowns, popovers |
| None | (default) | Everything else |

Rule: never use `shadow-md`, `shadow-lg`, or `shadow-xl`.

## Focus States

Every interactive element must include:

`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`

For danger buttons, use `focus-visible:ring-red-500`.

## Breakpoints

| Breakpoint | Width | Usage |
|-----------|-------|-------|
| (default) | 0px+ | Mobile-first base styles |
| `sm:` | 640px+ | Minor mobile adjustments |
| `md:` | 768px+ | Enable desktop sidebar |
| `lg:` | 1024px+ | Full desktop layout |

## Forbidden Values

Never use these classes anywhere in the ERP frontend:

- Any `shadow-md` or larger
- Any gradient (`bg-gradient-*`)
- Any custom color outside this table (e.g., `bg-purple-500`, `bg-pink-300`)
- Any radius other than `rounded`, `rounded-lg`, `rounded-full`
- Arbitrary values like `bg-[#123456]` or `p-[13px]`