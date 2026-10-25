import React, { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore, isSuperAdminRole } from "../stores/authStore";
import { showConfirmQuestion } from "../lib/sweetalert";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Layers,
  MapPin,
  TrendingUp,
  Percent,
  FileText,
  Building2,
  Warehouse,
  Menu,
  X,
  LogOut,
  User,
  ArrowRightLeft,
  Users,
  CreditCard,
  Truck,
  Clock,
  Landmark,
  BookOpen,
  FileCheck,
  Calculator,
  History,
  SlidersHorizontal,
  ShoppingBag,
  PackageCheck,
  FileSpreadsheet,
  Send,
  KeyRound,
  ShieldCheck,
  ClipboardCheck,
  ChevronDown,
  Coins,
  Edit2,
  Lock,
  RefreshCw,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  Utensils,
  ChefHat,
  Sun,
  Moon,
} from "lucide-react";
import { useExchangeRateStore } from "../stores/exchangeRateStore";
import { useThemeStore } from "../stores/themeStore";
import { BcvRateAutoSyncModal } from "../components/BcvRateAutoSyncModal";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";
import { toast } from "sonner";
import { formatExchangeRate, formatMoneyVES } from "@ero/shared";

interface NavSubItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  module: string;
  action: string;
}

interface NavGroup {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  to?: string;
  module?: string;
  action?: string;
  children?: NavSubItem[];
}

