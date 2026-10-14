import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { toast } from 'sonner';
import {
  Truck,
  Search,
  Plus,
  FileSpreadsheet,
  X,
  Building2,
  Phone,
  Mail,
  Receipt,
  DollarSign,
  Clock,
} from 'lucide-react';

interface Supplier {
  id: string;
  rif: string;
  name: string;
  fiscalAddress?: string;
  phone?: string;
  email?: string;
  isPersonNatural: boolean;
  isResident: boolean;
  islrConceptCode?: string;
  creditLimit: number;
  paymentTermsDays: number;
  isActive: boolean;
  currentBalance: number;
  pendingPayablesCount: number;
}

const DEMO_SUPPLIERS: Supplier[] = [
  {
    id: 's1',
    rif: 'J-30555666-0',
    name: 'ALIMENTOS POLAR COMERCIAL C.A.',
    fiscalAddress: 'Los Cortijos de Lourdes, Edif. Polar, Caracas',
    phone: '+58 212 202 3111',
    email: 'atencionproveedores@polar.com.ve',
    isPersonNatural: false,
    isResident: true,
    islrConceptCode: 'SERV_IND',
    creditLimit: 25000.0,
    paymentTermsDays: 15,
    isActive: true,
    currentBalance: 1254.80,
    pendingPayablesCount: 1,
  },
  {
    id: 's2',
    rif: 'J-00033322-1',
    name: 'MONDELEZ VENEZUELA C.A.',
    fiscalAddress: 'Zona Industrial San Diego, Valencia, Edo. Carabobo',
    phone: '+58 241 876 5432',
    email: 'pagos@mondelezinternational.com',
    isPersonNatural: false,
    isResident: true,
    islrConceptCode: 'SERV_IND',
    creditLimit: 10000.0,
    paymentTermsDays: 30,
    isActive: true,
    currentBalance: 1240.00,
    pendingPayablesCount: 1,
  },
  {
    id: 's3',
    rif: 'J-29888777-4',
    name: 'DISTRIBUIDORA FERRETERA CENTRAL C.A.',
    fiscalAddress: 'Av. Las Delicias, Maracay, Edo. Aragua',
    phone: '+58 243 234 5678',
    email: 'ventas@ferreteracentral.com',
    isPersonNatural: false,
    isResident: true,
    islrConceptCode: 'BIENES',
    creditLimit: 5000.0,
    paymentTermsDays: 15,
    isActive: true,
    currentBalance: 0.0,
    pendingPayablesCount: 0,
  },
];

