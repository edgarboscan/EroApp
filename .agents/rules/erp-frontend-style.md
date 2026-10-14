---
trigger: always_on
---

# ERP Frontend Architecture & Style Rules

## Tech Stack Constraints (Non-Negotiable)

- **Framework**: React 19+, function components + Hooks, class components forbidden
- **Styling**: Tailwind CSS v4 (utility-first), custom CSS files forbidden
- **Build**: Vite
- **State Management**: Zustand (lightweight) or React Query (server state)
- **Routing**: React Router v7 (data router mode)
- **Language**: TypeScript strict mode

## Visual Design Rules

### Minimalism Principles
- Remove all unnecessary borders, shadows, gradients, and decorative elements
- Use a neutral gray scale + a single brand accent color
- Use Tailwind spacing scale consistently: `gap-2` / `gap-4` / `gap-6`
- Unified radius: `rounded-lg` (cards/buttons), never mix radii
- No icons larger than `w-5 h-5` in navigation or buttons
- No emojis in UI text or code comments

### Responsive Requirements (Mandatory)
- Mobile-first authoring
- Desktop ERP layout: `flex` sidebar + `flex-1` main content area
- Mobile: sidebar collapses into an overlay drawer
- Data tables must support horizontal scroll: `overflow-x-auto`
- All touch targets must be at least `py-3` on mobile
- Test every component at 375px, 768px, and 1440px widths

### ERP Component Conventions
- **Data tables**: Semantic `<table>` or TanStack Table, sticky header
- **Forms**: label stacked above input, error state via `border-red-500` + helper text
- **Empty states**: Every list/table must have an explicit empty state component
- **Loading states**: Use skeletons, not spinners, to reduce layout shift
- **Error states**: Inline errors, never `alert()` or `console.log` for user feedback
- **Pagination**: Server-side preferred, cursor-based when possible
- **Filters**: URL-synced (searchParams) so state is shareable and bookmarkable

## Performance Rules
- Route-level code splitting: each page component via `React.lazy`
- Large lists (100+ rows) must be virtualized (TanStack Virtual)
- Avoid creating new objects/functions in render (unless justified)
- Images use `loading="lazy"`
- Debounce search inputs (300ms minimum)
- Memoize expensive computations with `useMemo`
- Never block the main thread with synchronous heavy work

## Code Quality
- TypeScript strict mode
- Component props must be explicitly typed
- `any` forbidden (unless documented with a comment explaining why)
- Prefer named exports over default exports
- One component per file
- File naming: PascalCase for components, camelCase for hooks/utilities
- Hooks follow the `use*` prefix convention
- All async functions must handle errors explicitly

## Accessibility
- All interactive elements must have `focus-visible:ring-2`
- All images must have `alt` text (empty `alt=""` for decorative)
- Form inputs must have associated `<label>` elements
- Color contrast must meet WCAG AA (4.5:1 for text)
- Keyboard navigation must work for all interactive components
- No `onClick` on non-interactive elements without `role` and keyboard handlers

## Forbidden Patterns
- ❌ Class components
- ❌ Inline styles (`style={{...}}`) except for dynamic values Tailwind can't express
- ❌ Custom CSS files or CSS modules
- ❌ Component libraries (MUI, Ant Design, Chakra, Mantine)
- ❌ CSS-in-JS (styled-components, emotion)
- ❌ `alert()`, `confirm()`, `prompt()`
- ❌ `console.log` in committed code
- ❌ Hardcoded colors outside the design token system
- ❌ Mixing different border radius values in the same view