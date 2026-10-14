import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { toast } from 'sonner';
import {
  Users,
  Search,
  Plus,
  FileSpreadsheet,
  X,
  CreditCard,
  Building2,
  Phone,
  Mail,
} from 'lucide-react';

interface Customer {
  id: string;
  docType: 'V' | 'E' | 'J' | 'G' | 'P';
  docNumber: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  isSpecialTaxpayer: boolean;
  creditEnabled: boolean;
  creditLimit: number;
  paymentTermsDays: number;
  isActive: boolean;
  currentBalance: number;
  pendingInvoicesCount: number;
}

const DEMO_CUSTOMERS: Customer[] = [
  {
    id: 'c1',
    docType: 'J',
    docNumber: '30999888-1',
    name: 'INVERSIONES EL SOL DE CARACAS C.A.',
    address: 'Av. Libertador, Edif. Centro, Chacao, Caracas',
    phone: '+58 212 999 1122',
    email: 'contacto@elsolcaracas.com',
    isSpecialTaxpayer: true,
    creditEnabled: true,
    creditLimit: 5000.0,
    paymentTermsDays: 30,
    isActive: true,
    currentBalance: 1420.50,
    pendingInvoicesCount: 2,
  },
  {
    id: 'c2',
    docType: 'J',
    docNumber: '40111222-3',
    name: 'SUMINISTROS Y ALIMENTOS INDUSTRIALES S.A.',
    address: 'Zona Industrial Los Ruices, Galpón 4',
    phone: '+58 212 234 5678',
    email: 'compras@suministrosve.com',
    isSpecialTaxpayer: false,
    creditEnabled: true,
    creditLimit: 2500.0,
    paymentTermsDays: 15,
    isActive: true,
    currentBalance: 850.00,
    pendingInvoicesCount: 1,
  },
  {
    id: 'c3',
    docType: 'V',
    docNumber: '18456789',
    name: 'CARLOS ALBERTO MENDOZA',
    address: 'Urb. Santa Mónica, Calle Rómulo Gallegos',
    phone: '+58 414 123 4567',
    email: 'cmendoza@gmail.com',
    isSpecialTaxpayer: false,
    creditEnabled: false,
    creditLimit: 0,
    paymentTermsDays: 0,
    isActive: true,
    currentBalance: 0,
    pendingInvoicesCount: 0,
  },
];

