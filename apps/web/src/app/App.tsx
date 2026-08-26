import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { HomePage } from '../modules/my-work/HomePage';
import { LoginPage } from '../modules/auth/LoginPage';
import { BootstrapPage } from '../modules/auth/BootstrapPage';
import { RequireAuth } from '../modules/auth/RequireAuth';
import { InvoicesPage } from '../modules/invoices/InvoicesPage';
import { InvoiceWorkspacePage } from '../modules/invoices/InvoiceWorkspacePage';
import { IntegrationPlaceholder } from '../modules/integration-center/IntegrationPlaceholder';
import { AdminPlaceholder } from '../modules/admin/AdminPlaceholder';
import { DirectoryPage } from '../modules/directory/DirectoryPage';

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
          <Route path="/integration" element={<IntegrationPlaceholder />} />
          <Route path="/admin" element={<AdminPlaceholder />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
