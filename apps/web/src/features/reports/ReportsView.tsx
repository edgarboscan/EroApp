import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { PdfViewerModal } from '../../components/ui/PdfViewerModal';
import {
  FileText,
  Download,
  Calendar,
  DollarSign,
  ShoppingCart,
  CreditCard,
  Building2,
  TrendingUp,
  User,
  Package,
  Layers,
  ArrowUpDown,
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Eye,
  FileSpreadsheet,
  Coins,
  Landmark,
  FileCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/authStore';
import { useExchangeRateStore } from '../../stores/exchangeRateStore';
import {
  formatMoneyUSD,
  formatMoneyVES,
  formatNumber,
} from '@ero/shared';

type ReportTab =
  | 'sales'
  | 'cash_shifts'
  | 'sales_by_product'
  | 'sales_by_cashier'
  | 'inventory_hierarchy'
  | 'restaurant_tips'
  | 'receivables_aging'
  | 'payables_aging'
  | 'treasury_balances'
  | 'bank_movements'
  | 'bank_reconciliation'
  | 'cash_flow';

const reportSlugMap: Record<string, ReportTab> = {
  sales: 'sales',
  'cash-shifts': 'cash_shifts',
  cashiers: 'sales_by_cashier',
  products: 'sales_by_product',
  inventory: 'inventory_hierarchy',
  'restaurant-tips': 'restaurant_tips',
  receivables: 'receivables_aging',
  payables: 'payables_aging',
  'treasury-balances': 'treasury_balances',
  'bank-movements': 'bank_movements',
  'bank-reconciliation': 'bank_reconciliation',
  'cash-flow': 'cash_flow',
};

const reportMeta: Record<ReportTab, { title: string; category: string; subtitle: string; icon: React.ComponentType<{ className?: string }> }> = {
  sales: {
    title: 'Reporte General de Ventas',
    category: 'Ventas & Caja',
    subtitle: 'Consolidación de ventas, bases gravables, IVA, IGTF y métodos de recaudación',
    icon: ShoppingCart,
  },
  cash_shifts: {
    title: 'Cierres de Caja & Arqueos (X / Z)',
    category: 'Ventas & Caja',
    subtitle: 'Control de lotes POS, depósitos en bancos de tesorería y cuadres de caja',
    icon: CreditCard,
  },
  sales_by_cashier: {
    title: 'Desempeño y Rendimiento por Cajero',
    category: 'Ventas & Caja',
    subtitle: 'Turnos operados, facturas procesadas, ventas totales y recaudación en POS',
    icon: User,
  },
  sales_by_product: {
    title: 'Ventas y Rotación por Producto',
    category: 'Inventario & Stock',
    subtitle: 'Top de rotación, unidades facturadas y volumen de venta por producto',
    icon: Package,
  },
  inventory_hierarchy: {
    title: 'Jerarquía & Stock Valorizado de Inventario',
    category: 'Inventario & Stock',
    subtitle: 'Estructura por departamentos, grupos, existencias actuales y valoración a costo y PVP',
    icon: Layers,
  },
  restaurant_tips: {
    title: 'Propinas de Restaurante por Mesero',
    category: 'Restaurante',
    subtitle: 'Control de propinas percibidas en comandas para liquidación al personal',
    icon: Coins,
  },
  receivables_aging: {
    title: 'Antigüedad de Cartera (CxC)',
    category: 'Finanzas & Cartera',
    subtitle: 'Análisis de vencimientos de créditos otorgados a clientes (0-30, 31-60, 61-90, +90 días)',
    icon: TrendingUp,
  },
  payables_aging: {
    title: 'Antigüedad de Deudas (CxP)',
    category: 'Finanzas & Cartera',
    subtitle: 'Análisis de vencimientos de compromisos con proveedores y pagos pendientes',
    icon: ArrowUpDown,
  },
  treasury_balances: {
    title: 'Posición Global de Saldos y Liquidez Bancaria',
    category: 'Tesorería & Bancos',
    subtitle: 'Consolidación de cuentas bancarias en Bs. y $, partidas en tránsito y saldo real disponible',
    icon: Landmark,
  },
  bank_movements: {
    title: 'Libro Auxiliar & Cartola de Movimientos Bancarios',
    category: 'Tesorería & Bancos',
    subtitle: 'Cartola cronológica por cuenta bancaria con saldo inicial, débitos, créditos y saldo progresivo',
    icon: FileSpreadsheet,
  },
  bank_reconciliation: {
    title: 'Acta Oficial de Conciliación Bancaria Certificada',
    category: 'Tesorería & Bancos',
    subtitle: 'Confrontación entre extracto bancario y mayor contable con partidas en tránsito y dictamen de cuadre',
    icon: FileCheck,
  },
  cash_flow: {
    title: 'Flujo de Caja Operativo de Tesorería',
    category: 'Tesorería & Bancos',
    subtitle: 'Ingresos por recaudación/cobranzas vs egresos por proveedores/gastos y flujo neto diario',
    icon: Coins,
  },
};

const formatSafeDateTime = (val?: string | null) => {
  if (!val) return null;
  const str = String(val);
  const d = new Date(str.includes('T') ? str : str.replace(' ', 'T'));
  if (isNaN(d.getTime())) return { time: str, date: '' };
  return {
    time: d.toLocaleTimeString('es-VE'),
    date: d.toLocaleDateString('es-VE'),
  };
};

export const ReportsView: React.FC = () => {
  const { reportId } = useParams<{ reportId?: string }>();
  const activeTab: ReportTab = reportSlugMap[reportId || 'sales'] || 'sales';
  const meta = reportMeta[activeTab];

  const { token, activeBranchId } = useAuthStore();
  const bcvRate = useExchangeRateStore((s) => s.rate) || 1;

  // Filtros Globales
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [isDetailed, setIsDetailed] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedMethod, setSelectedMethod] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);

  // Estados de datos de reportes
  const [salesData, setSalesData] = useState<any>(null);
  const [shiftsData, setShiftsData] = useState<any>(null);
  const [productData, setProductData] = useState<any[]>([]);
  const [cashierData, setCashierData] = useState<any[]>([]);
  const [inventoryData, setInventoryData] = useState<any[]>([]);
  const [restaurantTipsData, setRestaurantTipsData] = useState<any>(null);
  const [receivablesData, setReceivablesData] = useState<any>(null);
  const [payablesData, setPayablesData] = useState<any>(null);
  const [treasuryBalancesData, setTreasuryBalancesData] = useState<any>(null);
  const [bankMovementsData, setBankMovementsData] = useState<any>(null);
  const [bankReconciliationData, setBankReconciliationData] = useState<any>(null);
  const [cashFlowData, setCashFlowData] = useState<any>(null);

  // Cuentas bancarias para selector en reportes de cuenta
  const [bankAccountsList, setBankAccountsList] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  const [selectedWaiter, setSelectedWaiter] = useState<string>('all');
  const [tipsViewMode, setTipsViewMode] = useState<'summary' | 'detailed'>('summary');

  // Estado de moneda para visualización y exportación de reportes
  const [reportCurrency, setReportCurrency] = useState<'BOTH' | 'VES' | 'USD'>('BOTH');

  // Estado para el visor de PDF interactivo
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);

  // Cargar configuración de moneda predeterminada de la empresa
  useEffect(() => {
    const fetchCompanySettings = async () => {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        const res = await fetch('/api/config/company', { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data?.reportCurrency) {
            setReportCurrency(json.data.reportCurrency);
          }
        }
      } catch {}
    };
    fetchCompanySettings();
  }, [token]);

  // Cargar cuentas bancarias para reportes de Tesorería
  useEffect(() => {
    if (activeTab === 'bank_movements' || activeTab === 'bank_reconciliation') {
      const fetchAccounts = async () => {
        try {
          const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
          const res = await fetch('/api/treasury/accounts', { headers });
          if (res.ok) {
            const json = await res.json();
            if (json.success && Array.isArray(json.data)) {
              setBankAccountsList(json.data);
              if (!selectedAccountId && json.data.length > 0) {
                setSelectedAccountId(json.data[0].id);
              }
            }
          }
        } catch {}
      };
      fetchAccounts();
    }
  }, [activeTab, token]);

  useEffect(() => {
    loadActiveReport();
  }, [activeTab, startDate, endDate, selectedMethod, selectedWaiter, selectedAccountId, activeBranchId, reportCurrency]);

  const loadActiveReport = async () => {
    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const branchParam = activeBranchId ? `&branchId=${activeBranchId}` : '';
      const methodParam = selectedMethod !== 'all' ? `&paymentMethod=${selectedMethod}` : '';

      if (activeTab === 'sales') {
        const url = `/api/reports/sales?startDate=${startDate}&endDate=${endDate}${branchParam}${methodParam}&detailed=true`;
        const res = await fetch(url, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) setSalesData(json.data);
        }
      } else if (activeTab === 'cash_shifts') {
        const url = `/api/reports/cash-shifts?startDate=${startDate}&endDate=${endDate}${branchParam}&detailed=true`;
        const res = await fetch(url, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) setShiftsData(json.data);
        }
      } else if (activeTab === 'sales_by_product') {
        const url = `/api/reports/sales-by-product?startDate=${startDate}&endDate=${endDate}${branchParam}&limit=100`;
        const res = await fetch(url, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) setProductData(json.data);
        }
      } else if (activeTab === 'sales_by_cashier') {
        const url = `/api/reports/sales-by-cashier?startDate=${startDate}&endDate=${endDate}${branchParam}`;
        const res = await fetch(url, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) setCashierData(json.data);
        }
      } else if (activeTab === 'inventory_hierarchy') {
        const url = `/api/reports/inventory-hierarchy`;
        const res = await fetch(url, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) setInventoryData(json.data);
        }
      } else if (activeTab === 'restaurant_tips') {
        const waiterParam = selectedWaiter !== 'all' ? `&waiterName=${encodeURIComponent(selectedWaiter)}` : '';
        const url = `/api/reports/restaurant-tips?startDate=${startDate}&endDate=${endDate}${branchParam}${waiterParam}`;
        const res = await fetch(url, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) setRestaurantTipsData(json.data);
        }
      } else if (activeTab === 'receivables_aging') {
        const url = `/api/reports/receivables-aging?${branchParam}`;
        const res = await fetch(url, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) setReceivablesData(json.data);
        }
      } else if (activeTab === 'payables_aging') {
        const url = `/api/reports/payables-aging?${branchParam}`;
        const res = await fetch(url, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) setPayablesData(json.data);
        }
      } else if (activeTab === 'treasury_balances') {
        const url = `/api/reports/treasury-balances?${branchParam}&currency=${reportCurrency}`;
        const res = await fetch(url, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) setTreasuryBalancesData(json.data);
        }
      } else if (activeTab === 'bank_movements') {
        const accParam = selectedAccountId ? `&accountId=${selectedAccountId}` : '';
        const url = `/api/reports/bank-movements?startDate=${startDate}&endDate=${endDate}${accParam}`;
        const res = await fetch(url, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) setBankMovementsData(json.data);
        }
      } else if (activeTab === 'bank_reconciliation') {
        const accParam = selectedAccountId ? `&accountId=${selectedAccountId}` : '';
        const url = `/api/reports/bank-reconciliation?asOfDate=${endDate}${accParam}`;
        const res = await fetch(url, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) setBankReconciliationData(json.data);
        }
      } else if (activeTab === 'cash_flow') {
        const url = `/api/reports/cash-flow?startDate=${startDate}&endDate=${endDate}${branchParam}&currency=${reportCurrency}`;
        const res = await fetch(url, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) setCashFlowData(json.data);
        }
      }
    } catch {
      toast.error('Error al consultar datos del reporte');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    setExporting(true);
    try {
      const branchParam = activeBranchId ? `&branchId=${activeBranchId}` : '';
      const methodParam = selectedMethod !== 'all' ? `&paymentMethod=${selectedMethod}` : '';
      const currParam = `&currency=${reportCurrency}`;
      let endpoint = '';

      if (activeTab === 'sales') {
        endpoint = `/api/reports/sales?startDate=${startDate}&endDate=${endDate}${branchParam}${methodParam}&detailed=${isDetailed}${currParam}&export=${format}`;
      } else if (activeTab === 'cash_shifts') {
        endpoint = `/api/reports/cash-shifts?startDate=${startDate}&endDate=${endDate}${branchParam}${currParam}&export=${format}`;
      } else if (activeTab === 'sales_by_product') {
        endpoint = `/api/reports/sales-by-product?startDate=${startDate}&endDate=${endDate}${branchParam}${currParam}&export=${format}`;
      } else if (activeTab === 'sales_by_cashier') {
        endpoint = `/api/reports/sales-by-cashier?startDate=${startDate}&endDate=${endDate}${branchParam}${currParam}&export=${format}`;
      } else if (activeTab === 'inventory_hierarchy') {
        endpoint = `/api/reports/inventory-hierarchy?${currParam.slice(1)}&export=${format}`;
      } else if (activeTab === 'restaurant_tips') {
        const waiterParam = selectedWaiter !== 'all' ? `&waiterName=${encodeURIComponent(selectedWaiter)}` : '';
        endpoint = `/api/reports/restaurant-tips?startDate=${startDate}&endDate=${endDate}${branchParam}${waiterParam}${currParam}&export=${format}`;
      } else if (activeTab === 'receivables_aging') {
        endpoint = `/api/reports/receivables-aging?${branchParam}${currParam}&export=${format}`;
      } else if (activeTab === 'payables_aging') {
        endpoint = `/api/reports/payables-aging?${branchParam}${currParam}&export=${format}`;
      } else if (activeTab === 'treasury_balances') {
        endpoint = `/api/reports/treasury-balances?${branchParam}${currParam}&export=${format}`;
      } else if (activeTab === 'bank_movements') {
        const accParam = selectedAccountId ? `&accountId=${selectedAccountId}` : '';
        endpoint = `/api/reports/bank-movements?startDate=${startDate}&endDate=${endDate}${accParam}&export=${format}`;
      } else if (activeTab === 'bank_reconciliation') {
        const accParam = selectedAccountId ? `&accountId=${selectedAccountId}` : '';
        endpoint = `/api/reports/bank-reconciliation?asOfDate=${endDate}${accParam}&export=${format}`;
      } else if (activeTab === 'cash_flow') {
        endpoint = `/api/reports/cash-flow?startDate=${startDate}&endDate=${endDate}${branchParam}${currParam}&export=${format}`;
      }

      if (!endpoint) return;

      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(endpoint, { headers });
      if (!res.ok) throw new Error('Falló la descarga del archivo');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${getReportName()}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`Reporte exportado exitosamente (${format.toUpperCase()})`);
    } catch {
      toast.error('Error al exportar reporte');
    } finally {
      setExporting(false);
    }
  };

  const getPdfEndpoint = () => {
    const branchParam = activeBranchId ? `&branchId=${activeBranchId}` : '';
    const methodParam = selectedMethod !== 'all' ? `&paymentMethod=${selectedMethod}` : '';
    const currParam = `&currency=${reportCurrency}`;
    let endpoint = '';

    if (activeTab === 'sales') {
      endpoint = `/api/reports/sales?startDate=${startDate}&endDate=${endDate}${branchParam}${methodParam}&detailed=${isDetailed}${currParam}&format=pdf`;
    } else if (activeTab === 'cash_shifts') {
      endpoint = `/api/reports/cash-shifts?startDate=${startDate}&endDate=${endDate}${branchParam}&detailed=${isDetailed}${currParam}&format=pdf`;
    } else if (activeTab === 'sales_by_product') {
      endpoint = `/api/reports/sales-by-product?startDate=${startDate}&endDate=${endDate}${branchParam}${currParam}&format=pdf`;
    } else if (activeTab === 'sales_by_cashier') {
      endpoint = `/api/reports/sales-by-cashier?startDate=${startDate}&endDate=${endDate}${branchParam}${currParam}&format=pdf`;
    } else if (activeTab === 'inventory_hierarchy') {
      endpoint = `/api/reports/inventory-hierarchy?${currParam.slice(1)}&format=pdf`;
    } else if (activeTab === 'restaurant_tips') {
      const waiterParam = selectedWaiter !== 'all' ? `&waiterName=${encodeURIComponent(selectedWaiter)}` : '';
      endpoint = `/api/reports/restaurant-tips?startDate=${startDate}&endDate=${endDate}${branchParam}${waiterParam}${currParam}&format=pdf`;
    } else if (activeTab === 'receivables_aging') {
      endpoint = `/api/reports/receivables-aging?${branchParam}${currParam}&format=pdf`;
    } else if (activeTab === 'payables_aging') {
      endpoint = `/api/reports/payables-aging?${branchParam}${currParam}&format=pdf`;
    } else if (activeTab === 'treasury_balances') {
      endpoint = `/api/reports/treasury-balances?${branchParam}${currParam}&format=pdf`;
    } else if (activeTab === 'bank_movements') {
      const accParam = selectedAccountId ? `&accountId=${selectedAccountId}` : '';
      endpoint = `/api/reports/bank-movements?startDate=${startDate}&endDate=${endDate}${accParam}&format=pdf`;
    } else if (activeTab === 'bank_reconciliation') {
      const accParam = selectedAccountId ? `&accountId=${selectedAccountId}` : '';
      endpoint = `/api/reports/bank-reconciliation?asOfDate=${endDate}${accParam}&format=pdf`;
    } else if (activeTab === 'cash_flow') {
      endpoint = `/api/reports/cash-flow?startDate=${startDate}&endDate=${endDate}${branchParam}${currParam}&format=pdf`;
    }
    return endpoint;
  };

  const getReportName = () => {
    switch (activeTab) {
      case 'sales':
        return isDetailed ? 'Reporte_Ventas_Detallado' : 'Reporte_Ventas_Resumido';
      case 'cash_shifts':
        return 'Reporte_Cierres_Caja_Arqueos';
      case 'sales_by_product':
        return 'Reporte_Ventas_Por_Producto';
      case 'sales_by_cashier':
        return 'Reporte_Desempeno_Cajeros';
      case 'inventory_hierarchy':
        return 'Reporte_Jerarquia_Stock_Inventario';
      case 'restaurant_tips':
        return 'Reporte_Propinas_Restaurante';
      case 'receivables_aging':
        return 'Reporte_Antiguedad_CxC';
      case 'payables_aging':
        return 'Reporte_Antiguedad_CxP';
      case 'treasury_balances':
        return 'Reporte_Posicion_Bancaria_Liquidez';
      case 'bank_movements':
        return `Reporte_Movimientos_${bankMovementsData?.account?.accountNumber || 'Cuenta'}`;
      case 'bank_reconciliation':
        return `Acta_Conciliacion_${bankReconciliationData?.account?.accountNumber || 'Bancaria'}`;
      case 'cash_flow':
        return 'Reporte_Flujo_Caja_Operativo';
      default:
        return 'Reporte';
    }
  };

  // Filtrado reactivo en memoria para las tablas
  const filteredSalesInvoices = (salesData?.invoices || []).filter((inv: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      inv.invoice_number?.toLowerCase().includes(term) ||
      inv.control_number?.toLowerCase().includes(term) ||
      inv.customer_name?.toLowerCase().includes(term) ||
      inv.customer_doc?.toLowerCase().includes(term)
    );
  });

  const filteredCashShifts = (shiftsData?.shifts || []).filter((s: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const code = s.cashRegisterCode || s.cash_register_code || '';
    const cashier = s.cashierName || s.cashier_name || '';
    const branch = s.branchName || s.branch_name || '';
    return (
      code.toLowerCase().includes(term) ||
      cashier.toLowerCase().includes(term) ||
      branch.toLowerCase().includes(term)
    );
  });

  const filteredProducts = productData.filter((p: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const name = p.productName || p.product_name || '';
    const sku = p.sku || '';
    const barcode = p.barcode || '';
    const dept = p.departmentName || p.department_name || '';
    return (
      name.toLowerCase().includes(term) ||
      sku.toLowerCase().includes(term) ||
      barcode.toLowerCase().includes(term) ||
      dept.toLowerCase().includes(term)
    );
  });

  const filteredCashiers = cashierData.filter((c: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const name = c.cashierName || c.cashier_name || '';
    const branch = c.branchName || c.branch_name || '';
    return name.toLowerCase().includes(term) || branch.toLowerCase().includes(term);
  });

  const filteredInventory = inventoryData.filter((item: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const name = item.productName || item.product_name || '';
    const sku = item.sku || '';
    const dept = item.departmentName || item.department_name || '';
    const grp = item.groupName || item.group_name || '';
    return (
      name.toLowerCase().includes(term) ||
      sku.toLowerCase().includes(term) ||
      dept.toLowerCase().includes(term) ||
      grp.toLowerCase().includes(term)
    );
  });

  const filteredReceivables = (receivablesData?.items || []).filter((r: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.customer_name?.toLowerCase().includes(term) ||
      r.doc_number?.toLowerCase().includes(term) ||
      r.invoice_number?.toLowerCase().includes(term)
    );
  });

  const filteredPayables = (payablesData?.items || []).filter((r: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.supplier_name?.toLowerCase().includes(term) ||
      r.rif?.toLowerCase().includes(term) ||
      r.invoice_number?.toLowerCase().includes(term)
    );
  });

  const filteredTreasuryAccounts = (treasuryBalancesData?.accounts || []).filter((acc: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      acc.bankName?.toLowerCase().includes(term) ||
      acc.bankCode?.toLowerCase().includes(term) ||
      acc.accountNumber?.toLowerCase().includes(term) ||
      acc.description?.toLowerCase().includes(term)
    );
  });

  const filteredBankMovements = (bankMovementsData?.movements || []).filter((m: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      m.reference?.toLowerCase().includes(term) ||
      m.concept?.toLowerCase().includes(term) ||
      m.type?.toLowerCase().includes(term) ||
      m.userName?.toLowerCase().includes(term)
    );
  });

  const filteredCashFlowCategories = (cashFlowData?.categories || []).filter((c: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return c.label?.toLowerCase().includes(term);
  });

  const MetaIcon = meta.icon;
  const isDateFilterApplicable =
    activeTab !== 'inventory_hierarchy' &&
    activeTab !== 'receivables_aging' &&
    activeTab !== 'payables_aging' &&
    activeTab !== 'treasury_balances' &&
    activeTab !== 'bank_reconciliation';

  return (
    <div className="space-y-4">
      {/* Encabezado Principal del Módulo de Reportes */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sky-100 dark:bg-sky-900/40 text-[#007BFF] dark:text-[#3D91FF] flex items-center justify-center shrink-0 shadow-xs">
            <MetaIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Reportes & Exportación
              </span>
              <span className="text-neutral-300 dark:text-neutral-700">•</span>
              <Badge variant="neutral">{meta.category}</Badge>
            </div>
            <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 leading-tight">
              {meta.title}
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {meta.subtitle}
            </p>
          </div>
        </div>

        {/* Acciones de Exportación */}
        <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={loadActiveReport}
            disabled={loading}
            title="Refrescar datos del reporte"
            className="flex items-center gap-2 border-neutral-300 dark:border-neutral-700 rounded-lg"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refrescar</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('csv')}
            disabled={exporting || loading}
            title="Descargar archivo en formato CSV"
            className="flex items-center gap-2 border-neutral-300 dark:border-neutral-700 rounded-lg"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('xlsx')}
            disabled={exporting || loading}
            title="Descargar libro de cálculo Excel (.xlsx)"
            className="flex items-center gap-2 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPdfModalOpen(true)}
            disabled={loading}
            title="Abrir visor interactivo de PDF oficial"
            className="flex items-center gap-2 border-[#007BFF] dark:border-[#3D91FF] rounded-lg bg-blue-50 dark:bg-blue-600/30 hover:bg-blue-100 dark:hover:border-blue-500 font-semibold"
          >
            <Eye className="w-3.5 h-3.5 text-[#007BFF] dark:text-[#3D91FF]" />
            <span>Ver PDF</span>
          </Button>
        </div>
      </div>

      {/* Barra de Filtros y Configuración */}
      <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-neutral-200 dark:border-neutral-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {isDateFilterApplicable && (
            <>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
                <span className="font-medium text-neutral-700 dark:text-neutral-300">Desde:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-8 px-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs font-mono"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="font-medium text-neutral-700 dark:text-neutral-300">Hasta:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-8 px-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs font-mono"
                />
              </div>
            </>
          )}

          {activeTab === 'sales' && (
            <div className="flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
              <span className="font-medium text-neutral-700 dark:text-neutral-300">Medio:</span>
              <select
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
                className="h-8 px-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs"
              >
                <option value="all">Todos los Medios</option>
                <option value="DEBIT_CARD">Punto Débito (Bs)</option>
                <option value="CREDIT_CARD">Punto Crédito (Bs)</option>
                <option value="PAGO_MOVIL">Pago Móvil (Bs)</option>
                <option value="CASH_USD">Efectivo Divisas ($)</option>
                <option value="CASH_VES">Efectivo Bolívares (Bs)</option>
                <option value="ZELLE">Zelle USD</option>
                <option value="BIOPAGO">Biopago BDV</option>
                <option value="CASHEA">Cashea</option>
              </select>
            </div>
          )}

          {activeTab === 'restaurant_tips' && (
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
              <span className="font-medium text-neutral-700 dark:text-neutral-300">Mesero:</span>
              <select
                value={selectedWaiter}
                onChange={(e) => setSelectedWaiter(e.target.value)}
                className="h-8 px-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs"
              >
                <option value="all">Todos los Meseros</option>
                {(restaurantTipsData?.byWaiter || []).map((w: any) => (
                  <option key={w.waiterName} value={w.waiterName}>
                    {w.waiterName} ({w.ordersCount})
                  </option>
                ))}
              </select>
            </div>
          )}

          {(activeTab === 'bank_movements' || activeTab === 'bank_reconciliation') && (
            <div className="flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
              <span className="font-medium text-neutral-700 dark:text-neutral-300">Cuenta:</span>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="h-8 px-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs font-mono max-w-[240px]"
              >
                {bankAccountsList.map((acc: any) => (
                  <option key={acc.id} value={acc.id}>
                    [{acc.bankCode}] {acc.bankName} - {acc.accountNumber?.slice(-8)} ({acc.currency})
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeTab === 'bank_reconciliation' && (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
              <span className="font-medium text-neutral-700 dark:text-neutral-300">Fecha Corte:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 px-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs font-mono"
              />
            </div>
          )}

          {activeTab === 'restaurant_tips' && (
            <div className="flex items-center gap-2 pl-2 border-l border-neutral-300 dark:border-neutral-700">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">Vista:</span>
              <button
                type="button"
                onClick={() => setTipsViewMode('summary')}
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                  tipsViewMode === 'summary'
                    ? 'bg-[#007BFF] dark:bg-[#3D91FF] text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200'
                }`}
              >
                Por Mesero
              </button>
              <button
                type="button"
                onClick={() => setTipsViewMode('detailed')}
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                  tipsViewMode === 'detailed'
                    ? 'bg-[#007BFF] dark:bg-[#3D91FF] text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200'
                }`}
              >
                Detalle Comandas
              </button>
            </div>
          )}

          {/* Toggle de Resumido y Detallado: Únicamente para Ventas Generales */}
          {activeTab === 'sales' && (
            <div className="flex items-center gap-2 pl-2 border-l border-neutral-300 dark:border-neutral-700">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">Modo:</span>
              <button
                type="button"
                onClick={() => setIsDetailed(false)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
                  !isDetailed
                    ? 'bg-[#007BFF] dark:bg-[#3D91FF] text-white shadow-xs'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200'
                }`}
              >
                Resumido (Diario)
              </button>
              <button
                type="button"
                onClick={() => setIsDetailed(true)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
                  isDetailed
                    ? 'bg-[#007BFF] dark:bg-[#3D91FF] text-white shadow-xs'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200'
                }`}
              >
                Detallado (Facturas)
              </button>
            </div>
          )}

          {/* Selector de Moneda de Reporte */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-neutral-300 dark:border-neutral-700">
            <Coins className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
            <span className="font-medium text-neutral-700 dark:text-neutral-300">Moneda:</span>
            <div className="inline-flex rounded-lg p-0.5 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
              <button
                type="button"
                onClick={() => setReportCurrency('BOTH')}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  reportCurrency === 'BOTH'
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-xs font-semibold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
                title="Bimonetario: Mostrar valores en Bolívares y Dólares simultáneamente"
              >
                Bimonetario
              </button>
              <button
                type="button"
                onClick={() => setReportCurrency('VES')}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  reportCurrency === 'VES'
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-xs font-semibold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
                title="Mostrar valores exclusivamente en Bolívares (VES)"
              >
                Bs. (VES)
              </button>
              <button
                type="button"
                onClick={() => setReportCurrency('USD')}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  reportCurrency === 'USD'
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-xs font-semibold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
                title="Mostrar valores exclusivamente en Dólares ($)"
              >
                $ (USD)
              </button>
            </div>
          </div>
        </div>

        {/* Buscador Rápido */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-400 dark:text-neutral-500" />
            <input
              type="text"
              placeholder="Buscar en resultados..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-8 pl-8 pr-2.5 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs focus:ring-1 focus:ring-sky-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Contenedor Principal de Reportes */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 space-y-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-neutral-200 dark:border-neutral-800">
          <Loader2 className="w-8 h-8 animate-spin text-[#007BFF] dark:text-[#3D91FF]" />
          <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
            Consultando registros en base de datos...
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* ============================================================== */}
          {/* REPORTE 1: VENTAS GENERALES (RESUMIDO Y DETALLADO)             */}
          {/* ============================================================== */}
          {activeTab === 'sales' && salesData && (
            <div className="space-y-4">
              {/* Tarjetas de Resumen KPI */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {reportCurrency === 'VES' ? (
                  <>
                    <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-[#28A745] dark:border-l-[#4ADE80]">
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                        Ventas Totales (Bs)
                      </span>
                      <span className="text-lg font-bold font-mono text-[#28A745] dark:text-[#4ADE80] block mt-0.5">
                        {formatMoneyVES(salesData.summary?.totalSalesVES || 0)}
                      </span>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Tasa oficial BCV</span>
                    </div>

                    <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-purple-500">
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                        Facturas Emitidas
                      </span>
                      <span className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100 block mt-0.5">
                        {salesData.summary?.totalInvoices || 0}
                      </span>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Comprobantes válidos</span>
                    </div>

                    <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-amber-500">
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                        Ticket Promedio (Bs)
                      </span>
                      <span className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100 block mt-0.5">
                        {formatMoneyVES(
                          salesData.summary?.totalInvoices && salesData.summary.totalInvoices > 0
                            ? (salesData.summary.totalSalesVES || 0) / salesData.summary.totalInvoices
                            : 0
                        )}
                      </span>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Promedio en Bolívares</span>
                    </div>

                    <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-sky-500">
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                        Moneda de Visualización
                      </span>
                      <span className="text-base font-bold text-neutral-900 dark:text-neutral-100 block mt-0.5">
                        Bolívares (VES)
                      </span>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Moneda fiscal SENIAT</span>
                    </div>
                  </>
                ) : reportCurrency === 'USD' ? (
                  <>
                    <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-[#007BFF] dark:border-l-[#3D91FF]">
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                        Ventas Totales ($)
                      </span>
                      <span className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100 block mt-0.5">
                        {formatMoneyUSD(salesData.summary?.totalSalesUSD || 0)}
                      </span>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Base Imponible + Exento + IVA</span>
                    </div>

                    <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-purple-500">
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                        Facturas Emitidas
                      </span>
                      <span className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100 block mt-0.5">
                        {salesData.summary?.totalInvoices || 0}
                      </span>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Comprobantes válidos</span>
                    </div>

                    <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-amber-500">
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                        Ticket Promedio ($)
                      </span>
                      <span className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100 block mt-0.5">
                        {formatMoneyUSD(salesData.summary?.averageTicketUSD || 0)}
                      </span>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Por factura procesada</span>
                    </div>

                    <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-sky-500">
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                        Moneda de Visualización
                      </span>
                      <span className="text-base font-bold text-neutral-900 dark:text-neutral-100 block mt-0.5">
                        Dólares ($ USD)
                      </span>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Divisa base de referencia</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-[#007BFF] dark:border-l-[#3D91FF]">
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                        Ventas Totales ($)
                      </span>
                      <span className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100 block mt-0.5">
                        {formatMoneyUSD(salesData.summary?.totalSalesUSD || 0)}
                      </span>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Base Imponible + Exento + IVA</span>
                    </div>

                    <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-[#28A745] dark:border-l-[#4ADE80]">
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                        Ventas Totales (Bs)
                      </span>
                      <span className="text-lg font-bold font-mono text-[#28A745] dark:text-[#4ADE80] block mt-0.5">
                        {formatMoneyVES(salesData.summary?.totalSalesVES || 0)}
                      </span>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Tasa oficial BCV</span>
                    </div>

                    <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-purple-500">
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                        Facturas Emitidas
                      </span>
                      <span className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100 block mt-0.5">
                        {salesData.summary?.totalInvoices || 0}
                      </span>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Comprobantes válidos</span>
                    </div>

                    <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-amber-500">
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                        Ticket Promedio ($)
                      </span>
                      <span className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100 block mt-0.5">
                        {formatMoneyUSD(salesData.summary?.averageTicketUSD || 0)}
                      </span>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Por factura procesada</span>
                    </div>
                  </>
                )}
              </div>

              {/* Modo Resumido o Detallado */}
              {!isDetailed ? (
                <Card
                  title="Resumen Diario de Ventas"
                  subtitle="Totales consolidados por fecha, base gravada, IVA e IGTF"
                >
                  <div className="overflow-x-auto mt-2 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-3">Fecha</th>
                          <th className="py-2.5 px-3 text-center">N° Facturas</th>
                          {reportCurrency !== 'VES' && (
                            <>
                              <th className="py-2.5 px-3 text-right">Exento ($)</th>
                              <th className="py-2.5 px-3 text-right">Base Imponible ($)</th>
                              <th className="py-2.5 px-3 text-right">IVA 16% ($)</th>
                              <th className="py-2.5 px-3 text-right">IGTF 3% ($)</th>
                              <th className="py-2.5 px-3 text-right">Total ($)</th>
                            </>
                          )}
                          {reportCurrency !== 'USD' && (
                            <th className="py-2.5 px-3 text-right">Total Facturado (Bs)</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                        {(salesData.dailySummary || []).length > 0 ? (
                          (salesData.dailySummary || []).map((d: any) => (
                            <tr key={d.date} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/60">
                              <td className="py-2.5 px-3 font-mono font-medium text-neutral-900 dark:text-neutral-100">
                                {d.date}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono">
                                <Badge variant="neutral">{d.invoicesCount}</Badge>
                              </td>
                              {reportCurrency !== 'VES' && (
                                <>
                                  <td className="py-2.5 px-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                                    {formatMoneyUSD(d.exemptUSD)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                                    {formatMoneyUSD(d.taxableUSD)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                                    {formatMoneyUSD(d.ivaUSD)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                                    {formatMoneyUSD(d.igtfUSD)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-900 dark:text-neutral-100">
                                    {formatMoneyUSD(d.totalUSD)}
                                  </td>
                                </>
                              )}
                              {reportCurrency !== 'USD' && (
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-sky-800 dark:text-sky-400">
                                  {formatMoneyVES(d.totalVES)}
                                </td>
                              )}
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={reportCurrency === 'BOTH' ? 8 : reportCurrency === 'VES' ? 3 : 7} className="py-8 text-center text-neutral-400 dark:text-neutral-500">
                              No hay movimientos de ventas registrados en este período
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ) : (
                <Card
                  title={`Detalle de Facturas Emitidas (${filteredSalesInvoices.length})`}
                  subtitle="Relación pormenorizada de cada operación fiscal registrada"
                >
                  <div className="overflow-x-auto mt-2 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-3">N° Factura</th>
                          <th className="py-2.5 px-3">Fecha / Hora</th>
                          <th className="py-2.5 px-3">Cliente</th>
                          <th className="py-2.5 px-3">Cajero</th>
                          {reportCurrency !== 'VES' && (
                            <>
                              <th className="py-2.5 px-3 text-right">Base ($)</th>
                              <th className="py-2.5 px-3 text-right">IVA ($)</th>
                              <th className="py-2.5 px-3 text-right">Total ($)</th>
                            </>
                          )}
                          {reportCurrency !== 'USD' && (
                            <th className="py-2.5 px-3 text-right">Total (Bs)</th>
                          )}
                          <th className="py-2.5 px-3 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                        {filteredSalesInvoices.length > 0 ? (
                          filteredSalesInvoices.map((inv: any) => (
                            <tr key={inv.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/60">
                              <td className="py-2.5 px-3 font-mono font-bold text-neutral-900 dark:text-neutral-100">
                                {inv.invoice_number}
                                {inv.control_number && (
                                  <span className="text-[10px] text-neutral-400 block font-normal">
                                    Ctrl: {inv.control_number}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
                                {inv.emission_date}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="font-medium text-neutral-900 dark:text-neutral-100 block">
                                  {inv.customer_name}
                                </span>
                                <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">
                                  {inv.customer_doc}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-400">
                                {inv.cashier_name}
                              </td>
                              {reportCurrency !== 'VES' && (
                                <>
                                  <td className="py-2.5 px-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                                    {formatMoneyUSD(inv.taxableUSD)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                                    {formatMoneyUSD(inv.ivaUSD)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-900 dark:text-neutral-100">
                                    {formatMoneyUSD(inv.totalUSD)}
                                  </td>
                                </>
                              )}
                              {reportCurrency !== 'USD' && (
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-sky-800 dark:text-sky-400">
                                  {formatMoneyVES(inv.totalVES)}
                                </td>
                              )}
                              <td className="py-2.5 px-3 text-center">
                                <Badge variant={inv.status === 'PAID' ? 'success' : inv.status === 'ANNULLED' ? 'danger' : 'neutral'}>
                                  {inv.status}
                                </Badge>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={reportCurrency === 'BOTH' ? 9 : reportCurrency === 'VES' ? 6 : 8} className="py-8 text-center text-neutral-400 dark:text-neutral-500">
                              No hay facturas que coincidan con los filtros
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* REPORTE 2: CIERRES DE CAJA & ARQUEOS (X / Z)                   */}
          {/* ============================================================== */}
          {activeTab === 'cash_shifts' && shiftsData && (
            <div className="space-y-4">
              {/* Tarjetas KPI de Cuadres de Caja */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 border-l-4 border-l-[#007BFF] dark:border-l-[#3D91FF] bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                    Turnos Auditados
                  </span>
                  <span className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100 block mt-0.5">
                    {shiftsData.summary?.totalShiftsCount || 0}
                  </span>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                    Cerrados: {shiftsData.summary?.closedShiftsCount || 0} • Abiertos: {shiftsData.summary?.openShiftsCount || 0}
                  </span>
                </div>

                {reportCurrency !== 'USD' && (
                  <div className="p-3 border-l-4 border-l-sky-500 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                      Total Lotes POS
                    </span>
                    <span className="text-lg font-bold font-mono text-sky-800 dark:text-sky-400 block mt-0.5">
                      {formatMoneyVES(shiftsData.summary?.totalPosBatchesVES || shiftsData.summary?.totalPOSBatchVES || 0)}
                    </span>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Puntos de venta débito/crédito</span>
                  </div>
                )}

                <div className="p-3 border-l-4 border-l-[#28A745] dark:border-l-[#4ADE80] bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                    {reportCurrency === 'USD' ? 'Total Recaudado ($)' : 'Total Recaudado (Bs)'}
                  </span>
                  <span className="text-lg font-bold font-mono text-[#28A745] dark:text-[#4ADE80] block mt-0.5">
                    {reportCurrency === 'USD'
                      ? formatMoneyUSD(shiftsData.summary?.totalCollectedUSD || 0)
                      : formatMoneyVES(shiftsData.summary?.totalCollectedVES || 0)}
                  </span>
                  {reportCurrency === 'BOTH' && (
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">
                      {formatMoneyUSD(shiftsData.summary?.totalCollectedUSD || 0)}
                    </span>
                  )}
                </div>

                <div className="p-3 border-l-4 border-l-emerald-600 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                    Depósitos Registrados
                  </span>
                  <span className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400 block mt-0.5">
                    {reportCurrency === 'USD'
                      ? formatMoneyUSD(shiftsData.summary?.totalDepositedUSD || 0)
                      : formatMoneyVES(shiftsData.summary?.totalDepositedVES || 0)}
                  </span>
                  {reportCurrency === 'BOTH' && (
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">
                      {formatMoneyUSD(shiftsData.summary?.totalDepositedUSD || 0)}
                    </span>
                  )}
                </div>
              </div>

              {/* Tabla de Cierres de Turno y Arqueos */}
              <Card
                title={`Historial de Turnos de Caja & Arqueos (${filteredCashShifts.length})`}
                subtitle="Control de lotes POS, depósitos en bancos de tesorería y cuadres de caja"
              >
                <div className="overflow-x-auto mt-2 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3">Caja / Cajero</th>
                        <th className="py-2.5 px-3">Apertura / Cierre</th>
                        <th className="py-2.5 px-3 text-center">Estado</th>
                        {reportCurrency !== 'USD' && (
                          <th className="py-2.5 px-3 text-right">Lote POS (Bs)</th>
                        )}
                        <th className="py-2.5 px-3 text-right">
                          {reportCurrency === 'BOTH' ? 'Total Recaudado' : reportCurrency === 'VES' ? 'Total Recaudado (Bs)' : 'Total Recaudado ($)'}
                        </th>
                        {reportCurrency !== 'USD' && (
                          <th className="py-2.5 px-3">Depósito Bancario (VES)</th>
                        )}
                        {reportCurrency !== 'VES' && (
                          <th className="py-2.5 px-3">Depósito Bancario (USD)</th>
                        )}
                        <th className="py-2.5 px-3 text-center">Diferencia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {filteredCashShifts.length > 0 ? (
                        filteredCashShifts.map((s: any) => {
                          const registerCode = s.cashRegisterCode || s.cash_register_code || 'CAJA';
                          const cashier = s.cashierName || s.cashier_name || 'Cajero';
                          const branch = s.branchName || s.branch_name || '';
                          const rawOpened = s.openedAt || s.opened_at;
                          const rawClosed = s.closedAt || s.closed_at;

                          const openedFormatted = formatSafeDateTime(rawOpened);
                          const closedFormatted = formatSafeDateTime(rawClosed);

                          const diffUSD = Number(s.differenceUSD ?? s.difference_usd ?? 0);
                          const diffVES = Number(s.differenceVES ?? s.difference_ves ?? 0);
                          const isBalanced = Math.abs(diffUSD) < 0.01 && Math.abs(diffVES) < 0.01;

                          const depositVES = Number(s.depositAmountVES ?? s.deposit_amount_ves ?? 0);
                          const depositUSD = Number(s.depositAmountUSD ?? s.deposit_amount_usd ?? 0);

                          const posBatch = Number(s.posBatchVES ?? s.pos_batch_ves ?? s.revenue?.posBatchVES ?? 0);
                          const debitAmount = Number(s.debitVES ?? s.debit_ves ?? s.revenue?.debitVES ?? 0);
                          const creditAmount = Number(s.creditVES ?? s.credit_ves ?? s.revenue?.creditVES ?? 0);

                          const collectedVES = Number(s.totalCollectedVES ?? s.total_collected_ves ?? s.revenue?.totalCollectedVES ?? 0);
                          const collectedUSD = Number(s.totalCollectedUSD ?? s.total_collected_usd ?? s.revenue?.totalCollectedUSD ?? 0);

                          return (
                            <tr key={s.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/60">
                              <td className="py-2.5 px-3">
                                <span className="font-bold text-neutral-900 dark:text-neutral-100 block font-mono">
                                  {registerCode}
                                </span>
                                <span className="text-[11px] text-neutral-600 dark:text-neutral-400 font-medium block">
                                  {cashier}
                                </span>
                                {branch && (
                                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block">
                                    {branch}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[11px]">
                                {openedFormatted ? (
                                  <span className="text-neutral-700 dark:text-neutral-300 block">
                                    Inic: {openedFormatted.time} ({openedFormatted.date})
                                  </span>
                                ) : (
                                  <span className="text-neutral-400 block">-</span>
                                )}
                                {closedFormatted ? (
                                  <span className="text-neutral-500 dark:text-neutral-400 block">
                                    Cierr: {closedFormatted.time} ({closedFormatted.date})
                                  </span>
                                ) : (
                                  <span className="text-sky-600 dark:text-sky-400 font-semibold block">En Operación</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <Badge variant={s.status === 'CLOSED' ? 'neutral' : 'success'}>
                                  {s.status === 'CLOSED' ? 'CERRADO' : 'ABIERTO'}
                                </Badge>
                              </td>
                              {reportCurrency !== 'USD' && (
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-sky-800 dark:text-sky-400">
                                  {formatMoneyVES(posBatch)}
                                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block font-normal">
                                    Déb: {formatMoneyVES(debitAmount)} • Créd: {formatMoneyVES(creditAmount)}
                                  </span>
                                </td>
                              )}
                              <td className="py-2.5 px-3 text-right font-mono">
                                {reportCurrency !== 'USD' && (
                                  <span className="font-bold text-neutral-900 dark:text-neutral-100 block">
                                    {formatMoneyVES(collectedVES)}
                                  </span>
                                )}
                                {reportCurrency !== 'VES' && (
                                  <span className={reportCurrency === 'USD' ? 'font-bold text-neutral-900 dark:text-neutral-100 block' : 'text-[11px] text-neutral-600 dark:text-neutral-400 block'}>
                                    {formatMoneyUSD(collectedUSD)}
                                  </span>
                                )}
                              </td>
                              {reportCurrency !== 'USD' && (
                                <td className="py-2.5 px-3">
                                  {depositVES > 0 ? (
                                    <div className="text-[11px]">
                                      <span className="font-mono font-bold text-emerald-800 dark:text-emerald-400 block">
                                        {formatMoneyVES(depositVES)}
                                      </span>
                                      <span className="text-neutral-600 dark:text-neutral-400 block">
                                        {s.depositAccountVES || s.deposit_account_ves || s.depositBankNameVES || s.deposit_bank_name_ves || 'Banco'}
                                      </span>
                                      {(s.depositReferenceVES || s.deposit_reference_ves) && (
                                        <span className="font-mono text-[10px] text-neutral-500 dark:text-neutral-400 block">
                                          Ref: {s.depositReferenceVES || s.deposit_reference_ves}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-neutral-400 dark:text-neutral-500 text-[11px]">Sin depósito</span>
                                  )}
                                </td>
                              )}
                              {reportCurrency !== 'VES' && (
                                <td className="py-2.5 px-3">
                                  {depositUSD > 0 ? (
                                    <div className="text-[11px]">
                                      <span className="font-mono font-bold text-emerald-800 dark:text-emerald-400 block">
                                        {formatMoneyUSD(depositUSD)}
                                      </span>
                                      <span className="text-neutral-600 dark:text-neutral-400 block">
                                        {s.depositAccountUSD || s.deposit_account_usd || s.depositBankNameUSD || s.deposit_bank_name_usd || 'Custodia USD'}
                                      </span>
                                      {(s.depositReferenceUSD || s.deposit_reference_usd) && (
                                        <span className="font-mono text-[10px] text-neutral-500 dark:text-neutral-400 block">
                                          Ref: {s.depositReferenceUSD || s.deposit_reference_usd}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-neutral-400 dark:text-neutral-500 text-[11px]">Sin depósito</span>
                                  )}
                                </td>
                              )}
                              <td className="py-2.5 px-3 text-center">
                                {s.status === 'CLOSED' ? (
                                  <Badge variant={isBalanced ? 'success' : 'danger'}>
                                    {isBalanced
                                      ? 'Cuadrado'
                                      : `${diffUSD !== 0 ? formatMoneyUSD(diffUSD) : ''} ${diffVES !== 0 ? formatMoneyVES(diffVES) : ''}`}
                                  </Badge>
                                ) : (
                                  <span className="text-neutral-400 dark:text-neutral-500 text-[11px]">En curso</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={reportCurrency === 'BOTH' ? 8 : reportCurrency === 'VES' ? 7 : 6} className="py-8 text-center text-neutral-400 dark:text-neutral-500">
                            No hay turnos registrados en este rango de fechas
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* ============================================================== */}
          {/* REPORTE 3: VENTAS Y ROTACIÓN POR PRODUCTO                      */}
          {/* ============================================================== */}
          {activeTab === 'sales_by_product' && (
            <Card
              title={`Ranking de Ventas por Producto (${filteredProducts.length} productos)`}
              subtitle="Top de rotación, unidades facturadas, precio promedio e ingresos consolidados"
            >
              <div className="overflow-x-auto mt-2 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3">Producto</th>
                      <th className="py-2.5 px-3">Departamento</th>
                      <th className="py-2.5 px-3 text-center">Unidades</th>
                      {reportCurrency !== 'VES' && (
                        <>
                          <th className="py-2.5 px-3 text-right">Precio Prom. ($)</th>
                          <th className="py-2.5 px-3 text-right">Total Facturado ($)</th>
                        </>
                      )}
                      {reportCurrency !== 'USD' && (
                        <th className="py-2.5 px-3 text-right">Total Facturado (Bs)</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {filteredProducts.length > 0 ? (
                      filteredProducts.map((p, idx) => {
                        const units = p.totalQtySold ?? p.total_units ?? p.total_qty_sold ?? 0;
                        const avgPrice = p.averagePriceUSD ?? p.average_price_usd ?? 0;
                        const salesUSD = p.totalSalesUSD ?? p.total_sales_usd ?? 0;
                        const salesVES = p.totalSalesVES ?? p.total_sales_ves ?? 0;

                        return (
                          <tr key={p.productId || p.product_id || idx} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/60">
                            <td className="py-2.5 px-3 font-mono text-neutral-400 dark:text-neutral-500">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-neutral-800 dark:text-neutral-200">
                              {p.sku}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-neutral-900 dark:text-neutral-100">
                              {p.productName || p.product_name}
                            </td>
                            <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-400">
                              {p.departmentName || p.department_name || p.category_name || 'General'}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-sky-700 dark:text-sky-400">
                              {formatNumber(units)}
                            </td>
                            {reportCurrency !== 'VES' && (
                              <>
                                <td className="py-2.5 px-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                                  {formatMoneyUSD(avgPrice)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-900 dark:text-neutral-100">
                                  {formatMoneyUSD(salesUSD)}
                                </td>
                              </>
                            )}
                            {reportCurrency !== 'USD' && (
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-sky-800 dark:text-sky-400">
                                {formatMoneyVES(salesVES)}
                              </td>
                            )}
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={reportCurrency === 'BOTH' ? 8 : reportCurrency === 'VES' ? 6 : 7} className="py-8 text-center text-neutral-400 dark:text-neutral-500">
                          No hay registros de ventas para productos en el período
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* ============================================================== */}
          {/* REPORTE 4: DESEMPEÑO POR CAJERO                                */}
          {/* ============================================================== */}
          {activeTab === 'sales_by_cashier' && (
            <Card
              title={`Rendimiento por Cajero (${filteredCashiers.length} cajeros)`}
              subtitle="Turnos operados, facturas procesadas, ventas totales y recaudación en POS"
            >
              <div className="overflow-x-auto mt-2 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3">Cajero / Operador</th>
                      <th className="py-2.5 px-3">Sucursal</th>
                      <th className="py-2.5 px-3 text-center">Turnos Realizados</th>
                      <th className="py-2.5 px-3 text-center">Facturas Emitidas</th>
                      {reportCurrency !== 'USD' && (
                        <th className="py-2.5 px-3 text-right">Lote POS (Bs)</th>
                      )}
                      {reportCurrency !== 'VES' && (
                        <>
                          <th className="py-2.5 px-3 text-right">Ticket Promedio ($)</th>
                          <th className="py-2.5 px-3 text-right">Venta Total ($)</th>
                        </>
                      )}
                      {reportCurrency !== 'USD' && (
                        <th className="py-2.5 px-3 text-right">Venta Total (Bs)</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {filteredCashiers.length > 0 ? (
                      filteredCashiers.map((c, idx) => {
                        const cashier = c.cashierName || c.cashier_name || 'Cajero';
                        const branch = c.branchName || c.branch_name || 'Principal';
                        const shifts = c.totalShifts ?? c.total_shifts ?? 0;
                        const invoices = c.totalInvoices ?? c.total_invoices ?? c.invoicesCount ?? c.invoices_count ?? 0;
                        const pos = c.posBatchVES ?? c.pos_batch_ves ?? 0;
                        const avgTicket = c.averageTicketUSD ?? c.average_ticket_usd ?? 0;
                        const salesUSD = c.totalSalesUSD ?? c.total_sales_usd ?? 0;
                        const salesVES = c.totalSalesVES ?? c.total_sales_ves ?? 0;

                        return (
                          <tr key={c.userId || c.cashier_id || idx} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/60">
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-neutral-900 dark:text-neutral-100 block">
                                {cashier}
                              </span>
                              {c.email && (
                                <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">
                                  {c.email}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-400">
                              {branch}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono text-neutral-700 dark:text-neutral-300">
                              <Badge variant="neutral">{shifts}</Badge>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-sky-700 dark:text-sky-400">
                              {invoices}
                            </td>
                            {reportCurrency !== 'USD' && (
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-sky-800 dark:text-sky-400">
                                {formatMoneyVES(pos)}
                              </td>
                            )}
                            {reportCurrency !== 'VES' && (
                              <>
                                <td className="py-2.5 px-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                                  {formatMoneyUSD(avgTicket)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-900 dark:text-neutral-100">
                                  {formatMoneyUSD(salesUSD)}
                                </td>
                              </>
                            )}
                            {reportCurrency !== 'USD' && (
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                {formatMoneyVES(salesVES)}
                              </td>
                            )}
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={reportCurrency === 'BOTH' ? 8 : reportCurrency === 'VES' ? 6 : 6} className="py-8 text-center text-neutral-400 dark:text-neutral-500">
                          No hay actividades de cajeros en el período seleccionado
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* ============================================================== */}
          {/* REPORTE 5: JERARQUÍA & STOCK VALORIZADO DE INVENTARIO          */}
          {/* ============================================================== */}
          {activeTab === 'inventory_hierarchy' && (
            <Card
              title={`Estructura de Inventario & Valoración (${filteredInventory.length} productos)`}
              subtitle="Existencias en stock, costos, precios de venta y valor total del inventario"
            >
              <div className="overflow-x-auto mt-2 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3">Producto</th>
                      <th className="py-2.5 px-3">Departamento / Grupo</th>
                      <th className="py-2.5 px-3 text-center">Stock Actual</th>
                      {reportCurrency !== 'VES' && (
                        <>
                          <th className="py-2.5 px-3 text-right">Costo Unit ($)</th>
                          <th className="py-2.5 px-3 text-right">PVP ($)</th>
                          <th className="py-2.5 px-3 text-right">Total Costo ($)</th>
                          <th className="py-2.5 px-3 text-right">Total PVP ($)</th>
                        </>
                      )}
                      {reportCurrency !== 'USD' && (
                        <>
                          <th className="py-2.5 px-3 text-right">Total Costo (Bs)</th>
                          <th className="py-2.5 px-3 text-right">Total PVP (Bs)</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {filteredInventory.length > 0 ? (
                      filteredInventory.map((item: any, idx: number) => {
                        const stock = Number(item.stockQty ?? item.stock_qty ?? 0);
                        const cost = Number(item.costPrice ?? item.cost_price ?? 0);
                        const pvp = Number(item.finalPrice ?? item.final_price ?? 0);
                        const totalCost = Number(item.totalCostUSD ?? item.total_cost_usd ?? (stock * cost));
                        const totalRetail = Number(item.totalRetailUSD ?? item.total_retail_usd ?? (stock * pvp));

                        return (
                          <tr key={item.productId || item.product_id || idx} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/60">
                            <td className="py-2.5 px-3 font-mono font-bold text-neutral-900 dark:text-neutral-100">
                              {item.sku}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                                {item.productName || item.product_name}
                              </span>
                              {item.barcode && (
                                <span className="text-[10px] text-neutral-400 font-mono block">
                                  CB: {item.barcode}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-400">
                              <span className="font-medium block">{item.departmentName || item.department_name}</span>
                              <span className="text-[10px] text-neutral-400 block">{item.groupName || item.group_name}</span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-sky-700 dark:text-sky-400">
                              {formatNumber(stock)}
                            </td>
                            {reportCurrency !== 'VES' && (
                              <>
                                <td className="py-2.5 px-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                                  {formatMoneyUSD(cost)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                                  {formatMoneyUSD(pvp)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-900 dark:text-neutral-100">
                                  {formatMoneyUSD(totalCost)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                  {formatMoneyUSD(totalRetail)}
                                </td>
                              </>
                            )}
                            {reportCurrency !== 'USD' && (
                              <>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-sky-800 dark:text-sky-400">
                                  {formatMoneyVES(totalCost * bcvRate)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-800 dark:text-emerald-400">
                                  {formatMoneyVES(totalRetail * bcvRate)}
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={reportCurrency === 'BOTH' ? 10 : reportCurrency === 'VES' ? 6 : 8} className="py-8 text-center text-neutral-400 dark:text-neutral-500">
                          No hay productos en el catálogo para mostrar
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* ============================================================== */}
          {/* REPORTE 6: PROPINAS DE RESTAURANTE                             */}
          {/* ============================================================== */}
          {activeTab === 'restaurant_tips' && restaurantTipsData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {reportCurrency !== 'VES' && (
                  <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-amber-500">
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                      Total Propinas ($)
                    </span>
                    <span className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100 block mt-0.5">
                      {formatMoneyUSD(restaurantTipsData.summary?.totalTipsUSD || 0)}
                    </span>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Liquidación acumulada</span>
                  </div>
                )}

                {reportCurrency !== 'USD' && (
                  <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-[#28A745] dark:border-l-[#4ADE80]">
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                      Total Propinas (Bs)
                    </span>
                    <span className="text-lg font-bold font-mono text-[#28A745] dark:text-[#4ADE80] block mt-0.5">
                      {formatMoneyVES(restaurantTipsData.summary?.totalTipsVES || 0)}
                    </span>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Al cambio oficial</span>
                  </div>
                )}

                <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-[#007BFF] dark:border-l-[#3D91FF]">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                    Comandas con Propina
                  </span>
                  <span className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100 block mt-0.5">
                    {restaurantTipsData.summary?.totalOrdersWithTip || 0}
                  </span>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Órdenes cerradas</span>
                </div>

                <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-purple-500">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                    {reportCurrency === 'VES' ? 'Propina Promedio (Bs)' : 'Propina Promedio ($)'}
                  </span>
                  <span className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100 block mt-0.5">
                    {reportCurrency === 'VES'
                      ? formatMoneyVES((restaurantTipsData.summary?.averageTipUSD || 0) * bcvRate)
                      : formatMoneyUSD(restaurantTipsData.summary?.averageTipUSD || 0)}
                  </span>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Por mesa atendida</span>
                </div>
              </div>

              {tipsViewMode === 'summary' ? (
                <Card
                  title={`Liquidación de Propinas por Mesero (${(restaurantTipsData.byWaiter || []).length} meseros)`}
                  subtitle="Totales a pagar por concepto de propinas recolectadas en el servicio"
                >
                  <div className="overflow-x-auto mt-2 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-3">Mesero / Servidor</th>
                          <th className="py-2.5 px-3 text-center">Comandas Atendidas</th>
                          {reportCurrency !== 'VES' && (
                            <th className="py-2.5 px-3 text-right">Total Facturado ($)</th>
                          )}
                          {reportCurrency !== 'USD' && (
                            <th className="py-2.5 px-3 text-right">Total Facturado (Bs)</th>
                          )}
                          {reportCurrency !== 'VES' && (
                            <th className="py-2.5 px-3 text-right">Propina ($)</th>
                          )}
                          {reportCurrency !== 'USD' && (
                            <th className="py-2.5 px-3 text-right">Propina (Bs)</th>
                          )}
                          {reportCurrency !== 'VES' && (
                            <th className="py-2.5 px-3 text-right">Propina Promedio ($)</th>
                          )}
                          {reportCurrency !== 'USD' && (
                            <th className="py-2.5 px-3 text-right">Propina Promedio (Bs)</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                        {(restaurantTipsData.byWaiter || []).length > 0 ? (
                          (restaurantTipsData.byWaiter || []).map((w: any) => (
                            <tr key={w.waiterName} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/60">
                              <td className="py-2.5 px-3 font-semibold text-neutral-900 dark:text-neutral-100">
                                {w.waiterName}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono">
                                <Badge variant="neutral">{w.ordersCount}</Badge>
                              </td>
                              {reportCurrency !== 'VES' && (
                                <td className="py-2.5 px-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                                  {formatMoneyUSD(w.totalSalesUSD || 0)}
                                </td>
                              )}
                              {reportCurrency !== 'USD' && (
                                <td className="py-2.5 px-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                                  {formatMoneyVES((w.totalSalesUSD || 0) * bcvRate)}
                                </td>
                              )}
                              {reportCurrency !== 'VES' && (
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700 dark:text-amber-400">
                                  {formatMoneyUSD(w.totalTipsUSD || 0)}
                                </td>
                              )}
                              {reportCurrency !== 'USD' && (
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                  {formatMoneyVES(w.totalTipsVES || 0)}
                                </td>
                              )}
                              {reportCurrency !== 'VES' && (
                                <td className="py-2.5 px-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                                  {formatMoneyUSD(w.averageTipUSD || 0)}
                                </td>
                              )}
                              {reportCurrency !== 'USD' && (
                                <td className="py-2.5 px-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                                  {formatMoneyVES((w.averageTipUSD || 0) * bcvRate)}
                                </td>
                              )}
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={reportCurrency === 'BOTH' ? 8 : 5} className="py-8 text-center text-neutral-400 dark:text-neutral-500">
                              No hay propinas registradas para meseros en este rango
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ) : (
                <Card
                  title="Detalle de Comandas con Propina"
                  subtitle="Comandas cerradas con su respectiva mesa y monto de propina asignado"
                >
                  <div className="overflow-x-auto mt-2 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-3">N° Comanda</th>
                          <th className="py-2.5 px-3">Fecha</th>
                          <th className="py-2.5 px-3">Mesa</th>
                          <th className="py-2.5 px-3">Mesero</th>
                          {reportCurrency !== 'VES' && (
                            <th className="py-2.5 px-3 text-right">Total Cuenta ($)</th>
                          )}
                          {reportCurrency !== 'USD' && (
                            <th className="py-2.5 px-3 text-right">Total Cuenta (Bs)</th>
                          )}
                          {reportCurrency !== 'VES' && (
                            <th className="py-2.5 px-3 text-right">Propina ($)</th>
                          )}
                          {reportCurrency !== 'USD' && (
                            <th className="py-2.5 px-3 text-right">Propina (Bs)</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                        {(restaurantTipsData.detailedOrders || []).length > 0 ? (
                          (restaurantTipsData.detailedOrders || []).map((ord: any) => (
                          <tr key={ord.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/60">
                            <td className="py-2.5 px-3 font-mono font-bold text-neutral-900 dark:text-neutral-100">
                              {ord.orderNumber}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
                              {ord.closedAt ? ord.closedAt.slice(0, 16) : '-'}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-neutral-800 dark:text-neutral-200">
                              {ord.tableName}
                            </td>
                            <td className="py-2.5 px-3 text-neutral-700 dark:text-neutral-300">
                              {ord.waiterName}
                            </td>
                            {reportCurrency !== 'VES' && (
                              <td className="py-2.5 px-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                                {formatMoneyUSD(ord.totalAmountUSD || 0)}
                              </td>
                            )}
                            {reportCurrency !== 'USD' && (
                              <td className="py-2.5 px-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                                {formatMoneyVES((ord.totalAmountUSD || 0) * bcvRate)}
                              </td>
                            )}
                            {reportCurrency !== 'VES' && (
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700 dark:text-amber-400">
                                {formatMoneyUSD(ord.tipUSD || 0)}
                              </td>
                            )}
                            {reportCurrency !== 'USD' && (
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                {formatMoneyVES(ord.tipVES || 0)}
                              </td>
                            )}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={reportCurrency === 'BOTH' ? 8 : 6} className="py-8 text-center text-neutral-400 dark:text-neutral-500">
                            No hay comandas registradas en este rango
                          </td>
                        </tr>
                      )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* REPORTE 7: ANTIGÜEDAD DE CARTERA (CXC)                         */}
          {/* ============================================================== */}
          {activeTab === 'receivables_aging' && receivablesData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-[#007BFF] dark:border-l-[#3D91FF]">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                    {reportCurrency === 'VES' ? 'Saldo Total CxC (Bs)' : 'Saldo Total CxC ($)'}
                  </span>
                  <span className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100 block mt-0.5">
                    {reportCurrency === 'VES'
                      ? formatMoneyVES((receivablesData.summary?.grandTotalUSD || receivablesData.summary?.grandTotal || 0) * bcvRate)
                      : formatMoneyUSD(receivablesData.summary?.grandTotalUSD || receivablesData.summary?.grandTotal || 0)}
                  </span>
                  {reportCurrency === 'BOTH' ? (
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">
                      {formatMoneyVES((receivablesData.summary?.grandTotalUSD || receivablesData.summary?.grandTotal || 0) * bcvRate)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Deuda total pendiente clientes</span>
                  )}
                </div>

                <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-[#28A745] dark:border-l-[#4ADE80]">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                    {reportCurrency === 'VES' ? 'Corriente (Bs)' : 'Corriente ($)'}
                  </span>
                  <span className="text-lg font-bold font-mono text-[#28A745] dark:text-[#4ADE80] block mt-0.5">
                    {reportCurrency === 'VES'
                      ? formatMoneyVES((receivablesData.summary?.totalCurrentUSD || receivablesData.summary?.totalCurrent || 0) * bcvRate)
                      : formatMoneyUSD(receivablesData.summary?.totalCurrentUSD || receivablesData.summary?.totalCurrent || 0)}
                  </span>
                  {reportCurrency === 'BOTH' ? (
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">
                      {formatMoneyVES((receivablesData.summary?.totalCurrentUSD || receivablesData.summary?.totalCurrent || 0) * bcvRate)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Dentro del plazo convenido</span>
                  )}
                </div>

                <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-amber-500">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                    {reportCurrency === 'VES' ? 'Vencido 1 a 30 Días (Bs)' : 'Vencido 1 a 30 Días ($)'}
                  </span>
                  <span className="text-lg font-bold font-mono text-amber-700 dark:text-amber-400 block mt-0.5">
                    {reportCurrency === 'VES'
                      ? formatMoneyVES((receivablesData.summary?.totalDays1_30USD || receivablesData.summary?.totalDays1_30 || 0) * bcvRate)
                      : formatMoneyUSD(receivablesData.summary?.totalDays1_30USD || receivablesData.summary?.totalDays1_30 || 0)}
                  </span>
                  {reportCurrency === 'BOTH' ? (
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">
                      {formatMoneyVES((receivablesData.summary?.totalDays1_30USD || receivablesData.summary?.totalDays1_30 || 0) * bcvRate)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500">En gestión de cobranza</span>
                  )}
                </div>

                <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-red-500">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                    {reportCurrency === 'VES' ? 'Mora Crítica (Bs)' : 'Mora Crítica (+30 Días)'}
                  </span>
                  <span className="text-lg font-bold font-mono text-red-600 dark:text-red-400 block mt-0.5">
                    {reportCurrency === 'VES'
                      ? formatMoneyVES(
                          (Number(receivablesData.summary?.totalDays31_60 || 0) +
                            Number(receivablesData.summary?.totalDays61_90 || 0) +
                            Number(receivablesData.summary?.totalDays90Plus || 0)) *
                            bcvRate
                        )
                      : formatMoneyUSD(
                          Number(receivablesData.summary?.totalDays31_60 || 0) +
                            Number(receivablesData.summary?.totalDays61_90 || 0) +
                            Number(receivablesData.summary?.totalDays90Plus || 0)
                        )}
                  </span>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Riesgo de incobrabilidad</span>
                </div>
              </div>

              <Card
                title={`Cuentas por Cobrar Pendientes (${filteredReceivables.length} créditos)`}
                subtitle="Clasificación de vencimiento por cliente, documento y días de mora"
              >
                <div className="overflow-x-auto mt-2 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3">Cliente</th>
                        <th className="py-2.5 px-3">N° Factura</th>
                        <th className="py-2.5 px-3">Vencimiento</th>
                        <th className="py-2.5 px-3 text-center">Días Mora</th>
                        <th className="py-2.5 px-3 text-right">
                          {reportCurrency === 'VES' ? 'Saldo Pend. (Bs)' : 'Saldo Pend. ($)'}
                        </th>
                        <th className="py-2.5 px-3 text-right">
                          {reportCurrency === 'VES' ? 'Corriente (Bs)' : 'Corriente ($)'}
                        </th>
                        <th className="py-2.5 px-3 text-right">
                          {reportCurrency === 'VES' ? '1-30 Días (Bs)' : '1-30 Días ($)'}
                        </th>
                        <th className="py-2.5 px-3 text-right">
                          {reportCurrency === 'VES' ? '31-60 Días (Bs)' : '31-60 Días ($)'}
                        </th>
                        <th className="py-2.5 px-3 text-right">
                          {reportCurrency === 'VES' ? '+60 Días (Bs)' : '+60 Días ($)'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {filteredReceivables.length > 0 ? (
                        filteredReceivables.map((r: any) => {
                          const balUSD = Number(r.amount_balance || 0);
                          const curUSD = Number(r.current_due || 0);
                          const d30USD = Number(r.days_1_30 || 0);
                          const d60USD = Number(r.days_31_60 || 0);
                          const dPlusUSD = Number(r.days_61_90 || 0) + Number(r.days_90_plus || 0);

                          return (
                            <tr key={r.receivable_id || r.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/60">
                              <td className="py-2.5 px-3">
                                <span className="font-bold text-neutral-900 dark:text-neutral-100 block">
                                  {r.customer_name}
                                </span>
                                <span className="text-[10px] text-neutral-400 font-mono">
                                  {r.doc_type}-{r.doc_number}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-mono font-semibold text-neutral-800 dark:text-neutral-200">
                                {r.invoice_number || '-'}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
                                {r.due_date ? String(r.due_date).slice(0, 10) : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono">
                                <Badge variant={Number(r.days_overdue || 0) > 30 ? 'danger' : Number(r.days_overdue || 0) > 0 ? 'warning' : 'success'}>
                                  {r.days_overdue > 0 ? `${r.days_overdue} d` : 'Al día'}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono">
                                <span className="font-bold text-neutral-900 dark:text-neutral-100 block">
                                  {reportCurrency === 'VES' ? formatMoneyVES(balUSD * bcvRate) : formatMoneyUSD(balUSD)}
                                </span>
                                {reportCurrency === 'BOTH' && (
                                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">
                                    {formatMoneyVES(balUSD * bcvRate)}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono">
                                <span className="text-emerald-700 dark:text-emerald-400 block font-medium">
                                  {reportCurrency === 'VES' ? formatMoneyVES(curUSD * bcvRate) : formatMoneyUSD(curUSD)}
                                </span>
                                {reportCurrency === 'BOTH' && (
                                  <span className="text-[10px] text-neutral-400 block">
                                    {formatMoneyVES(curUSD * bcvRate)}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono">
                                <span className="text-amber-700 dark:text-amber-400 block font-medium">
                                  {reportCurrency === 'VES' ? formatMoneyVES(d30USD * bcvRate) : formatMoneyUSD(d30USD)}
                                </span>
                                {reportCurrency === 'BOTH' && (
                                  <span className="text-[10px] text-neutral-400 block">
                                    {formatMoneyVES(d30USD * bcvRate)}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono">
                                <span className="text-neutral-600 dark:text-neutral-400 block">
                                  {reportCurrency === 'VES' ? formatMoneyVES(d60USD * bcvRate) : formatMoneyUSD(d60USD)}
                                </span>
                                {reportCurrency === 'BOTH' && (
                                  <span className="text-[10px] text-neutral-400 block">
                                    {formatMoneyVES(d60USD * bcvRate)}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono">
                                <span className="font-bold text-red-600 dark:text-red-400 block">
                                  {reportCurrency === 'VES' ? formatMoneyVES(dPlusUSD * bcvRate) : formatMoneyUSD(dPlusUSD)}
                                </span>
                                {reportCurrency === 'BOTH' && (
                                  <span className="text-[10px] text-neutral-400 block">
                                    {formatMoneyVES(dPlusUSD * bcvRate)}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-neutral-400 dark:text-neutral-500">
                            No hay cuentas por cobrar pendientes
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* ============================================================== */}
          {/* REPORTE 8: ANTIGÜEDAD DE DEUDAS (CXP)                          */}
          {/* ============================================================== */}
          {activeTab === 'payables_aging' && payablesData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-[#007BFF] dark:border-l-[#3D91FF]">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                    {reportCurrency === 'VES' ? 'Saldo Total CxP (Bs)' : 'Saldo Total CxP ($)'}
                  </span>
                  <span className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100 block mt-0.5">
                    {reportCurrency === 'VES'
                      ? formatMoneyVES((payablesData.summary?.grandTotalUSD || payablesData.summary?.grandTotal || 0) * bcvRate)
                      : formatMoneyUSD(payablesData.summary?.grandTotalUSD || payablesData.summary?.grandTotal || 0)}
                  </span>
                  {reportCurrency === 'BOTH' ? (
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">
                      {formatMoneyVES((payablesData.summary?.grandTotalUSD || payablesData.summary?.grandTotal || 0) * bcvRate)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Compromisos pendientes proveedores</span>
                  )}
                </div>

                <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-[#28A745] dark:border-l-[#4ADE80]">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                    {reportCurrency === 'VES' ? 'Corriente (Bs)' : 'Corriente ($)'}
                  </span>
                  <span className="text-lg font-bold font-mono text-[#28A745] dark:text-[#4ADE80] block mt-0.5">
                    {reportCurrency === 'VES'
                      ? formatMoneyVES((payablesData.summary?.totalCurrentUSD || payablesData.summary?.totalCurrent || 0) * bcvRate)
                      : formatMoneyUSD(payablesData.summary?.totalCurrentUSD || payablesData.summary?.totalCurrent || 0)}
                  </span>
                  {reportCurrency === 'BOTH' ? (
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">
                      {formatMoneyVES((payablesData.summary?.totalCurrentUSD || payablesData.summary?.totalCurrent || 0) * bcvRate)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Dentro de fecha pactada</span>
                  )}
                </div>

                <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-amber-500">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                    {reportCurrency === 'VES' ? 'Vencido 1 a 30 Días (Bs)' : 'Vencido 1 a 30 Días ($)'}
                  </span>
                  <span className="text-lg font-bold font-mono text-amber-700 dark:text-amber-400 block mt-0.5">
                    {reportCurrency === 'VES'
                      ? formatMoneyVES((payablesData.summary?.totalDays1_30USD || payablesData.summary?.totalDays1_30 || 0) * bcvRate)
                      : formatMoneyUSD(payablesData.summary?.totalDays1_30USD || payablesData.summary?.totalDays1_30 || 0)}
                  </span>
                  {reportCurrency === 'BOTH' ? (
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">
                      {formatMoneyVES((payablesData.summary?.totalDays1_30USD || payablesData.summary?.totalDays1_30 || 0) * bcvRate)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Programar liquidación</span>
                  )}
                </div>

                <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-red-500">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                    {reportCurrency === 'VES' ? 'Vencido > 30 Días (Bs)' : 'Vencido Mayor a 30 Días'}
                  </span>
                  <span className="text-lg font-bold font-mono text-red-600 dark:text-red-400 block mt-0.5">
                    {reportCurrency === 'VES'
                      ? formatMoneyVES(
                          (Number(payablesData.summary?.totalDays31_60 || 0) +
                            Number(payablesData.summary?.totalDays61_90 || 0) +
                            Number(payablesData.summary?.totalDays90Plus || 0)) *
                            bcvRate
                        )
                      : formatMoneyUSD(
                          Number(payablesData.summary?.totalDays31_60 || 0) +
                            Number(payablesData.summary?.totalDays61_90 || 0) +
                            Number(payablesData.summary?.totalDays90Plus || 0)
                        )}
                  </span>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Urgencia de pago</span>
                </div>
              </div>

              <Card
                title={`Cuentas por Pagar a Proveedores (${filteredPayables.length} facturas)`}
                subtitle="Clasificación de vencimiento por proveedor, RIF y días transcurridos"
              >
                <div className="overflow-x-auto mt-2 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3">Proveedor</th>
                        <th className="py-2.5 px-3">N° Factura</th>
                        <th className="py-2.5 px-3">Vencimiento</th>
                        <th className="py-2.5 px-3 text-center">Días Mora</th>
                        <th className="py-2.5 px-3 text-right">
                          {reportCurrency === 'VES' ? 'Saldo Deuda (Bs)' : 'Saldo Deuda ($)'}
                        </th>
                        <th className="py-2.5 px-3 text-right">
                          {reportCurrency === 'VES' ? 'Corriente (Bs)' : 'Corriente ($)'}
                        </th>
                        <th className="py-2.5 px-3 text-right">
                          {reportCurrency === 'VES' ? '1-30 Días (Bs)' : '1-30 Días ($)'}
                        </th>
                        <th className="py-2.5 px-3 text-right">
                          {reportCurrency === 'VES' ? '31-60 Días (Bs)' : '31-60 Días ($)'}
                        </th>
                        <th className="py-2.5 px-3 text-right">
                          {reportCurrency === 'VES' ? '+60 Días (Bs)' : '+60 Días ($)'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {filteredPayables.length > 0 ? (
                        filteredPayables.map((r: any) => {
                          const balUSD = Number(r.amount_balance || 0);
                          const curUSD = Number(r.current_due || 0);
                          const d30USD = Number(r.days_1_30 || 0);
                          const d60USD = Number(r.days_31_60 || 0);
                          const dPlusUSD = Number(r.days_61_90 || 0) + Number(r.days_90_plus || 0);

                          return (
                            <tr key={r.payable_id || r.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/60">
                              <td className="py-2.5 px-3">
                                <span className="font-bold text-neutral-900 dark:text-neutral-100 block">
                                  {r.supplier_name}
                                </span>
                                <span className="text-[10px] text-neutral-400 font-mono">
                                  RIF: {r.rif}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-mono font-semibold text-neutral-800 dark:text-neutral-200">
                                {r.invoice_number || '-'}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
                                {r.due_date ? String(r.due_date).slice(0, 10) : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono">
                                <Badge variant={Number(r.days_overdue || 0) > 30 ? 'danger' : Number(r.days_overdue || 0) > 0 ? 'warning' : 'success'}>
                                  {r.days_overdue > 0 ? `${r.days_overdue} d` : 'Al día'}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono">
                                <span className="font-bold text-neutral-900 dark:text-neutral-100 block">
                                  {reportCurrency === 'VES' ? formatMoneyVES(balUSD * bcvRate) : formatMoneyUSD(balUSD)}
                                </span>
                                {reportCurrency === 'BOTH' && (
                                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">
                                    {formatMoneyVES(balUSD * bcvRate)}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono">
                                <span className="text-emerald-700 dark:text-emerald-400 block font-medium">
                                  {reportCurrency === 'VES' ? formatMoneyVES(curUSD * bcvRate) : formatMoneyUSD(curUSD)}
                                </span>
                                {reportCurrency === 'BOTH' && (
                                  <span className="text-[10px] text-neutral-400 block">
                                    {formatMoneyVES(curUSD * bcvRate)}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono">
                                <span className="text-amber-700 dark:text-amber-400 block font-medium">
                                  {reportCurrency === 'VES' ? formatMoneyVES(d30USD * bcvRate) : formatMoneyUSD(d30USD)}
                                </span>
                                {reportCurrency === 'BOTH' && (
                                  <span className="text-[10px] text-neutral-400 block">
                                    {formatMoneyVES(d30USD * bcvRate)}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono">
                                <span className="text-neutral-600 dark:text-neutral-400 block">
                                  {reportCurrency === 'VES' ? formatMoneyVES(d60USD * bcvRate) : formatMoneyUSD(d60USD)}
                                </span>
                                {reportCurrency === 'BOTH' && (
                                  <span className="text-[10px] text-neutral-400 block">
                                    {formatMoneyVES(d60USD * bcvRate)}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono">
                                <span className="font-bold text-red-600 dark:text-red-400 block">
                                  {reportCurrency === 'VES' ? formatMoneyVES(dPlusUSD * bcvRate) : formatMoneyUSD(dPlusUSD)}
                                </span>
                                {reportCurrency === 'BOTH' && (
                                  <span className="text-[10px] text-neutral-400 block">
                                    {formatMoneyVES(dPlusUSD * bcvRate)}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-neutral-400 dark:text-neutral-500">
                            No hay cuentas por pagar registradas
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* ============================================================== */}
          {/* REPORTE 9: POSICIÓN GLOBAL DE SALDOS Y LIQUIDEZ BANCARIA       */}
          {/* ============================================================== */}
          {activeTab === 'treasury_balances' && treasuryBalancesData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-[#007BFF] dark:border-l-[#3D91FF]">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                    Liquidez Total ($ USD)
                  </span>
                  <span className="text-lg font-bold font-mono text-[#007BFF] dark:text-[#3D91FF] block mt-0.5">
                    {formatMoneyUSD(treasuryBalancesData.summary?.grandTotalUSD || 0)}
                  </span>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                    Tasa BCV: {formatMoneyVES(bcvRate)}
                  </span>
                </div>

                <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-[#28A745] dark:border-l-[#4ADE80]">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                    Liquidez Total (Bs. VES)
                  </span>
                  <span className="text-lg font-bold font-mono text-[#28A745] dark:text-[#4ADE80] block mt-0.5">
                    {formatMoneyVES(treasuryBalancesData.summary?.grandTotalVES || 0)}
                  </span>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Consolidado en moneda nacional</span>
                </div>

                <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-purple-500">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                    Saldos Libros Bolívares
                  </span>
                  <span className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100 block mt-0.5">
                    {formatMoneyVES(treasuryBalancesData.summary?.totalVesBook || 0)}
                  </span>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                    Tránsito: {formatMoneyVES(treasuryBalancesData.summary?.totalVesTransit || 0)}
                  </span>
                </div>

                <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-amber-500">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                    Saldos Libros Dólares
                  </span>
                  <span className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100 block mt-0.5">
                    {formatMoneyUSD(treasuryBalancesData.summary?.totalUsdBook || 0)}
                  </span>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                    Tránsito: {formatMoneyUSD(treasuryBalancesData.summary?.totalUsdTransit || 0)}
                  </span>
                </div>
              </div>

              <Card
                title={`Cuentas Bancarias Operativas (${filteredTreasuryAccounts.length} cuentas)`}
                subtitle="Consolidación de saldos contables, partidas en tránsito y saldo real certificado"
              >
                <div className="overflow-x-auto mt-2 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3">Banco / Entidad</th>
                        <th className="py-2.5 px-3">N° Cuenta</th>
                        <th className="py-2.5 px-3">Tipo / Moneda</th>
                        <th className="py-2.5 px-3 text-right">Saldo en Libros</th>
                        <th className="py-2.5 px-3 text-right">Partidas Tránsito</th>
                        <th className="py-2.5 px-3 text-right">Saldo Real Banco</th>
                        <th className="py-2.5 px-3 text-right">Equivalente BCV</th>
                        <th className="py-2.5 px-3 text-center">Última Conciliación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {filteredTreasuryAccounts.length > 0 ? (
                        filteredTreasuryAccounts.map((acc: any) => {
                          const isVES = acc.currency === 'VES';
                          return (
                            <tr key={acc.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/60">
                              <td className="py-2.5 px-3">
                                <span className="font-bold text-neutral-900 dark:text-neutral-100 block">
                                  {acc.bankName}
                                </span>
                                <span className="text-[10px] text-neutral-400 font-mono">
                                  Código SUDEBAN: {acc.bankCode}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-mono font-semibold text-neutral-800 dark:text-neutral-200">
                                {acc.accountNumber}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-1.5">
                                  <Badge variant={acc.currency === 'USD' ? 'success' : 'neutral'}>
                                    {acc.currency}
                                  </Badge>
                                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                                    {acc.accountType === 'CUSTODY_USD' ? 'Custodia' : acc.accountType === 'SAVINGS' ? 'Ahorro' : 'Corriente'}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-900 dark:text-neutral-100">
                                {isVES ? formatMoneyVES(acc.currentBalance) : formatMoneyUSD(acc.currentBalance)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                                {isVES ? formatMoneyVES(acc.transitBalance) : formatMoneyUSD(acc.transitBalance)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                {isVES ? formatMoneyVES(acc.realBalance) : formatMoneyUSD(acc.realBalance)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-sky-700 dark:text-sky-400">
                                {isVES ? formatMoneyUSD(acc.equivalentUSD) : formatMoneyVES(acc.equivalentVES)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {acc.lastReconciliation ? (
                                  <Badge variant={acc.lastReconciliation.status === 'RECONCILED' ? 'success' : 'warning'}>
                                    {acc.lastReconciliation.periodEnd}
                                  </Badge>
                                ) : (
                                  <span className="text-[10px] text-neutral-400">Sin conciliar</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-neutral-400 dark:text-neutral-500">
                            No se encontraron cuentas bancarias para los criterios seleccionados
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* ============================================================== */}
          {/* REPORTE 10: LIBRO AUXILIAR Y CARTOLA DE MOVIMIENTOS BANCARIOS   */}
          {/* ============================================================== */}
          {activeTab === 'bank_movements' && bankMovementsData && (
            <div className="space-y-4">
              <div className="p-3.5 bg-neutral-50 dark:bg-neutral-800/60 rounded-lg border border-neutral-200 dark:border-neutral-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-sky-100 dark:bg-sky-900/40 text-[#007BFF] dark:text-[#3D91FF] flex items-center justify-center font-bold font-mono text-sm">
                    {bankMovementsData.account?.bankCode}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                      {bankMovementsData.account?.bankName} — Cuenta {bankMovementsData.account?.accountType === 'CUSTODY_USD' ? 'Custodia USD' : 'Corriente'}
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                      N° {bankMovementsData.account?.accountNumber} • Moneda: {bankMovementsData.account?.currency} • Sucursal: {bankMovementsData.account?.branchName}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">
                    Saldo Actual en Libros
                  </span>
                  <span className="text-lg font-bold font-mono text-[#007BFF] dark:text-[#3D91FF]">
                    {bankMovementsData.account?.currency === 'VES'
                      ? formatMoneyVES(bankMovementsData.account?.currentBalance || 0)
                      : formatMoneyUSD(bankMovementsData.account?.currentBalance || 0)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-neutral-400">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                    Saldo Inicial
                  </span>
                  <span className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100 block mt-0.5">
                    {bankMovementsData.account?.currency === 'VES'
                      ? formatMoneyVES(bankMovementsData.summary?.openingBalance || 0)
                      : formatMoneyUSD(bankMovementsData.summary?.openingBalance || 0)}
                  </span>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Saldo previo al período</span>
                </div>

                <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-[#28A745] dark:border-l-[#4ADE80]">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                    Total Ingresos (+)
                  </span>
                  <span className="text-lg font-bold font-mono text-[#28A745] dark:text-[#4ADE80] block mt-0.5">
                    {bankMovementsData.account?.currency === 'VES'
                      ? formatMoneyVES(bankMovementsData.summary?.totalDebits || 0)
                      : formatMoneyUSD(bankMovementsData.summary?.totalDebits || 0)}
                  </span>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Créditos y recaudación</span>
                </div>

                <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-red-500">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                    Total Egresos (-)
                  </span>
                  <span className="text-lg font-bold font-mono text-red-600 dark:text-red-400 block mt-0.5">
                    {bankMovementsData.account?.currency === 'VES'
                      ? formatMoneyVES(bankMovementsData.summary?.totalCredits || 0)
                      : formatMoneyUSD(bankMovementsData.summary?.totalCredits || 0)}
                  </span>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Débitos, retiros y pagos</span>
                </div>

                <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-[#007BFF] dark:border-l-[#3D91FF]">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                    Saldo Final Libros
                  </span>
                  <span className="text-lg font-bold font-mono text-[#007BFF] dark:text-[#3D91FF] block mt-0.5">
                    {bankMovementsData.account?.currency === 'VES'
                      ? formatMoneyVES(bankMovementsData.summary?.closingBalance || 0)
                      : formatMoneyUSD(bankMovementsData.summary?.closingBalance || 0)}
                  </span>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                    {bankMovementsData.summary?.reconciledCount || 0} conciliados • {bankMovementsData.summary?.unreconciledCount || 0} en tránsito
                  </span>
                </div>
              </div>

              <Card
                title={`Movimientos Registrados (${filteredBankMovements.length} operaciones)`}
                subtitle="Cartola de débitos, créditos y saldos progresivos en libros contables"
              >
                <div className="overflow-x-auto mt-2 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3">Fecha / Hora</th>
                        <th className="py-2.5 px-3">Referencia</th>
                        <th className="py-2.5 px-3">Operación</th>
                        <th className="py-2.5 px-3">Concepto / Detalle</th>
                        <th className="py-2.5 px-3 text-right">Ingresos (+)</th>
                        <th className="py-2.5 px-3 text-right">Egresos (-)</th>
                        <th className="py-2.5 px-3 text-center">Estado</th>
                        <th className="py-2.5 px-3 text-right">Saldo Progresivo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {filteredBankMovements.length > 0 ? (
                        filteredBankMovements.map((m: any) => {
                          const isVES = bankMovementsData.account?.currency === 'VES';
                          return (
                            <tr key={m.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/60">
                              <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
                                {m.date}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                                {m.reference}
                              </td>
                              <td className="py-2.5 px-3">
                                <Badge variant="neutral">{m.type}</Badge>
                              </td>
                              <td className="py-2.5 px-3 text-neutral-800 dark:text-neutral-200">
                                <span>{m.concept}</span>
                                <span className="text-[10px] text-neutral-400 block">Op: {m.userName}</span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                {m.debit > 0 ? (isVES ? formatMoneyVES(m.debit) : formatMoneyUSD(m.debit)) : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-red-600 dark:text-red-400">
                                {m.credit > 0 ? (isVES ? formatMoneyVES(m.credit) : formatMoneyUSD(m.credit)) : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <Badge variant={m.isReconciled ? 'success' : 'warning'}>
                                  {m.isReconciled ? 'Conciliado' : 'En Tránsito'}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-900 dark:text-neutral-100">
                                {isVES ? formatMoneyVES(m.balanceAfter) : formatMoneyUSD(m.balanceAfter)}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-neutral-400 dark:text-neutral-500">
                            No se encontraron movimientos registrados en el período seleccionado
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* ============================================================== */}
          {/* REPORTE 11: ACTA OFICIAL DE CONCILIACIÓN BANCARIA CERTIFICADA   */}
          {/* ============================================================== */}
          {activeTab === 'bank_reconciliation' && bankReconciliationData && (
            <div className="space-y-4">
              {/* Banner de Certificación */}
              <div
                className={`p-4 rounded-lg border flex items-center justify-between gap-4 ${
                  bankReconciliationData.isBalanced
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                    : 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold shrink-0 ${
                      bankReconciliationData.isBalanced
                        ? 'bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-100'
                        : 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-100'
                    }`}
                  >
                    {bankReconciliationData.isBalanced ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">
                      {bankReconciliationData.isBalanced
                        ? 'DICTAMEN: CONCILIACIÓN BANCARIA CUADRADA AL 100%'
                        : 'DICTAMEN: EXISTE DISCREPANCIA PENDIENTE DE AJUSTE'}
                    </h3>
                    <p className="text-xs opacity-80">
                      {bankReconciliationData.isBalanced
                        ? 'El saldo bancario ajustado coincide de forma exacta con el saldo según libros de contabilidad (Diferencia: 0.00).'
                        : `Se detectó una discrepancia neta de ${
                            bankReconciliationData.account?.currency === 'VES'
                              ? formatMoneyVES(bankReconciliationData.reconciliation?.difference || 0)
                              : formatMoneyUSD(bankReconciliationData.reconciliation?.difference || 0)
                          } entre el banco y los libros contables.`}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <Badge variant={bankReconciliationData.isBalanced ? 'success' : 'warning'}>
                    {bankReconciliationData.isBalanced ? 'CERTIFICADA' : 'REVISIÓN REQUERIDA'}
                  </Badge>
                  <span className="text-[10px] opacity-70 block mt-1 font-mono">
                    Corte: {bankReconciliationData.reconciliation?.periodEnd}
                  </span>
                </div>
              </div>

              {/* Hoja de Trabajo Contable de Conciliación */}
              <Card
                title="Ecuación Oficial de Conciliación Bancaria"
                subtitle={`Cuenta: [${bankReconciliationData.account?.bankCode}] ${bankReconciliationData.account?.bankName} - N° ${bankReconciliationData.account?.accountNumber}`}
              >
                <div className="max-w-3xl mx-auto space-y-3 py-2 text-xs">
                  <div className="p-3 bg-neutral-50 dark:bg-neutral-800/60 rounded-lg flex items-center justify-between">
                    <div>
                      <span className="font-bold text-neutral-900 dark:text-neutral-100 block">
                        1. Saldo según Estado de Cuenta Bancario
                      </span>
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        Saldo reportado por la institución financiera a la fecha de corte
                      </span>
                    </div>
                    <span className="font-bold font-mono text-sm text-neutral-900 dark:text-neutral-100">
                      {bankReconciliationData.account?.currency === 'VES'
                        ? formatMoneyVES(bankReconciliationData.reconciliation?.statementBalance || 0)
                        : formatMoneyUSD(bankReconciliationData.reconciliation?.statementBalance || 0)}
                    </span>
                  </div>

                  <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg border border-emerald-100 dark:border-emerald-900/30 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-emerald-800 dark:text-emerald-300 block">
                        (+) Depósitos y Cobranzas en Tránsito
                      </span>
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        {bankReconciliationData.unclearedDeposits?.items?.length || 0} depósitos en libros no acreditados por el banco
                      </span>
                    </div>
                    <span className="font-bold font-mono text-sm text-emerald-700 dark:text-emerald-400">
                      + {bankReconciliationData.account?.currency === 'VES'
                        ? formatMoneyVES(bankReconciliationData.unclearedDeposits?.total || 0)
                        : formatMoneyUSD(bankReconciliationData.unclearedDeposits?.total || 0)}
                    </span>
                  </div>

                  <div className="p-3 bg-red-50/50 dark:bg-red-950/20 rounded-lg border border-red-100 dark:border-red-900/30 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-red-800 dark:text-red-300 block">
                        (-) Cheques y Egresos en Tránsito
                      </span>
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        {bankReconciliationData.unclearedWithdrawals?.items?.length || 0} egresos/cheques emitidos no debitados por el banco
                      </span>
                    </div>
                    <span className="font-bold font-mono text-sm text-red-600 dark:text-red-400">
                      - {bankReconciliationData.account?.currency === 'VES'
                        ? formatMoneyVES(bankReconciliationData.unclearedWithdrawals?.total || 0)
                        : formatMoneyUSD(bankReconciliationData.unclearedWithdrawals?.total || 0)}
                    </span>
                  </div>

                  <div className="p-3 bg-sky-50 dark:bg-sky-950/30 rounded-lg border border-sky-200 dark:border-sky-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-[#007BFF] dark:text-[#3D91FF] block">
                        (=) Saldo Bancario Conciliado / Ajustado
                      </span>
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        Disponibilidad bancaria real ajustada con partidas en tránsito
                      </span>
                    </div>
                    <span className="font-bold font-mono text-base text-[#007BFF] dark:text-[#3D91FF]">
                      {bankReconciliationData.account?.currency === 'VES'
                        ? formatMoneyVES(bankReconciliationData.reconciliation?.adjustedBankBalance || 0)
                        : formatMoneyUSD(bankReconciliationData.reconciliation?.adjustedBankBalance || 0)}
                    </span>
                  </div>

                  <div className="p-3 bg-neutral-50 dark:bg-neutral-800/60 rounded-lg flex items-center justify-between">
                    <div>
                      <span className="font-bold text-neutral-900 dark:text-neutral-100 block">
                        2. Saldo según Libros de Contabilidad (Mayor ERP)
                      </span>
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        Saldo registrado en la cuenta de mayor contable a la fecha de corte
                      </span>
                    </div>
                    <span className="font-bold font-mono text-sm text-neutral-900 dark:text-neutral-100">
                      {bankReconciliationData.account?.currency === 'VES'
                        ? formatMoneyVES(bankReconciliationData.reconciliation?.finalBookBalance || 0)
                        : formatMoneyUSD(bankReconciliationData.reconciliation?.finalBookBalance || 0)}
                    </span>
                  </div>

                  <div className="p-3.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-300 dark:border-neutral-700 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-neutral-900 dark:text-neutral-100 block text-sm">
                        (=) Diferencia de Conciliación
                      </span>
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        Saldo Bancario Ajustado menos Saldo según Libros
                      </span>
                    </div>
                    <span
                      className={`font-bold font-mono text-base ${
                        bankReconciliationData.isBalanced
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {bankReconciliationData.account?.currency === 'VES'
                        ? formatMoneyVES(bankReconciliationData.reconciliation?.difference || 0)
                        : formatMoneyUSD(bankReconciliationData.reconciliation?.difference || 0)}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Anexo de Partidas en Tránsito */}
              {((bankReconciliationData.unclearedDeposits?.items?.length || 0) > 0 ||
                (bankReconciliationData.unclearedWithdrawals?.items?.length || 0) > 0) && (
                <Card
                  title="Anexo: Detalle de Partidas en Tránsito al Cierre"
                  subtitle="Operaciones contables pendientes de compensación por la cámara de compensación bancaria"
                >
                  <div className="overflow-x-auto mt-2 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-700">
                        <tr>
                          <th className="py-2.5 px-3">Fecha</th>
                          <th className="py-2.5 px-3">Clasificación</th>
                          <th className="py-2.5 px-3">Referencia</th>
                          <th className="py-2.5 px-3">Concepto</th>
                          <th className="py-2.5 px-3 text-right">Importe</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                        {(bankReconciliationData.unclearedDeposits?.items || []).map((d: any) => (
                          <tr key={d.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/60">
                            <td className="py-2.5 px-3 font-mono">{d.date}</td>
                            <td className="py-2.5 px-3">
                              <Badge variant="success">Depósito en Tránsito</Badge>
                            </td>
                            <td className="py-2.5 px-3 font-mono">{d.reference}</td>
                            <td className="py-2.5 px-3">{d.concept}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                              + {bankReconciliationData.account?.currency === 'VES' ? formatMoneyVES(d.amount) : formatMoneyUSD(d.amount)}
                            </td>
                          </tr>
                        ))}
                        {(bankReconciliationData.unclearedWithdrawals?.items || []).map((w: any) => (
                          <tr key={w.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/60">
                            <td className="py-2.5 px-3 font-mono">{w.date}</td>
                            <td className="py-2.5 px-3">
                              <Badge variant="danger">Egreso en Tránsito</Badge>
                            </td>
                            <td className="py-2.5 px-3 font-mono">{w.reference}</td>
                            <td className="py-2.5 px-3">{w.concept}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-red-600 dark:text-red-400">
                              - {bankReconciliationData.account?.currency === 'VES' ? formatMoneyVES(w.amount) : formatMoneyUSD(w.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* REPORTE 12: FLUJO DE CAJA OPERATIVO DE TESORERÍA               */}
          {/* ============================================================== */}
          {activeTab === 'cash_flow' && cashFlowData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-[#28A745] dark:border-l-[#4ADE80]">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                    Ingresos Operativos Totales ($)
                  </span>
                  <span className="text-lg font-bold font-mono text-[#28A745] dark:text-[#4ADE80] block mt-0.5">
                    {formatMoneyUSD(cashFlowData.summary?.grandTotalInflowsUSD || 0)}
                  </span>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">
                    Bs. {formatMoneyVES(cashFlowData.summary?.totalInflowsVES || 0)}
                  </span>
                </div>

                <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-red-500">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                    Egresos Operativos Totales ($)
                  </span>
                  <span className="text-lg font-bold font-mono text-red-600 dark:text-red-400 block mt-0.5">
                    {formatMoneyUSD(cashFlowData.summary?.grandTotalOutflowsUSD || 0)}
                  </span>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">
                    Bs. {formatMoneyVES(cashFlowData.summary?.totalOutflowsVES || 0)}
                  </span>
                </div>

                <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-[#007BFF] dark:border-l-[#3D91FF]">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                    Flujo Neto Consolidado ($)
                  </span>
                  <span
                    className={`text-lg font-bold font-mono block mt-0.5 ${
                      Number(cashFlowData.summary?.grandNetFlowUSD || 0) >= 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {formatMoneyUSD(cashFlowData.summary?.grandNetFlowUSD || 0)}
                  </span>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                    {Number(cashFlowData.summary?.grandNetFlowUSD || 0) >= 0 ? 'Superávit operativo' : 'Déficit del período'}
                  </span>
                </div>

                <div className="p-3 bg-white dark:bg-[#1E1F21] rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs border-l-4 border-l-amber-500">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider block">
                    Tasa Oficial BCV
                  </span>
                  <span className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100 block mt-0.5">
                    {formatMoneyVES(cashFlowData.bcvRate || bcvRate)}
                  </span>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Conversión bimonetaria</span>
                </div>
              </div>

              {/* Tabla 1: Categorías de Flujo */}
              <Card
                title="Flujo de Caja por Categoría y Concepto"
                subtitle="Clasificación de entradas y salidas operativas en moneda nacional y extranjera"
              >
                <div className="overflow-x-auto mt-2 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-700">
                      <tr>
                        <th className="py-2.5 px-3">Concepto / Categoría Operativa</th>
                        <th className="py-2.5 px-3 text-center">Naturaleza</th>
                        <th className="py-2.5 px-3 text-right">Bolívares (VES)</th>
                        <th className="py-2.5 px-3 text-right">Dólares (USD)</th>
                        <th className="py-2.5 px-3 text-right">Consolidado ($ USD)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {filteredCashFlowCategories.length > 0 ? (
                        filteredCashFlowCategories.map((c: any) => (
                          <tr key={c.key} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/60">
                            <td className="py-2.5 px-3 font-semibold text-neutral-900 dark:text-neutral-100">
                              {c.label}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <Badge variant={c.isOutflow ? 'danger' : 'success'}>
                                {c.isOutflow ? 'Egreso (-)' : 'Ingreso (+)'}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-neutral-700 dark:text-neutral-300">
                              {formatMoneyVES(c.ves)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-neutral-700 dark:text-neutral-300">
                              {formatMoneyUSD(c.usd)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-900 dark:text-neutral-100">
                              {formatMoneyUSD(c.consolidatedUSD)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-neutral-400 dark:text-neutral-500">
                            No se encontraron categorías de flujo registradas
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-neutral-50 dark:bg-neutral-800 font-bold border-t border-neutral-200 dark:border-neutral-700">
                      <tr>
                        <td colSpan={2} className="py-2.5 px-3 text-right">
                          FLUJO NETO DEL PERÍODO:
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {formatMoneyVES(cashFlowData.summary?.netVES || 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {formatMoneyUSD(cashFlowData.summary?.netUSD || 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[#007BFF] dark:text-[#3D91FF]">
                          {formatMoneyUSD(cashFlowData.summary?.grandNetFlowUSD || 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>

              {/* Tabla 2: Evolución Diaria */}
              {cashFlowData.dailyBreakdown && cashFlowData.dailyBreakdown.length > 0 && (
                <Card
                  title="Evolución Cronológica Diaria"
                  subtitle="Detalle de entradas, salidas y flujo neto por fecha operativa"
                >
                  <div className="overflow-x-auto mt-2 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-200 dark:border-neutral-700">
                        <tr>
                          <th className="py-2.5 px-3">Fecha</th>
                          <th className="py-2.5 px-3 text-right">Ingresos (Bs)</th>
                          <th className="py-2.5 px-3 text-right">Egresos (Bs)</th>
                          <th className="py-2.5 px-3 text-right">Neto Diario (Bs)</th>
                          <th className="py-2.5 px-3 text-right">Ingresos ($)</th>
                          <th className="py-2.5 px-3 text-right">Egresos ($)</th>
                          <th className="py-2.5 px-3 text-right">Neto Diario ($)</th>
                          <th className="py-2.5 px-3 text-right">Neto Consolidado ($)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                        {cashFlowData.dailyBreakdown.map((d: any) => (
                          <tr key={d.date} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/60 font-mono">
                            <td className="py-2.5 px-3 font-semibold text-neutral-900 dark:text-neutral-100">
                              {d.date}
                            </td>
                            <td className="py-2.5 px-3 text-right text-emerald-700 dark:text-emerald-400">
                              {formatMoneyVES(d.inflowsVES)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-red-600 dark:text-red-400">
                              {formatMoneyVES(d.outflowsVES)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-neutral-900 dark:text-neutral-100">
                              {formatMoneyVES(d.netVES)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-emerald-700 dark:text-emerald-400">
                              {formatMoneyUSD(d.inflowsUSD)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-red-600 dark:text-red-400">
                              {formatMoneyUSD(d.outflowsUSD)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-neutral-900 dark:text-neutral-100">
                              {formatMoneyUSD(d.netUSD)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-sky-700 dark:text-sky-400">
                              {formatMoneyUSD(d.netConsolidatedUSD)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal Visor Interactivo de PDF Oficial */}
      {isPdfModalOpen && (
        <PdfViewerModal
          isOpen={isPdfModalOpen}
          onClose={() => setIsPdfModalOpen(false)}
          endpoint={getPdfEndpoint()}
          filename={`${getReportName()}.pdf`}
          title={meta.title}
          subtitle={`Orientación: ${
            activeTab === 'bank_reconciliation'
              ? 'Vertical (Portrait)'
              : 'Horizontal (Landscape)'
          }`}
        />
      )}
    </div>
  );
};
