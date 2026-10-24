import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Utensils,
  Search,
  Plus,
  Trash2,
  DollarSign,
  Users,
  Clock,
  Eye,
  CheckCircle,
  CreditCard,
  ChefHat,
  Wine,
  FileText,
  X,
  ChevronRight,
  Split,
  MessageSquare,
  LayoutGrid,
  UserCheck,
  UserPlus,
  AlertCircle,
  Store,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/authStore';
import { useExchangeRateStore } from '../../stores/exchangeRateStore';
import { TableManagementModal } from './TableManagementModal';
import { TableClosuresModal } from './TableClosuresModal';
import type {
  RestaurantTable,
  RestaurantOrder,
  RestaurantOrderItem,
  PreparationStation,
} from '@ero/shared';

interface RestaurantCashRegister {
  id: string;
  code: string;
  name: string;
  status: 'OPEN' | 'CLOSED' | 'MAINTENANCE';
  allowedDepartmentIds?: string[];
}

interface RestaurantProduct {
  id: string;
  sku: string;
  name: string;
  description: string;
  department_id?: string;
  department_name?: string;
  group_id?: string;
  group_name?: string;
  price_usd: number;
  price_ves: number;
  suggested_station: PreparationStation;
}

interface PresetNote {
  id: string;
  category: string;
  note_text: string;
}

interface ERPCustomer {
  id: string;
  doc_type?: string;
  doc_number: string;
  name: string;
  email?: string;
  phone?: string;
}

