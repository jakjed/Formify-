import { Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { HomePage } from '../modules/my-work/HomePage';
import { LoginPage } from '../modules/auth/LoginPage';
import { BootstrapPage } from '../modules/auth/BootstrapPage';
import { InviteAcceptPage } from '../modules/auth/InviteAcceptPage';
import { PasswordResetRequestPage } from '../modules/auth/PasswordResetRequestPage';
import { PasswordResetConfirmPage } from '../modules/auth/PasswordResetConfirmPage';
import { OidcCallbackPage } from '../modules/auth/OidcCallbackPage';
import { RequireAuth } from '../modules/auth/RequireAuth';
import { InvoicesPage } from '../modules/invoices/InvoicesPage';
import { InvoiceWorkspacePage } from '../modules/invoices/InvoiceWorkspacePage';
import { IntegrationCenterPage } from '../modules/integration-center/IntegrationCenterPage';
import { AdminPage } from '../modules/admin/AdminPage';
import { DirectoryPage } from '../modules/directory/DirectoryPage';
import { ExceptionsPage } from '../modules/ops/ExceptionsPage';
import { OpsDashboardPage } from '../modules/ops/OpsDashboardPage';
import { ContractsPage } from '../modules/contracts/ContractsPage';
import { ContractWorkspacePage } from '../modules/contracts/ContractWorkspacePage';
import { PurchaseRequestsPage } from '../modules/purchase-requests/PurchaseRequestsPage';
import { PurchaseOrdersPage } from '../modules/purchase-orders/PurchaseOrdersPage';
import {
  ForbiddenPage,
  NotFoundPage,
} from '../shared/components/SystemPages';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/bootstrap" element={<BootstrapPage />} />
      <Route path="/invite/:token" element={<InviteAcceptPage />} />
      <Route path="/reset" element={<PasswordResetRequestPage />} />
      <Route path="/reset/:token" element={<PasswordResetConfirmPage />} />
      <Route path="/auth/callback" element={<OidcCallbackPage />} />
      <Route path="/403" element={<ForbiddenPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/directory" element={<DirectoryPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/invoices/:id" element={<InvoiceWorkspacePage />} />
          <Route path="/exceptions" element={<ExceptionsPage />} />
          <Route path="/ops" element={<OpsDashboardPage />} />
          <Route path="/contracts" element={<ContractsPage />} />
          <Route path="/contracts/:id" element={<ContractWorkspacePage />} />
          <Route path="/purchase-requests" element={<PurchaseRequestsPage />} />
          <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
          <Route path="/integration" element={<IntegrationCenterPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
