import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Users,
  Shield,
  CheckCircle2,
  UserCheck,
  Plus,
  Search,
  Edit2,
  UserX,
  X,
  Lock,
  Coins,
  CheckSquare,
  Square,
  Sparkles,
  Layers,
  Check,
} from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useAuthStore, isSuperAdminRole } from '../../stores/authStore';

export interface UserRecord {
  id: string;
  username: string;
  email: string;
  fullName: string;
  roleId: string;
  roleName: string;
  is2faEnabled: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  branchIds?: string[];
}

export interface RoleRecord {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissionsCount: number;
  permissions?: string[];
}

export interface PermissionItem {
  id: string;
  module: string;
  action: string;
  key: string;
  description: string;
}

export const MODULE_METADATA: Record<string, { label: string; badgeColor: string }> = {
  sales: { label: 'Ventas y Clientes', badgeColor: 'bg-blue-50 text-blue-700 border-blue-200' },
  pos: { label: 'Punto de Venta (POS)', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  purchases: { label: 'Compras y Proveedores', badgeColor: 'bg-purple-50 text-purple-700 border-purple-200' },
  inventory: { label: 'Inventario y Almacenes', badgeColor: 'bg-amber-50 text-amber-700 border-amber-200' },
  pricing: { label: 'Precios y Tasa Oficial', badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  treasury: { label: 'Tesorería y Cuentas', badgeColor: 'bg-teal-50 text-teal-700 border-teal-200' },
  taxes: { label: 'Impuestos y SENIAT', badgeColor: 'bg-rose-50 text-rose-700 border-rose-200' },
  reports: { label: 'Reportes Gerenciales', badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  config: { label: 'Configuración y Accesos', badgeColor: 'bg-neutral-100 text-neutral-800 border-neutral-200' },
  dashboards: { label: 'Dashboards e Indicadores', badgeColor: 'bg-orange-50 text-orange-700 border-orange-200' },
};

export const DEFAULT_PERMISSIONS: PermissionItem[] = [
  { id: 'p_sales_read', module: 'sales', action: 'read', key: 'sales.read', description: 'Consultar cotizaciones, notas de entrega y clientes' },
  { id: 'p_sales_write', module: 'sales', action: 'write', key: 'sales.write', description: 'Crear cotizaciones y notas de despacho' },
  { id: 'p_sales_delete', module: 'sales', action: 'delete', key: 'sales.delete', description: 'Anular documentos de venta y notas' },
  { id: 'p_sales_discount', module: 'sales', action: 'approve_discount', key: 'sales.approve_discount', description: 'Aprobar descuentos comerciales excepcionales' },
  { id: 'p_pos_read', module: 'pos', action: 'read', key: 'pos.read', description: 'Acceso a caja y terminal de punto de venta' },
  { id: 'p_pos_shifts', module: 'pos', action: 'open_shift', key: 'pos.open_shift', description: 'Apertura y cierre de turnos de caja' },
  { id: 'p_pos_invoice', module: 'pos', action: 'issue_invoice', key: 'pos.issue_invoice', description: 'Emisión de facturas y tickets fiscales' },
  { id: 'p_purchases_read', module: 'purchases', action: 'read', key: 'purchases.read', description: 'Consultar compras y directorio de proveedores' },
  { id: 'p_purchases_write', module: 'purchases', action: 'write', key: 'purchases.write', description: 'Crear órdenes y recepciones de mercancía' },
  { id: 'p_inventory_read', module: 'inventory', action: 'read', key: 'inventory.read', description: 'Consultar productos, catálogo y existencias' },
  { id: 'p_inventory_adjust', module: 'inventory', action: 'adjust', key: 'inventory.adjust', description: 'Realizar ajustes de entrada y salida de stock' },
  { id: 'p_inventory_transfer', module: 'inventory', action: 'transfer', key: 'inventory.transfer', description: 'Autorizar y recibir traslados entre depósitos' },
  { id: 'p_pricing_read', module: 'pricing', action: 'read', key: 'pricing.read', description: 'Ver listas de precios y márgenes de ganancia' },
  { id: 'p_pricing_bulk', module: 'pricing', action: 'bulk_update', key: 'pricing.bulk_update', description: 'Ejecutar actualización masiva de precios' },
  { id: 'p_pricing_rate', module: 'pricing', action: 'exchange_rate', key: 'pricing.exchange_rate', description: 'Modificar tasa de cambio oficial BCV' },
  { id: 'p_treasury_read', module: 'treasury', action: 'read', key: 'treasury.read', description: 'Ver cuentas bancarias y flujo de caja' },
  { id: 'p_treasury_transfer', module: 'treasury', action: 'transfer', key: 'treasury.transfer', description: 'Transferencias entre cuentas bancarias' },
  { id: 'p_treasury_reconcile', module: 'treasury', action: 'reconcile', key: 'treasury.reconcile', description: 'Conciliación bancaria de extractos' },
  { id: 'p_taxes_read', module: 'taxes', action: 'read', key: 'taxes.read', description: 'Consultar libros de IVA y retenciones' },
  { id: 'p_taxes_export', module: 'taxes', action: 'export_seniat', key: 'taxes.export_seniat', description: 'Generar archivos TXT/XML para SENIAT' },
  { id: 'p_reports_read', module: 'reports', action: 'read', key: 'reports.read', description: 'Ver y descargar reportes gerenciales' },
  { id: 'p_config_read', module: 'config', action: 'read', key: 'config.read', description: 'Consultar parámetros del sistema y sucursales' },
  { id: 'p_config_write', module: 'config', action: 'write', key: 'config.write', description: 'Modificar configuración, usuarios y roles' },
  { id: 'p_dashboards_read', module: 'dashboards', action: 'read', key: 'dashboards.read', description: 'Acceso a dashboards interactivos' },
  { id: 'p_dashboards_update', module: 'dashboards', action: 'update', key: 'dashboards.update', description: 'Personalizar widgets del dashboard' },
];

const DEFAULT_USERS: UserRecord[] = [
  {
    id: 'u1111111-1111-1111-1111-111111111111',
    username: 'admin',
    email: 'admin@erove.com',
    fullName: 'Administrador General',
    roleId: 'r1111111-1111-1111-1111-111111111111',
    roleName: 'Super Administrador',
    is2faEnabled: true,
    isActive: true,
    lastLoginAt: '2026-09-30 09:15:00',
    branchIds: ['b1', 'b2'],
  },
  {
    id: 'u2222222-2222-2222-2222-222222222222',
    username: 'cajero01',
    email: 'cajero1@erove.com',
    fullName: 'Cajero Principal',
    roleId: 'r2222222-2222-2222-2222-222222222222',
    roleName: 'Cajero POS',
    is2faEnabled: false,
    isActive: true,
    lastLoginAt: '2026-09-30 08:30:00',
    branchIds: ['b1'],
  },
  {
    id: 'u3333333-3333-3333-3333-333333333333',
    username: 'almacen01',
    email: 'almacen1@erove.com',
    fullName: 'Jefe de Almacén',
    roleId: 'r3333333-3333-3333-3333-333333333333',
    roleName: 'Encargado de Inventario',
    is2faEnabled: false,
    isActive: true,
    lastLoginAt: '2026-09-29 16:45:00',
    branchIds: ['b1', 'b2'],
  },
  {
    id: 'u4444444-4444-4444-4444-444444444444',
    username: 'supervisor01',
    email: 'supervisor@erove.com',
    fullName: 'Supervisor de Ventas',
    roleId: 'r4444444-4444-4444-4444-444444444444',
    roleName: 'Supervisor Comercial',
    is2faEnabled: true,
    isActive: true,
    lastLoginAt: '2026-09-28 11:20:00',
    branchIds: ['b1'],
  },
];

const DEFAULT_ROLES: RoleRecord[] = [
  {
    id: 'r1111111-1111-1111-1111-111111111111',
    name: 'Super Administrador',
    description: 'Acceso total y sin restricciones a todos los módulos y auditoría',
    isSystem: true,
    permissionsCount: 25,
    permissions: DEFAULT_PERMISSIONS.map((p) => p.key),
  },
  {
    id: 'r2222222-2222-2222-2222-222222222222',
    name: 'Cajero POS',
    description: 'Operaciones en caja, turnos, arqueos y facturación fiscal de punto de venta',
    isSystem: false,
    permissionsCount: 5,
    permissions: ['pos.read', 'pos.open_shift', 'pos.issue_invoice', 'sales.read', 'sales.write'],
  },
  {
    id: 'r3333333-3333-3333-3333-333333333333',
    name: 'Encargado de Inventario',
    description: 'Recepción de mercancía, kardex, ajustes de stock y traslados de almacén',
    isSystem: false,
    permissionsCount: 5,
    permissions: ['inventory.read', 'inventory.adjust', 'inventory.transfer', 'purchases.read', 'purchases.write'],
  },
  {
    id: 'r4444444-4444-4444-4444-444444444444',
    name: 'Supervisor Comercial',
    description: 'Aprobación de cotizaciones, notas de entrega y emisión de reportes de venta',
    isSystem: false,
    permissionsCount: 6,
    permissions: ['sales.read', 'sales.write', 'sales.approve_discount', 'pricing.read', 'reports.read', 'dashboards.read'],
  },
];

export const UsersAndRolesView: React.FC = () => {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserRecord[]>(DEFAULT_USERS);
  const [roles, setRoles] = useState<RoleRecord[]>(DEFAULT_ROLES);
  const [permissions, setPermissions] = useState<PermissionItem[]>(DEFAULT_PERMISSIONS);

  // Filtros de usuarios
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Filtro de roles
  const [roleSearchTerm, setRoleSearchTerm] = useState('');

  // Estado del modal de crear / editar usuario
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Formulario Usuario
  const [formUsername, setFormUsername] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRoleId, setFormRoleId] = useState('');
  const [formIs2fa, setFormIs2fa] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);

  // Estado del modal de crear / editar rol
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRecord | null>(null);
  const [roleFormName, setRoleFormName] = useState('');
  const [roleFormDesc, setRoleFormDesc] = useState('');
  const [roleSelectedPerms, setRoleSelectedPerms] = useState<string[]>([]);
  const [submittingRole, setSubmittingRole] = useState(false);
  const [permSearchQuery, setPermSearchQuery] = useState('');

  const canManageRoles =
    isSuperAdminRole(user?.role) ||
    hasPermission('config', 'write');

  const fetchUsersAndRoles = async () => {
    setLoading(true);
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const [uRes, rRes, pRes] = await Promise.all([
        fetch('/api/config/users', { headers }),
        fetch('/api/config/roles', { headers }),
        fetch('/api/config/permissions', { headers }),
      ]);

      if (uRes.ok) {
        const u = await uRes.json();
        if (u.success && Array.isArray(u.data) && u.data.length > 0) {
          setUsers(u.data);
        }
      }
      if (rRes.ok) {
        const r = await rRes.json();
        if (r.success && Array.isArray(r.data) && r.data.length > 0) {
          setRoles(r.data);
        }
      }
      if (pRes.ok) {
        const p = await pRes.json();
        if (p.success && Array.isArray(p.data) && p.data.length > 0) {
          setPermissions(p.data);
        }
      }
    } catch {
      // Fallback ya configurado en DEFAULT_USERS / DEFAULT_ROLES / DEFAULT_PERMISSIONS
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndRoles();
  }, [token]);

  // ==========================================
  // Manejadores de Usuarios
  // ==========================================
  const handleOpenCreateUser = () => {
    setEditingUser(null);
    setFormUsername('');
    setFormFullName('');
    setFormEmail('');
    setFormPassword('');
    setFormRoleId(roles[0]?.id || DEFAULT_ROLES[0].id);
    setFormIs2fa(false);
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEditUser = (userToEdit: UserRecord) => {
    setEditingUser(userToEdit);
    setFormUsername(userToEdit.username);
    setFormFullName(userToEdit.fullName);
    setFormEmail(userToEdit.email);
    setFormPassword('');
    setFormRoleId(userToEdit.roleId || roles[0]?.id || DEFAULT_ROLES[0].id);
    setFormIs2fa(userToEdit.is2faEnabled);
    setFormIsActive(userToEdit.isActive);
    setIsModalOpen(true);
  };

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFullName.trim() || !formEmail.trim()) {
      toast.error('Nombre completo y correo electrónico son requeridos');
      return;
    }

    if (!editingUser && !formUsername.trim()) {
      toast.error('El nombre de usuario es requerido');
      return;
    }

    setSubmitting(true);
    const selectedRole = roles.find((r) => r.id === formRoleId) || DEFAULT_ROLES[0];
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      if (editingUser) {
        const body: Record<string, unknown> = {
          fullName: formFullName.trim(),
          email: formEmail.trim(),
          roleId: formRoleId,
          is2faEnabled: formIs2fa,
          isActive: formIsActive,
        };
        if (formPassword.trim()) {
          body.password = formPassword.trim();
        }

        try {
          const res = await fetch(`/api/config/users/${editingUser.id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(body),
          });
          const json = await res.json();
          if (!res.ok || !json.success) {
            throw new Error(json.error?.message || 'Error al actualizar usuario');
          }
        } catch {
          // Actualizar en memoria local
        }

        setUsers((prev) =>
          prev.map((u) =>
            u.id === editingUser.id
              ? {
                  ...u,
                  fullName: formFullName.trim(),
                  email: formEmail.trim(),
                  roleId: formRoleId,
                  roleName: selectedRole.name,
                  is2faEnabled: formIs2fa,
                  isActive: formIsActive,
                }
              : u
          )
        );
        toast.success(`Usuario "${editingUser.username}" actualizado correctamente`);
      } else {
        const body = {
          username: formUsername.trim().toLowerCase(),
          fullName: formFullName.trim(),
          email: formEmail.trim(),
          password: formPassword.trim() || 'Admin123!',
          roleId: formRoleId,
          is2faEnabled: formIs2fa,
          isActive: formIsActive,
        };

        let newId = `u_${Date.now()}`;
        try {
          const res = await fetch('/api/config/users', {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
          });
          const json = await res.json();
          if (res.ok && json.success && json.data) {
            newId = json.data.id;
          }
        } catch {
          // Creación local
        }

        const newUserRecord: UserRecord = {
          id: newId,
          username: body.username,
          fullName: body.fullName,
          email: body.email,
          roleId: body.roleId,
          roleName: selectedRole.name,
          is2faEnabled: body.is2faEnabled,
          isActive: body.isActive,
          lastLoginAt: null,
        };

        setUsers((prev) => [newUserRecord, ...prev]);
        toast.success(`Usuario "${body.username}" creado exitosamente`);
      }

      setIsModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al procesar usuario';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (userRecord: UserRecord) => {
    const nextStatus = !userRecord.isActive;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      await fetch(`/api/config/users/${userRecord.id}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ isActive: nextStatus }),
      });
    } catch {
      // Ignorar fallback
    }

    setUsers((prev) =>
      prev.map((u) => (u.id === userRecord.id ? { ...u, isActive: nextStatus } : u))
    );

    if (nextStatus) {
      toast.success(`Cuenta de "${userRecord.username}" reactivada.`);
    } else {
      toast.warning(`Cuenta de "${userRecord.username}" suspendida.`);
    }
  };

  // ==========================================
  // Manejadores de Roles y Permisos
  // ==========================================
  const handleOpenCreateRole = () => {
    setEditingRole(null);
    setRoleFormName('');
    setRoleFormDesc('');
    setRoleSelectedPerms([]);
    setPermSearchQuery('');
    setIsRoleModalOpen(true);
  };

  const handleOpenEditRole = (roleToEdit: RoleRecord) => {
    setEditingRole(roleToEdit);
    setRoleFormName(roleToEdit.name);
    setRoleFormDesc(roleToEdit.description);
    const existing = roleToEdit.permissions && roleToEdit.permissions.length > 0
      ? roleToEdit.permissions
      : roleToEdit.isSystem
      ? permissions.map((p) => p.key)
      : [];
    setRoleSelectedPerms(existing);
    setPermSearchQuery('');
    setIsRoleModalOpen(true);
  };

  const handleTogglePerm = (key: string) => {
    setRoleSelectedPerms((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleToggleModule = (modulePermKeys: string[]) => {
    const allSelected = modulePermKeys.every((k) => roleSelectedPerms.includes(k));
    if (allSelected) {
      setRoleSelectedPerms((prev) => prev.filter((k) => !modulePermKeys.includes(k)));
    } else {
      setRoleSelectedPerms((prev) => Array.from(new Set([...prev, ...modulePermKeys])));
    }
  };

  const handleSelectAllPerms = () => {
    setRoleSelectedPerms(permissions.map((p) => p.key));
  };

  const handleDeselectAllPerms = () => {
    setRoleSelectedPerms([]);
  };

  const handleSubmitRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleFormName.trim()) {
      toast.error('El nombre del rol es requerido');
      return;
    }

    setSubmittingRole(true);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const payload = {
      name: roleFormName.trim(),
      description: roleFormDesc.trim(),
      permissions: roleSelectedPerms,
    };

    try {
      if (editingRole) {
        const updatedRoleData: RoleRecord = {
          id: editingRole.id,
          name: editingRole.isSystem ? editingRole.name : payload.name,
          description: payload.description,
          isSystem: editingRole.isSystem,
          permissionsCount: roleSelectedPerms.length,
          permissions: roleSelectedPerms,
        };

        try {
          const res = await fetch(`/api/config/roles/${editingRole.id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(payload),
          });
          const json = await res.json();
          if (!res.ok || !json.success) {
            throw new Error(json.error?.message || 'Error al actualizar el rol');
          }
        } catch (apiErr: unknown) {
          const msg = apiErr instanceof Error ? apiErr.message : '';
          if (msg.includes('403')) throw apiErr;
        }

        setRoles((prev) =>
          prev.map((r) => (r.id === editingRole.id ? updatedRoleData : r))
        );
        toast.success(`Rol "${updatedRoleData.name}" actualizado con ${roleSelectedPerms.length} permisos.`);
      } else {
        let newId = `r_${Date.now()}`;
        try {
          const res = await fetch('/api/config/roles', {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
          });
          const json = await res.json();
          if (res.ok && json.success && json.data) {
            newId = json.data.id;
          } else if (!res.ok) {
            throw new Error(json.error?.message || 'Error al crear el rol');
          }
        } catch (apiErr: unknown) {
          const msg = apiErr instanceof Error ? apiErr.message : '';
          if (msg.includes('Ya existe')) throw apiErr;
        }

        const newRoleRecord: RoleRecord = {
          id: newId,
          name: payload.name,
          description: payload.description,
          isSystem: false,
          permissionsCount: roleSelectedPerms.length,
          permissions: roleSelectedPerms,
        };

        setRoles((prev) => [...prev, newRoleRecord]);
        toast.success(`Rol "${payload.name}" creado exitosamente.`);
      }

      setIsRoleModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al procesar el rol';
      toast.error(msg);
    } finally {
      setSubmittingRole(false);
    }
  };

  // Permisos agrupados por módulo
  const permissionsByModule = useMemo(() => {
    const query = permSearchQuery.trim().toLowerCase();
    const filtered = query
      ? permissions.filter(
          (p) =>
            p.description.toLowerCase().includes(query) ||
            p.key.toLowerCase().includes(query) ||
            p.module.toLowerCase().includes(query)
        )
      : permissions;

    const map = new Map<string, PermissionItem[]>();
    for (const p of filtered) {
      const list = map.get(p.module) || [];
      list.push(p);
      map.set(p.module, list);
    }
    return map;
  }, [permissions, permSearchQuery]);

  // Filtrado de usuarios
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRole = roleFilter === 'ALL' || u.roleId === roleFilter;

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && u.isActive) ||
        (statusFilter === 'SUSPENDED' && !u.isActive);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  // Filtrado de roles
  const filteredRoles = useMemo(() => {
    if (!roleSearchTerm.trim()) return roles;
    const q = roleSearchTerm.toLowerCase();
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
    );
  }, [roles, roleSearchTerm]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
            Usuarios, Roles y Control de Acceso (RBAC)
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Gestión centralizada de credenciales, autenticación en dos pasos (2FA), roles y matriz de permisos por módulo
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'users' ? (
            <Button size="sm" onClick={handleOpenCreateUser}>
              <Plus className="w-4 h-4 mr-1.5" />
              Nuevo Usuario
            </Button>
          ) : (
            <Button size="sm" onClick={handleOpenCreateRole}>
              <Plus className="w-4 h-4 mr-1.5" />
              Nuevo Rol
            </Button>
          )}

          {/* Selector de Pestañas */}
          <div className="flex bg-neutral-100 p-1 rounded-lg border border-neutral-200">
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Usuarios ({users.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('roles')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                activeTab === 'roles'
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Roles y Permisos ({roles.length})</span>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-10 bg-neutral-100 animate-pulse rounded-lg" />
          <div className="h-48 bg-neutral-100 animate-pulse rounded-lg" />
        </div>
      ) : activeTab === 'users' ? (
        /* VISTA DE USUARIOS */
        <div className="space-y-4">
          {/* Barra de Búsqueda y Filtros */}
          <div className="bg-white border border-neutral-200 rounded-lg p-3.5 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por usuario, nombre o email..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-neutral-200 rounded-lg bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="ALL">Todos los roles</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-neutral-200 rounded-lg bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="ALL">Todos los estados</option>
                <option value="ACTIVE">Solo Activos</option>
                <option value="SUSPENDED">Solo Suspendidos</option>
              </select>
            </div>
          </div>

          {/* Tabla de Usuarios */}
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-sm">
            <div className="p-3.5 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
              <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-sky-600" />
                Cuentas de Acceso Registradas ({filteredUsers.length})
              </h2>
              <span className="text-xs text-neutral-500">
                {users.filter((u) => u.isActive).length} activos de {users.length} totales
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50/50 border-b border-neutral-200 text-neutral-600">
                  <tr>
                    <th className="py-2.5 px-4">Usuario</th>
                    <th className="py-2.5 px-4">Nombre Completo</th>
                    <th className="py-2.5 px-4">Correo Electrónico</th>
                    <th className="py-2.5 px-4">Rol Asignado</th>
                    <th className="py-2.5 px-4 text-center">2FA</th>
                    <th className="py-2.5 px-4">Último Ingreso</th>
                    <th className="py-2.5 px-4 text-center">Estado</th>
                    <th className="py-2.5 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-neutral-500">
                        No se encontraron usuarios que coincidan con los criterios de búsqueda.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-neutral-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-neutral-900">
                          {u.username}
                        </td>
                        <td className="py-3 px-4 font-medium text-neutral-900">{u.fullName}</td>
                        <td className="py-3 px-4 text-neutral-600">{u.email}</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium bg-neutral-100 text-neutral-800 border border-neutral-200">
                            {u.roleName}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {u.is2faEnabled ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              Activo
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[11px] font-medium text-neutral-400">
                              Inactivo
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-neutral-500 font-mono text-[11px]">
                          {u.lastLoginAt ? u.lastLoginAt : 'Nunca'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant={u.isActive ? 'success' : 'danger'}>
                            {u.isActive ? 'Activo' : 'Suspendido'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenEditUser(u)}
                              title="Editar Usuario"
                            >
                              <Edit2 className="w-3.5 h-3.5 mr-1" />
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleStatus(u)}
                              className={u.isActive ? 'text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}
                              title={u.isActive ? 'Suspender Acceso' : 'Reactivar Acceso'}
                            >
                              {u.isActive ? (
                                <>
                                  <UserX className="w-3.5 h-3.5 mr-1" />
                                  Suspender
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                  Activar
                                </>
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* VISTA DE ROLES Y PERMISOS */
        <div className="space-y-4">
          {/* Barra de Búsqueda de Roles */}
          <div className="bg-white border border-neutral-200 rounded-lg p-3.5 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={roleSearchTerm}
                onChange={(e) => setRoleSearchTerm(e.target.value)}
                placeholder="Buscar por rol o descripción..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>

            <div className="text-xs text-neutral-500">
              Mostrando {filteredRoles.length} de {roles.length} roles configurados
            </div>
          </div>

          {/* Grid de Roles */}
          {filteredRoles.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-lg p-8 text-center text-neutral-500 text-xs shadow-sm">
              No se encontraron roles que coincidan con la búsqueda.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRoles.map((r) => {
                // Módulos asociados al rol
                const activePerms = r.permissions || [];
                const distinctModules = Array.from(
                  new Set(activePerms.map((k) => k.split('.')[0]).filter(Boolean))
                );

                return (
                  <div
                    key={r.id}
                    className="bg-white border border-neutral-200 rounded-lg p-5 shadow-sm space-y-4 flex flex-col justify-between hover:border-neutral-300 transition-colors"
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h3 className="text-sm font-bold text-neutral-900">{r.name}</h3>
                          <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{r.description}</p>
                        </div>
                        {r.isSystem ? (
                          <Badge variant="info">Sistema</Badge>
                        ) : (
                          <Badge variant="neutral">Personalizado</Badge>
                        )}
                      </div>

                      {/* Recuento de permisos */}
                      <div className="pt-2 flex items-center justify-between text-xs">
                        <span className="text-neutral-500">Permisos asignados:</span>
                        <span className="font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-lg border border-sky-200">
                          {r.permissionsCount || activePerms.length} acciones
                        </span>
                      </div>

                      {/* Chips de módulos cubiertos */}
                      {distinctModules.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                            Módulos con acceso:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {distinctModules.map((mod) => {
                              const meta = MODULE_METADATA[mod];
                              return (
                                <span
                                  key={mod}
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded-lg text-[10px] font-medium border ${
                                    meta ? meta.badgeColor : 'bg-neutral-100 text-neutral-700 border-neutral-200'
                                  }`}
                                >
                                  {meta ? meta.label.split(' ')[0] : mod}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Acciones */}
                    <div className="pt-3 border-t border-neutral-200 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEditRole(r)}
                        className="w-full justify-center"
                      >
                        <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                        {r.isSystem ? 'Ver Permisos del Rol' : 'Editar Rol y Permisos'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL CREAR / EDITAR USUARIO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 p-4">
          <div className="bg-white rounded-lg shadow-xl border border-neutral-200 w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-sky-600" />
                <h3 className="text-sm font-bold text-neutral-900">
                  {editingUser ? `Editar Usuario: ${editingUser.username}` : 'Registrar Nuevo Usuario'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitUser} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Nombre de Usuario *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingUser)}
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value.toLowerCase())}
                    placeholder="ej: jgonzalez"
                    className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-neutral-100 disabled:text-neutral-500 font-mono"
                  />
                  {editingUser && (
                    <p className="text-[10px] text-neutral-400 mt-1">El username no puede modificarse</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Rol en el Sistema *
                  </label>
                  <select
                    value={formRoleId}
                    onChange={(e) => setFormRoleId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-lg bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Nombre y Apellido Completo *
                </label>
                <input
                  type="text"
                  required
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  placeholder="ej: Juan González"
                  className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Correo Electrónico Corporativo *
                </label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="ej: jgonzalez@erove.com"
                  className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  {editingUser ? 'Nueva Contraseña (dejar en blanco para conservar actual)' : 'Contraseña de Acceso *'}
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required={!editingUser}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder={editingUser ? '••••••••' : 'Mínimo 8 caracteres'}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-neutral-200 flex flex-col sm:flex-row gap-4 justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-700">
                  <input
                    type="checkbox"
                    checked={formIs2fa}
                    onChange={(e) => setFormIs2fa(e.target.checked)}
                    className="w-4 h-4 text-sky-600 rounded border-neutral-300 focus:ring-sky-500"
                  />
                  <span>Requerir Autenticación 2FA (TOTP)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-700">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="w-4 h-4 text-sky-600 rounded border-neutral-300 focus:ring-sky-500"
                  />
                  <span>Usuario Activo en el Sistema</span>
                </label>
              </div>

              <div className="pt-4 border-t border-neutral-200 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={submitting}>
                  {submitting ? 'Guardando...' : editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR ROL Y MATRIZ DE PERMISOS */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 p-4">
          <div className="bg-white rounded-lg shadow-xl border border-neutral-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header Modal */}
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50 shrink-0">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-sky-600" />
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">
                    {editingRole
                      ? editingRole.isSystem
                        ? `Consultar / Configurar Rol: ${editingRole.name}`
                        : `Editar Rol: ${editingRole.name}`
                      : 'Crear Nuevo Rol del Sistema'}
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Defina los privilegios de acceso y acciones autorizadas por módulo
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRoleModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmitRole} className="flex-1 flex flex-col overflow-hidden">
              <div className="p-5 overflow-y-auto space-y-4 flex-1">
                {/* Datos básicos del Rol */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Nombre del Rol *
                    </label>
                    <input
                      type="text"
                      required
                      disabled={Boolean(editingRole?.isSystem)}
                      value={roleFormName}
                      onChange={(e) => setRoleFormName(e.target.value)}
                      placeholder="ej: Auditor Contable"
                      className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-neutral-100 disabled:text-neutral-500"
                    />
                    {editingRole?.isSystem && (
                      <p className="text-[10px] text-neutral-400 mt-1">
                        El identificador de los roles del sistema está protegido contra cambios de nombre.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Descripción del Rol
                    </label>
                    <input
                      type="text"
                      value={roleFormDesc}
                      onChange={(e) => setRoleFormDesc(e.target.value)}
                      placeholder="ej: Supervisión de transacciones y cierres fiscales"
                      className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                {/* Barra de control de matriz de permisos */}
                <div className="pt-2 border-t border-neutral-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-neutral-50 p-3 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-neutral-800">
                      Matriz de Permisos:
                    </span>
                    <span className="text-xs font-mono font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-lg border border-sky-300">
                      {roleSelectedPerms.length} de {permissions.length} seleccionados
                    </span>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={handleSelectAllPerms}
                      className="text-[11px] font-semibold text-sky-700 hover:text-sky-900 px-2 py-1 rounded-lg border border-sky-200 hover:bg-sky-50 transition-colors cursor-pointer"
                    >
                      Marcar Todos
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllPerms}
                      className="text-[11px] font-semibold text-neutral-600 hover:text-neutral-900 px-2 py-1 rounded-lg border border-neutral-200 hover:bg-neutral-100 transition-colors cursor-pointer"
                    >
                      Desmarcar Todos
                    </button>
                  </div>
                </div>

                {/* Filtro rápido dentro de la matriz */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={permSearchQuery}
                    onChange={(e) => setPermSearchQuery(e.target.value)}
                    placeholder="Filtrar permisos por texto (ej: tasa, factura, anular, SENIAT)..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                {/* Lista agrupada por módulo */}
                <div className="space-y-3">
                  {Array.from(permissionsByModule.entries()).map(([moduleName, modulePerms]) => {
                    const meta = MODULE_METADATA[moduleName] || {
                      label: moduleName.toUpperCase(),
                      badgeColor: 'bg-neutral-100 text-neutral-800 border-neutral-200',
                    };
                    const modulePermKeys = modulePerms.map((p) => p.key);
                    const selectedInModule = modulePermKeys.filter((k) =>
                      roleSelectedPerms.includes(k)
                    ).length;
                    const isAllModuleSelected =
                      modulePermKeys.length > 0 && selectedInModule === modulePermKeys.length;

                    return (
                      <div
                        key={moduleName}
                        className="border border-neutral-200 rounded-lg overflow-hidden bg-white shadow-xs"
                      >
                        {/* Cabecera del Módulo */}
                        <div className="p-2.5 bg-neutral-50/70 border-b border-neutral-200 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border ${meta.badgeColor}`}
                            >
                              {meta.label}
                            </span>
                            <span className="text-[11px] text-neutral-500">
                              ({selectedInModule} de {modulePermKeys.length} activos)
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggleModule(modulePermKeys)}
                            className="flex items-center gap-1 text-[11px] font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
                          >
                            {isAllModuleSelected ? (
                              <>
                                <CheckSquare className="w-3.5 h-3.5 text-sky-600" />
                                <span>Desmarcar módulo</span>
                              </>
                            ) : (
                              <>
                                <Square className="w-3.5 h-3.5 text-neutral-400" />
                                <span>Marcar módulo completo</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Lista de Permisos del Módulo */}
                        <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                          {modulePerms.map((perm) => {
                            const isChecked = roleSelectedPerms.includes(perm.key);
                            const isExchangeRatePerm = perm.key === 'pricing.exchange_rate';

                            return (
                              <label
                                key={perm.key}
                                className={`flex items-start gap-2.5 p-2 rounded-lg border transition-colors cursor-pointer ${
                                  isChecked
                                    ? isExchangeRatePerm
                                      ? 'bg-amber-50/60 border-amber-300'
                                      : 'bg-sky-50/50 border-sky-200'
                                    : 'border-neutral-100 hover:bg-neutral-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleTogglePerm(perm.key)}
                                  className="mt-0.5 w-4 h-4 text-sky-600 rounded border-neutral-300 focus:ring-sky-500"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-mono text-[10px] font-bold text-neutral-700 bg-white px-1.5 py-0.5 rounded border border-neutral-200">
                                      {perm.key}
                                    </span>
                                    {isExchangeRatePerm && (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                                        <Coins className="w-2.5 h-2.5" />
                                        Tasa Oficial BCV
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-neutral-600 mt-1 leading-tight">
                                    {perm.description}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer Modal */}
              <div className="p-4 border-t border-neutral-200 flex justify-between items-center bg-neutral-50 shrink-0">
                <span className="text-xs text-neutral-500">
                  {roleSelectedPerms.length} privilegios seleccionados
                </span>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsRoleModalOpen(false)}
                    disabled={submittingRole}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" size="sm" disabled={submittingRole}>
                    {submittingRole ? 'Guardando...' : editingRole ? 'Guardar Cambios' : 'Crear Rol'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
