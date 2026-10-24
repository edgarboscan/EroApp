import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { LoginView } from '../features/auth/LoginView';
import { TwoFactorView } from '../features/auth/TwoFactorView';
import { SelectBranchView } from '../features/auth/SelectBranchView';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { RequirePermission } from '../components/auth/RequirePermission';
import { useAuthStore } from '../stores/authStore';
import { getDefaultAppRoute } from '../lib/navigation';

const DefaultLandingRedirect: React.FC = () => {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const targetRoute = getDefaultAppRoute(hasPermission);
  return <Navigate to={targetRoute} replace />;
};

import { DynamicDashboard } from '../features/dashboards/DynamicDashboard';
import { POSRegister } from '../features/pos/POSRegister';
import { CashRegisterView } from '../features/pos/CashRegisterView';
import { CashAuditVerificationView } from '../features/pos/CashAuditVerificationView';
import { RestaurantOrdersView } from '../features/restaurant/RestaurantOrdersView';
import { KitchenDisplayView } from '../features/restaurant/KitchenDisplayView';
import { ProductCatalog } from '../features/inventory/ProductCatalog';
import { HierarchyManager } from '../features/inventory/HierarchyManager';
import { PhysicalLocationsView } from '../features/inventory/PhysicalLocationsView';
import { KardexView } from '../features/inventory/KardexView';
import { InventoryAdjustmentsView } from '../features/inventory/InventoryAdjustmentsView';
import { InventoryTransfersView } from '../features/inventory/InventoryTransfersView';
import { BulkPriceUpdateWizard } from '../features/pricing/BulkPriceUpdateWizard';
import { TaxRatesView } from '../features/pricing/TaxRatesView';
import { ReportsView } from '../features/reports/ReportsView';

// Módulo Clientes & CxC (Paso 2)
import { CustomersView } from '../features/customers/CustomersView';
import { CustomerStatementView } from '../features/customers/CustomerStatementView';
import { ReceivablesAgingView } from '../features/receivables/ReceivablesAgingView';
import { CollectionsView } from '../features/receivables/CollectionsView';

// Módulo Proveedores & CxP (Paso 3)
import { SuppliersView } from '../features/suppliers/SuppliersView';
import { SupplierStatementView } from '../features/suppliers/SupplierStatementView';
import { PayablesAgingView } from '../features/payables/PayablesAgingView';
import { PayablePaymentView } from '../features/payables/PayablePaymentView';

// Módulo Compras & Abastecimiento (Paso 8)
import { PurchaseOrdersView } from '../features/purchases/PurchaseOrdersView';
import { GoodsReceiptsView } from '../features/purchases/GoodsReceiptsView';

// Módulo Ventas Comerciales & Despachos (Paso 9)
import { QuotationsView } from '../features/sales/QuotationsView';
import { DeliveryNotesView } from '../features/sales/DeliveryNotesView';
import { CustomerNotesView } from '../features/sales/CustomerNotesView';

// Módulo Tesorería & Bancos (Paso 4)
import { TreasuryView } from '../features/treasury/TreasuryView';
import { BankReconciliationView } from '../features/treasury/BankReconciliationView';

// Módulo Tributos SENIAT Avanzado (Paso 5)
import { WithholdingsView } from '../features/taxes/WithholdingsView';
import { PurchasesBookView } from '../features/taxes/PurchasesBookView';
import { SalesBookView } from '../features/taxes/SalesBookView';
import { ARCVReportView } from '../features/taxes/ARCVReportView';

// Módulo Configuración, Licenciamiento & Auditoría (Paso 10)
import { CompanyConfigView } from '../features/config/CompanyConfigView';
import { PaymentMethodsConfigView } from '../features/config/PaymentMethodsConfigView';
import { UsersAndRolesView } from '../features/config/UsersAndRolesView';
import { LicensesView } from '../features/config/LicensesView';
import { AuditLogsView } from '../features/audit/AuditLogsView';