export const RestaurantOrdersView: React.FC = () => {
  const { token, user, activeBranchId } = useAuthStore();
  const rate = useExchangeRateStore((s) => s.rate);

  // Estados de datos
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [products, setProducts] = useState<RestaurantProduct[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [groups, setGroups] = useState<Array<{ id: string; department_id: string; name: string }>>([]);
  const [presetNotes, setPresetNotes] = useState<PresetNote[]>([]);
  const [erpCustomers, setErpCustomers] = useState<ERPCustomer[]>([]);
  const [cashRegisters, setCashRegisters] = useState<RestaurantCashRegister[]>([]);
  const [selectedCashRegisterId, setSelectedCashRegisterId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filtros de mesas
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [searchTable, setSearchTable] = useState<string>('');

  // Mesa y comanda activa seleccionada
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [activeOrder, setActiveOrder] = useState<RestaurantOrder | null>(null);
  const [isOrderLoading, setIsOrderLoading] = useState<boolean>(false);

  // Cliente activo en la comanda
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Filtros de productos en la comanda
  const [selectedDeptId, setSelectedDeptId] = useState<string>('ALL');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('ALL');
  const [searchProduct, setSearchProduct] = useState<string>('');

  // Modales
  const [showOpenTableModal, setShowOpenTableModal] = useState<boolean>(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState<boolean>(false);
  const [showProductDetailModal, setShowProductDetailModal] = useState<boolean>(false);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [showAdHocProductModal, setShowAdHocProductModal] = useState<boolean>(false);
  const [showItemNotesModal, setShowItemNotesModal] = useState<boolean>(false);
  const [showTableManagementModal, setShowTableManagementModal] = useState<boolean>(false);
  const [showTableClosuresModal, setShowTableClosuresModal] = useState<boolean>(false);
  const [showCloseOrderPromptModal, setShowCloseOrderPromptModal] = useState<boolean>(false);

  // Estados para abrir mesa y búsqueda / creación de cliente
  const [openWaiterName, setOpenWaiterName] = useState<string>(user?.fullName || user?.username || '');
  const [initialCustomerInput, setInitialCustomerInput] = useState<string>('Cliente 1, Cliente 2');
  const [openOrderNotes, setOpenOrderNotes] = useState<string>('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');
  const [customerSearchResults, setCustomerSearchResults] = useState<ERPCustomer[]>([]);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState<boolean>(false);
  const [selectedErpCustomer, setSelectedErpCustomer] = useState<ERPCustomer | null>(null);
  const [showQuickNewCustomer, setShowQuickNewCustomer] = useState<boolean>(false);
  const [quickCustomerDocType, setQuickCustomerDocType] = useState<'V' | 'J' | 'E' | 'G'>('V');
  const [quickCustomerDocNumber, setQuickCustomerDocNumber] = useState<string>('');
  const [quickCustomerName, setQuickCustomerName] = useState<string>('');
  const [quickCustomerPhone, setQuickCustomerPhone] = useState<string>('');
  const [quickCustomerEmail, setQuickCustomerEmail] = useState<string>('');
  const [isCreatingQuickCustomer, setIsCreatingQuickCustomer] = useState<boolean>(false);

  // Estados para cierre de mesa (auditoría / propina / notas)
  const [closureTipUsd, setClosureTipUsd] = useState<string>('0');
  const [closureNotes, setClosureNotes] = useState<string>('');

  // Estado para nuevo cliente en mesa
  const [newCustomerName, setNewCustomerName] = useState<string>('');
  const [newCustomerNotes, setNewCustomerNotes] = useState<string>('');

  // Estado para producto ad-hoc fuera de carta
  const [adHocName, setAdHocName] = useState<string>('');
  const [adHocPriceUsd, setAdHocPriceUsd] = useState<string>('');
  const [adHocStation, setAdHocStation] = useState<PreparationStation>('KITCHEN');
  const [adHocNotes, setAdHocNotes] = useState<string>('');

  // Estado para editar notas de ítem
  const [editingItem, setEditingItem] = useState<RestaurantOrderItem | null>(null);
  const [itemNoteText, setItemNoteText] = useState<string>('');
  const [saveAsPreset, setSaveAsPreset] = useState<boolean>(false);

  // Estado para pagos
  const [paymentCustomerId, setPaymentCustomerId] = useState<string | null>(null); // null = toda la mesa
  const [paymentMethodName, setPaymentMethodName] = useState<string>('Efectivo Divisas ($)');
  const [customMethodInput, setCustomMethodInput] = useState<string>('');
  const [paymentCurrency, setPaymentCurrency] = useState<'USD' | 'VES'>('USD');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [orderPaymentNotes, setOrderPaymentNotes] = useState<string>('');
  const [isCreditPayment, setIsCreditPayment] = useState<boolean>(false);
  const [selectedErpCustomerId, setSelectedErpCustomerId] = useState<string>('');
  const [creditDueDate, setCreditDueDate] = useState<string>('');

  // Estado para vista en modal de detalle (por cliente vs por mesa)
  const [detailViewMode, setDetailViewMode] = useState<'BY_CUSTOMER' | 'BY_TABLE'>('BY_CUSTOMER');

  // Vista en móvil de comanda (drawer)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    if (type === 'error') {
      toast.error(text);
    } else {
      toast.success(text);
    }
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const getHeaders = useCallback(() => {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Branch-Id': activeBranchId || 'b1111111-1111-1111-1111-111111111111',
    };
  }, [token, activeBranchId]);

  // Carga inicial de mesas, catálogo y observaciones
  const fetchTables = useCallback(async () => {
    try {
      const res = await fetch('/api/restaurant/tables', { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        setTables(data.data);
      }
    } catch {
      showNotification('Error al cargar mesas del restaurante', 'error');
    }
  }, [getHeaders]);

  // Carga de cajas registradoras para filtro de departamentos
  const fetchCashRegisters = useCallback(async () => {
    try {
      const branchParam = activeBranchId ? `?branch_id=${activeBranchId}` : '';
      const res = await fetch(`/api/pos/registers${branchParam}`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setCashRegisters(data.data);
        setSelectedCashRegisterId((prev) => {
          if (prev && data.data.some((r: any) => r.id === prev)) return prev;
          const openReg = data.data.find((r: any) => r.status === 'OPEN');
          return openReg ? openReg.id : (data.data[0]?.id || '');
        });
      }
    } catch {
      // Ignorar fallo no crítico
    }
  }, [activeBranchId, getHeaders]);

  const fetchCatalogAndPresets = useCallback(async (cashRegisterId?: string) => {
    try {
      const regIdToUse = cashRegisterId !== undefined ? cashRegisterId : selectedCashRegisterId;
      const cashParam = regIdToUse ? `?cash_register_id=${encodeURIComponent(regIdToUse)}` : '';
      const [prodsRes, deptsRes, notesRes, custsRes] = await Promise.all([
        fetch(`/api/restaurant/products${cashParam}`, { headers: getHeaders() }),
        fetch(`/api/restaurant/departments${cashParam}`, { headers: getHeaders() }),
        fetch('/api/restaurant/preset-notes', { headers: getHeaders() }),
        fetch('/api/customers', { headers: getHeaders() }),
      ]);

      const [prodsData, deptsData, notesData, custsData] = await Promise.all([
        prodsRes.json(),
        deptsRes.json(),
        notesRes.json(),
        custsRes.json(),
      ]);

      if (prodsData.success) setProducts(prodsData.data);
      if (deptsData.success) {
        setDepartments(deptsData.data.departments || []);
        setGroups(deptsData.data.groups || []);
      }
      if (notesData.success) setPresetNotes(notesData.data);
      if (custsData.success) setErpCustomers(custsData.data || []);
    } catch {
      showNotification('Error al cargar datos auxiliares del restaurante', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders, selectedCashRegisterId]);

  useEffect(() => {
    fetchTables();
    fetchCashRegisters();
  }, [fetchTables, fetchCashRegisters]);

  useEffect(() => {
    setSelectedDeptId('ALL');
    setSelectedGroupId('ALL');
    fetchCatalogAndPresets(selectedCashRegisterId);
  }, [selectedCashRegisterId, fetchCatalogAndPresets]);

  // Cargar comanda activa de la mesa seleccionada
  const fetchActiveOrder = useCallback(
    async (tableId: string) => {
      setIsOrderLoading(true);
      try {
        const res = await fetch(`/api/restaurant/orders/table/${tableId}`, { headers: getHeaders() });
        const data = await res.json();
        if (data.success && data.data) {
          setActiveOrder(data.data);
          // Por defecto seleccionar el primer cliente si no hay uno activo
          if (data.data.customers && data.data.customers.length > 0) {
            setSelectedCustomerId(data.data.customers[0].id);
          } else {
            setSelectedCustomerId(null);
          }
        } else {
          setActiveOrder(null);
          setSelectedCustomerId(null);
        }
      } catch {
        showNotification('Error al cargar la comanda de la mesa', 'error');
      } finally {
        setIsOrderLoading(false);
      }
    },
    [getHeaders]
  );

  const handleSelectTable = (table: RestaurantTable) => {
    setSelectedTable(table);
    if (table.status === 'OCCUPIED' && table.active_order_id) {
      fetchActiveOrder(table.id);
    } else {
      setActiveOrder(null);
      setSelectedCustomerId(null);
      setSelectedErpCustomer(null);
      setCustomerSearchQuery('');
      setCustomerSearchResults([]);
      setShowQuickNewCustomer(false);
      setInitialCustomerInput('Cliente 1, Cliente 2');
      setShowOpenTableModal(true);
    }
  };

  // Buscar clientes en el directorio ERP
  const handleSearchCustomers = async (term: string) => {
    setCustomerSearchQuery(term);
    if (!term.trim() || term.length < 2) {
      setCustomerSearchResults([]);
      return;
    }
    setIsSearchingCustomer(true);
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(term.trim())}&limit=8`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setCustomerSearchResults(data.data);
      } else {
        setCustomerSearchResults([]);
      }
    } catch {
      setCustomerSearchResults([]);
    } finally {
      setIsSearchingCustomer(false);
    }
  };

  const handleSelectErpCustomer = (cust: ERPCustomer) => {
    setSelectedErpCustomer(cust);
    setCustomerSearchQuery('');
    setCustomerSearchResults([]);
    // Si la lista de comensales tiene 'Cliente 1', reemplazar por el nombre del cliente
    setInitialCustomerInput((prev) => {
      if (prev.includes('Cliente 1')) {
        return prev.replace('Cliente 1', cust.name);
      }
      return `${cust.name}, Acompañante 2`;
    });
  };

  // Crear cliente nuevo de manera rápida en ERP
  const handleCreateQuickCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCustomerDocNumber.trim() || !quickCustomerName.trim()) {
      showNotification('Documento y Nombre son requeridos', 'error');
      return;
    }
    setIsCreatingQuickCustomer(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          doc_type: quickCustomerDocType,
          doc_number: quickCustomerDocNumber.trim(),
          name: quickCustomerName.trim(),
          phone: quickCustomerPhone.trim() || null,
          email: quickCustomerEmail.trim() || null,
          address: 'Cliente Restaurante',
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        showNotification(`Cliente ${data.data.name} registrado con éxito`);
        handleSelectErpCustomer(data.data);
        setShowQuickNewCustomer(false);
        setQuickCustomerDocNumber('');
        setQuickCustomerName('');
        setQuickCustomerPhone('');
        setQuickCustomerEmail('');
      } else {
        showNotification(data.error?.message || 'Error al registrar cliente', 'error');
      }
    } catch {
      showNotification('Error de conexión al registrar cliente', 'error');
    } finally {
      setIsCreatingQuickCustomer(false);
    }
  };

  // Abrir comanda
  const handleOpenTableOrder = async () => {
    if (!selectedTable) return;
    const names = initialCustomerInput
      .split(',')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    const initialList = names.length > 0 ? names : [selectedErpCustomer?.name || 'Cliente 1'];

    try {
      const res = await fetch('/api/restaurant/orders/open', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          table_id: selectedTable.id,
          waiter_name: openWaiterName,
          customer_id: selectedErpCustomer?.id || null,
          customer_name: selectedErpCustomer?.name || null,
          initial_customers: initialList,
          notes: openOrderNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification('Comanda abierta exitosamente');
        setShowOpenTableModal(false);
        setSelectedErpCustomer(null);
        await fetchTables();
        await fetchActiveOrder(selectedTable.id);
      } else {
        showNotification(data.error?.message || 'Error al abrir mesa', 'error');
      }
    } catch {
      showNotification('Error de conexión al abrir mesa', 'error');
    }
  };

  // Agregar cliente a la comanda activa
  const handleAddCustomer = async () => {
    if (!activeOrder || !newCustomerName.trim()) return;
    try {
      const res = await fetch(`/api/restaurant/orders/${activeOrder.id}/customers`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          customer_name: newCustomerName.trim(),
          notes: newCustomerNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(`Cliente "${newCustomerName}" agregado a la mesa`);
        setActiveOrder(data.data);
        const lastCust = data.data.customers[data.data.customers.length - 1];
        if (lastCust) setSelectedCustomerId(lastCust.id);
        setShowAddCustomerModal(false);
        setNewCustomerName('');
        setNewCustomerNotes('');
        fetchTables();
      } else {
        showNotification(data.error?.message || 'Error al agregar cliente', 'error');
      }
    } catch {
      showNotification('Error al agregar cliente', 'error');
    }
  };

  // Agregar ítem de producto regular
  const handleAddProductToOrder = async (product: RestaurantProduct) => {
    if (!activeOrder) return;
    try {
      const res = await fetch(`/api/restaurant/orders/${activeOrder.id}/items`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          order_customer_id: selectedCustomerId || null,
          product_id: product.id || null,
          product_name: product.name,
          sku: product.sku || null,
          quantity: 1,
          unit_price_usd: Number(product.price_usd) || 0,
          station: product.suggested_station || 'KITCHEN',
          department_id: product.department_id || null,
          group_id: product.group_id || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(`Agregado: ${product.name}`);
        await fetchActiveOrder(selectedTable!.id);
        fetchTables();
      } else {
        const errMsg = data.error?.message || (typeof data.error === 'string' ? data.error : 'Error al agregar ítem');
        showNotification(errMsg, 'error');
      }
    } catch {
      showNotification('Error de conexión al agregar ítem', 'error');
    }
  };

  // Agregar producto ad-hoc fuera de carta
  const handleAddAdHocProduct = async () => {
    if (!activeOrder || !adHocName.trim()) return;
    const price = parseFloat(adHocPriceUsd) || 0;
    try {
      const res = await fetch(`/api/restaurant/orders/${activeOrder.id}/items`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          order_customer_id: selectedCustomerId,
          product_name: adHocName.trim(),
          quantity: 1,
          unit_price_usd: price,
          station: adHocStation,
          notes: adHocNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(`Producto personalizado agregado: ${adHocName}`);
        setShowAdHocProductModal(false);
        setAdHocName('');
        setAdHocPriceUsd('');
        setAdHocNotes('');
        await fetchActiveOrder(selectedTable!.id);
        fetchTables();
      } else {
        showNotification(data.error?.message || 'Error al crear producto rápido', 'error');
      }
    } catch {
      showNotification('Error al crear producto rápido', 'error');
    }
  };

  // Modificar cantidad de ítem
  const handleUpdateItemQuantity = async (item: RestaurantOrderItem, delta: number) => {
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      handleDeleteItem(item.id);
      return;
    }
    try {
      const res = await fetch(`/api/restaurant/items/${item.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ quantity: newQty }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchActiveOrder(selectedTable!.id);
        fetchTables();
      }
    } catch {
      showNotification('Error al modificar cantidad', 'error');
    }
  };

  // Eliminar ítem
  const handleDeleteItem = async (itemId: string) => {
    try {
      const res = await fetch(`/api/restaurant/items/${itemId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        showNotification('Ítem eliminado');
        await fetchActiveOrder(selectedTable!.id);
        fetchTables();
      }
    } catch {
      showNotification('Error al eliminar ítem', 'error');
    }
  };

  // Guardar observaciones de un ítem
  const handleSaveItemNotes = async () => {
    if (!editingItem) return;
    try {
      const res = await fetch(`/api/restaurant/items/${editingItem.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ notes: itemNoteText.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        if (saveAsPreset && itemNoteText.trim()) {
          // Guardar en preset notes
          await fetch('/api/restaurant/preset-notes', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
              category: editingItem.station === 'BAR' ? 'BARRA' : 'COCINA',
              note_text: itemNoteText.trim(),
            }),
          });
          fetchCatalogAndPresets();
        }
        showNotification('Observaciones actualizadas');
        setShowItemNotesModal(false);
        setEditingItem(null);
        setItemNoteText('');
        setSaveAsPreset(false);
        await fetchActiveOrder(selectedTable!.id);
      }
    } catch {
      showNotification('Error al guardar observaciones', 'error');
    }
  };

  // Registrar pago
  const handleRegisterPayment = async () => {
    if (!activeOrder) return;
    const amountNum = parseFloat(paymentAmount);
    if (!amountNum || amountNum <= 0) {
      showNotification('Ingrese un monto válido', 'error');
      return;
    }

    const finalMethodName =
      paymentMethodName === 'OTRO_PERSONALIZADO'
        ? customMethodInput.trim() || 'Forma de Pago Personalizada'
        : paymentMethodName;

    try {
      const res = await fetch(`/api/restaurant/orders/${activeOrder.id}/payments`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          order_customer_id: paymentCustomerId,
          payment_method_name: finalMethodName,
          currency: paymentCurrency,
          amount: amountNum,
          reference: paymentReference,
          is_credit: isCreditPayment,
          customer_id: isCreditPayment ? selectedErpCustomerId : null,
          due_date: isCreditPayment ? creditDueDate : null,
          notes: paymentNotes,
          order_notes: orderPaymentNotes,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showNotification('Pago registrado con éxito');
        setPaymentAmount('');
        setPaymentReference('');
        setPaymentNotes('');
        setIsCreditPayment(false);
        setSelectedErpCustomerId('');
        await fetchActiveOrder(selectedTable!.id);
        fetchTables();
      } else {
        showNotification(data.error?.message || 'Error al procesar el pago', 'error');
      }
    } catch {
      showNotification('Error de conexión al procesar el pago', 'error');
    }
  };

  // Iniciar modal de confirmación y auditoría de cierre
  const handlePromptCloseOrder = () => {
    setClosureTipUsd('0');
    setClosureNotes(orderPaymentNotes || '');
    setShowCloseOrderPromptModal(true);
  };

  // Ejecutar cierre definitivo con registro en restaurant_table_closures
  const handleConfirmCloseTableOrder = async () => {
    if (!activeOrder) return;
    try {
      const tipUsd = Number(closureTipUsd || 0);
      const tipVes = Number((tipUsd * rate).toFixed(2));
      const res = await fetch(`/api/restaurant/orders/${activeOrder.id}/close`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          notes: closureNotes || orderPaymentNotes || 'Cierre de comanda y mesa',
          tip_usd: tipUsd,
          tip_ves: tipVes,
          closed_by_user_id: user?.id,
          closed_by_user_name: user?.fullName || user?.username,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification('Mesa cerrada y registro de cierre generado exitosamente');
        setShowCloseOrderPromptModal(false);
        setShowPaymentModal(false);
        setSelectedTable(null);
        setActiveOrder(null);
        setClosureTipUsd('0');
        setClosureNotes('');
        await fetchTables();
      } else {
        showNotification(data.error?.message || 'Error al cerrar comanda', 'error');
      }
    } catch {
      showNotification('Error al cerrar mesa', 'error');
    }
  };

  // Zonas únicas disponibles
  const zones = useMemo(() => {
    const set = new Set<string>();
    tables.forEach((t) => set.add(t.zone));
    return Array.from(set);
  }, [tables]);

  // Mesas filtradas
  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      const matchZone = selectedZone === 'ALL' || t.zone === selectedZone;
      const matchSearch =
        !searchTable.trim() ||
        t.name.toLowerCase().includes(searchTable.toLowerCase()) ||
        t.table_number.toLowerCase().includes(searchTable.toLowerCase()) ||
        (t.current_waiter_name && t.current_waiter_name.toLowerCase().includes(searchTable.toLowerCase()));
      return matchZone && matchSearch;
    });
  }, [tables, selectedZone, searchTable]);

  // Grupos filtrados por departamento seleccionado
  const availableGroups = useMemo(() => {
    if (selectedDeptId === 'ALL') return groups;
    return groups.filter((g) => g.department_id === selectedDeptId);
  }, [groups, selectedDeptId]);

  // Productos filtrados para toma de pedido
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchDept = selectedDeptId === 'ALL' || p.department_id === selectedDeptId;
      const matchGroup = selectedGroupId === 'ALL' || p.group_id === selectedGroupId;
      const matchSearch =
        !searchProduct.trim() ||
        p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchProduct.toLowerCase());
      return matchDept && matchGroup && matchSearch;
    });
  }, [products, selectedDeptId, selectedGroupId, searchProduct]);

  // Ítems de la comanda según el cliente seleccionado
  const activeCustomerItems = useMemo(() => {
    if (!activeOrder?.items) return [];
    if (!selectedCustomerId) return activeOrder.items;
    return activeOrder.items.filter((i) => i.order_customer_id === selectedCustomerId);
  }, [activeOrder, selectedCustomerId]);

  // Total pendiente de la mesa
  const tablePaymentsTotal = useMemo(() => {
    if (!activeOrder?.payments) return 0;
    return activeOrder.payments.reduce((sum, p) => sum + p.amount_usd, 0);
  }, [activeOrder]);

  const tablePendingBalance = useMemo(() => {
    if (!activeOrder) return 0;
    return Math.max(0, Number((activeOrder.total_usd - tablePaymentsTotal).toFixed(2)));
  }, [activeOrder, tablePaymentsTotal]);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Notificación Toast */}
      {statusMessage && (
        <div
          className={`fixed top-4 right-4 z-[99999] px-4 py-3 rounded-lg text-sm font-medium shadow-2xl transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {/* Header General */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Módulo de Restaurante & Toma de Pedidos</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Gestión de mesas, comanda por clientes, separación de cuentas y KDS
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 hidden">
            <span className="text-gray-500 dark:text-gray-400 mr-1">Tasa BCV:</span>
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
              {rate.toFixed(4)} VES/USD
            </span>
          </div>

          {/* Selector de Caja Registradora para filtrar departamentos y catálogo */}
          <div className="flex items-center gap-1.5 bg-slate-800 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs">
            <Store className="w-4 h-4 text-indigo-400" />
            <span className="text-slate-400 font-medium">Caja:</span>
            <select
              value={selectedCashRegisterId}
              onChange={(e) => setSelectedCashRegisterId(e.target.value)}
              className="bg-transparent text-slate-100 font-semibold border-0 focus:outline-none cursor-pointer pr-1"
            >
              <option value="" className="bg-slate-800 text-slate-200">
                Todas las Cajas
              </option>
              {cashRegisters.map((reg) => (
                <option key={reg.id} value={reg.id} className="bg-slate-800 text-slate-200">
                  {reg.name} {reg.status === 'OPEN' ? '(Abierta)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Botón Administrar Mesas */}
          <button
            type="button"
            onClick={() => setShowTableManagementModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg focus-visible:ring-2 focus-visible:ring-slate-500 transition-colors"
          >
            <LayoutGrid className="w-4 h-4 text-blue-400" />
            <span>Administrar Mesas</span>
          </button>

          {/* Botón Historial de Cierres */}
          <button
            type="button"
            onClick={() => setShowTableClosuresModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg focus-visible:ring-2 focus-visible:ring-slate-500 transition-colors"
          >
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>Historial de Cierres</span>
          </button>

          <a
            href="/restaurant/kds"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-lg focus-visible:ring-2 focus-visible:ring-amber-500 transition-colors"
          >
            <ChefHat className="w-4 h-4" />
            <span>Abrir KDS Cocina/Barra</span>
          </a>
        </div>
      </header>

      {/* Layout Principal: Mapa y Grilla de Mesas a 100% de ancho */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mapa / Grilla de Mesas */}
        <section className="flex-1 w-full flex flex-col p-4 overflow-y-auto">
          {/* Barra de Filtros de Mesas */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedZone('ALL')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  selectedZone === 'ALL'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750'
                }`}
              >
                Todas las Zonas
              </button>
              {zones.map((zone) => (
                <button
                  key={zone}
                  type="button"
                  onClick={() => setSelectedZone(zone)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    selectedZone === zone
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750'
                  }`}
                >
                  {zone}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar mesa o mozo..."
                value={searchTable}
                onChange={(e) => setSearchTable(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus-visible:ring-2 focus-visible:ring-indigo-500"
              />
            </div>
          </div>

          {/* Grilla de Mesas */}
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 animate-pulse">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-lg" />
              ))}
            </div>
          ) : filteredTables.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
              <Utensils className="w-8 h-8 text-gray-400 mb-2" />
              <p className="text-sm font-medium">No se encontraron mesas para los filtros seleccionados</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredTables.map((table) => {
                const isSelected = selectedTable?.id === table.id;
                const isOccupied = table.status === 'OCCUPIED';
                const isBillReq = table.status === 'BILL_REQUESTED';

                return (
                  <button
                    key={table.id}
                    type="button"
                    onClick={() => handleSelectTable(table)}
                    className={`p-4 text-left rounded-lg border transition-all flex flex-col justify-between focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                      isSelected
                        ? 'border-indigo-600 ring-2 ring-indigo-600/20 bg-indigo-50/30 dark:bg-indigo-950/20'
                        : isOccupied
                        ? 'border-blue-300 dark:border-blue-900 bg-white dark:bg-gray-800 hover:border-blue-400 shadow-xs'
                        : isBillReq
                        ? 'border-amber-400 dark:border-amber-700 bg-amber-50/20 dark:bg-amber-950/20 hover:border-amber-500'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-emerald-500'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                          #{table.table_number}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg uppercase ${
                            isOccupied
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                              : isBillReq
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          }`}
                        >
                          {isOccupied ? 'Ocupada' : isBillReq ? 'Cuenta' : 'Disponible'}
                        </span>
                      </div>
                      <h2 className="text-sm font-semibold truncate">{table.name}</h2>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{table.zone}</p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700/60 flex flex-col gap-1 text-[11px]">
                      {isOccupied ? (
                        <>
                          <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                            <span>Mozo: {table.current_waiter_name || 'N/A'}</span>
                            <span>{table.customer_count} pers.</span>
                          </div>
                          <div className="flex items-center justify-between font-bold text-indigo-600 dark:text-indigo-400">
                            <span>Total:</span>
                            <span>${(table.total_usd || 0).toFixed(2)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-between text-gray-400">
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" /> Cap. {table.capacity}
                          </span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Libre</span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ======================================================== */}
      {/* MODAL PRINCIPAL: COMANDA ACTIVA Y TOMA DE PEDIDOS        */}
      {/* ======================================================== */}
      {selectedTable && activeOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-800 w-full max-w-6xl h-[92vh] max-h-[920px] rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Cabecera del modal */}
            <div className="p-3.5 bg-gray-50 dark:bg-gray-850 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-lg">
                  <Utensils className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 rounded-lg">
                      Mesa #{selectedTable.table_number} - {selectedTable.name}
                    </span>
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                      Comanda: {activeOrder.order_number}
                    </span>
                    <span className="text-xs text-gray-400">({selectedTable.zone})</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Atendido por: <strong className="text-gray-700 dark:text-gray-300">{activeOrder.waiter_name}</strong>
                  </p>
                </div>
              </div>

              {/* Botones de acción en cabecera del modal */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowProductDetailModal(true)}
                  className="px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-indigo-500"
                  title="Ver Detalle de Productos por Cliente y Mesa"
                >
                  <Eye className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="hidden sm:inline">Detalle Consolidado</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPaymentModal(true)}
                  className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-emerald-500 shadow-xs"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Cobrar / Cierre</span>
                </button>

                {/* Botón cerrar modal */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTable(null);
                    setActiveOrder(null);
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg focus-visible:ring-2 focus-visible:ring-gray-400 transition-colors"
                  title="Cerrar comanda"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Selector de Clientes de la comanda (Split comanda por persona) */}
            <div className="px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2 overflow-x-auto">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCustomerId(null)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                    selectedCustomerId === null
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                  }`}
                >
                  Mesa Consolidada
                </button>

                {activeOrder.customers?.map((cust) => (
                  <button
                    key={cust.id}
                    type="button"
                    onClick={() => setSelectedCustomerId(cust.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                      selectedCustomerId === cust.id
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    <span>{cust.customer_name}</span>
                    <span className="text-[10px] opacity-80">(${(cust.total_usd || 0).toFixed(2)})</span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowAddCustomerModal(true)}
                className="px-3 py-1.5 text-xs font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg flex items-center gap-1 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar Comensal</span>
              </button>
            </div>

            {/* Cuerpo del Modal: 2 Paneles lado a lado en Desktop (Ítems a la izquierda, Catálogo a la derecha) */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
              {/* PANEL 1: Ítems Agregados en la Comanda (col-span-5) */}
              <div className="md:col-span-5 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full overflow-hidden bg-gray-50/30 dark:bg-gray-900/20">
                <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                      Detalle del Pedido
                    </h3>
                    <p className="text-[11px] text-gray-400">
                      {selectedCustomerId
                        ? `Comensal: ${activeOrder.customers?.find((c) => c.id === selectedCustomerId)?.customer_name}`
                        : 'Mesa Consolidada (Todos)'}
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {activeCustomerItems.length} {activeCustomerItems.length === 1 ? 'ítem' : 'ítems'}
                  </span>
                </div>

                {/* Lista scrollable de ítems */}
                <div className="flex-1 p-3 overflow-y-auto space-y-2">
                  {activeCustomerItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center text-gray-400">
                      <Utensils className="w-8 h-8 mb-2 opacity-40 text-indigo-400" />
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        No hay productos en esta selección
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        Haga clic en un producto del catálogo para añadirlo inmediatamente a la comanda.
                      </p>
                    </div>
                  ) : (
                    activeCustomerItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xs flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-lg uppercase ${
                                  item.station === 'BAR'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                }`}
                              >
                                {item.station === 'BAR' ? 'Barra' : 'Cocina'}
                              </span>
                              <span className="text-xs font-semibold truncate">{item.product_name}</span>
                            </div>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">
                              {item.customer_name ? `${item.customer_name} • ` : ''}${item.unit_price_usd.toFixed(2)} c/u
                            </span>
                          </div>

                          {/* Control de cantidad */}
                          <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQuantity(item, -1)}
                              className="w-6 h-6 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-xs font-bold"
                            >
                              -
                            </button>
                            <span className="w-6 text-center text-xs font-bold">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQuantity(item, 1)}
                              className="w-6 h-6 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-xs font-bold"
                            >
                              +
                            </button>
                          </div>

                          {/* Subtotal */}
                          <span className="text-xs font-bold text-gray-900 dark:text-gray-100 w-16 text-right">
                            ${item.subtotal_usd.toFixed(2)}
                          </span>

                          {/* Eliminar */}
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                            title="Eliminar de la comanda"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Observaciones del ítem */}
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-gray-100 dark:border-gray-700/60">
                          <div className="flex-1 mr-2 truncate">
                            {item.notes ? (
                              <span className="text-amber-600 dark:text-amber-400 font-medium">
                                Obs: {item.notes}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic">Sin observaciones</span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingItem(item);
                              setItemNoteText(item.notes || '');
                              setShowItemNotesModal(true);
                            }}
                            className="text-indigo-600 dark:text-indigo-400 hover:underline text-[10px] font-medium flex items-center gap-0.5"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>Observaciones</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Pie con totales de la mesa */}
                <div className="p-3.5 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Total Consolidado Mesa:</span>
                    <div className="text-right">
                      <span className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400">
                        ${activeOrder.total_usd.toFixed(2)}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                        ({(activeOrder.total_usd * rate).toFixed(2)} Bs)
                      </span>
                    </div>
                  </div>

                  {tablePaymentsTotal > 0 && (
                    <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      <span>Abonado / Pagado:</span>
                      <span>${tablePaymentsTotal.toFixed(2)}</span>
                    </div>
                  )}

                  {tablePendingBalance > 0 && tablePaymentsTotal > 0 && (
                    <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400 font-bold">
                      <span>Saldo Pendiente:</span>
                      <span>${tablePendingBalance.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* PANEL 2: Catálogo de Productos y Filtros (col-span-7) */}
              <div className="md:col-span-7 flex flex-col h-full overflow-hidden bg-white dark:bg-gray-800">
                {/* Filtros de Departamentos, Grupos y Buscador */}
                <div className="p-3 border-b border-gray-200 dark:border-gray-700 space-y-2 bg-gray-50/50 dark:bg-gray-850/50">
                  {/* Departamentos */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDeptId('ALL');
                        setSelectedGroupId('ALL');
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                        selectedDeptId === 'ALL'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      Todos
                    </button>
                    {departments.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          setSelectedDeptId(d.id);
                          setSelectedGroupId('ALL');
                        }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                          selectedDeptId === d.id
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        {d.name}
                      </button>
                    ))}
                  </div>

                  {/* Subgrupos */}
                  {availableGroups.length > 0 && selectedDeptId !== 'ALL' && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      <button
                        type="button"
                        onClick={() => setSelectedGroupId('ALL')}
                        className={`px-2.5 py-1 text-[11px] rounded-lg whitespace-nowrap transition-colors ${
                          selectedGroupId === 'ALL'
                            ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900'
                            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        Todos los Grupos
                      </button>
                      {availableGroups.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setSelectedGroupId(g.id)}
                          className={`px-2.5 py-1 text-[11px] rounded-lg whitespace-nowrap transition-colors ${
                            selectedGroupId === g.id
                              ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900'
                              : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          {g.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Buscador de productos + Fuera de Carta */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar producto por nombre o código..."
                        value={searchProduct}
                        onChange={(e) => setSearchProduct(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus-visible:ring-2 focus-visible:ring-indigo-500"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAdHocProductModal(true)}
                      className="px-3 py-2 text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/50 flex items-center gap-1.5 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-amber-500"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Fuera de Carta</span>
                    </button>
                  </div>
                </div>

                {/* Grid de Productos Disponibles */}
                <div className="flex-1 p-3 overflow-y-auto">
                  {filteredProducts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center text-gray-400">
                      <Search className="w-8 h-8 mb-2 opacity-40" />
                      <p className="text-sm font-medium">No se encontraron productos disponibles</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Verifique los filtros de departamento o la caja registradora activa.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
                      {filteredProducts.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleAddProductToOrder(p)}
                          className="p-3 text-left bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-indigo-500 hover:shadow-sm rounded-lg flex flex-col justify-between transition-all group focus-visible:ring-2 focus-visible:ring-indigo-500"
                        >
                          <div>
                            <span className="text-xs font-semibold line-clamp-2 text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {p.name}
                            </span>
                            <span className="text-[10px] text-gray-400 block mt-0.5">{p.sku}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-gray-100 dark:border-gray-700/60">
                            <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
                              ${p.price_usd.toFixed(2)}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-lg uppercase ${
                                p.suggested_station === 'BAR'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              }`}
                            >
                              {p.suggested_station === 'BAR' ? 'Barra' : 'Cocina'}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: ABRIR MESA & COMANDA INICIAL                    */}
      {/* ======================================================== */}
      {showOpenTableModal && selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Utensils className="w-5 h-5 text-indigo-600" />
                <span>Abrir Comanda - {selectedTable.name}</span>
              </h2>
              <button
                type="button"
                onClick={() => setShowOpenTableModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Sección de Cliente Titular / ERP */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Cliente Titular de la Mesa (Opcional / Directorio ERP)
                  </label>
                  {!showQuickNewCustomer && (
                    <button
                      type="button"
                      onClick={() => setShowQuickNewCustomer(true)}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>+ Crear Nuevo Cliente</span>
                    </button>
                  )}
                </div>

                {selectedErpCustomer ? (
                  <div className="flex items-center justify-between p-2.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <div>
                        <span className="font-bold text-gray-900 dark:text-white block">
                          {selectedErpCustomer.name}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {selectedErpCustomer.doc_type || 'V'}-{selectedErpCustomer.doc_number}{' '}
                          {selectedErpCustomer.phone ? `• Tel: ${selectedErpCustomer.phone}` : ''}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedErpCustomer(null);
                        setInitialCustomerInput('Cliente 1, Cliente 2');
                      }}
                      className="text-xs text-red-500 hover:text-red-700 p-1 cursor-pointer"
                      title="Quitar cliente asignado"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : showQuickNewCustomer ? (
                  /* Formulario de creación rápida de cliente */
                  <div className="p-3 bg-gray-50 dark:bg-gray-750 border border-indigo-200 dark:border-indigo-800 rounded-lg space-y-2.5 text-xs">
                    <div className="flex items-center justify-between font-semibold text-indigo-600 dark:text-indigo-400">
                      <span>Registrar Nuevo Cliente en ERP</span>
                      <button
                        type="button"
                        onClick={() => setShowQuickNewCustomer(false)}
                        className="text-gray-400 hover:text-gray-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">Tipo</label>
                        <select
                          value={quickCustomerDocType}
                          onChange={(e) => setQuickCustomerDocType(e.target.value as any)}
                          className="w-full px-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-xs"
                        >
                          <option value="V">V - Venezolano</option>
                          <option value="J">J - Jurídico</option>
                          <option value="E">E - Extranjero</option>
                          <option value="G">G - Gobierno</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] text-gray-500 mb-0.5">Cédula / RIF *</label>
                        <input
                          type="text"
                          required
                          value={quickCustomerDocNumber}
                          onChange={(e) => setQuickCustomerDocNumber(e.target.value)}
                          placeholder="Ej. 18234567"
                          className="w-full px-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">Nombre / Razón Social *</label>
                      <input
                        type="text"
                        required
                        value={quickCustomerName}
                        onChange={(e) => setQuickCustomerName(e.target.value)}
                        placeholder="Ej. Juan Pérez / Inversiones 2026"
                        className="w-full px-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">Teléfono</label>
                        <input
                          type="text"
                          value={quickCustomerPhone}
                          onChange={(e) => setQuickCustomerPhone(e.target.value)}
                          placeholder="0414-1234567"
                          className="w-full px-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">Email</label>
                        <input
                          type="email"
                          value={quickCustomerEmail}
                          onChange={(e) => setQuickCustomerEmail(e.target.value)}
                          placeholder="correo@ejemplo.com"
                          className="w-full px-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowQuickNewCustomer(false)}
                        className="px-2.5 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-650 rounded-lg cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateQuickCustomer}
                        disabled={isCreatingQuickCustomer}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        {isCreatingQuickCustomer ? 'Guardando...' : 'Crear y Asignar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Buscador con autocompletado */
                  <div className="relative">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={customerSearchQuery}
                        onChange={(e) => handleSearchCustomers(e.target.value)}
                        placeholder="Buscar cliente existente por nombre o cédula/RIF..."
                        className="w-full pl-8 pr-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-2 focus-visible:ring-indigo-500"
                      />
                      {isSearchingCustomer && (
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-indigo-500 font-medium">
                          Buscando...
                        </span>
                      )}
                    </div>

                    {customerSearchResults.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 max-h-44 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-750">
                        {customerSearchResults.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => handleSelectErpCustomer(c)}
                            className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer text-xs"
                          >
                            <span className="font-semibold text-gray-900 dark:text-white block truncate">
                              {c.name}
                            </span>
                            <span className="text-[10px] text-gray-500">
                              {c.doc_type || 'V'}-{c.doc_number} {c.phone ? `• Tel: ${c.phone}` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Mozo / Mesero Asignado
                </label>
                <input
                  type="text"
                  value={openWaiterName}
                  onChange={(e) => setOpenWaiterName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-2 focus-visible:ring-indigo-500"
                  placeholder="Nombre del mesero"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Clientes / Comensales (separados por coma)
                </label>
                <input
                  type="text"
                  value={initialCustomerInput}
                  onChange={(e) => setInitialCustomerInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-2 focus-visible:ring-indigo-500"
                  placeholder="Ej: Juan, Maria, Pedro"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Cada comensal tendrá su propia comanda y total para separar la cuenta.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Notas de la Mesa / Ocasión
                </label>
                <input
                  type="text"
                  value={openOrderNotes}
                  onChange={(e) => setOpenOrderNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus-visible:ring-2 focus-visible:ring-indigo-500"
                  placeholder="Ej: Cumpleaños, mesa cerca de la ventana..."
                />
              </div>
            </div>

            <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowOpenTableModal(false)}
                className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleOpenTableOrder}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer"
              >
                Abrir Mesa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: AGREGAR CLIENTE A COMANDA                      */}
      {/* ======================================================== */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-sm font-bold mb-3 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-indigo-600" />
              <span>Agregar Nuevo Cliente a la Mesa</span>
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Nombre o Alias del Cliente</label>
                <input
                  type="text"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="Ej: Carlos o Cliente 3"
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Observaciones</label>
                <input
                  type="text"
                  value={newCustomerNotes}
                  onChange={(e) => setNewCustomerNotes(e.target.value)}
                  placeholder="Opcional"
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowAddCustomerModal(false)}
                className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddCustomer}
                className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
              >
                Guardar Cliente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: PRODUCTO FUERA DE CARTA / NUEVO                */}
      {/* ======================================================== */}
      {showAdHocProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-sm font-bold mb-3 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-indigo-600" />
              <span>Crear Producto Rápido / Fuera de Carta</span>
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Nombre del Producto / Plato</label>
                <input
                  type="text"
                  value={adHocName}
                  onChange={(e) => setAdHocName(e.target.value)}
                  placeholder="Ej: Postre Especial del Chef"
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Precio Unitario ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={adHocPriceUsd}
                    onChange={(e) => setAdHocPriceUsd(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Área de Preparación</label>
                  <select
                    value={adHocStation}
                    onChange={(e) => setAdHocStation(e.target.value as PreparationStation)}
                    className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                  >
                    <option value="KITCHEN">Cocina</option>
                    <option value="BAR">Barra / Bebidas</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Observaciones</label>
                <input
                  type="text"
                  value={adHocNotes}
                  onChange={(e) => setAdHocNotes(e.target.value)}
                  placeholder="Detalles para cocina o barra..."
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowAdHocProductModal(false)}
                className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddAdHocProduct}
                className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
              >
                Agregar a Comanda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: OBSERVACIONES DEL ÍTEM (PREESTABLECIDAS + LIBRE)*/}
      {/* ======================================================== */}
      {showItemNotesModal && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-sm font-bold mb-2 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-indigo-600" />
              <span>Observaciones: {editingItem.product_name}</span>
            </h2>

            {/* Chips de notas preestablecidas */}
            <div className="mb-3">
              <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                Notas Rápidas Preestablecidas (clic para añadir):
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1 bg-gray-50 dark:bg-gray-750 rounded-lg border border-gray-200 dark:border-gray-700">
                {presetNotes.map((pn) => (
                  <button
                    key={pn.id}
                    type="button"
                    onClick={() => {
                      const trimmed = itemNoteText.trim();
                      if (trimmed.length > 0) {
                        setItemNoteText(`${trimmed}, ${pn.note_text}`);
                      } else {
                        setItemNoteText(pn.note_text);
                      }
                    }}
                    className="px-2 py-1 text-[10px] font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-indigo-500 transition-colors"
                  >
                    + {pn.note_text}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Observación Personalizada</label>
              <textarea
                rows={2}
                value={itemNoteText}
                onChange={(e) => setItemNoteText(e.target.value)}
                placeholder="Escriba especificaciones del cliente..."
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
              />
            </div>

            <div className="mt-3 flex items-center gap-2">
              <input
                type="checkbox"
                id="savePreset"
                checked={saveAsPreset}
                onChange={(e) => setSaveAsPreset(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded-lg"
              />
              <label htmlFor="savePreset" className="text-xs text-gray-700 dark:text-gray-300">
                Guardar también en catálogo de notas preestablecidas
              </label>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setShowItemNotesModal(false);
                  setEditingItem(null);
                }}
                className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveItemNotes}
                className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
              >
                Guardar Observaciones
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: DETALLE DE PRODUCTOS (POR CLIENTE Y POR MESA)   */}
      {/* ======================================================== */}
      {showProductDetailModal && activeOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-base font-bold flex items-center gap-2">
                  <Eye className="w-5 h-5 text-indigo-600" />
                  <span>Detalle de Comanda - Mesa {activeOrder.table_number}</span>
                </h2>
                <p className="text-xs text-gray-500">Orden: {activeOrder.order_number}</p>
              </div>

              {/* Selector de modo: Por Cliente vs Por Mesa */}
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 p-0.5 rounded-lg">
                <button
                  onClick={() => setDetailViewMode('BY_CUSTOMER')}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                    detailViewMode === 'BY_CUSTOMER'
                      ? 'bg-white dark:bg-gray-800 shadow-xs text-indigo-600 font-bold'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  Por Cliente
                </button>
                <button
                  onClick={() => setDetailViewMode('BY_TABLE')}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                    detailViewMode === 'BY_TABLE'
                      ? 'bg-white dark:bg-gray-800 shadow-xs text-indigo-600 font-bold'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  Por Mesa (Consolidada)
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-4">
              {detailViewMode === 'BY_CUSTOMER' ? (
                <div className="space-y-4">
                  {activeOrder.customers?.map((cust) => {
                    const custItems = activeOrder.items?.filter((i) => i.order_customer_id === cust.id) || [];
                    return (
                      <div
                        key={cust.id}
                        className="p-3 bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-lg"
                      >
                        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2 mb-2">
                          <span className="font-bold text-sm text-indigo-600 dark:text-indigo-400">
                            {cust.customer_name}
                          </span>
                          <span className="font-bold text-sm">
                            Total: ${(cust.total_usd || 0).toFixed(2)} USD (
                            {((cust.total_usd || 0) * rate).toFixed(2)} Bs)
                          </span>
                        </div>

                        {custItems.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">No ha agregado productos</p>
                        ) : (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-500 border-b border-gray-200/50 dark:border-gray-700/50">
                                <th className="text-left py-1">Cant.</th>
                                <th className="text-left py-1">Producto</th>
                                <th className="text-left py-1">Área</th>
                                <th className="text-right py-1">Precio</th>
                                <th className="text-right py-1">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {custItems.map((item) => (
                                <tr key={item.id} className="border-b border-gray-100 dark:border-gray-800">
                                  <td className="py-1 font-bold">{item.quantity}x</td>
                                  <td className="py-1">
                                    <div>{item.product_name}</div>
                                    {item.notes && (
                                      <div className="text-[10px] text-amber-600">Nota: {item.notes}</div>
                                    )}
                                  </td>
                                  <td className="py-1">
                                    <span className="text-[10px] uppercase font-semibold">
                                      {item.station === 'BAR' ? 'Barra' : 'Cocina'}
                                    </span>
                                  </td>
                                  <td className="py-1 text-right">${item.unit_price_usd.toFixed(2)}</td>
                                  <td className="py-1 text-right font-semibold">
                                    ${item.subtotal_usd.toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Detalle Consolidado de la Mesa */
                <div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500 border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2">Cliente</th>
                        <th className="text-left py-2">Cant.</th>
                        <th className="text-left py-2">Producto</th>
                        <th className="text-left py-2">Área</th>
                        <th className="text-right py-2">Precio</th>
                        <th className="text-right py-2">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeOrder.items?.map((item) => (
                        <tr key={item.id} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 text-indigo-600 font-medium">
                            {item.customer_name || 'General'}
                          </td>
                          <td className="py-2 font-bold">{item.quantity}x</td>
                          <td className="py-2">
                            <div>{item.product_name}</div>
                            {item.notes && (
                              <div className="text-[10px] text-amber-600">Nota: {item.notes}</div>
                            )}
                          </td>
                          <td className="py-2 uppercase font-semibold text-[10px]">
                            {item.station === 'BAR' ? 'Barra' : 'Cocina'}
                          </td>
                          <td className="py-2 text-right">${item.unit_price_usd.toFixed(2)}</td>
                          <td className="py-2 text-right font-bold">${item.subtotal_usd.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="text-sm">
                <span className="text-gray-500 mr-2">Total Mesa:</span>
                <strong className="text-indigo-600 text-base">${activeOrder.total_usd.toFixed(2)} USD</strong>
              </div>
              <button
                onClick={() => setShowProductDetailModal(false)}
                className="px-4 py-2 text-xs font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 6: FORMAS DE PAGO & SEPARACIÓN DE CUENTAS / CIERRE */}
      {/* ======================================================== */}
      {showPaymentModal && activeOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-base font-bold flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-600" />
                  <span>Cobro y Formas de Pago - Mesa {activeOrder.table_number}</span>
                </h2>
                <p className="text-xs text-gray-500">Separación de cuenta y crédito comercial (CxC)</p>
              </div>

              <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-4">
              {/* Resumen de Cuentas por Persona */}
              <div className="bg-gray-50 dark:bg-gray-850 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  División de Cuenta (Split Bill)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeOrder.customers?.map((cust) => {
                    const custPayments =
                      activeOrder.payments?.filter((p) => p.order_customer_id === cust.id) || [];
                    const paid = custPayments.reduce((s, p) => s + p.amount_usd, 0);
                    const remaining = Math.max(0, Number(((cust.total_usd || 0) - paid).toFixed(2)));

                    return (
                      <div
                        key={cust.id}
                        className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between ${
                          paymentCustomerId === cust.id
                            ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{cust.customer_name}</span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg ${
                              remaining === 0
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60'
                            }`}
                          >
                            {remaining === 0 ? 'Saldado' : 'Pendiente'}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-gray-500">
                          <span>Total: ${(cust.total_usd || 0).toFixed(2)}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentCustomerId(cust.id);
                              setPaymentAmount(remaining > 0 ? remaining.toString() : '');
                            }}
                            className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                          >
                            Cobrar (${remaining.toFixed(2)})
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Formulario de Registro de Pago */}
              <div className="border border-gray-200 dark:border-gray-700 p-3.5 rounded-lg space-y-3">
                <h3 className="text-xs font-bold flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <span>Registrar Pago</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Abonar a:</label>
                    <select
                      value={paymentCustomerId || ''}
                      onChange={(e) => {
                        const val = e.target.value || null;
                        setPaymentCustomerId(val);
                        if (!val) {
                          setPaymentAmount(tablePendingBalance.toString());
                        }
                      }}
                      className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                    >
                      <option value="">Cuenta Completa (Toda la Mesa)</option>
                      {activeOrder.customers?.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.customer_name} (Total: ${c.total_usd.toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">Forma de Pago:</label>
                    <select
                      value={paymentMethodName}
                      onChange={(e) => setPaymentMethodName(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                    >
                      <option value="Efectivo Divisas ($)">Efectivo Divisas ($)</option>
                      <option value="Efectivo Bolívares (Bs)">Efectivo Bolívares (Bs)</option>
                      <option value="Pago Móvil Interbancario (Bs)">Pago Móvil Interbancario (Bs)</option>
                      <option value="Punto de Venta / Débito (Bs)">Punto de Venta / Débito (Bs)</option>
                      <option value="Transferencia Bancaria (Bs)">Transferencia Bancaria (Bs)</option>
                      <option value="Zelle / Divisas ($)">Zelle / Divisas ($)</option>
                      <option value="OTRO_PERSONALIZADO">+ Nueva Forma de Pago Personalizada</option>
                    </select>
                  </div>
                </div>

                {paymentMethodName === 'OTRO_PERSONALIZADO' && (
                  <div>
                    <label className="block text-xs font-semibold mb-1">Nombre de la Nueva Forma de Pago</label>
                    <input
                      type="text"
                      value={customMethodInput}
                      onChange={(e) => setCustomMethodInput(e.target.value)}
                      placeholder="Ej: Cupón de Descuento, Criptomoneda, etc."
                      className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Moneda</label>
                    <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setPaymentCurrency('USD')}
                        className={`flex-1 py-1.5 text-xs font-bold ${
                          paymentCurrency === 'USD'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        USD ($)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentCurrency('VES')}
                        className={`flex-1 py-1.5 text-xs font-bold ${
                          paymentCurrency === 'VES'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        VES (Bs)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">Monto a Pagar</label>
                    <input
                      type="number"
                      step="0.01"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg font-bold"
                    />
                  </div>
                </div>

                {/* Crédito Comercial / CxC */}
                <div className="pt-2 border-t border-gray-200/60 dark:border-gray-700/60">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      id="isCredit"
                      checked={isCreditPayment}
                      onChange={(e) => setIsCreditPayment(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded-lg"
                    />
                    <label htmlFor="isCredit" className="text-xs font-bold text-gray-800 dark:text-gray-200">
                      Cargar a Crédito / Cuenta por Cobrar (CxC)
                    </label>
                  </div>

                  {isCreditPayment && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2.5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <div>
                        <label className="block text-xs font-semibold mb-1">Cliente ERP (CxC):</label>
                        <select
                          value={selectedErpCustomerId}
                          onChange={(e) => setSelectedErpCustomerId(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                        >
                          <option value="">Seleccione Cliente...</option>
                          {erpCustomers.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.doc_number})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold mb-1">Fecha de Vencimiento:</label>
                        <input
                          type="date"
                          value={creditDueDate}
                          onChange={(e) => setCreditDueDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Observaciones de pago */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Referencia / Banco</label>
                    <input
                      type="text"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      placeholder="N° referencia o banco"
                      className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Observación del Pago</label>
                    <input
                      type="text"
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      placeholder="Ej: Billete $20 vuelto $5..."
                      className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRegisterPayment}
                  className="w-full py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  Registrar Pago de ${paymentAmount || '0.00'}
                </button>
              </div>

              {/* Historial de Pagos de la comanda */}
              {activeOrder.payments && activeOrder.payments.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Pagos Registrados en esta Mesa
                  </h4>
                  <div className="space-y-1.5">
                    {activeOrder.payments.map((p) => (
                      <div
                        key={p.id}
                        className="p-2 bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-lg text-xs flex items-center justify-between"
                      >
                        <div>
                          <span className="font-semibold">{p.payment_method_name}</span>
                          <span className="text-gray-400 ml-2">
                            {p.customer_name ? `(${p.customer_name})` : '(Mesa)'}
                          </span>
                          {p.reference && <span className="text-gray-500 ml-2">Ref: {p.reference}</span>}
                          {p.is_credit && (
                            <span className="text-amber-600 dark:text-amber-400 font-bold ml-2">
                              [Crédito CxC]
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-emerald-600">${p.amount_usd.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Pie con Cierre de Mesa */}
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs text-gray-500">Pendiente: </span>
                <strong
                  className={`text-sm ${
                    tablePendingBalance === 0
                      ? 'text-emerald-600'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  ${tablePendingBalance.toFixed(2)} USD
                </strong>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg"
                >
                  Cerrar Ventana
                </button>

                <button
                  type="button"
                  onClick={handlePromptCloseOrder}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg focus-visible:ring-2 focus-visible:ring-emerald-500 transition-colors"
                >
                  Cerrar Mesa & Liberar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación y Auditoría de Cierre de Mesa */}
      {showCloseOrderPromptModal && selectedTable && activeOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-3">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="w-5 h-5" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  Cierre de Mesa #{selectedTable.table_number}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCloseOrderPromptModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg focus-visible:ring-2 focus-visible:ring-gray-400"
                aria-label="Cerrar modal de confirmación"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Mesa:</span>
                  <span className="font-semibold">{selectedTable.name} ({selectedTable.zone})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Mozo:</span>
                  <span className="font-semibold">{activeOrder.waiter_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Comensales:</span>
                  <span className="font-semibold">{activeOrder.customers?.length || 1} personas</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Total Consumo:</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    ${activeOrder.total_usd.toFixed(2)} USD ({(activeOrder.total_usd * rate).toFixed(2)} Bs)
                  </span>
                </div>
                {tablePendingBalance > 0 && (
                  <div className="flex justify-between text-amber-600 dark:text-amber-400 font-semibold pt-1 border-t border-gray-200 dark:border-gray-700">
                    <span>Saldo no cobrado:</span>
                    <span>${tablePendingBalance.toFixed(2)} USD</span>
                  </div>
                )}
              </div>

              {/* Input de Propina */}
              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  Propina Voluntaria (USD $)
                </label>
                <div className="flex gap-2 mb-2">
                  {[0, 5, 10, 15].map((pct) => {
                    const tipVal = pct === 0 ? '0' : ((activeOrder.total_usd * pct) / 100).toFixed(2);
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setClosureTipUsd(tipVal)}
                        className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-lg border transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                          Number(closureTipUsd) === Number(tipVal)
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold'
                            : 'border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {pct === 0 ? 'Sin propina' : `${pct}% ($${tipVal})`}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={closureTipUsd}
                      onChange={(e) => setClosureTipUsd(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg font-bold focus-visible:ring-2 focus-visible:ring-indigo-500"
                    />
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <span>Equiv: </span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                      {((Number(closureTipUsd) || 0) * rate).toFixed(2)} Bs
                    </span>
                  </div>
                </div>
              </div>

              {/* Observaciones / Notas de Cierre */}
              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  Notas de Cierre / Auditoría (opcional)
                </label>
                <textarea
                  value={closureNotes}
                  onChange={(e) => setClosureNotes(e.target.value)}
                  placeholder="Comentarios adicionales sobre el servicio, comanda o pagos..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg resize-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCloseOrderPromptModal(false)}
                className="px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-gray-400"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmCloseTableOrder}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg focus-visible:ring-2 focus-visible:ring-emerald-500 transition-colors"
              >
                Confirmar Cierre y Liberar Mesa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal CRUD Administrador de Mesas */}
      <TableManagementModal
        isOpen={showTableManagementModal}
        onClose={() => setShowTableManagementModal(false)}
        tables={tables}
        onRefresh={fetchTables}
        token={token}
        activeBranchId={activeBranchId}
      />

      {/* Modal Historial de Cierres de Mesa */}
      <TableClosuresModal
        isOpen={showTableClosuresModal}
        onClose={() => setShowTableClosuresModal(false)}
        token={token}
        activeBranchId={activeBranchId}
      />
    </div>
  );
};
