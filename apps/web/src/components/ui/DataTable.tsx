import React, { useState, useMemo } from 'react';
import { Button } from './Button';
import { Download, Search, ChevronLeft, ChevronRight } from 'lucide-react';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  searchKey?: keyof T;
  onExportCSV?: () => void;
  isLoading?: boolean;
  emptyMessage?: string;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  searchPlaceholder = 'Buscar...',
  searchKey,
  onExportCSV,
  isLoading = false,
  emptyMessage = 'No se encontraron registros para mostrar',
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const filteredData = useMemo(() => {
    if (!search) return data;
    return data.filter((item) => {
      if (searchKey) {
        return String(item[searchKey]).toLowerCase().includes(search.toLowerCase());
      }
      return Object.values(item).some((val) =>
        String(val).toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [data, search, searchKey]);

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de herramientas */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={searchPlaceholder}
            className="w-full h-10 pl-9 pr-3 text-sm bg-white border border-neutral-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          />
        </div>

        {onExportCSV && (
          <Button variant="outline" size="sm" onClick={onExportCSV}>
            <Download className="w-4 h-4 mr-1.5" />
            Exportar CSV
          </Button>
        )}
      </div>

      {/* Tabla con scroll horizontal */}
      <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                {columns.map((col, idx) => (
                  <th
                    key={idx}
                    className={`py-3 px-4 text-xs font-semibold text-neutral-600 tracking-wider uppercase ${col.className || ''}`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-neutral-100">
                    {columns.map((col, idx) => (
                      <td key={idx} className={`py-3 px-4 ${col.className || ''}`}>
                        <div className="h-4 bg-neutral-200/70 rounded animate-pulse w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="py-12 text-center text-neutral-500">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-neutral-50/80 transition-colors">
                    {columns.map((col, colIdx) => (
                      <td key={colIdx} className={`py-3 px-4 text-neutral-800 ${col.className || ''}`}>
                        {col.cell ? col.cell(row) : col.accessorKey ? String(row[col.accessorKey] ?? '') : ''}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200 bg-neutral-50/50 text-xs text-neutral-600">
          <span>
            Mostrando {filteredData.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} a{' '}
            {Math.min(currentPage * pageSize, filteredData.length)} de {filteredData.length} registros
          </span>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-medium">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
