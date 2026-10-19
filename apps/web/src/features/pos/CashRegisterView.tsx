import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { DataTable, Column } from '../../components/ui/DataTable';
import {
  DollarSign,
  FileText,
  Plus,
  Minus,
  Lock,
  Unlock,
  Printer,
  History,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  X,
  CreditCard,
  Building2,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/authStore';
import { FiscalReportModal, FiscalReportData } from './FiscalReportModal';
import { formatNumber, formatCurrency, formatMoneyUSD, formatMoneyVES, parseFormattedNumber } from '@ero/shared';
import { PdfViewerModal } from '../../components/ui/PdfViewerModal';

interface CashRegister {
  id: string;
  branchId: string;
  code: string;
  name: string;
  fiscalPrinterSerial?: string | null;
  invoiceMode: string;
  warehouseId?: string | null;
  warehouseName?: string | null;
  defaultBankAccountIdVES?: string | null;
  defaultBankAccountIdUSD?: string | null;
  isActive: boolean;
  activeShiftId?: string | null;
  activeCashierName?: string | null;
  hasActiveShift: boolean;
}

interface CurrentShiftSummary {
  totalInvoices: number;
  cashSalesUSD: number;
  cashSalesVES: number;
  pagomovilVES: number;
  debitVES: number;
  creditVES?: number;
  posBatchVES?: number;
  zelleUSD: number;
  otherVES?: number;
  otherUSD?: number;
  totalCollectedVES?: number;
  totalCollectedUSD?: number;
  totalIGTFUSD: number;
  inflowsUSD: number;
  outflowsUSD: number;
  inflowsVES: number;
  outflowsVES: number;
}

interface CurrentShift {
  id: string;
  cashRegisterId: string;
  cashRegisterCode: string;
  cashRegisterName: string;
  fiscalPrinterSerial?: string | null;
  invoiceMode: string;
  defaultBankAccountIdVES?: string | null;
  defaultBankAccountIdUSD?: string | null;
  branchId: string;
  userId: string;
  cashierName: string;
  openedAt: string;
  initialCashUSD: number;
  initialCashVES: number;
  expectedCashUSD: number;
  expectedCashVES: number;
  summary: CurrentShiftSummary;
  status: string;
  notes?: string | null;
}

interface BankAccountOption {
  id: string;
  bankName: string;
  accountNumber: string;
  currency: 'USD' | 'VES';
  currentBalance: number;
  description?: string;
}

interface FiscalReportItem {
  id: string;
  reportType: 'X' | 'Z';
  zNumber?: number | null;
  cashRegisterCode: string;
  cashRegisterName: string;
  cashierName: string;
  reportDate: string;
  invoicesCount: number;
  firstInvoiceNumber: string;
  lastInvoiceNumber: string;
  baseExempt: number;
  baseTaxableGeneral: number;
  taxGeneral: number;
  igtfAmount: number;
  totalSales: number;
  rawContent?: string;
}

export const CashRegisterView: React.FC = () => {
  const { activeBranchId, token } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'SHIFT' | 'HISTORY'>('SHIFT');
  const [loading, setLoading] = useState(false);

  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [currentShift, setCurrentShift] = useState<CurrentShift | null>(null);
  const [fiscalReports, setFiscalReports] = useState<FiscalReportItem[]>([]);

  // Determinar si la caja activa (o la sucursal) opera en modalidad fiscal
  const isFiscal = useMemo(() => {
    if (currentShift) {
      return (
        currentShift.invoiceMode === 'fiscal_printer' ||
        Boolean(currentShift.fiscalPrinterSerial && currentShift.fiscalPrinterSerial.trim())
      );
    }
    return registers.some(
      (r) => r.invoiceMode === 'fiscal_printer' || Boolean(r.fiscalPrinterSerial && r.fiscalPrinterSerial.trim())
    );
  }, [currentShift, registers]);

  // Si la caja no es fiscal y estaba en la pestaña de historial fiscal, regresar a turno
  useEffect(() => {
    if (!isFiscal && activeTab === 'HISTORY') {
      setActiveTab('SHIFT');
    }
  }, [isFiscal, activeTab]);

  // Modales
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showFiscalModal, setShowFiscalModal] = useState(false);
  const [activeFiscalReport, setActiveFiscalReport] = useState<FiscalReportData | null>(null);
  const [pdfModal, setPdfModal] = useState<{
    isOpen: boolean;
    endpoint: string | null;
    title: string;
    filename?: string;
  }>({
    isOpen: false,
    endpoint: null,
    title: '',
  });

  // Form State: Apertura de Turno
  const [openRegisterId, setOpenRegisterId] = useState('');
  const [openInitialUSD, setOpenInitialUSD] = useState<number>(0);
  const [openInitialVES, setOpenInitialVES] = useState<number>(0);
  const [openNotes, setOpenNotes] = useState('');

  // Form State: Cierre de Turno y Depósito a Bancos
  const [countedCashUSD, setCountedCashUSD] = useState<number>(0);
  const [countedCashVES, setCountedCashVES] = useState<number>(0);
  const [closeNotes, setCloseNotes] = useState('');

  // Cuentas Bancarias de Tesorería para Depósito
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [depositBankAccountIdVES, setDepositBankAccountIdVES] = useState<string>('');
  const [depositAmountVES, setDepositAmountVES] = useState<number>(0);
  const [depositAmountVESInput, setDepositAmountVESInput] = useState<string>('0');
  const [depositReferenceVES, setDepositReferenceVES] = useState<string>('');
  const [depositBankAccountIdUSD, setDepositBankAccountIdUSD] = useState<string>('');
  const [depositAmountUSD, setDepositAmountUSD] = useState<number>(0);
  const [depositAmountUSDInput, setDepositAmountUSDInput] = useState<string>('0');
  const [depositReferenceUSD, setDepositReferenceUSD] = useState<string>('');

  // Form State: Movimiento Manual
  const [movementType, setMovementType] = useState<'INFLOW' | 'OUTFLOW'>('OUTFLOW');
  const [movementCurrency, setMovementCurrency] = useState<'USD' | 'VES'>('USD');
  const [movementAmount, setMovementAmount] = useState<number>(0);
  const [movementReason, setMovementReason] = useState('');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCurrentState();
  }, [activeBranchId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showFiscalModal) setShowFiscalModal(false);
        else if (showMovementModal) setShowMovementModal(false);
        else if (showCloseShiftModal) setShowCloseShiftModal(false);
        else if (showOpenShiftModal) setShowOpenShiftModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showFiscalModal, showMovementModal, showCloseShiftModal, showOpenShiftModal]);

  const fetchCurrentState = async () => {
    setLoading(true);
    try {
      const branchParam = activeBranchId ? `?branchId=${activeBranchId}` : '';
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

      // 1. Cajas
      let currentRegs: CashRegister[] = [];
      const regRes = await fetch(`/api/pos/registers${branchParam}`, { headers });
      if (regRes.ok) {
        const json = await regRes.json();
        if (json.success && json.data) {
          currentRegs = json.data;
          setRegisters(currentRegs);
        }
      }

      // 2. Turno Actual
      let currShift: CurrentShift | null = null;
      const shiftRes = await fetch(`/api/pos/shifts/current${branchParam}`, { headers });
      if (shiftRes.ok) {
        const json = await shiftRes.json();
        if (json.success) {
          currShift = json.data || null;
          setCurrentShift(currShift);
          if (json.data) {
            const expUSD = json.data.expectedCashUSD || 0;
            const expVES = json.data.expectedCashVES || 0;
            const posVES = json.data.summary?.posBatchVES || ((json.data.summary?.debitVES || 0) + (json.data.summary?.creditVES || 0));
            const totalVES = json.data.summary?.totalCollectedVES || (expVES + posVES + (json.data.summary?.pagomovilVES || 0));
            setCountedCashUSD(expUSD);
            setCountedCashVES(expVES);
            setDepositAmountUSD(expUSD);
            setDepositAmountUSDInput(String(expUSD));
            const initDepositVES = expVES > 0 ? expVES : (posVES > 0 ? posVES : totalVES);
            setDepositAmountVES(initDepositVES);
            setDepositAmountVESInput(String(initDepositVES));
            if (json.data.defaultBankAccountIdVES) {
              setDepositBankAccountIdVES(json.data.defaultBankAccountIdVES);
            }
            if (json.data.defaultBankAccountIdUSD) {
              setDepositBankAccountIdUSD(json.data.defaultBankAccountIdUSD);
            }
          }
        }
      }

      // 3. Historial de Reportes Fiscales (solo si la caja/turno es fiscal)
      const isShiftFiscal = currShift
        ? (currShift.invoiceMode === 'fiscal_printer' || Boolean(currShift.fiscalPrinterSerial && currShift.fiscalPrinterSerial.trim()))
        : currentRegs.some((r) => r.invoiceMode === 'fiscal_printer' || Boolean(r.fiscalPrinterSerial && r.fiscalPrinterSerial.trim()));

      if (isShiftFiscal) {
        const repRes = await fetch(`/api/pos/fiscal-reports${branchParam}`, { headers });
        if (repRes.ok) {
          const json = await repRes.json();
          if (json.success && json.data) setFiscalReports(json.data);
        }
      } else {
        setFiscalReports([]);
      }

      // 4. Cuentas Bancarias de Tesorería para Depósitos
      const accRes = await fetch('/api/treasury/accounts', { headers });
      if (accRes.ok) {
        const json = await accRes.json();
        if (json.success && Array.isArray(json.data)) {
          setBankAccounts(json.data);
        }
      }
    } catch {
      setRegisters([]);
      setCurrentShift(null);
      setFiscalReports([]);
    } finally {
      setLoading(false);
    }
  };

  // Apertura de turno
  const handleOpenShift = async () => {
    if (!openRegisterId) {
      toast.error('Debe seleccionar una caja registradora');
      return;
    }
    const selectedRegister = registers.find((r) => r.id === openRegisterId);
    if (selectedRegister?.hasActiveShift) {
      toast.error(`La caja ${selectedRegister.code} ya tiene un turno abierto por ${selectedRegister.activeCashierName || 'otro cajero'}`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/pos/shifts/open', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          cashRegisterId: openRegisterId,
          branchId: activeBranchId || selectedRegister?.branchId || 'b1111111-1111-1111-1111-111111111111',
          initialCashUSD: Number(openInitialUSD) || 0,
          initialCashVES: Number(openInitialVES) || 0,
          notes: openNotes || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.message || 'Error al abrir el turno');
      }

      toast.success('Turno de caja abierto correctamente');
      setShowOpenShiftModal(false);
      fetchCurrentState();
    } catch (err: any) {
      toast.error(err.message || 'Error al abrir turno');
    } finally {
      setSubmitting(false);
    }
  };

  // Cierre de turno
  const handleCloseShift = async () => {
    if (!currentShift) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/pos/shifts/close', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          shiftId: currentShift.id,
          finalCashUSDCounted: Number(countedCashUSD) || 0,
          finalCashVESCounted: Number(countedCashVES) || 0,
          notes: closeNotes || null,
          depositBankAccountIdVES: depositBankAccountIdVES || null,
          depositAmountVES: Number(depositAmountVES) || 0,
          depositReferenceVES: depositReferenceVES.trim() || null,
          depositBankAccountIdUSD: depositBankAccountIdUSD || null,
          depositAmountUSD: Number(depositAmountUSD) || 0,
          depositReferenceUSD: depositReferenceUSD.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Error al cerrar el turno');
      }

      const closedShiftId = currentShift.id;
      toast.success('Turno cerrado exitosamente con arqueo y depósitos registrados en tesorería');
      setShowCloseShiftModal(false);
      fetchCurrentState();

      // Abrir inmediatamente el comprobante PDF de Cierre y Arqueo de Caja resultante
      setPdfModal({
        isOpen: true,
        endpoint: `/api/pos/shifts/${closedShiftId}/pdf`,
        title: 'Acta Oficial de Cierre y Arqueo de Caja',
        filename: `cierre_caja_${closedShiftId}.pdf`,
      });
    } catch (err: any) {
      toast.error(err.message || 'Error al cerrar turno');
    } finally {
      setSubmitting(false);
    }
  };

  // Registrar Movimiento Manual
  const handleRegisterMovement = async () => {
    if (!currentShift) return;
    if (movementAmount <= 0) {
      toast.error('El monto del movimiento debe ser mayor a 0');
      return;
    }
    if (!movementReason.trim()) {
      toast.error('Debe indicar el motivo o concepto del movimiento');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/pos/shifts/movements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          shiftId: currentShift.id,
          type: movementType,
          currency: movementCurrency,
          amount: Number(movementAmount),
          reason: movementReason.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Error al registrar movimiento');
      }

      toast.success('Movimiento registrado en caja');
      setShowMovementModal(false);
      setMovementAmount(0);
      setMovementReason('');
      fetchCurrentState();
    } catch (err: any) {
      toast.error(err.message || 'Error al registrar movimiento');
    } finally {
      setSubmitting(false);
    }
  };

  // Generar Reporte X o Z
  const handleGenerateFiscalReport = async (reportType: 'X' | 'Z') => {
    if (!currentShift) {
      toast.error('No hay un turno activo para emitir el reporte fiscal');
      return;
    }
    if (!isFiscal) {
      toast.error('Esta caja registradora no está configurada como fiscal');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/pos/fiscal-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          cashRegisterId: currentShift.cashRegisterId,
          branchId: currentShift.branchId,
          shiftId: currentShift.id,
          reportType,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Error al emitir reporte fiscal');
      }

      toast.success(
        reportType === 'Z'
          ? 'Reporte Z (Cierre Diario SENIAT) emitido y auditado'
          : 'Reporte X (Corte Parcial) generado con éxito'
      );

      setActiveFiscalReport(json.data);
      setShowFiscalModal(true);
      fetchCurrentState();
    } catch (err: any) {
      toast.error(err.message || 'Error al generar reporte fiscal');
    } finally {
      setSubmitting(false);
    }
  };

  // Cálculo de diferencia de arqueo en el modal de cierre
  const diffUSD = currentShift ? Number((countedCashUSD - currentShift.expectedCashUSD).toFixed(2)) : 0;
  const diffVES = currentShift ? Number((countedCashVES - currentShift.expectedCashVES).toFixed(2)) : 0;

  // Columnas para el historial de reportes fiscales
  const reportColumns: Column<FiscalReportItem>[] = [
    {
      header: 'Fecha / Hora',
      accessorKey: 'reportDate',
      cell: (r) => (
        <div className="flex flex-col text-xs">
          <span className="font-semibold text-neutral-800">
            {new Date(r.reportDate).toLocaleDateString('es-VE')}
          </span>
          <span className="text-[11px] text-neutral-400">
            {new Date(r.reportDate).toLocaleTimeString('es-VE')}
          </span>
        </div>
      ),
    },
    {
      header: 'Tipo',
      accessorKey: 'reportType',
      cell: (r) => (
        <Badge variant={r.reportType === 'Z' ? 'danger' : 'info'}>
          {r.reportType === 'Z' ? `Reporte Z ${r.zNumber ? `(Z-${r.zNumber.toString().padStart(4, '0')})` : ''}` : 'Reporte X'}
        </Badge>
      ),
    },
    {
      header: 'Caja / Cajero',
      cell: (r) => (
        <div className="flex flex-col text-xs">
          <span className="font-medium text-neutral-900">{r.cashRegisterCode}</span>
          <span className="text-[11px] text-neutral-500">{r.cashierName}</span>
        </div>
      ),
    },
    {
      header: 'Facturas',
      cell: (r) => (
        <div className="flex flex-col text-xs font-mono">
          <span>{r.firstInvoiceNumber} al {r.lastInvoiceNumber}</span>
          <span className="text-[10px] text-neutral-400">{r.invoicesCount} doc(s)</span>
        </div>
      ),
    },
    {
      header: 'Base Imp. (16%)',
      accessorKey: 'baseTaxableGeneral',
      cell: (r) => <span className="font-mono text-xs">{formatMoneyUSD(r.baseTaxableGeneral)}</span>,
    },
    {
      header: 'IVA (16%)',
      accessorKey: 'taxGeneral',
      cell: (r) => <span className="font-mono text-xs">{formatMoneyUSD(r.taxGeneral)}</span>,
    },
    {
      header: 'IGTF (3%)',
      accessorKey: 'igtfAmount',
      cell: (r) => <span className="font-mono text-xs">{formatMoneyUSD(r.igtfAmount)}</span>,
    },
    {
      header: 'Total Ventas',
      accessorKey: 'totalSales',
      cell: (r) => <span className="font-mono font-bold text-xs text-neutral-900">{formatMoneyUSD(r.totalSales)}</span>,
    },
    {
      header: 'Acción',
      cell: (r) => (
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setPdfModal({
                isOpen: true,
                endpoint: `/api/pos/shifts/${r.id}/pdf`,
                title: `Acta Fiscal de Caja (${r.reportType})`,
                filename: `acta_fiscal_${r.reportType}_${r.id}.pdf`,
              })
            }
            title="Descargar o Ver Acta en PDF"
            className="h-8 px-2 text-xs text-sky-700 hover:text-sky-800"
          >
            <FileText className="w-3.5 h-3.5 mr-1 text-sky-600" />
            PDF
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setActiveFiscalReport({
                reportType: r.reportType,
                zNumber: r.zNumber,
                cashRegisterCode: r.cashRegisterCode,
                fiscalPrinterSerial: 'Z1B89201928',
                reportDate: r.reportDate,
                invoicesCount: r.invoicesCount,
                firstInvoiceNumber: r.firstInvoiceNumber,
                lastInvoiceNumber: r.lastInvoiceNumber,
                baseExempt: r.baseExempt,
                baseTaxableGeneral: r.baseTaxableGeneral,
                taxGeneral: r.taxGeneral,
                igtfAmount: r.igtfAmount,
                totalSales: r.totalSales,
                formattedText: r.rawContent,
              });
              setShowFiscalModal(true);
            }}
          >
            <Printer className="w-3.5 h-3.5 mr-1" />
            Ver Ticket
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
              {isFiscal ? 'Cierre de Caja & Arqueo Fiscal (SENIAT)' : 'Cierre de Caja & Arqueo'}
            </h1>
            {currentShift ? (
              <Badge variant="success">TURNO ABIERTO</Badge>
            ) : (
              <Badge variant="neutral">CAJA CERRADA</Badge>
            )}
            {!isFiscal && currentShift && (
              <Badge variant="neutral" className="text-xs">NO FISCAL</Badge>
            )}
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            {isFiscal
              ? 'Arqueo de efectivo en divisas y bolívares, control de turnos y emisión de Reportes X / Z homologados.'
              : 'Arqueo de efectivo en divisas y bolívares y control de turnos de caja.'}
          </p>
        </div>

        {/* Botones de Acción Global */}
        <div className="flex items-center gap-2">
          {currentShift ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMovementModal(true)}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Movimiento de Caja
              </Button>
              {isFiscal && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={submitting}
                    onClick={() => handleGenerateFiscalReport('X')}
                  >
                    <Printer className="w-4 h-4 mr-1.5" />
                    Emitir Reporte X
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={submitting}
                    onClick={() => handleGenerateFiscalReport('Z')}
                    className="text-red-700 border-red-200 hover:bg-red-50"
                  >
                    <Printer className="w-4 h-4 mr-1.5" />
                    Reporte Z (SENIAT)
                  </Button>
                </>
              )}
              <Button
                size="sm"
                onClick={() => {
                  const expUSD = currentShift.expectedCashUSD || 0;
                  const expVES = currentShift.expectedCashVES || 0;
                  const posVES = currentShift.summary?.posBatchVES || ((currentShift.summary?.debitVES || 0) + (currentShift.summary?.creditVES || 0));
                  const totalVES = currentShift.summary?.totalCollectedVES || (expVES + posVES + (currentShift.summary?.pagomovilVES || 0));
                  setCountedCashUSD(expUSD);
                  setCountedCashVES(expVES);
                  setDepositAmountUSD(expUSD);
                  setDepositAmountUSDInput(String(expUSD));
                  const initVES = expVES > 0 ? expVES : (posVES > 0 ? posVES : totalVES);
                  setDepositAmountVES(initVES);
                  setDepositAmountVESInput(String(initVES));
                  setShowCloseShiftModal(true);
                }}
              >
                <Lock className="w-4 h-4 mr-1.5" />
                Arqueo & Cierre
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setPdfModal({
                    isOpen: true,
                    endpoint: `/api/pos/shifts/${currentShift.id}/pdf`,
                    title: `Acta de Caja - Turno ${currentShift.cashRegisterCode}`,
                    filename: `acta_caja_${currentShift.cashRegisterCode}.pdf`,
                  })
                }
                title="Ver / Imprimir Acta Oficial de Caja en PDF"
              >
                <FileText className="w-4 h-4 mr-1.5 text-sky-600" />
                Acta PDF
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                const available = registers.find((r) => !r.hasActiveShift);
                if (available) {
                  setOpenRegisterId(available.id);
                } else if (registers.length > 0) {
                  setOpenRegisterId(registers[0].id);
                }
                setShowOpenShiftModal(true);
              }}
            >
              <Unlock className="w-4 h-4 mr-1.5" />
              Abrir Turno de Caja
            </Button>
          )}
        </div>
      </div>

      {/* Tabs (Solo se muestra selector si la caja es fiscal para poder acceder a su historial) */}
      {isFiscal && (
        <div className="flex border-b border-neutral-200 text-xs font-semibold gap-6">
          <button
            onClick={() => setActiveTab('SHIFT')}
            className={`pb-2.5 transition-colors border-b-2 ${
              activeTab === 'SHIFT'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            Estado del Turno & Arqueo en Vivo
          </button>
          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`pb-2.5 transition-colors border-b-2 ${
              activeTab === 'HISTORY'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            Historial de Reportes Fiscales (X / Z)
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <div className="h-28 bg-neutral-200 rounded-lg animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="h-24 bg-neutral-200 rounded-lg animate-pulse" />
            <div className="h-24 bg-neutral-200 rounded-lg animate-pulse" />
            <div className="h-24 bg-neutral-200 rounded-lg animate-pulse" />
            <div className="h-24 bg-neutral-200 rounded-lg animate-pulse" />
          </div>
        </div>
      ) : activeTab === 'SHIFT' ? (
        currentShift ? (
          <div className="space-y-6">
            {/* Banner Informativo del Turno */}
            <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold">
                  {currentShift.cashRegisterCode}
                </div>
                <div>
                  <div className="font-bold text-neutral-900 text-sm">
                    {currentShift.cashRegisterName}
                  </div>
                  <div className="text-neutral-600">
                    Cajero: <span className="font-semibold">{currentShift.cashierName}</span> • Apertura:{' '}
                    <span className="font-mono">{new Date(currentShift.openedAt).toLocaleTimeString('es-VE')}</span>
                    {isFiscal ? (
                      <>
                        {' '}• Serial Fiscal:{' '}
                        <span className="font-mono">{currentShift.fiscalPrinterSerial || 'N/A'}</span>
                      </>
                    ) : (
                      <>
                        {' '}• Modalidad: <span className="font-medium text-neutral-700">No Fiscal</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-neutral-700">
                <div>
                  <span className="text-neutral-500">Saldo Inicial USD:</span>{' '}
                  <span className="font-mono font-bold text-neutral-900">{formatMoneyUSD(currentShift.initialCashUSD)}</span>
                </div>
                <div>
                  <span className="text-neutral-500">Saldo Inicial Bs:</span>{' '}
                  <span className="font-mono font-bold text-neutral-900">{formatMoneyVES(currentShift.initialCashVES)}</span>
                </div>
              </div>
            </div>

            {/* Tarjetas de Métricas de Recaudación */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4 space-y-1">
                <span className="text-xs text-neutral-500">Efectivo en Divisas (Esperado)</span>
                <div className="text-xl font-bold font-mono text-emerald-600">
                  {formatMoneyUSD(currentShift.expectedCashUSD)}
                </div>
                <div className="text-[11px] text-neutral-400">
                  Ventas: {formatMoneyUSD(currentShift.summary.cashSalesUSD)} • Salidas: -{formatMoneyUSD(currentShift.summary.outflowsUSD)}
                </div>
              </Card>

              <Card className="p-4 space-y-1">
                <span className="text-xs text-neutral-500">Efectivo en Bolívares (Esperado)</span>
                <div className="text-xl font-bold font-mono text-emerald-600">
                  {formatMoneyVES(currentShift.expectedCashVES)}
                </div>
                <div className="text-[11px] text-neutral-400">
                  Ventas en Bs físico en caja
                </div>
              </Card>

              <Card className="p-4 space-y-1">
                <span className="text-xs text-neutral-500">Pagos Digitales en Bs</span>
                <div className="text-xl font-bold font-mono text-sky-700">
                  {formatMoneyVES(currentShift.summary.pagomovilVES + currentShift.summary.debitVES)}
                </div>
                <div className="text-[11px] text-neutral-400">
                  Pago Móvil: {formatMoneyVES(currentShift.summary.pagomovilVES)} • Débito: {formatMoneyVES(currentShift.summary.debitVES)}
                </div>
              </Card>

              <Card className="p-4 space-y-1">
                <span className="text-xs text-neutral-500">Zelle / IGTF Divisas</span>
                <div className="text-xl font-bold font-mono text-indigo-700">
                  {formatMoneyUSD(currentShift.summary.zelleUSD)}
                </div>
                <div className="text-[11px] text-neutral-400">
                  IGTF 3% recaudado: {formatMoneyUSD(currentShift.summary.totalIGTFUSD)}
                </div>
              </Card>
            </div>

            {/* Detalle de Métodos de Pago y Desglose */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Desglose por Método de Pago */}
              <Card className="p-5 space-y-4">
                <h3 className="text-sm font-bold text-neutral-900 border-b border-neutral-100 pb-2">
                  Desglose por Método de Cobro en el Turno
                </h3>
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b border-neutral-50">
                    <span className="text-neutral-600">Efectivo Divisas ($)</span>
                    <span className="font-mono font-semibold">{formatMoneyUSD(currentShift.summary.cashSalesUSD)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-neutral-50">
                    <span className="text-neutral-600">Efectivo Bolívares (Bs en Gaveta)</span>
                    <span className="font-mono font-semibold text-emerald-700">{formatMoneyVES(currentShift.summary.cashSalesVES)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-neutral-50">
                    <span className="text-neutral-600">Punto de Venta - Tarjeta de Débito</span>
                    <span className="font-mono font-semibold">{formatMoneyVES(currentShift.summary.debitVES)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-neutral-50">
                    <span className="text-neutral-600">Punto de Venta - Tarjeta de Crédito</span>
                    <span className="font-mono font-semibold">{formatMoneyVES(currentShift.summary.creditVES || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-neutral-50 bg-sky-50/60 px-2 rounded">
                    <span className="font-bold text-sky-900">Lote Consolidado Punto de Venta (POS):</span>
                    <span className="font-mono font-bold text-sky-800">
                      {formatMoneyVES(currentShift.summary.posBatchVES || ((currentShift.summary.debitVES || 0) + (currentShift.summary.creditVES || 0)))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-neutral-50">
                    <span className="text-neutral-600">Pago Móvil Bancario</span>
                    <span className="font-mono font-semibold">{formatMoneyVES(currentShift.summary.pagomovilVES)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-neutral-50">
                    <span className="text-neutral-600">Transferencia / Zelle ($)</span>
                    <span className="font-mono font-semibold">{formatMoneyUSD(currentShift.summary.zelleUSD)}</span>
                  </div>
                  {((currentShift.summary.otherVES || 0) > 0 || (currentShift.summary.otherUSD || 0) > 0) && (
                    <div className="flex items-center justify-between py-1.5 border-b border-neutral-50">
                      <span className="text-neutral-600">Otros Medios de Pago</span>
                      <span className="font-mono font-semibold">
                        {(currentShift.summary.otherVES || 0) > 0 ? formatMoneyVES(currentShift.summary.otherVES) : ''}
                        {(currentShift.summary.otherUSD || 0) > 0 ? ` ${formatMoneyUSD(currentShift.summary.otherUSD)}` : ''}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-neutral-200 font-bold text-neutral-900">
                    <span>Total Recaudado en Bolívares (VES):</span>
                    <span className="font-mono text-indigo-700 font-extrabold text-sm">
                      {formatMoneyVES(currentShift.summary.totalCollectedVES || (currentShift.summary.cashSalesVES + (currentShift.summary.posBatchVES || 0) + currentShift.summary.pagomovilVES))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-neutral-100 font-medium text-neutral-600">
                    <span>Documentos / Facturas Emitidas:</span>
                    <span className="font-mono font-semibold">{currentShift.summary.totalInvoices} operaciones</span>
                  </div>
                </div>
              </Card>

              {/* Movimientos de Caja Registrados */}
              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                  <h3 className="text-sm font-bold text-neutral-900">
                    Movimientos Manuales (Entradas y Salidas)
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowMovementModal(true)}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Registrar
                  </Button>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b border-neutral-50">
                    <div className="flex items-center gap-2">
                      <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                      <span>Entradas de Efectivo (USD)</span>
                    </div>
                    <span className="font-mono text-emerald-600">+{formatMoneyUSD(currentShift.summary.inflowsUSD)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-neutral-50">
                    <div className="flex items-center gap-2">
                      <ArrowUpRight className="w-4 h-4 text-amber-600" />
                      <span>Salidas de Efectivo (USD)</span>
                    </div>
                    <span className="font-mono text-amber-600">-{formatMoneyUSD(currentShift.summary.outflowsUSD)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-neutral-50">
                    <div className="flex items-center gap-2">
                      <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                      <span>Entradas de Efectivo (VES)</span>
                    </div>
                    <span className="font-mono text-emerald-600">+{formatMoneyVES(currentShift.summary.inflowsVES)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-neutral-50">
                    <div className="flex items-center gap-2">
                      <ArrowUpRight className="w-4 h-4 text-amber-600" />
                      <span>Salidas de Efectivo (VES)</span>
                    </div>
                    <span className="font-mono text-amber-600">-{formatMoneyVES(currentShift.summary.outflowsVES)}</span>
                  </div>
                  <div className="p-3 bg-neutral-50 rounded-lg text-neutral-500 text-[11px] leading-relaxed">
                    Nota: Los movimientos de caja afectan directamente el saldo teórico esperado en gaveta durante el arqueo final.
                  </div>
                </div>
              </Card>
            </div>
          </div>
        ) : (
          <Card className="p-12 text-center flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">No hay ningún turno de caja abierto</h3>
              <p className="text-xs text-neutral-500 max-w-sm mt-1">
                {isFiscal
                  ? 'Para comenzar a facturar en el Punto de Venta y emitir tickets fiscales SENIAT, debes realizar la apertura de turno indicando el fondo de caja inicial.'
                  : 'Para comenzar a facturar en el Punto de Venta, debes realizar la apertura de turno indicando el fondo de caja inicial.'}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                if (registers.length > 0) setOpenRegisterId(registers[0].id);
                setShowOpenShiftModal(true);
              }}
            >
              <Unlock className="w-4 h-4 mr-1.5" />
              Abrir Turno de Caja Ahora
            </Button>
          </Card>
        )
      ) : (
        /* Pestaña: Historial de Reportes Fiscales */
        <Card className="p-4">
          <DataTable
            data={fiscalReports}
            columns={reportColumns}
            searchPlaceholder="Buscar por N° reporte, caja o cajero..."
            searchKey="cashRegisterCode"
          />
        </Card>
      )}

      {/* Modal: Apertura de Turno */}
      {showOpenShiftModal && (
        <div className="fixed inset-0 bg-neutral-900/60 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[92vh] shadow-2xl flex flex-col overflow-hidden border border-neutral-200 my-auto">
            {/* Header (Pinned) */}
            <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <Unlock className="w-5 h-5 text-sky-600" />
                <h3 className="text-sm font-bold text-neutral-900">Apertura de Turno de Caja</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowOpenShiftModal(false)}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg hover:bg-neutral-100 cursor-pointer"
                title="Cerrar modal (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Caja Registradora</label>
                <select
                  value={openRegisterId}
                  onChange={(e) => setOpenRegisterId(e.target.value)}
                  className="w-full h-9 px-3 border border-neutral-300 rounded-lg text-xs bg-white"
                >
                  <option value="">Seleccione una caja...</option>
                  {registers.map((r) => {
                    const isRegFiscal = r.invoiceMode === 'fiscal_printer' || Boolean(r.fiscalPrinterSerial && r.fiscalPrinterSerial.trim());
                    return (
                      <option key={r.id} value={r.id} disabled={r.hasActiveShift}>
                        {r.code} - {r.name} ({isRegFiscal ? 'Fiscal' : 'No Fiscal'}) [Almacén: {r.warehouseName || 'Principal'}] {r.hasActiveShift ? `(Ocupada por ${r.activeCashierName || 'otro cajero'})` : '(Disponible)'}
                      </option>
                    );
                  })}
                </select>
                {openRegisterId && (
                  <p className="text-[11px] text-neutral-500 mt-1">
                    Almacén de descarga de stock: <strong>{registers.find((r) => r.id === openRegisterId)?.warehouseName || 'Almacén Principal'}</strong>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Fondo Inicial USD ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={openInitialUSD}
                    onChange={(e) => setOpenInitialUSD(parseFloat(e.target.value) || 0)}
                    className="w-full h-9 px-3 border border-neutral-300 rounded-lg text-xs font-mono"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Fondo Inicial VES (Bs)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={openInitialVES}
                    onChange={(e) => setOpenInitialVES(parseFloat(e.target.value) || 0)}
                    className="w-full h-9 px-3 border border-neutral-300 rounded-lg text-xs font-mono"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Observaciones / Notas</label>
                <input
                  type="text"
                  value={openNotes}
                  onChange={(e) => setOpenNotes(e.target.value)}
                  className="w-full h-9 px-3 border border-neutral-300 rounded-lg text-xs"
                  placeholder="Ej: Turno mañana, billetes de baja denominación para cambio"
                />
              </div>
            </div>

            {/* Footer (Pinned) */}
            <div className="px-5 py-3.5 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowOpenShiftModal(false)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={submitting || !openRegisterId}
                onClick={handleOpenShift}
              >
                Abrir Turno
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Arqueo y Cierre de Turno */}
      {showCloseShiftModal && currentShift && (
        <div className="fixed inset-0 bg-neutral-900/60 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-xl w-full max-h-[92vh] shadow-2xl flex flex-col overflow-hidden border border-neutral-200 my-auto">
            {/* Header (Pinned) */}
            <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-neutral-800" />
                <h3 className="text-sm font-bold text-neutral-900">Arqueo y Cierre de Turno de Caja</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCloseShiftModal(false)}
                className="text-neutral-400 hover:text-neutral-600 focus-visible:ring-2 focus-visible:ring-sky-500 rounded-lg p-1 hover:bg-neutral-100 cursor-pointer"
                title="Cerrar modal (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              <p className="text-neutral-600">
                Ingrese el conteo físico real de billetes en gaveta. El sistema contrastará contra el saldo teórico de ventas y movimientos registrados.
              </p>

              {/* Conteo USD */}
              <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-2">
                <div className="flex justify-between items-center font-semibold text-neutral-700">
                  <span>Efectivo Divisas ($)</span>
                  <span className="font-mono text-neutral-500">Esperado: {formatMoneyUSD(currentShift.expectedCashUSD)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="text-[11px] text-neutral-500">Monto Contado ($):</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={countedCashUSD}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setCountedCashUSD(val);
                        setDepositAmountUSD(val);
                      }}
                      className="w-full h-9 px-3 border border-neutral-300 rounded-lg text-xs font-mono font-bold focus-visible:ring-2 focus-visible:ring-sky-500"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-neutral-500 block mb-1">Diferencia:</span>
                    <Badge variant={diffUSD === 0 ? 'success' : diffUSD > 0 ? 'info' : 'danger'}>
                      {diffUSD === 0 ? `Cuadrado (${formatMoneyUSD(0)})` : diffUSD > 0 ? `Sobrante +${formatMoneyUSD(diffUSD)}` : `Faltante -${formatMoneyUSD(Math.abs(diffUSD))}`}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Conteo VES */}
              <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-2">
                <div className="flex justify-between items-center font-semibold text-neutral-700">
                  <span>Efectivo Bolívares (Bs)</span>
                  <span className="font-mono text-neutral-500">Esperado: {formatMoneyVES(currentShift.expectedCashVES)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="text-[11px] text-neutral-500">Monto Contado (Bs):</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={countedCashVES}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setCountedCashVES(val);
                        setDepositAmountVES(val);
                      }}
                      className="w-full h-9 px-3 border border-neutral-300 rounded-lg text-xs font-mono font-bold focus-visible:ring-2 focus-visible:ring-sky-500"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-neutral-500 block mb-1">Diferencia:</span>
                    <Badge variant={diffVES === 0 ? 'success' : diffVES > 0 ? 'info' : 'danger'}>
                      {diffVES === 0 ? `Cuadrado (${formatMoneyVES(0)})` : diffVES > 0 ? `Sobrante +${formatMoneyVES(diffVES)}` : `Faltante -${formatMoneyVES(Math.abs(diffVES))}`}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* SECCIÓN: Depósito a Bancos / Tesorería */}
              <div className="p-3.5 bg-sky-50/60 rounded-lg border border-sky-200 space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-sky-600" />
                  <span className="font-bold text-neutral-900 text-xs">
                    Depósito a Bancos / Tesorería (Cierre de Caja y Punto de Venta)
                  </span>
                </div>
                <p className="text-[11px] text-neutral-600 leading-relaxed">
                  Establezca el banco y la cuenta de destino para depositar la recaudación. Al confirmar el cierre, los fondos se reflejarán automáticamente en Tesorería y quedarán listos para la conciliación bancaria.
                </p>

                {/* Depósito en Bolívares (VES) */}
                <div className="p-2.5 bg-white rounded-lg border border-neutral-200 space-y-2">
                  {(() => {
                    const posBatchVES = currentShift.summary?.posBatchVES || ((currentShift.summary?.debitVES || 0) + (currentShift.summary?.creditVES || 0));
                    const totalVES = currentShift.summary?.totalCollectedVES || (currentShift.expectedCashVES + posBatchVES + (currentShift.summary?.pagomovilVES || 0));
                    return (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 font-semibold text-neutral-800 text-[11px]">
                        <span>Depósito en Bolívares (VES)</span>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          <span className="text-neutral-500 font-normal">Sugerir:</span>
                          <button
                            type="button"
                            onClick={() => {
                              setDepositAmountVES(countedCashVES);
                              setDepositAmountVESInput(String(countedCashVES));
                            }}
                            className="px-2 py-0.5 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium cursor-pointer"
                            title="Depositar efectivo físico en gaveta"
                          >
                            Efectivo ({formatMoneyVES(countedCashVES)})
                          </button>
                          {posBatchVES > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setDepositAmountVES(posBatchVES);
                                setDepositAmountVESInput(String(posBatchVES));
                              }}
                              className="px-2 py-0.5 rounded bg-sky-100 hover:bg-sky-200 text-sky-800 font-semibold cursor-pointer"
                              title="Depositar lote consolidado de puntos de venta"
                            >
                              Lote POS ({formatMoneyVES(posBatchVES)})
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setDepositAmountVES(totalVES);
                              setDepositAmountVESInput(String(totalVES));
                            }}
                            className="px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-semibold cursor-pointer"
                            title="Depositar recaudación total en bolívares"
                          >
                            Total Recaudado ({formatMoneyVES(totalVES)})
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-2">
                      <label className="text-[10px] text-neutral-500 block mb-0.5">Banco y Cuenta Receptora (VES):</label>
                      <select
                        value={depositBankAccountIdVES}
                        onChange={(e) => setDepositBankAccountIdVES(e.target.value)}
                        className="w-full h-8 px-2 border border-neutral-300 rounded-lg text-xs bg-white focus-visible:ring-2 focus-visible:ring-sky-500"
                      >
                        <option value="">-- Sin depósito bancario VES --</option>
                        {bankAccounts
                          .filter((a) => a.currency === 'VES')
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.bankName} - {a.accountNumber.slice(-4)} (Saldo: {formatMoneyVES(a.currentBalance)})
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-neutral-500 block mb-0.5">Monto Depósito (Bs):</label>
                      <input
                        type="text"
                        value={depositAmountVESInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDepositAmountVESInput(val);
                          setDepositAmountVES(parseFormattedNumber(val));
                        }}
                        className="w-full h-8 px-2 border border-neutral-300 rounded-lg text-xs font-mono font-bold focus-visible:ring-2 focus-visible:ring-sky-500"
                        placeholder="0,00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-500 block mb-0.5">Nro. de Referencia / Comprobante de Depósito VES:</label>
                    <input
                      type="text"
                      value={depositReferenceVES}
                      onChange={(e) => setDepositReferenceVES(e.target.value)}
                      className="w-full h-8 px-2 border border-neutral-300 rounded-lg text-xs focus-visible:ring-2 focus-visible:ring-sky-500"
                      placeholder="Ej: DEP-892019 o Lote Punto 0192"
                    />
                  </div>
                </div>

                {/* Depósito en Divisas (USD) */}
                <div className="p-2.5 bg-white rounded-lg border border-neutral-200 space-y-2">
                  {(() => {
                    const totalUSD = currentShift.summary?.totalCollectedUSD || (currentShift.expectedCashUSD + (currentShift.summary?.zelleUSD || 0));
                    return (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 font-semibold text-neutral-800 text-[11px]">
                        <span>Depósito en Divisas (USD)</span>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          <span className="text-neutral-500 font-normal">Sugerir:</span>
                          <button
                            type="button"
                            onClick={() => {
                              setDepositAmountUSD(countedCashUSD);
                              setDepositAmountUSDInput(String(countedCashUSD));
                            }}
                            className="px-2 py-0.5 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium cursor-pointer"
                            title="Depositar efectivo físico en gaveta"
                          >
                            Efectivo ({formatMoneyUSD(countedCashUSD)})
                          </button>
                          {totalUSD > countedCashUSD && (
                            <button
                              type="button"
                              onClick={() => {
                                setDepositAmountUSD(totalUSD);
                                setDepositAmountUSDInput(String(totalUSD));
                              }}
                              className="px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-semibold cursor-pointer"
                              title="Depositar recaudación total en divisas"
                            >
                              Total Recaudado ({formatMoneyUSD(totalUSD)})
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-2">
                      <label className="text-[10px] text-neutral-500 block mb-0.5">Cuenta Custodia / Divisas USD:</label>
                      <select
                        value={depositBankAccountIdUSD}
                        onChange={(e) => setDepositBankAccountIdUSD(e.target.value)}
                        className="w-full h-8 px-2 border border-neutral-300 rounded-lg text-xs bg-white focus-visible:ring-2 focus-visible:ring-sky-500"
                      >
                        <option value="">-- Sin depósito bancario USD --</option>
                        {bankAccounts
                          .filter((a) => a.currency === 'USD')
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.bankName} - {a.accountNumber.slice(-4)} (Saldo: {formatMoneyUSD(a.currentBalance)})
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-neutral-500 block mb-0.5">Monto Depósito ($):</label>
                      <input
                        type="text"
                        value={depositAmountUSDInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDepositAmountUSDInput(val);
                          setDepositAmountUSD(parseFormattedNumber(val));
                        }}
                        className="w-full h-8 px-2 border border-neutral-300 rounded-lg text-xs font-mono font-bold focus-visible:ring-2 focus-visible:ring-sky-500"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-500 block mb-0.5">Nro. de Referencia / Comprobante de Depósito USD:</label>
                    <input
                      type="text"
                      value={depositReferenceUSD}
                      onChange={(e) => setDepositReferenceUSD(e.target.value)}
                      className="w-full h-8 px-2 border border-neutral-300 rounded-lg text-xs focus-visible:ring-2 focus-visible:ring-sky-500"
                      placeholder="Ej: DEP-USD-00219"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Notas de Cierre</label>
                <input
                  type="text"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  className="w-full h-9 px-3 border border-neutral-300 rounded-lg text-xs focus-visible:ring-2 focus-visible:ring-sky-500"
                  placeholder="Justificación de sobrantes/faltantes o novedades en el turno"
                />
              </div>
            </div>

            {/* Footer (Pinned) */}
            <div className="px-5 py-3.5 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCloseShiftModal(false)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={submitting}
                onClick={handleCloseShift}
              >
                Confirmar Cierre y Depósito
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Registrar Movimiento Manual */}
      {showMovementModal && currentShift && (
        <div className="fixed inset-0 bg-neutral-900/60 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[92vh] shadow-2xl flex flex-col overflow-hidden border border-neutral-200 my-auto">
            {/* Header (Pinned) */}
            <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-sky-600" />
                <h3 className="text-sm font-bold text-neutral-900">Registrar Movimiento de Caja</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMovementModal(false)}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg hover:bg-neutral-100 cursor-pointer"
                title="Cerrar modal (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Tipo de Movimiento</label>
                  <select
                    value={movementType}
                    onChange={(e) => setMovementType(e.target.value as any)}
                    className="w-full h-9 px-3 border border-neutral-300 rounded-lg text-xs bg-white"
                  >
                    <option value="OUTFLOW">Salida de Efectivo</option>
                    <option value="INFLOW">Entrada de Efectivo</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Moneda</label>
                  <select
                    value={movementCurrency}
                    onChange={(e) => setMovementCurrency(e.target.value as any)}
                    className="w-full h-9 px-3 border border-neutral-300 rounded-lg text-xs bg-white"
                  >
                    <option value="USD">Dólares ($)</option>
                    <option value="VES">Bolívares (Bs)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Monto</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={movementAmount}
                  onChange={(e) => setMovementAmount(parseFloat(e.target.value) || 0)}
                  className="w-full h-9 px-3 border border-neutral-300 rounded-lg text-xs font-mono font-bold"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Motivo / Justificación</label>
                <input
                  type="text"
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  className="w-full h-9 px-3 border border-neutral-300 rounded-lg text-xs"
                  placeholder="Ej: Pago de flete / delivery, cambio de sencillo, etc."
                />
              </div>
            </div>

            {/* Footer (Pinned) */}
            <div className="px-5 py-3.5 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMovementModal(false)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={submitting || movementAmount <= 0 || !movementReason.trim()}
                onClick={handleRegisterMovement}
              >
                Guardar Movimiento
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Visor de Ticket Fiscal Térmico Emulado */}
      {isFiscal && (
        <FiscalReportModal
          isOpen={showFiscalModal}
          data={activeFiscalReport}
          onClose={() => setShowFiscalModal(false)}
        />
      )}

      {/* Modal: Visor / Descarga PDF Acta Oficial de Caja */}
      <PdfViewerModal
        isOpen={pdfModal.isOpen}
        onClose={() => setPdfModal((prev) => ({ ...prev, isOpen: false }))}
        title={pdfModal.title}
        endpoint={pdfModal.endpoint}
        filename={pdfModal.filename}
      />
    </div>
  );
};
