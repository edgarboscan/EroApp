import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { DataTable, Column } from '../../components/ui/DataTable';
import { toast } from 'sonner';
import { formatNumber } from '../../utils/formatters';

interface LocationRow {
  aisle: string;
  shelf: string;
  compartment: string;
  warehouseName: string;
  sku: string;
  productName: string;
  currentStock: number;
}

export const PhysicalLocationsView: React.FC = () => {
  const [locations] = useState<LocationRow[]>([
    {
      aisle: 'Pasillo A1',
      shelf: 'Estante 03',
      compartment: 'Nivel 1 (Piso)',
      warehouseName: 'Almacén Central Mayorista',
      sku: 'HAR-PAN-01',
      productName: 'Harina PAN Blanca 1Kg',
      currentStock: 350,
    },
    {
      aisle: 'Pasillo A1',
      shelf: 'Estante 04',
      compartment: 'Nivel 2',
      warehouseName: 'Almacén Central Mayorista',
      sku: 'LEC-POL-01',
      productName: 'Leche en Polvo Completa 1Kg',
      currentStock: 120,
    },
    {
      aisle: 'Pasillo C2',
      shelf: 'Estante 01',
      compartment: 'Gaveta 05-B',
      warehouseName: 'Almacén Central Mayorista',
      sku: 'DES-SET-06',
      productName: 'Juego Destornilladores 6 Piezas',
      currentStock: 45,
    },
  ]);

  const columns: Column<LocationRow>[] = [
    {
      header: 'Pasillo',
      accessorKey: 'aisle',
      cell: (row) => <span className="font-bold text-neutral-800">{row.aisle}</span>,
    },
    {
      header: 'Estante',
      accessorKey: 'shelf',
      cell: (row) => <span className="font-medium text-neutral-700">{row.shelf}</span>,
    },
    {
      header: 'Compartimiento',
      accessorKey: 'compartment',
      cell: (row) => <span className="font-medium text-neutral-700">{row.compartment}</span>,
    },
    {
      header: 'Depósito',
      accessorKey: 'warehouseName',
      cell: (row) => <span className="text-xs text-neutral-600">{row.warehouseName}</span>,
    },
    {
      header: 'Producto Asignado',
      cell: (row) => (
        <div>
          <div className="font-semibold text-neutral-900">{row.productName}</div>
          <div className="text-xs font-mono text-neutral-400">{row.sku}</div>
        </div>
      ),
    },
    {
      header: 'Stock Actual',
      accessorKey: 'currentStock',
      cell: (row) => <span className="font-bold text-neutral-900">{formatNumber(row.currentStock, { maximumFractionDigits: 2})} UND</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Mapa de Ubicaciones Físicas</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Localización por Pasillo / Estante / Compartimiento por depósito
          </p>
        </div>
      </div>

      <Card>
        <DataTable
          data={locations}
          columns={columns}
          searchPlaceholder="Buscar por pasillo, estante o producto..."
          searchKey="productName"
          onExportCSV={() => toast.info('Exportando mapa de ubicaciones físicas en formato CSV...')}
        />
      </Card>
    </div>
  );
};
