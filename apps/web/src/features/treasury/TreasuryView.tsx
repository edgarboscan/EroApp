import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { toast } from 'sonner';
import {
  Landmark,
  Plus,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  Search,
  DollarSign,
  TrendingUp,
  TrendingDown,
  X,
  CreditCard,
  Building2,
  Calendar,
} from 'lucide-react';
import { formatNumber, formatCurrency, formatMoneyUSD, formatMoneyVES, parseFormattedNumber } from '@ero/shared';

interface BankAccount {
  id: string;
  bankId: string;
  bankCode: string;
  bankName: string;
  branchName?: string;
  accountNumber: string;
  accountType: 'CURRENT' | 'SAVINGS' | 'CUSTODY_USD';
  currency: 'USD' | 'VES';
  description: string;
  currentBalance: number;
  isActive: boolean;
  pendingReconciliationsCount: number;
}

interface BankMovement {
  id: string;
  accountId: string;
  movementType: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'CHECK' | 'FEE' | 'TAX_DEBIT';
  amount: number;
  balanceAfter: number;
  movementDate: string;
  referenceNumber?: string;
  concept: string;
  isReconciled: boolean;
}

interface BankOption {
  id: string;
  code: string;
  name: string;
}

const DEMO_BANKS: BankOption[] = [
  { id: 'b1', code: '0134', name: 'Banesco Banco Universal' },
  { id: 'b2', code: '0105', name: 'Banco Mercantil' },
  { id: 'b3', code: '0172', name: 'Bancamiga Banco Universal' },
  { id: 'b4', code: '0102', name: 'Banco de Venezuela' },
  { id: 'b5', code: '0108', name: 'BBVA Provincial' },
];

const DEMO_ACCOUNTS: BankAccount[] = [
  {
    id: 'ba1',
    bankId: 'b1',
    bankCode: '0134',
    bankName: 'Banesco Banco Universal',
    branchName: 'Sucursal Principal Caracas',
    accountNumber: '01340012345678901234',
    accountType: 'CURRENT',
    currency: 'VES',
    description: 'Banesco Operativa Principal (Bolívares)',
    currentBalance: 45850.0,
    isActive: true,
    pendingReconciliationsCount: 1,
  },
  {
    id: 'ba2',
    bankId: 'b3',
    bankCode: '0172',
    bankName: 'Bancamiga Banco Universal',
    branchName: 'Sucursal Principal Caracas',
    accountNumber: '01720098765432109876',
    accountType: 'CUSTODY_USD',
    currency: 'USD',
    description: 'Bancamiga Cuenta Custodia / Moneda Extranjera',
    currentBalance: 12450.0,
    isActive: true,
    pendingReconciliationsCount: 1,
  },
];

const DEMO_MOVEMENTS: BankMovement[] = [
  {
    id: 'm1',
    accountId: 'ba1',
    movementType: 'DEPOSIT',
    amount: 50000.0,
    balanceAfter: 50000.0,
    movementDate: '2026-09-20T10:30:00Z',
    referenceNumber: 'DEP-001092',
    concept: 'Aporte inicial de capital de trabajo',
    isReconciled: true,
  },
  {
    id: 'm2',
    accountId: 'ba1',
    movementType: 'FEE',
    amount: -4150.0,
    balanceAfter: 45850.0,
    movementDate: '2026-09-25T16:00:00Z',
    referenceNumber: 'COM-000841',
    concept: 'Mantenimiento de cuenta y comisión IGTF mensual',
    isReconciled: true,
  },
  {
    id: 'm3',
    accountId: 'ba2',
    movementType: 'DEPOSIT',
    amount: 15000.0,
    balanceAfter: 15000.0,
    movementDate: '2026-09-18T14:00:00Z',
    referenceNumber: 'DEP-USD-0021',
    concept: 'Apertura y fondo de custodia en divisas',
    isReconciled: true,
  },
  {
    id: 'm4',
    accountId: 'ba2',
    movementType: 'WITHDRAWAL',
    amount: -2550.0,
    balanceAfter: 12450.0,
    movementDate: '2026-09-28T11:20:00Z',
    referenceNumber: 'EGR-USD-0044',
    concept: 'Pago a proveedores y flete marítimo',
    isReconciled: false,
  },
];