export const SuppliersView: React.FC = () => {
  const navigate = useNavigate();
  const { token, hasPermission } = useAuthStore();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    rif: '',
    name: '',
    fiscalAddress: '',
    phone: '',
    email: '',
    isPersonNatural: false,
    isResident: true,
    islrConceptCode: 'SERV_IND',
    creditLimit: 0,
    paymentTermsDays: 15,
  });

  const canCreate = hasPermission('suppliers', 'create');

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/suppliers?q=${encodeURIComponent(search)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setSuppliers(json.data || []);
      } else {
        setSuppliers(
          DEMO_SUPPLIERS.filter(
            (s) =>
              s.name.toLowerCase().includes(search.toLowerCase()) ||
              s.rif.toLowerCase().includes(search.toLowerCase())
          )
        );
      }
    } catch {
      setSuppliers(
        DEMO_SUPPLIERS.filter(
          (s) =>
            s.name.toLowerCase().includes(search.toLowerCase()) ||
            s.rif.toLowerCase().includes(search.toLowerCase())
        )
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSuppliers();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.rif || !formData.name) {
      toast.error('El RIF y la Razón Social son campos requeridos');
      return;
    }

    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast.success('Proveedor registrado correctamente');
        setIsModalOpen(false);
        setFormData({
          rif: '',
          name: '',
          fiscalAddress: '',
          phone: '',
          email: '',
          isPersonNatural: false,
          isResident: true,
          islrConceptCode: 'SERV_IND',
          creditLimit: 0,
          paymentTermsDays: 15,
        });
        fetchSuppliers();
      } else {
        const err = await res.json();
        toast.error(err.error?.message || 'Error al guardar el proveedor');
      }
    } catch {
      // Demo fallback: update local state
      const newSup: Supplier = {
        id: `s-${Date.now()}`,
        rif: formData.rif.toUpperCase(),
        name: formData.name,
        fiscalAddress: formData.fiscalAddress,
        phone: formData.phone,
        email: formData.email,
        isPersonNatural: formData.isPersonNatural,
        isResident: formData.isResident,
        islrConceptCode: formData.islrConceptCode,
        creditLimit: formData.creditLimit,
        paymentTermsDays: formData.paymentTermsDays,
        isActive: true,
        currentBalance: 0,
        pendingPayablesCount: 0,
      };
      setSuppliers([newSup, ...suppliers]);
      toast.success('Proveedor guardado localmente');
      setIsModalOpen(false);
    }
  };

  const totalBalance = suppliers.reduce((sum, s) => sum + s.currentBalance, 0);
  const withDebtCount = suppliers.filter((s) => s.currentBalance > 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
            <Truck className="w-5 h-5 text-sky-600" />
            Directorio de Proveedores
          </h1>
          <p className="text-sm text-neutral-500">
            Administración de acreedores comerciales, términos de pago y retenciones ISLR/IVA
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/payables')}
            className="flex-1 sm:flex-none"
          >
            <Clock className="w-4 h-4 mr-1 text-neutral-600" />
            Ver CxP
          </Button>
          {canCreate && (
            <Button
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className="flex-1 sm:flex-none"
            >
              <Plus className="w-4 h-4 mr-1" />
              Nuevo Proveedor
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Total Proveedores
              </p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{suppliers.length}</p>
            </div>
            <div className="p-2 bg-neutral-100 rounded-lg text-neutral-600">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Con Saldo Pendiente
              </p>
              <p className="text-2xl font-bold text-amber-700 mt-1">{withDebtCount}</p>
            </div>
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Deuda Total CxP
              </p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                ${totalBalance.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-2 bg-red-50 rounded-lg text-red-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Plazo Promedio Crédito
              </p>
              <p className="text-2xl font-bold text-sky-700 mt-1">
                {suppliers.length > 0
                  ? Math.round(
                      suppliers.reduce((a, b) => a + b.paymentTermsDays, 0) / suppliers.length
                    )
                  : 0}{' '}
                días
              </p>
            </div>
            <div className="p-2 bg-sky-50 rounded-lg text-sky-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="border-neutral-200 overflow-hidden">
        <div className="p-4 border-b border-neutral-200 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar por RIF, nombre o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-neutral-600">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">RIF / Proveedor</th>
                <th className="py-3 px-4">Contacto</th>
                <th className="py-3 px-4">Condición Fiscal</th>
                <th className="py-3 px-4 text-center">Plazo Crédito</th>
                <th className="py-3 px-4 text-right">Saldo Deudor</th>
                <th className="py-3 px-4 text-center">Facturas</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                // Skeletons to avoid layout shift
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-4">
                      <div className="h-4 bg-neutral-200 rounded w-36 mb-1.5" />
                      <div className="h-3 bg-neutral-100 rounded w-20" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-neutral-200 rounded w-28" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-5 bg-neutral-200 rounded w-20" />
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="h-4 bg-neutral-200 rounded w-12 mx-auto" />
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="h-4 bg-neutral-200 rounded w-16 ml-auto" />
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="h-4 bg-neutral-200 rounded w-8 mx-auto" />
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="h-8 bg-neutral-200 rounded w-24 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-neutral-400">
                    <Truck className="w-8 h-8 mx-auto mb-2 opacity-50 text-neutral-400" />
                    <p className="font-medium text-neutral-700">No se encontraron proveedores</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      Intenta con otro término de búsqueda o agrega un nuevo proveedor.
                    </p>
                  </td>
                </tr>
              ) : (
                suppliers.map((sup) => (
                  <tr key={sup.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-neutral-900">{sup.name}</div>
                      <div className="text-xs text-neutral-500 font-mono mt-0.5">{sup.rif}</div>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {sup.phone && (
                        <div className="flex items-center gap-1 text-neutral-700">
                          <Phone className="w-3.5 h-3.5 text-neutral-400" />
                          {sup.phone}
                        </div>
                      )}
                      {sup.email && (
                        <div className="flex items-center gap-1 text-neutral-500 mt-0.5">
                          <Mail className="w-3.5 h-3.5 text-neutral-400" />
                          {sup.email}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="neutral">
                          {sup.isPersonNatural ? 'Natural' : 'Jurídica'}
                        </Badge>
                        <Badge variant={sup.isResident ? 'success' : 'warning'}>
                          {sup.isResident ? 'Domiciliado' : 'No Dom.'}
                        </Badge>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-medium">
                      {sup.paymentTermsDays > 0 ? (
                        <span className="text-neutral-700">{sup.paymentTermsDays} d</span>
                      ) : (
                        <span className="text-neutral-400 text-xs">Contado</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {sup.currentBalance > 0 ? (
                        <span className="font-bold text-red-600 font-mono">
                          ${sup.currentBalance.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-mono text-xs font-semibold">
                          Solvente ($0)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {sup.pendingPayablesCount > 0 ? (
                        <Badge variant="warning">{sup.pendingPayablesCount} pend.</Badge>
                      ) : (
                        <span className="text-neutral-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/suppliers/${sup.id}/statement`)}
                          className="h-8 text-xs"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-neutral-500" />
                          Estado de Cuenta
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal: Registrar Proveedor */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 shadow-xl border border-neutral-200">
            <div className="flex justify-between items-center mb-4 border-b border-neutral-100 pb-3">
              <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-sky-600" />
                Registrar Nuevo Proveedor
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="RIF (Fiscal SENIAT)"
                  placeholder="J-12345678-9"
                  value={formData.rif}
                  onChange={(e) => setFormData({ ...formData, rif: e.target.value })}
                  required
                />
                <Input
                  label="Teléfono de Contacto"
                  placeholder="+58 212 999 8877"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <Input
                label="Nombre o Razón Social"
                placeholder="Nombre legal completo"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />

              <Input
                label="Correo Electrónico"
                type="email"
                placeholder="pagos@empresa.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />

              <Input
                label="Dirección Fiscal"
                placeholder="Zona industrial, calle, edificio..."
                value={formData.fiscalAddress}
                onChange={(e) => setFormData({ ...formData, fiscalAddress: e.target.value })}
              />

              <div className="grid grid-cols-2 gap-3 p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                <label className="flex items-center gap-2 text-xs font-medium text-neutral-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isPersonNatural}
                    onChange={(e) =>
                      setFormData({ ...formData, isPersonNatural: e.target.checked })
                    }
                    className="w-4 h-4 text-sky-600 rounded"
                  />
                  Persona Natural
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-neutral-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isResident}
                    onChange={(e) =>
                      setFormData({ ...formData, isResident: e.target.checked })
                    }
                    className="w-4 h-4 text-sky-600 rounded"
                  />
                  Domiciliado en Venezuela
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Límite de Crédito ($ USD)"
                  type="number"
                  value={formData.creditLimit}
                  onChange={(e) =>
                    setFormData({ ...formData, creditLimit: Number(e.target.value) })
                  }
                />
                <Input
                  label="Plazo de Pago (Días)"
                  type="number"
                  value={formData.paymentTermsDays}
                  onChange={(e) =>
                    setFormData({ ...formData, paymentTermsDays: Number(e.target.value) })
                  }
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button size="sm" type="submit">
                  Guardar Proveedor
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
