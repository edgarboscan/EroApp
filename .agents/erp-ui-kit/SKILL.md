---
name: erp-ui-kit
description: Generates minimalist, responsive React components for ERP applications using Tailwind CSS. Use when building data tables, forms, dashboards, sidebars, or any ERP UI element. Triggers on requests involving admin panels, inventory screens, product management, order lists, or any data-heavy CRUD interface.
---

# ERP UI Kit

## Goal

Provide reusable, production-ready React component patterns for a minimalist ERP frontend. All components must be responsive, accessible, and use Tailwind CSS utility classes exclusively.

## When to Use This Skill

Activate this Skill when the user requests any of the following:

- Data tables or lists (products, orders, customers, inventory)
- Forms with validation (create/edit entities)
- Dashboard cards or KPI widgets
- Sidebar navigation or app shell layout
- Any CRUD interface in an ERP context

## Core Component Patterns

### 1. Data Table (Core ERP Component)

Requirements:
- Sticky header: `sticky top-0 bg-white z-10`
- Responsive wrapper: `overflow-x-auto`
- Zebra optional: `even:bg-gray-50`
- Compact row height: `py-2 px-3` (desktop), `py-3` (mobile touch target)
- Empty state row when data is empty
- Loading skeleton rows instead of a spinner

```tsx
interface DataTableProps<T> {
  columns: { key: keyof T; label: string }[];
  data: T[];
  onRowClick?: (row: T) => void;
  isLoading?: boolean;
}

export function DataTable<T extends { id: string | number }>({
  columns,
  data,
  onRowClick,
  isLoading,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white border-b border-gray-200">
            <tr>
              {columns.map((col) => (
                <th key={String(col.key)} className="text-left py-2 px-3 font-medium text-gray-500">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-gray-100">
                {columns.map((col) => (
                  <td key={String(col.key)} className="py-2 px-3">
                    <div className="h-4 bg-gray-100 rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-gray-500">No data available</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white border-b border-gray-200">
          <tr>
            {columns.map((col) => (
              <th key={String(col.key)} className="text-left py-2 px-3 font-medium text-gray-500">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={row.id}
              onClick={() => onRowClick?.(row)}
              className={`border-b border-gray-100 even:bg-gray-50 ${
                onRowClick ? "cursor-pointer hover:bg-gray-100" : ""
              }`}
            >
              {columns.map((col) => (
                <td key={String(col.key)} className="py-2 px-3 text-gray-900">
                  {String(row[col.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}