export const AppRouter: React.FC = () => {
  return (
    <Routes>
      {/* Rutas Públicas de Autenticación */}
      <Route path="/login" element={<LoginView />} />
      <Route path="/2fa" element={<TwoFactorView />} />

      {/* Ruta de Selección de Sucursal */}
      <Route
        path="/select-branch"
        element={
          <ProtectedRoute requireBranch={false}>
            <SelectBranchView />
          </ProtectedRoute>
        }
      />

      {/* Rutas Protegidas del ERP */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DefaultLandingRedirect />} />
        
        <Route
          path="/dashboard"
          element={
            <RequirePermission module="dashboards" action="read" fallback={<DefaultLandingRedirect />}>
              <DynamicDashboard />
            </RequirePermission>
          }
        />

        <Route
          path="/pos/caja"
          element={
            <RequirePermission module="pos" action="read">
              <POSRegister />
            </RequirePermission>
          }
        />

        <Route
          path="/pos/cierre"
          element={
            <RequirePermission module="pos" action="close_register">
              <CashRegisterView />
            </RequirePermission>
          }
        />

        <Route
          path="/pos/auditoria-arqueos"
          element={
            <RequirePermission module="pos" action="audit_shifts">
              <CashAuditVerificationView />
            </RequirePermission>
          }
        />

        <Route
          path="/pos/verificacion"
          element={<Navigate to="/pos/auditoria-arqueos" replace />}
        />

        {/* Módulo de Restaurante & Comandas */}
        <Route
          path="/restaurant/orders"
          element={
            <RequirePermission module="pos" action="read">
              <RestaurantOrdersView />
            </RequirePermission>
          }
        />

        <Route
          path="/restaurant/kds"
          element={
            <RequirePermission module="pos" action="read">
              <KitchenDisplayView />
            </RequirePermission>
          }
        />

        <Route
          path="/customers"
          element={
            <RequirePermission module="customers" action="read">
              <CustomersView />
            </RequirePermission>
          }
        />

        <Route
          path="/customers/:id/statement"
          element={
            <RequirePermission module="customers" action="read">
              <CustomerStatementView />
            </RequirePermission>
          }
        />

        <Route
          path="/receivables"
          element={
            <RequirePermission module="receivables" action="read">
              <ReceivablesAgingView />
            </RequirePermission>
          }
        />

        <Route
          path="/receivables/collections"
          element={
            <RequirePermission module="receivables" action="create">
              <CollectionsView />
            </RequirePermission>
          }
        />

        {/* Módulo Proveedores & CxP */}
        <Route
          path="/suppliers"
          element={
            <RequirePermission module="suppliers" action="read">
              <SuppliersView />
            </RequirePermission>
          }
        />

        <Route
          path="/suppliers/:id/statement"
          element={
            <RequirePermission module="suppliers" action="read">
              <SupplierStatementView />
            </RequirePermission>
          }
        />

        <Route
          path="/payables"
          element={
            <RequirePermission module="payables" action="read">
              <PayablesAgingView />
            </RequirePermission>
          }
        />

        <Route
          path="/payables/payments"
          element={
            <RequirePermission module="payables" action="create">
              <PayablePaymentView />
            </RequirePermission>
          }
        />

        {/* Módulo Compras y Abastecimiento (Paso 8) */}
        <Route
          path="/purchases/orders"
          element={
            <RequirePermission module="purchases" action="read">
              <PurchaseOrdersView />
            </RequirePermission>
          }
        />

        <Route
          path="/purchases/receipts"
          element={
            <RequirePermission module="purchases" action="read">
              <GoodsReceiptsView />
            </RequirePermission>
          }
        />

        {/* Módulo Ventas Comerciales & Despachos (Paso 9) */}
        <Route
          path="/sales/quotations"
          element={
            <RequirePermission module="sales" action="read">
              <QuotationsView />
            </RequirePermission>
          }
        />

        <Route
          path="/sales/deliveries"
          element={
            <RequirePermission module="sales" action="read">
              <DeliveryNotesView />
            </RequirePermission>
          }
        />

        <Route
          path="/sales/credit-debit-notes"
          element={
            <RequirePermission module="sales" action="read">
              <CustomerNotesView />
            </RequirePermission>
          }
        />

        <Route
          path="/receivables/credit-debit-notes"
          element={
            <RequirePermission module="sales" action="read">
              <CustomerNotesView />
            </RequirePermission>
          }
        />

        {/* Módulo Tesorería y Bancos */}
        <Route
          path="/treasury"
          element={
            <RequirePermission module="treasury" action="read">
              <TreasuryView />
            </RequirePermission>
          }
        />

        <Route
          path="/treasury/reconcile"
          element={
            <RequirePermission module="treasury" action="reconcile">
              <BankReconciliationView />
            </RequirePermission>
          }
        />

        {/* Módulo Tributos SENIAT Avanzado (Paso 5) */}
        <Route
          path="/taxes/withholdings"
          element={
            <RequirePermission module="taxes" action="read">
              <WithholdingsView />
            </RequirePermission>
          }
        />

        <Route
          path="/taxes/books/purchases"
          element={
            <RequirePermission module="taxes" action="read">
              <PurchasesBookView />
            </RequirePermission>
          }
        />

        <Route
          path="/taxes/books/sales"
          element={
            <RequirePermission module="taxes" action="read">
              <SalesBookView />
            </RequirePermission>
          }
        />

        <Route
          path="/taxes/arcv"
          element={
            <RequirePermission module="taxes" action="read">
              <ARCVReportView />
            </RequirePermission>
          }
        />

        <Route
          path="/inventory/products"
          element={
            <RequirePermission module="inventory" action="read">
              <ProductCatalog />
            </RequirePermission>
          }
        />

        <Route
          path="/inventory/hierarchy"
          element={
            <RequirePermission module="inventory" action="read">
              <HierarchyManager />
            </RequirePermission>
          }
        />

        <Route
          path="/inventory/locations"
          element={
            <RequirePermission module="inventory" action="read">
              <PhysicalLocationsView />
            </RequirePermission>
          }
        />

        <Route
          path="/inventory/kardex"
          element={
            <RequirePermission module="inventory" action="read">
              <KardexView />
            </RequirePermission>
          }
        />

        <Route
          path="/inventory/adjustments"
          element={
            <RequirePermission module="inventory" action="adjust">
              <InventoryAdjustmentsView />
            </RequirePermission>
          }
        />

        <Route
          path="/inventory/transfers"
          element={
            <RequirePermission module="inventory" action="transfer">
              <InventoryTransfersView />
            </RequirePermission>
          }
        />

        <Route
          path="/pricing/bulk-update"
          element={
            <RequirePermission module="pricing" action="bulk_update">
              <BulkPriceUpdateWizard />
            </RequirePermission>
          }
        />

        <Route
          path="/pricing/tax-rates"
          element={
            <RequirePermission module="pricing" action="apply_tax">
              <TaxRatesView />
            </RequirePermission>
          }
        />

        <Route
          path="/reports"
          element={
            <RequirePermission module="reports" action="export_pdf">
              <ReportsView />
            </RequirePermission>
          }
        />

        {/* Módulo Configuración, Licencias & Auditoría (Paso 10) */}
        <Route
          path="/config/company"
          element={
            <RequirePermission module="config" action="read">
              <CompanyConfigView />
            </RequirePermission>
          }
        />

        <Route
          path="/config/payment-methods"
          element={
            <RequirePermission module="config" action="read">
              <PaymentMethodsConfigView />
            </RequirePermission>
          }
        />

        <Route
          path="/config/users"
          element={
            <RequirePermission module="config" action="read">
              <UsersAndRolesView />
            </RequirePermission>
          }
        />

        <Route
          path="/config/licenses"
          element={
            <RequirePermission module="config" action="read">
              <LicensesView />
            </RequirePermission>
          }
        />

        <Route
          path="/audit/logs"
          element={
            <RequirePermission module="audit" action="read">
              <AuditLogsView />
            </RequirePermission>
          }
        />
      </Route>

      {/* Fallback de redirección */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};