export const CustomersView: React.FC = () => {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);

  const [customers, setCustomers] = useState<Customer[]>(DEMO_CUSTOMERS);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    docType: 'J' as 'V' | 'E' | 'J' | 'G' | 'P',
    docNumber: '',
    name: '',
    address: '',
    phone: '',
    email: '',
    isSpecialTaxpayer: false,
    creditEnabled: false,
    creditLimit: 0,
    paymentTermsDays: 15,
  });

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const url = search ? `/api/customers?q=${encodeURIComponent(search)}` : '/api/customers';
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json();
      if (json.success && Array.isArray(json.data)) {
        setCustomers(json.data);
      }
    } catch {
      // Fallback a demo data
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [search]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.docNumber.trim() || !formData.name.trim()) {
      toast.error('Complete el documento y la razón social');
      return;
    }

    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const json = await response.json();
      if (response.ok && json.success) {
        toast.success('Cliente registrado exitosamente');
        setIsModalOpen(false);
        fetchCustomers();
      } else {
        throw new Error(json.error?.message || 'Error al guardar cliente');
      }
    } catch {
      // Demo local fallback
      const newCustomer: Customer = {
        id: `demo-${Date.now()}`,
        ...formData,
        isActive: true,
        currentBalance: 0,
        pendingInvoicesCount: 0,
      };
      setCustomers([newCustomer, ...customers]);
      toast.success('Cliente registrado (modo local)');
      setIsModalOpen(false);
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.docNumber.includes(search)
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Directorio de Clientes</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Gestión comercial, condiciones de crédito y estado de cuentas por cobrar
          </p>
        </div>

        <Button onClick={() => setIsModalOpen(true)} className="sm:w-auto">
          <Plus className="w-4 h-4 mr-1.5" />
          Nuevo Cliente
        </Button>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div className="flex items-center justify-between gap-4 bg-white p-3 rounded-lg border border-neutral-200">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
          <input
            type="text"
            placeholder="Buscar por RIF, cédula o nombre del cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-xs bg-white border border-neutral-300 rounded-lg focus-visible:ring-2 focus-visible:ring-sky-500"
          />
        </div>

        <div className="text-xs text-neutral-500 font-medium">
          {filteredCustomers.length} cliente{filteredCustomers.length !== 1 ? 's' : ''} registrado{filteredCustomers.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Tabla de Clientes */}
      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="w-full text-left text-xs">
          <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Documento</th>
              <th className="py-3 px-4">Nombre / Razón Social</th>
              <th className="py-3 px-4">Contacto</th>
              <th className="py-3 px-4">Condición Fiscal</th>
              <th className="py-3 px-4">Crédito</th>
              <th className="py-3 px-4 text-right">Saldo Deudor</th>
              <th className="py-3 px-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td className="py-3 px-4"><div className="h-4 bg-neutral-200 rounded-lg w-24" /></td>
                  <td className="py-3 px-4"><div className="h-4 bg-neutral-200 rounded-lg w-48" /></td>
                  <td className="py-3 px-4"><div className="h-4 bg-neutral-200 rounded-lg w-32" /></td>
                  <td className="py-3 px-4"><div className="h-4 bg-neutral-200 rounded-lg w-20" /></td>
                  <td className="py-3 px-4"><div className="h-4 bg-neutral-200 rounded-lg w-28" /></td>
                  <td className="py-3 px-4"><div className="h-4 bg-neutral-200 rounded-lg w-16 ml-auto" /></td>
                  <td className="py-3 px-4"><div className="h-6 bg-neutral-200 rounded-lg w-20 mx-auto" /></td>
                </tr>
              ))
            ) : filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-neutral-400">
                  <Users className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
                  <p className="text-xs">No se encontraron clientes</p>
                </td>
              </tr>
            ) : (
              filteredCustomers.map((c) => (
                <tr key={c.id} className="hover:bg-neutral-50/60 transition-colors">
                  <td className="py-3 px-4 font-mono font-medium text-neutral-900">
                    {c.docType}-{c.docNumber}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-neutral-900">{c.name}</div>
                    {c.address && (
                      <div className="text-[11px] text-neutral-400 truncate max-w-xs">{c.address}</div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-neutral-600">
                    {c.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3 text-neutral-400" /> {c.phone}</div>}
                    {c.email && <div className="flex items-center gap-1 text-[11px] text-neutral-500"><Mail className="w-3 h-3 text-neutral-400" /> {c.email}</div>}
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={c.isSpecialTaxpayer ? 'warning' : 'neutral'}>
                      {c.isSpecialTaxpayer ? 'Contribuyente Especial' : 'Ordinario'}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    {c.creditEnabled ? (
                      <div>
                        <div className="font-semibold text-neutral-800">${c.creditLimit.toFixed(2)}</div>
                        <div className="text-[10px] text-neutral-500">{c.paymentTermsDays} días plazo</div>
                      </div>
                    ) : (
                      <span className="text-[11px] text-neutral-400">Contado</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`font-mono font-bold ${
                        c.currentBalance > 0 ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      ${c.currentBalance.toFixed(2)}
                    </span>
                    {c.pendingInvoicesCount > 0 && (
                      <div className="text-[10px] text-neutral-400">
                        {c.pendingInvoicesCount} factura{c.pendingInvoicesCount > 1 ? 's' : ''} pendiente
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/customers/${c.id}/statement`)}
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
                      Estado
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Nuevo Cliente */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <h3 className="text-base font-bold text-neutral-900">Registrar Nuevo Cliente</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-neutral-700 block mb-1">
                    Tipo Doc
                  </label>
                  <select
                    value={formData.docType}
                    onChange={(e) => setFormData({ ...formData, docType: e.target.value as any })}
                    className="w-full h-10 px-3 text-xs bg-white border border-neutral-300 rounded-lg focus-visible:ring-2 focus-visible:ring-sky-500 font-mono"
                  >
                    <option value="J">J - Jurídico</option>
                    <option value="V">V - Venezolano</option>
                    <option value="E">E - Extranjero</option>
                    <option value="G">G - Gobierno</option>
                    <option value="P">P - Pasaporte</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <Input
                    label="Número de Documento / RIF"
                    placeholder="Ej: 309998881"
                    value={formData.docNumber}
                    onChange={(e) => setFormData({ ...formData, docNumber: e.target.value })}
                    required
                  />
                </div>
              </div>

              <Input
                label="Nombre / Razón Social"
                placeholder="Ej: Distribuidora El Sol C.A."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Teléfono"
                  placeholder="+58 212 999 8888"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
                <Input
                  label="Correo Electrónico"
                  type="email"
                  placeholder="cliente@empresa.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <Input
                label="Dirección Fiscal"
                placeholder="Av. Principal, Edificio, Ciudad"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />

              {/* Parámetros Fiscales y Comerciales */}
              <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-50 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-800">
                    ¿Es Contribuyente Especial SENIAT?
                  </span>
                  <input
                    type="checkbox"
                    checked={formData.isSpecialTaxpayer}
                    onChange={(e) => setFormData({ ...formData, isSpecialTaxpayer: e.target.checked })}
                    className="w-4 h-4 text-sky-600 rounded cursor-pointer"
                  />
                </div>

                <div className="border-t border-neutral-200 pt-2 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-neutral-800 block">
                      ¿Habilitar Línea de Crédito?
                    </span>
                    <span className="text-[11px] text-neutral-500">
                      Permite emitir facturas en estado pendiente (CxC)
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.creditEnabled}
                    onChange={(e) => setFormData({ ...formData, creditEnabled: e.target.checked })}
                    className="w-4 h-4 text-sky-600 rounded cursor-pointer"
                  />
                </div>

                {formData.creditEnabled && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <Input
                      label="Límite de Crédito ($ USD)"
                      type="number"
                      value={formData.creditLimit}
                      onChange={(e) => setFormData({ ...formData, creditLimit: Number(e.target.value) })}
                    />
                    <Input
                      label="Plazo de Pago (Días)"
                      type="number"
                      value={formData.paymentTermsDays}
                      onChange={(e) => setFormData({ ...formData, paymentTermsDays: Number(e.target.value) })}
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </Button>
                <Button size="sm" type="submit">
                  Guardar Cliente
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
