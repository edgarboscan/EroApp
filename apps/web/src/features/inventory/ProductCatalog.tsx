import React, { useState } from 'react';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Plus, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoneyUSD, formatNumber } from '../../utils/formatters';

interface ProductItem {
  id: string;
  sku: string;
  name: string;
  departmentName: string;
  groupName: string;
  subgroupName?: string;
  costPrice: number;
  basePrice: number;
  taxRate: number;
  finalPrice: number;
  currentStock: number;
  aisle?: string;
  shelf?: string;
  compartment?: string;
}

export const ProductCatalog: React.FC = () => {
  const [products] = useState<ProductItem[]>([
    {
      id: 'p1',
      sku: 'HAR-PAN-01',
      name: 'Harina PAN Blanca 1Kg',
      departmentName: 'Alimentos',
      groupName: 'Granos y Cereales',
      subgroupName: 'Harinas',
      costPrice: 1.00,
      basePrice: 1.40,
      taxRate: 0,
      finalPrice: 1.40,
      currentStock: 350,
      aisle: 'Pasillo A1',
      shelf: 'Estante 03',
      compartment: 'Nivel 1',
    },
    {
      id: 'p2',
      sku: 'LEC-POL-01',
      name: 'Leche en Polvo Completa 1Kg',
      departmentName: 'Alimentos',
      groupName: 'Lácteos',
      subgroupName: 'Leche en Polvo',
      costPrice: 6.50,
      basePrice: 9.20,
      taxRate: 16,
      finalPrice: 10.67,
      currentStock: 120,
      aisle: 'Pasillo A1',
      shelf: 'Estante 04',
      compartment: 'Nivel 2',
    },
    {
      id: 'p3',
      sku: 'DES-SET-06',
      name: 'Juego Destornilladores 6 Piezas',
      departmentName: 'Ferretería',
      groupName: 'Herramientas',
      subgroupName: 'Destornilladores',
      costPrice: 8.00,
      basePrice: 14.50,
      taxRate: 16,
      finalPrice: 16.82,
      currentStock: 45,
      aisle: 'Pasillo C2',
      shelf: 'Estante 01',
      compartment: 'Gaveta 05-B',
    },
    {
      id: 'p4',
      sku: 'ARR-PRI-01',
      name: 'Arroz Primor Tradicional 1Kg',
      departmentName: 'Alimentos',
      groupName: 'Granos y Cereales',
      subgroupName: 'Arroces',
      costPrice: 0.90,
      basePrice: 1.30,
      taxRate: 0,
      finalPrice: 1.30,
      currentStock: 210,
    },
  ]);

  const columns: Column<ProductItem>[] = [
    {
      header: 'Producto / SKU',
      cell: (row) => (
        <div>
          <div className="font-semibold text-neutral-900">{row.name}</div>
          <div className="text-xs font-mono text-neutral-500">{row.sku}</div>
        </div>
      ),
    },
    {
      header: 'Jerarquía',
      cell: (row) => (
        <div className="text-xs">
          <span className="font-medium text-neutral-800">{row.departmentName}</span>
          <span className="text-neutral-400"> › </span>
          <span className="text-neutral-600">{row.groupName}</span>
          {row.subgroupName && (
            <>
              <span className="text-neutral-400"> › </span>
              <span className="text-neutral-500">{row.subgroupName}</span>
            </>
          )}
        </div>
      ),
    },
    {
      header: 'Ubicación Física',
      cell: (row) =>
        row.aisle ? (
          <div className="flex items-center gap-1.5 text-xs text-neutral-700">
            <MapPin className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span>
              {row.aisle} • {row.shelf} • {row.compartment}
            </span>
          </div>
        ) : (
          <Badge variant="warning">Sin Ubicación</Badge>
        ),
    },
    {
      header: 'Costo ($)',
      accessorKey: 'costPrice',
      cell: (row) => formatMoneyUSD(row.costPrice),
    },
    {
      header: 'Base ($)',
      accessorKey: 'basePrice',
      cell: (row) => formatMoneyUSD(row.basePrice),
    },
    {
      header: 'IVA',
      cell: (row) => (
        <Badge variant={row.taxRate === 0 ? 'neutral' : 'info'}>
          {row.taxRate === 0 ? 'Exento' : `${row.taxRate}%`}
        </Badge>
      ),
    },
    {
      header: 'PVP Final ($)',
      cell: (row) => <span className="font-bold text-neutral-900">{formatMoneyUSD(row.finalPrice)}</span>,
    },
    {
      header: 'Stock',
      cell: (row) => (
        <span className={`font-semibold ${row.currentStock <= 20 ? 'text-red-600' : 'text-neutral-900'}`}>
          {formatNumber(row.currentStock, { maximumFractionDigits: 0 })} UND
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Catálogo de Productos e Inventario</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Gestión integral de precios, jerarquías de clasificación y ubicaciones en depósitos
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            Nuevo Producto
          </Button>
        </div>
      </div>

      {/* Tabla Principal */}
      <Card>
        <DataTable
          data={products}
          columns={columns}
          searchPlaceholder="Buscar por nombre, SKU o código de barra..."
          searchKey="name"
          onExportCSV={() => toast.info('Exportando catálogo completo en formato CSV...')}
        />
      </Card>
    </div>
  );
};