export const MainLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Estado para colapsar / ocultar el sidebar en pantallas grandes (Desktop)
  const [desktopSidebarVisible, setDesktopSidebarVisible] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("ero_desktop_sidebar_visible");
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });

  const toggleDesktopSidebar = () => {
    setDesktopSidebarVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("ero_desktop_sidebar_visible", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Estado y listeners para el modo Pantalla Completa
  const [isFullscreen, setIsFullscreen] = useState<boolean>(
    typeof document !== "undefined" ? Boolean(document.fullscreenElement) : false
  );

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch {
      // Ignorar rechazo si el navegador bloquea fullscreen
    }
  };

  // Atajo de teclado: Ctrl+B o Cmd+B para alternar el menú lateral
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleDesktopSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const { user, logout, activeBranchId, activeWarehouseId, hasPermission } =
    useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const { resolvedTheme, toggleTheme } = useThemeStore();

  const rate = useExchangeRateStore((s) => s.rate);
  const source = useExchangeRateStore((s) => s.source);
  const history = useExchangeRateStore((s) => s.history);
  const isHistoryLoading = useExchangeRateStore((s) => s.isHistoryLoading);
  const updateRate = useExchangeRateStore((s) => s.updateRate);
  const fetchRate = useExchangeRateStore((s) => s.fetchRate);
  const fetchHistory = useExchangeRateStore((s) => s.fetchHistory);
  const bcvLiveData = useExchangeRateStore((s) => s.bcvLiveData);
  const checkBcvLiveRate = useExchangeRateStore((s) => s.checkBcvLiveRate);
  const isBcvChecking = useExchangeRateStore((s) => s.isBcvChecking);

  const [showRateModal, setShowRateModal] = useState(false);
  const [showBcvPromptModal, setShowBcvPromptModal] = useState(false);
  const [activeRateTab, setActiveRateTab] = useState<"update" | "history">(
    "update",
  );
  const [formRate, setFormRate] = useState(rate.toString());
  const [formSource, setFormSource] = useState(source);
  const [formNotes, setFormNotes] = useState("");
  const [isUpdatingRate, setIsUpdatingRate] = useState(false);

  useEffect(() => {
    fetchRate();
  }, [fetchRate]);

  useEffect(() => {
    setFormRate(rate.toString());
    setFormSource(source);
  }, [rate, source]);

  const canEditRate =
    isSuperAdminRole(user?.role) ||
    hasPermission("pricing", "exchange_rate") ||
    hasPermission("pricing", "bulk_update") ||
    hasPermission("config", "write");

  // Tarea automática: verifica periódicamente el BCV siempre que el usuario tenga permitido cambiar la tasa
  useEffect(() => {
    if (!canEditRate) return;

    const today = new Date().toISOString().split("T")[0];
    const dismissedKey = `ero_bcv_prompt_dismissed_${today}`;

    const checkRate = async () => {
      if (sessionStorage.getItem(dismissedKey)) return;

      try {
        const data = await checkBcvLiveRate();
        if (data && data.needsUpdate) {
          setShowBcvPromptModal(true);
        }
      } catch {
        // Ignorar fallas silenciosas de red
      }
    };

    const initialTimer = setTimeout(checkRate, 2500);
    const interval = setInterval(checkRate, 30 * 60 * 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [canEditRate, checkBcvLiveRate]);

  const handleDismissBcvPrompt = () => {
    const today = new Date().toISOString().split("T")[0];
    sessionStorage.setItem(`ero_bcv_prompt_dismissed_${today}`, "true");
    setShowBcvPromptModal(false);
  };

  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(formRate);
    if (isNaN(parsed) || parsed <= 0) {
      toast.error("Ingrese una tasa de cambio válida mayor a 0");
      return;
    }
    setIsUpdatingRate(true);
    try {
      await updateRate(parsed, formSource, formNotes);
      toast.success(
        `Tasa oficial actualizada a Bs. ${formatExchangeRate(parsed, 4)} por USD`,
      );
      setShowRateModal(false);
      setFormNotes("");
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar la tasa");
    } finally {
      setIsUpdatingRate(false);
    }
  };

  const handleLogout = async () => {
    const confirmed = await showConfirmQuestion({
      title: "¿Seguro que desea cerrar sesión?",
      text: "¿Estás seguro de que deseas cerrar sesión?",
      confirmButtonText: "Sí, cerrar sesión",
      cancelButtonText: "Cancelar",
      icon: "question",
    });
    if (!confirmed) return;
    logout();
    navigate("/login", { replace: true });
  };

  const navGroups: NavGroup[] = [
    {
      id: "dashboards",
      title: "Dashboard General",
      icon: LayoutDashboard,
      to: "/dashboard",
      module: "dashboards",
      action: "read",
    },
    {
      id: "sales",
      title: "Ventas & Puntos de Venta",
      icon: ShoppingCart,
      children: [
        {
          label: "Punto de Venta (POS)",
          to: "/pos/caja",
          icon: ShoppingCart,
          module: "pos",
          action: "read",
        },
        {
          label: "Cierre de Caja & Arqueo",
          to: "/pos/cierre",
          icon: Calculator,
          module: "pos",
          action: "read",
        },
        {
          label: "Verificación de Arqueos",
          to: "/pos/auditoria-arqueos",
          icon: ClipboardCheck,
          module: "pos",
          action: "audit_shifts",
        },
        {
          label: "Cotizaciones (Presupuestos)",
          to: "/sales/quotations",
          icon: FileSpreadsheet,
          module: "sales",
          action: "read",
        },
        {
          label: "Notas de Entrega (Despachos)",
          to: "/sales/deliveries",
          icon: Send,
          module: "sales",
          action: "read",
        },
        {
          label: "Notas de Crédito & Débito",
          to: "/sales/credit-debit-notes",
          icon: ArrowRightLeft,
          module: "sales",
          action: "read",
        },
        {
          label: "Directorio de Clientes",
          to: "/customers",
          icon: Users,
          module: "customers",
          action: "read",
        },
        {
          label: "Cuentas por Cobrar (CxC)",
          to: "/receivables",
          icon: CreditCard,
          module: "receivables",
          action: "read",
        },
      ],
    },
    {
      id: "restaurant",
      title: "Restaurante & Comandas",
      icon: Utensils,
      children: [
        {
          label: "Toma de Pedidos (Mesas)",
          to: "/restaurant/orders",
          icon: Utensils,
          module: "pos",
          action: "read",
        },
        {
          label: "Cocina & Barra (KDS)",
          to: "/restaurant/kds",
          icon: ChefHat,
          module: "pos",
          action: "read",
        },
      ],
    },
    {
      id: "purchases",
      title: "Compras & Abastecimiento",
      icon: ShoppingBag,
      children: [
        {
          label: "Directorio de Proveedores",
          to: "/suppliers",
          icon: Truck,
          module: "suppliers",
          action: "read",
        },
        {
          label: "Órdenes de Compra",
          to: "/purchases/orders",
          icon: ShoppingBag,
          module: "purchases",
          action: "read",
        },
        {
          label: "Recepción de Mercancía",
          to: "/purchases/receipts",
          icon: PackageCheck,
          module: "purchases",
          action: "read",
        },
        {
          label: "Cuentas por Pagar (CxP)",
          to: "/payables",
          icon: Clock,
          module: "payables",
          action: "read",
        },
      ],
    },
    {
      id: "inventory",
      title: "Inventario & Almacenes",
      icon: Package,
      children: [
        {
          label: "Catálogo de Productos",
          to: "/inventory/products",
          icon: Package,
          module: "inventory",
          action: "read",
        },
        {
          label: "Jerarquía de Productos",
          to: "/inventory/hierarchy",
          icon: Layers,
          module: "inventory",
          action: "read",
        },
        {
          label: "Ubicaciones Físicas",
          to: "/inventory/locations",
          icon: MapPin,
          module: "inventory",
          action: "read",
        },
        {
          label: "Kardex Valorizado",
          to: "/inventory/kardex",
          icon: History,
          module: "inventory",
          action: "read",
        },
        {
          label: "Ajustes de Inventario",
          to: "/inventory/adjustments",
          icon: SlidersHorizontal,
          module: "inventory",
          action: "adjust",
        },
        {
          label: "Traslados entre Depósitos",
          to: "/inventory/transfers",
          icon: ArrowRightLeft,
          module: "inventory",
          action: "transfer",
        },
      ],
    },
    {
      id: "pricing",
      title: "Precios & Tarifas",
      icon: TrendingUp,
      children: [
        {
          label: "Cambio Masivo de Precios",
          to: "/pricing/bulk-update",
          icon: TrendingUp,
          module: "pricing",
          action: "bulk_update",
        },
        {
          label: "Tasas de Impuestos",
          to: "/pricing/tax-rates",
          icon: Percent,
          module: "pricing",
          action: "apply_tax",
        },
      ],
    },
    {
      id: "treasury",
      title: "Tesorería & Bancos",
      icon: Landmark,
      to: "/treasury",
      module: "treasury",
      action: "read",
    },
    {
      id: "taxes",
      title: "Tributos SENIAT",
      icon: BookOpen,
      children: [
        {
          label: "Retenciones IVA/ISLR",
          to: "/taxes/withholdings",
          icon: FileText,
          module: "taxes",
          action: "read",
        },
        {
          label: "Libro de Compras Fiscal",
          to: "/taxes/books/purchases",
          icon: BookOpen,
          module: "taxes",
          action: "read",
        },
        {
          label: "Libro de Ventas Fiscal",
          to: "/taxes/books/sales",
          icon: BookOpen,
          module: "taxes",
          action: "read",
        },
        {
          label: "Certificado ARCV (ISLR)",
          to: "/taxes/arcv",
          icon: FileCheck,
          module: "taxes",
          action: "read",
        },
      ],
    },
    {
      id: "reports",
      title: "Reportes & Exportación",
      icon: FileText,
      to: "/reports",
      module: "reports",
      action: "export_pdf",
    },
    {
      id: "config",
      title: "Configuración & Auditoría",
      icon: Building2,
      children: [
        {
          label: "Empresa & Reglas",
          to: "/config/company",
          icon: Building2,
          module: "config",
          action: "read",
        },
        {
          label: "Medios de Pago",
          to: "/config/payment-methods",
          icon: CreditCard,
          module: "config",
          action: "read",
        },
        {
          label: "Usuarios & Permisos",
          to: "/config/users",
          icon: Users,
          module: "config",
          action: "read",
        },
        {
          label: "Licenciamiento",
          to: "/config/licenses",
          icon: KeyRound,
          module: "config",
          action: "read",
        },
        {
          label: "Bitácora de Auditoría",
          to: "/audit/logs",
          icon: ShieldCheck,
          module: "audit",
          action: "read",
        },
      ],
    },
  ];

  // Estado de grupos abiertos
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navGroups.forEach((g) => {
      if (g.children) {
        const matches = g.children.some(
          (c) =>
            location.pathname === c.to ||
            location.pathname.startsWith(`${c.to}/`),
        );
        if (matches) initial[g.id] = true;
      }
    });
    return initial;
  });

  // Auto-expandir grupo cuando la ruta activa cambie
  useEffect(() => {
    navGroups.forEach((g) => {
      if (g.children) {
        const matches = g.children.some(
          (c) =>
            location.pathname === c.to ||
            location.pathname.startsWith(`${c.to}/`),
        );
        if (matches) {
          setOpenGroups((prev) => ({ ...prev, [g.id]: true }));
        }
      }
    });
  }, [location.pathname]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  // Filtrado por permisos
  const isSuper = isSuperAdminRole(user?.role);
  const filteredGroups = isSuper
    ? navGroups
    : navGroups
        .map((group) => {
          if (group.children) {
            const visibleChildren = group.children.filter((child) =>
              hasPermission(child.module, child.action),
            );
            return {
              ...group,
              children: visibleChildren,
            };
          }
          const isVisible =
            group.module && group.action
              ? hasPermission(group.module, group.action)
              : true;
          return isVisible ? group : null;
        })
        .filter((group): group is NavGroup => {
          if (!group) return false;
          if (group.children) return group.children.length > 0;
          return true;
        });

  // Sucursales y almacenes autorizados para etiquetas dinámicas
  const [branchesList, setBranchesList] = useState<any[]>([]);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    let isMounted = true;
    const fetchBranches = async () => {
      if (!token) return;
      try {
        const res = await fetch("/api/auth/branches", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data) && isMounted) {
            setBranchesList(json.data);
          }
        }
      } catch {
        // Fallback silencioso
      }
    };
    fetchBranches();
    return () => {
      isMounted = false;
    };
  }, [token]);

  // Etiquetas dinámicas de sucursal y depósito
  const activeBranchObj = branchesList.find((b) => b.id === activeBranchId);
  const branchLabel = activeBranchObj
    ? `${activeBranchObj.name} (${activeBranchObj.code})`
    : activeBranchId === "b2222222-2222-2222-2222-222222222222"
      ? "Las Mercedes (SUC-02)"
      : "Principal Caracas (SUC-01)";

  const activeWarehouseObj = activeBranchObj?.warehouses?.find(
    (w: any) => w.id === activeWarehouseId,
  );
  const warehouseLabel = activeWarehouseObj
    ? `${activeWarehouseObj.name} (${activeWarehouseObj.code})`
    : activeWarehouseId === "w2222222-2222-2222-2222-222222222222"
      ? "Depósito Piso de Venta (TIENDA-01)"
      : "Almacén Central (ALM-01)";

  const canSwitchBranch =
    isSuper ||
    (user?.allBranches !== false ? branchesList.length > 1 : (user?.branches || []).length > 1);

  const canSwitchWarehouse =
    isSuper ||
    (user?.canSwitchWarehouses !== false && (activeBranchObj?.warehouses || []).length > 1);

  const canSwitchEnv = canSwitchBranch || canSwitchWarehouse;

  return (
    <div className="flex h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 overflow-hidden">
      {/* Sidebar Móvil Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-neutral-900/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-neutral-900 text-neutral-300 flex flex-col transition-all duration-300 ease-in-out shrink-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } ${
          desktopSidebarVisible
            ? "lg:static lg:translate-x-0 lg:w-64"
            : "lg:static lg:w-0 lg:overflow-hidden lg:opacity-0 lg:p-0 lg:pointer-events-none"
        } w-64`}
      >
        <div className="w-64 flex flex-col h-full shrink-0">
          {/* Brand Header */}
          <div className="flex items-center justify-between h-16 px-5 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white font-bold text-base">
                E
              </div>
              <div>
                <h1 className="text-sm font-bold text-white tracking-wide">
                  ERO ERP
                </h1>
                <span className="text-[10px] text-sky-400 font-medium">
                  Enterprise Edition
                </span>
              </div>
            </div>
            {/* Botón cerrar en móvil */}
            <button
              type="button"
              className="lg:hidden text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
              onClick={() => setSidebarOpen(false)}
              title="Cerrar menú móvil"
            >
              <X className="w-5 h-5" />
            </button>
            {/* Botón ocultar sidebar en desktop */}
            <button
              type="button"
              className="hidden lg:flex text-neutral-400 hover:text-white p-1.5 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-neutral-400"
              onClick={toggleDesktopSidebar}
              title="Ocultar menú lateral (Ctrl+B)"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>

        {/* Navigation Links Grouped by Module */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {filteredGroups.map((group) => {
            if (group.children) {
              const isOpen = Boolean(openGroups[group.id]);
              const hasActiveChild = group.children.some(
                (child) =>
                  location.pathname === child.to ||
                  location.pathname.startsWith(`${child.to}/`),
              );

              return (
                <div key={group.id} className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      hasActiveChild
                        ? "text-sky-400 bg-neutral-800/80 font-semibold"
                        : "text-neutral-300 hover:bg-neutral-800 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <group.icon
                        className={`w-4 h-4 shrink-0 ${hasActiveChild ? "text-sky-400" : "text-neutral-400"}`}
                      />
                      <span className="truncate">{group.title}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-neutral-500 font-mono">
                        {group.children.length}
                      </span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-200 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </button>

                  {/* Submenú Desplegable con Guía Visual */}
                  {isOpen && (
                    <div className="ml-3 pl-3 border-l border-neutral-800 my-1 space-y-1">
                      {group.children.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          onClick={() => setSidebarOpen(false)}
                          className={({ isActive }) =>
                            `flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                              isActive
                                ? "bg-sky-600 text-white font-semibold shadow-xs"
                                : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                            }`
                          }
                        >
                          <child.icon className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{child.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            // Enlace Raíz Directo (Dashboard, Tesorería, Reportes)
            return (
              <NavLink
                key={group.id}
                to={group.to!}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-sky-600 text-white font-semibold shadow-xs"
                      : "text-neutral-300 hover:bg-neutral-800 hover:text-white"
                  }`
                }
              >
                <group.icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{group.title}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User Info Footer */}
        <div className="p-4 border-t border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-white text-xs font-semibold shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-medium text-white truncate">
                {user?.fullName || user?.username || "Usuario"}
              </p>
              <p className="text-[10px] text-neutral-400 capitalize">
                {user?.role || "Rol"}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="text-neutral-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden ">
        {/* Topbar */}
        <header className="h-16 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between px-4 lg:px-8 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Botón abrir menú en móvil */}
            <button
              type="button"
              className="lg:hidden text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              onClick={() => setSidebarOpen(true)}
              title="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Botón alternar menú lateral en Desktop */}
            <button
              type="button"
              onClick={toggleDesktopSidebar}
              title={desktopSidebarVisible ? "Ocultar menú lateral (Ctrl+B)" : "Mostrar menú lateral (Ctrl+B)"}
              className="hidden lg:flex items-center justify-center p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-neutral-400"
            >
              {desktopSidebarVisible ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeftOpen className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              )}
            </button>

            {/* Selectores de Sucursal y Depósito */}
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
                <Building2 className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
                <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                  Sucursal:
                </span>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {branchLabel}
                </span>
              </div>

              <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
                <Warehouse className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
                <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                  Depósito:
                </span>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {warehouseLabel}
                </span>
              </div>

              {canSwitchEnv ? (
                <button
                  onClick={() => navigate("/select-branch")}
                  title="Cambiar sucursal o depósito"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-sky-700 dark:text-sky-400 font-medium transition-colors cursor-pointer"
                >
                  <ArrowRightLeft className="w-3 h-3" />
                  {/* <span>Cambiar</span> */}
                </button>
              ) : (
                <div
                  title="Entorno operativo asignado a su perfil (Sin autorización para cambiar)"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-850 text-neutral-400 font-medium"
                >
                  <Lock className="w-3 h-3 text-neutral-400" />
                  <span>Fijado</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            {/* Tasa Oficial BCV */}
            <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
              <Coins className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
              <span className="font-semibold text-neutral-700 dark:text-neutral-300">BCV:</span>
              <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                Bs. {formatExchangeRate(rate, 2)}
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveRateTab("history");
                  setShowRateModal(true);
                  fetchHistory();
                }}
                title="Ver historial de tasas oficiales en base de datos"
                className="ml-1 text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 cursor-pointer"
              >
                <History className="w-3 h-3" />
              </button>
              {canEditRate ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveRateTab("update");
                    setShowRateModal(true);
                  }}
                  title="Actualizar tasa de cambio oficial (Usuario Autorizado)"
                  className="ml-0.5 text-sky-600 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300 p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 cursor-pointer"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              ) : (
                <span title="Solo administradores o usuarios autorizados pueden modificar la tasa oficial">
                  <Lock className="w-3 h-3 text-neutral-400 ml-0.5" />
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-200 font-medium hidden">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              SENIAT Conectado
            </div>

            {/* Botón Alternar Tema Claro / Oscuro */}
            <button
              type="button"
              onClick={toggleTheme}
              title={resolvedTheme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-neutral-400"
              aria-label="Alternar tema claro y oscuro"
            >
              {resolvedTheme === "dark" ? (
                <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-300 shrink-0" />
              )}
              {/* <span className="hidden sm:inline">
                {resolvedTheme === "dark" ? "Claro" : "Oscuro"}
              </span> */}
            </button>

            {/* Botón Pantalla Completa */}
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Salir de pantalla completa (Esc o F11)" : "Modo pantalla completa (F11)"}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-neutral-400"
            >
              {isFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400 shrink-0" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400 shrink-0" />
              )}
              {/* <span className="hidden sm:inline">
                {isFullscreen ? "Restaurar" : "Pantalla completa"}
              </span> */}
            </button>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 bg-neutral-50 dark:bg-neutral-950">
          <Outlet />
        </main>
      </div>

      {/* Modal para Modificar / Ver Historial de Tasa Oficial BCV */}
      <Modal
        isOpen={showRateModal}
        onClose={() => setShowRateModal(false)}
        title="Gestión de Tasa de Cambio Oficial (BCV)"
        subtitle="Historial y ajuste de la tasa de referencia en bolívares"
        size="lg"
      >
        <div className="flex flex-col -m-4 sm:-m-5">
          {/* Selector de Pestañas */}
          <div className="flex border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 px-5 text-xs font-medium shrink-0">
            {canEditRate && (
              <button
                type="button"
                onClick={() => setActiveRateTab("update")}
                className={`py-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
                  activeRateTab === "update"
                    ? "border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100 font-semibold"
                    : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
                }`}
              >
                Actualizar Tasa
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setActiveRateTab("history");
                fetchHistory();
              }}
              className={`py-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
                activeRateTab === "history"
                  ? "border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100 font-semibold"
                  : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
              }`}
            >
              Historial de Cambios ({history.length})
            </button>
          </div>

          {activeRateTab === "update" && canEditRate ? (
            <form
              onSubmit={handleSaveRate}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
                {/* Sincronización Directa BCV */}
                <div className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                  <div>
                    <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 block">
                      Sincronización Oficial BCV
                    </span>
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Consultar portal oficial en tiempo real
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const data = await checkBcvLiveRate();
                      if (data) {
                        setFormRate(data.bcvRate.toString());
                        setFormSource(data.source);
                        setFormNotes(
                          `Sincronizado desde portal oficial del BCV (${data.bcvFormattedDate || data.bcvEffectiveDate})`,
                        );
                        toast.success(
                          `Tasa obtenida del BCV: Bs. ${formatExchangeRate(data.bcvRate, 4)}`,
                        );
                      } else {
                        toast.error(
                          "No se pudo obtener la tasa del BCV en este momento",
                        );
                      }
                    }}
                    disabled={isBcvChecking}
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 mr-1.5 ${isBcvChecking ? "animate-spin" : ""}`}
                    />
                    {isBcvChecking ? "Consultando..." : "Obtener del BCV"}
                  </Button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Tasa de Cambio Oficial (Bs. por 1 USD) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400 dark:text-neutral-500 font-mono">
                      Bs.
                    </span>
                    <input
                      type="number"
                      step="0.0001"
                      required
                      value={formRate}
                      onChange={(e) => setFormRate(e.target.value)}
                      placeholder="ej: 36.8500"
                      className="w-full pl-9 pr-3 py-2 text-sm font-mono font-bold bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-lg focus-visible:ring-2 focus-visible:ring-neutral-400"
                    />
                  </div>
                  <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1">
                    Esta tasa se guardará en base de datos con fecha efectiva
                    y se aplicará a todas las operaciones actuales.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Fuente de Referencia Oficial *
                  </label>
                  <input
                    type="text"
                    required
                    value={formSource}
                    onChange={(e) => setFormSource(e.target.value)}
                    placeholder="ej: Banco Central de Venezuela (BCV)"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-lg focus-visible:ring-2 focus-visible:ring-neutral-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Notas / Justificación del Ajuste (Opcional)
                  </label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="ej: Cierre oficial publicado por el BCV al término de la jornada"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-lg focus-visible:ring-2 focus-visible:ring-neutral-400"
                  />
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                  <span className="font-semibold block">
                    Aviso de Auditoría:
                  </span>
                  <p className="text-[11px] leading-relaxed">
                    El cambio de tasa quedará auditado en base de datos con su
                    usuario ({user?.fullName || user?.username}) y fecha/hora
                    exacta.
                  </p>
                </div>
              </div>

              {/* Pinned Footer */}
              <div className="px-5 py-3.5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex items-center justify-end gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRateModal(false)}
                  disabled={isUpdatingRate}
                >
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={isUpdatingRate}>
                  {isUpdatingRate
                    ? "Guardando en BD..."
                    : "Guardar y Aplicar Tasa"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Registro Histórico de Tasas en Base de Datos:
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchHistory()}
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1" />
                    Refrescar
                  </Button>
                </div>

                {isHistoryLoading ? (
                  <div className="py-8 text-center text-xs text-neutral-400">
                    Cargando historial de base de datos...
                  </div>
                ) : history.length === 0 ? (
                  <div className="py-8 text-center text-xs text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-lg">
                    No se encontraron registros de tasas previas en base de
                    datos.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-lg">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-700 text-[10px] uppercase font-semibold">
                        <tr>
                          <th className="py-2 px-3">Fecha</th>
                          <th className="py-2 px-3 text-right">Tasa (Bs.)</th>
                          <th className="py-2 px-3">Fuente</th>
                          <th className="py-2 px-3">Usuario</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                        {history.map((h, i) => (
                          <tr
                            key={h.id || i}
                            className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/50"
                          >
                            <td className="py-2 px-3 font-mono text-[11px] text-neutral-700 dark:text-neutral-300">
                              {h.effectiveDate}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-neutral-900 dark:text-neutral-100">
                              Bs. {formatExchangeRate(h.rate, 4)}
                            </td>
                            <td className="py-2 px-3 text-neutral-600 dark:text-neutral-400 text-[11px] truncate max-w-[120px]">
                              {h.source}
                            </td>
                            <td className="py-2 px-3 text-neutral-500 dark:text-neutral-400 text-[11px] truncate max-w-[120px]">
                              {h.updatedBy}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Pinned Footer */}
              <div className="px-5 py-3.5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex items-center justify-end gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRateModal(false)}
                >
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal de Pregunta Automática para Sincronizar Tasa BCV */}
      <BcvRateAutoSyncModal
        isOpen={showBcvPromptModal}
        bcvData={bcvLiveData}
        onClose={handleDismissBcvPrompt}
      />
    </div>
  );
};