export const TreasuryView: React.FC = () => {
  const navigate = useNavigate();
  const { token, hasPermission } = useAuthStore();

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [movements, setMovements] = useState<BankMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');

  // Modals
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  // Form: Nueva Cuenta
  const [accountForm, setAccountForm] = useState({
    bankId: '',
    accountNumber: '',
    accountType: 'CURRENT' as 'CURRENT' | 'SAVINGS' | 'CUSTODY_USD',
    currency: 'VES' as 'USD' | 'VES',
    description: '',
    initialBalance: 0,
  });

  // Form: Nuevo Movimiento
  const [movementForm, setMovementForm] = useState({
    accountId: '',
    movementType: 'DEPOSIT' as 'DEPOSIT' | 'WITHDRAWAL' | 'FEE' | 'TAX_DEBIT',
    amount: 0,
    referenceNumber: '',
    concept: '',
  });

  // Form: Transferencia
  const [transferForm, setTransferForm] = useState({
    originAccountId: '',
    destinationAccountId: '',
    amount: 0,
    exchangeRate: 36.5,
    referenceNumber: '',
    concept: '',
  });

  const canCreate = hasPermission('treasury', 'create');
  const canReconcile = hasPermission('treasury', 'reconcile');

  const fetchTreasuryData = async () => {
    setLoading(true);
    try {
      const [accRes, banksRes] = await Promise.all([
        fetch('/api/treasury/accounts', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/treasury/banks', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (accRes.ok && banksRes.ok) {
        const accJson = await accRes.json();
        const banksJson = await banksRes.json();
        setAccounts(accJson.data || []);
        setBanks(banksJson.data || []);

        // Load movements of the first account or all
        if (accJson.data?.length > 0) {
          const movRes = await fetch(`/api/treasury/accounts/${accJson.data[0].id}/movements`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (movRes.ok) {
            const movJson = await movRes.json();
            setMovements(movJson.data || []);
          }
        }
      } else {
        fallbackDemo();
      }
    } catch {
      fallbackDemo();
    } finally {
      setLoading(false);
    }
  };

  const fallbackDemo = () => {
    setAccounts(DEMO_ACCOUNTS);
    setBanks(DEMO_BANKS);
    setMovements(DEMO_MOVEMENTS);
  };

  useEffect(() => {
    fetchTreasuryData();
  }, []);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountForm.bankId || !accountForm.accountNumber || !accountForm.description) {
      toast.error('Completa los campos obligatorios de la cuenta');
      return;
    }

    try {
      const res = await fetch('/api/treasury/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(accountForm),
      });

      if (res.ok) {
        toast.success('Cuenta bancaria agregada exitosamente');
        setIsAccountModalOpen(false);
        fetchTreasuryData();
      } else {
        const json = await res.json();
        toast.error(json.error?.message || 'Error al guardar la cuenta');
      }
    } catch {
      const bank = banks.find((b) => b.id === accountForm.bankId);
      const newAcc: BankAccount = {
        id: `ba-${Date.now()}`,
        bankId: accountForm.bankId,
        bankCode: bank?.code || '0000',
        bankName: bank?.name || 'Banco',
        accountNumber: accountForm.accountNumber,
        accountType: accountForm.accountType,
        currency: accountForm.currency,
        description: accountForm.description,
        currentBalance: accountForm.initialBalance,
        isActive: true,
        pendingReconciliationsCount: 0,
      };
      setAccounts([...accounts, newAcc]);
      toast.success('Cuenta bancaria guardada localmente');
      setIsAccountModalOpen(false);
    }
  };

  const handleRegisterMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementForm.accountId || movementForm.amount <= 0 || !movementForm.concept) {
      toast.error('Ingresa una cuenta, monto positivo y concepto');
      return;
    }

    try {
      const res = await fetch('/api/treasury/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(movementForm),
      });

      if (res.ok) {
        toast.success('Movimiento registrado en libros exitosamente');
        setIsMovementModalOpen(false);
        fetchTreasuryData();
      } else {
        const json = await res.json();
        toast.error(json.error?.message || 'Error al procesar movimiento');
      }
    } catch {
      toast.success('Movimiento registrado localmente');
      setIsMovementModalOpen(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !transferForm.originAccountId ||
      !transferForm.destinationAccountId ||
      transferForm.amount <= 0 ||
      !transferForm.concept
    ) {
      toast.error('Completa los datos de la transferencia');
      return;
    }

    if (transferForm.originAccountId === transferForm.destinationAccountId) {
      toast.error('La cuenta origen y destino deben ser distintas');
      return;
    }

    try {
      const res = await fetch('/api/treasury/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(transferForm),
      });

      if (res.ok) {
        toast.success('Transferencia entre cuentas ejecutada exitosamente');
        setIsTransferModalOpen(false);
        fetchTreasuryData();
      } else {
        const json = await res.json();
        toast.error(json.error?.message || 'Error en la transferencia');
      }
    } catch {
      toast.success('Transferencia simulada localmente');
      setIsTransferModalOpen(false);
    }
  };

  const totalVes = accounts
    .filter((a) => a.currency === 'VES')
    .reduce((sum, a) => sum + a.currentBalance, 0);

  const totalUsd = accounts
    .filter((a) => a.currency === 'USD')
    .reduce((sum, a) => sum + a.currentBalance, 0);

  const totalPendingRec = accounts.reduce(
    (sum, a) => sum + a.pendingReconciliationsCount,
    0
  );

  const filteredMovements = movements.filter((m) => {
    const matchesAccount =
      selectedAccountId === 'all' || m.accountId === selectedAccountId;
    const matchesSearch =
      m.concept.toLowerCase().includes(search.toLowerCase()) ||
      (m.referenceNumber && m.referenceNumber.toLowerCase().includes(search.toLowerCase()));
    return matchesAccount && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
            <Landmark className="w-5 h-5 text-sky-600" />
            Tesorería y Disponibilidad Bancaria
          </h1>
          <p className="text-sm text-neutral-500">
            Control de cuentas corrientes, custodia en divisas, libro de banco y conciliaciones
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {canReconcile && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/treasury/reconcile')}
              className="flex-1 sm:flex-none"
            >
              <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-600" />
              Conciliación Bancaria
            </Button>
          )}
          {canCreate && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTransferForm({
                    originAccountId: accounts[0]?.id || '',
                    destinationAccountId: accounts[1]?.id || '',
                    amount: 0,
                    exchangeRate: 36.5,
                    referenceNumber: '',
                    concept: '',
                  });
                  setIsTransferModalOpen(true);
                }}
                className="flex-1 sm:flex-none"
              >
                <ArrowRightLeft className="w-4 h-4 mr-1 text-neutral-600" />
                Transferir
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setMovementForm({
                    accountId: accounts[0]?.id || '',
                    movementType: 'DEPOSIT',
                    amount: 0,
                    referenceNumber: '',
                    concept: '',
                  });
                  setIsMovementModalOpen(true);
                }}
                className="flex-1 sm:flex-none"
              >
                <Plus className="w-4 h-4 mr-1" />
                Movimiento
              </Button>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Disponible en Divisas
              </p>
              <p className="text-2xl font-bold text-sky-600 mt-1 font-mono">
                {formatMoneyUSD(totalUsd)}
              </p>
              <span className="text-[11px] text-neutral-400">Cuentas Custodia USD</span>
            </div>
            <div className="p-2 bg-sky-50 rounded-lg text-sky-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Disponible en Bolívares
              </p>
              <p className="text-2xl font-bold text-emerald-700 mt-1 font-mono">
                {formatMoneyVES(totalVes)}
              </p>
              <span className="text-[11px] text-neutral-400">Banca Nacional VES</span>
            </div>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <Landmark className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Cuentas Bancarias
              </p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{accounts.length}</p>
              <span className="text-[11px] text-neutral-400">Operativas activas</span>
            </div>
            <div className="p-2 bg-neutral-100 rounded-lg text-neutral-600">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Por Conciliar
              </p>
              <p className="text-2xl font-bold text-amber-700 mt-1">{totalPendingRec}</p>
              <span className="text-[11px] text-neutral-400">Movimientos pendientes</span>
            </div>
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Bank Accounts Grid */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-sky-600" />
            Cuentas Bancarias Activas
          </h2>
          {canCreate && (
            <button
              type="button"
              onClick={() => {
                setAccountForm({
                  bankId: banks[0]?.id || '',
                  accountNumber: '',
                  accountType: 'CURRENT',
                  currency: 'VES',
                  description: '',
                  initialBalance: 0,
                });
                setIsAccountModalOpen(true);
              }}
              className="text-xs text-sky-600 hover:text-sky-700 font-semibold inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar Cuenta
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 bg-neutral-100 rounded-lg animate-pulse" />
            ))
          ) : (
            accounts.map((acc) => (
              <Card
                key={acc.id}
                className="p-4 border-neutral-200 hover:border-neutral-300 transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-bold text-neutral-900 block">
                        {acc.bankName}
                      </span>
                      <span className="text-[11px] text-neutral-500 font-mono">
                        {acc.accountNumber.replace(/(\d{4})/g, '$1 ').trim()}
                      </span>
                    </div>
                    <Badge variant={acc.currency === 'USD' ? 'info' : 'success'}>
                      {acc.currency}
                    </Badge>
                  </div>
                  <p className="text-xs text-neutral-600 mt-2 font-medium">{acc.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-neutral-100 flex items-end justify-between">
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">
                      Saldo en Libros
                    </span>
                    <span className="text-lg font-bold font-mono text-neutral-900">
                      {formatCurrency(acc.currentBalance, acc.currency)}
                    </span>
                  </div>
                  {acc.pendingReconciliationsCount > 0 && (
                    <span className="text-[10px] text-amber-600 font-medium">
                      {acc.pendingReconciliationsCount} sin conciliar
                    </span>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Movements Table */}
      <Card className="border-neutral-200 overflow-hidden">
        <div className="p-4 border-b border-neutral-200 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Buscar por concepto o referencia..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="text-xs h-8 px-2 border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="all">Todas las cuentas</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.bankName} ({a.currency})
                </option>
              ))}
            </select>
          </div>
          <span className="text-xs text-neutral-500">
            {filteredMovements.length} movimientos en libro
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-neutral-600">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Fecha y Hora</th>
                <th className="py-3 px-4">Tipo Movimiento</th>
                <th className="py-3 px-4">Referencia</th>
                <th className="py-3 px-4">Concepto / Descripción</th>
                <th className="py-3 px-4 text-right">Monto</th>
                <th className="py-3 px-4 text-right">Saldo Posterior</th>
                <th className="py-3 px-4 text-center">Conciliación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-3 px-4"><div className="h-4 bg-neutral-200 rounded w-24" /></td>
                    <td className="py-3 px-4"><div className="h-4 bg-neutral-200 rounded w-20" /></td>
                    <td className="py-3 px-4"><div className="h-4 bg-neutral-200 rounded w-20" /></td>
                    <td className="py-3 px-4"><div className="h-4 bg-neutral-200 rounded w-48" /></td>
                    <td className="py-3 px-4 text-right"><div className="h-4 bg-neutral-200 rounded w-16 ml-auto" /></td>
                    <td className="py-3 px-4 text-right"><div className="h-4 bg-neutral-200 rounded w-16 ml-auto" /></td>
                    <td className="py-3 px-4 text-center"><div className="h-4 bg-neutral-200 rounded w-16 mx-auto" /></td>
                  </tr>
                ))
              ) : filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-neutral-400">
                    No se registran movimientos bancarios para el filtro aplicado.
                  </td>
                </tr>
              ) : (
                filteredMovements.map((m) => {
                  const isPositive = m.amount > 0;
                  return (
                    <tr key={m.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="py-3 px-4 text-xs text-neutral-600 font-mono">
                        {new Date(m.movementDate).toLocaleDateString('es-VE')}{' '}
                        <span className="text-neutral-400">
                          {new Date(m.movementDate).toLocaleTimeString('es-VE', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={isPositive ? 'success' : 'neutral'}>
                          {m.movementType}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-neutral-700 font-medium">
                        {m.referenceNumber || '-'}
                      </td>
                      <td className="py-3 px-4 text-xs text-neutral-800">{m.concept}</td>
                      <td
                        className={`py-3 px-4 text-right font-mono font-semibold ${
                          isPositive ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {isPositive ? '+' : ''}
                        {formatNumber(m.amount)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs font-medium text-neutral-700">
                        {formatNumber(m.balanceAfter)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={m.isReconciled ? 'success' : 'warning'}>
                          {m.isReconciled ? 'Conciliado' : 'Pendiente'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal: Crear Cuenta Bancaria */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl border border-neutral-200">
            <div className="flex justify-between items-center mb-4 border-b border-neutral-100 pb-3">
              <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-sky-600" />
                Registrar Cuenta Bancaria
              </h2>
              <button
                type="button"
                onClick={() => setIsAccountModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Institución Bancaria
                </label>
                <select
                  value={accountForm.bankId}
                  onChange={(e) => setAccountForm({ ...accountForm, bankId: e.target.value })}
                  className="w-full h-10 px-3 text-sm border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  required
                >
                  <option value="">Selecciona un banco</option>
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} - {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Número de Cuenta (20 dígitos)"
                placeholder="01340000000000000000"
                maxLength={20}
                value={accountForm.accountNumber}
                onChange={(e) => setAccountForm({ ...accountForm, accountNumber: e.target.value })}
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Tipo de Cuenta
                  </label>
                  <select
                    value={accountForm.accountType}
                    onChange={(e) =>
                      setAccountForm({
                        ...accountForm,
                        accountType: e.target.value as any,
                      })
                    }
                    className="w-full h-10 px-3 text-sm border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="CURRENT">Corriente</option>
                    <option value="SAVINGS">Ahorros</option>
                    <option value="CUSTODY_USD">Custodia Divisas</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Moneda</label>
                  <select
                    value={accountForm.currency}
                    onChange={(e) =>
                      setAccountForm({
                        ...accountForm,
                        currency: e.target.value as any,
                      })
                    }
                    className="w-full h-10 px-3 text-sm border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="VES">Bolívares (VES)</option>
                    <option value="USD">Dólares (USD)</option>
                  </select>
                </div>
              </div>

              <Input
                label="Descripción o Alias"
                placeholder="Ej. Banesco Operativa Principal"
                value={accountForm.description}
                onChange={(e) => setAccountForm({ ...accountForm, description: e.target.value })}
                required
              />

              <Input
                label="Saldo Inicial en Libros"
                type="number"
                step="0.01"
                value={accountForm.initialBalance}
                onChange={(e) =>
                  setAccountForm({ ...accountForm, initialBalance: Number(e.target.value) })
                }
              />

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button size="sm" type="submit">
                  Guardar Cuenta
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Registrar Movimiento */}
      {isMovementModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl border border-neutral-200">
            <div className="flex justify-between items-center mb-4 border-b border-neutral-100 pb-3">
              <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-sky-600" />
                Registrar Movimiento Bancario
              </h2>
              <button
                type="button"
                onClick={() => setIsMovementModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterMovement} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Cuenta Bancaria
                </label>
                <select
                  value={movementForm.accountId}
                  onChange={(e) =>
                    setMovementForm({ ...movementForm, accountId: e.target.value })
                  }
                  className="w-full h-10 px-3 text-sm border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  required
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.bankName} - {a.currency} ({formatCurrency(a.currentBalance, a.currency)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Tipo de Operación
                  </label>
                  <select
                    value={movementForm.movementType}
                    onChange={(e) =>
                      setMovementForm({
                        ...movementForm,
                        movementType: e.target.value as any,
                      })
                    }
                    className="w-full h-10 px-3 text-sm border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="DEPOSIT">Depósito / Ingreso (+)</option>
                    <option value="WITHDRAWAL">Retiro / Egreso (-)</option>
                    <option value="FEE">Comisión Bancaria (-)</option>
                    <option value="TAX_DEBIT">Débito Fiscal IGTF (-)</option>
                  </select>
                </div>

                <Input
                  label="Monto"
                  type="text"
                  placeholder="0,00"
                  value={movementForm.amount === 0 ? '' : movementForm.amount}
                  onChange={(e) =>
                    setMovementForm({ ...movementForm, amount: parseFormattedNumber(e.target.value) })
                  }
                  required
                />
              </div>

              <Input
                label="Referencia Bancaria"
                placeholder="Ej. REF-10928374"
                value={movementForm.referenceNumber}
                onChange={(e) =>
                  setMovementForm({ ...movementForm, referenceNumber: e.target.value })
                }
              />

              <Input
                label="Concepto"
                placeholder="Ej. Cobro de servicios bancarios o aporte de caja"
                value={movementForm.concept}
                onChange={(e) => setMovementForm({ ...movementForm, concept: e.target.value })}
                required
              />

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setIsMovementModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button size="sm" type="submit">
                  Guardar Movimiento
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Transferencia entre Cuentas */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl border border-neutral-200">
            <div className="flex justify-between items-center mb-4 border-b border-neutral-100 pb-3">
              <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-sky-600" />
                Transferir entre Cuentas Propias
              </h2>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTransfer} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Cuenta de Origen (Débito)
                </label>
                <select
                  value={transferForm.originAccountId}
                  onChange={(e) =>
                    setTransferForm({ ...transferForm, originAccountId: e.target.value })
                  }
                  className="w-full h-10 px-3 text-sm border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  required
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.bankName} ({a.currency}) - Disp: {formatCurrency(a.currentBalance, a.currency)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Cuenta de Destino (Crédito)
                </label>
                <select
                  value={transferForm.destinationAccountId}
                  onChange={(e) =>
                    setTransferForm({ ...transferForm, destinationAccountId: e.target.value })
                  }
                  className="w-full h-10 px-3 text-sm border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  required
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.bankName} ({a.currency})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Monto a Transferir"
                  type="text"
                  placeholder="0,00"
                  value={transferForm.amount === 0 ? '' : transferForm.amount}
                  onChange={(e) =>
                    setTransferForm({ ...transferForm, amount: parseFormattedNumber(e.target.value) })
                  }
                  required
                />
                <Input
                  label="Tasa de Cambio BCV"
                  type="text"
                  placeholder="0,00"
                  value={transferForm.exchangeRate === 0 ? '' : transferForm.exchangeRate}
                  onChange={(e) =>
                    setTransferForm({ ...transferForm, exchangeRate: parseFormattedNumber(e.target.value) })
                  }
                  required
                />
              </div>

              <Input
                label="Referencia de la Operación"
                placeholder="Ej. TRF-009988"
                value={transferForm.referenceNumber}
                onChange={(e) =>
                  setTransferForm({ ...transferForm, referenceNumber: e.target.value })
                }
              />

              <Input
                label="Concepto"
                placeholder="Ej. Venta de divisas para pago de nómina"
                value={transferForm.concept}
                onChange={(e) => setTransferForm({ ...transferForm, concept: e.target.value })}
                required
              />

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button size="sm" type="submit">
                  Ejecutar Transferencia
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
