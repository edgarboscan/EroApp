import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { FileText, Download } from 'lucide-react';
import { toast } from 'sonner';

export const ReportsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sales_book' | 'inventory_hierarchy' | 'cxc_aging'>('sales_book');

  // Datos mock del Libro de Ventas SENIAT
  const salesBookRows = [
    {
      num: 1,
      date: '2026-09-25',
      rif: 'V-18222333',
      name: 'Juan Carlos Mendoza',
      invoiceNumber: 'FAC-00084920',
      controlNumber: '00-001294',
      total: 12.07,
      exempt: 2.80,
      taxable: 9.20,
      rate: 16,
      iva: 1.47,
      igtf: 0.36,
      retained: 0.00,
    },
    {
      num: 2,
      date: '2026-09-25',
      rif: 'J-31999888-0',
      name: 'INVERSIONES LA CASCADA C.A.',
      invoiceNumber: 'FAC-00084921',
      controlNumber: '00-001295',
      total: 345.00,
      exempt: 0.00,
      taxable: 297.41,
      rate: 16,
      iva: 47.59,
      igtf: 0.00,
      retained: 35.69,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Reportes & Libros Fiscales SENIAT</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Generación y exportación de Libros de Ventas/Compras, Retenciones e Inventario
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.info('Exportando reporte a formato Excel (XLSX)...')}>
            <Download className="w-4 h-4 mr-1.5" />
            Exportar Excel
          </Button>
          <Button size="sm" onClick={() => toast.info('Generando documento PDF oficial...')}>
            <FileText className="w-4 h-4 mr-1.5" />
            Descargar PDF
          </Button>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex border-b border-neutral-200 gap-6 text-sm">
        {[
          { id: 'sales_book', label: 'Libro de Ventas Fiscal (SENIAT)' },
          { id: 'inventory_hierarchy', label: 'Inventario por Jerarquía' },
          { id: 'cxc_aging', label: 'Antigüedad de Saldos CxC' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 font-semibold text-xs transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenido del Reporte: Libro de Ventas */}
      {activeTab === 'sales_book' && (
        <Card title="Libro de Ventas Fiscal - Período Septiembre 2026" subtitle="Contribuyente Especial - Formato exigido por el SENIAT">
          <div className="overflow-x-auto mt-2 border border-neutral-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 border-b border-neutral-200 uppercase text-neutral-500 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3">RIF / Cédula</th>
                  <th className="py-2.5 px-3">Razón Social</th>
                  <th className="py-2.5 px-3">N° Factura</th>
                  <th className="py-2.5 px-3">N° Control</th>
                  <th className="py-2.5 px-3 text-right">Total ($)</th>
                  <th className="py-2.5 px-3 text-right">Exento</th>
                  <th className="py-2.5 px-3 text-right">Base Imponible</th>
                  <th className="py-2.5 px-3 text-right">IVA (16%)</th>
                  <th className="py-2.5 px-3 text-right">IGTF (3%)</th>
                  <th className="py-2.5 px-3 text-right">IVA Retenido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {salesBookRows.map((r) => (
                  <tr key={r.num} className="hover:bg-neutral-50/50">
                    <td className="py-2.5 px-3 font-mono">{r.num}</td>
                    <td className="py-2.5 px-3">{r.date}</td>
                    <td className="py-2.5 px-3 font-mono font-medium text-neutral-700">{r.rif}</td>
                    <td className="py-2.5 px-3 font-semibold text-neutral-900">{r.name}</td>
                    <td className="py-2.5 px-3 font-mono">{r.invoiceNumber}</td>
                    <td className="py-2.5 px-3 font-mono text-neutral-500">{r.controlNumber}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-neutral-900">${r.total.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right text-neutral-600">${r.exempt.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right text-neutral-600">${r.taxable.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-medium text-neutral-800">${r.iva.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right text-indigo-600 font-medium">${r.igtf.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-600 font-medium">${r.retained.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'inventory_hierarchy' && (
        <Card title="Reporte de Inventario Agrupado por Jerarquía">
          <p className="text-xs text-neutral-500">
            Visualización consolidada de existencias y valorización agrupada por Departamento → Grupo → Subgrupo.
          </p>
        </Card>
      )}

      {activeTab === 'cxc_aging' && (
        <Card title="Reporte de Antigüedad de Cuentas por Cobrar (Aging)">
          <p className="text-xs text-neutral-500">
            Listado detallado de clientes con saldos vencidos clasificados por tramos de 30 días.
          </p>
        </Card>
      )}
    </div>
  );
};
