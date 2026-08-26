import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { HomePage } from '../modules/my-work/HomePage';
import { LoginPage } from '../modules/auth/LoginPage';
import { BootstrapPage } from '../modules/auth/BootstrapPage';
import { RequireAuth } from '../modules/auth/RequireAuth';
import { InvoicesPage } from '../modules/invoices/InvoicesPage';
import { InvoiceWorkspacePage } from '../modules/invoices/InvoiceWorkspacePage';
import { IntegrationCenterPage } from '../modules/integration-center/IntegrationCenterPage';
import { AdminPage } from '../modules/admin/AdminPage';
import { DirectoryPage } from '../modules/directory/DirectoryPage';
import { ExceptionsPage } from '../modules/ops/ExceptionsPage';
import { OpsDashboardPage } from '../modules/ops/OpsDashboardPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/bootstrap" element={<BootstrapPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/directory" element={<DirectoryPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/invoices/:id" element={<InvoiceWorkspacePage />} />
          <Route path="/exceptions" element={<ExceptionsPage />} />
          <Route path="/ops" element={<OpsDashboardPage />} />
          <Route path="/integration" element={<IntegrationCenterPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
