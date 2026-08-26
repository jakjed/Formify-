import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { HomePage } from '../modules/my-work/HomePage';
import { LoginPage } from '../modules/auth/LoginPage';
import { InvoicesPlaceholder } from '../modules/invoices/InvoicesPlaceholder';
import { IntegrationPlaceholder } from '../modules/integration-center/IntegrationPlaceholder';
import { AdminPlaceholder } from '../modules/admin/AdminPlaceholder';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/invoices" element={<InvoicesPlaceholder />} />
        <Route path="/integration" element={<IntegrationPlaceholder />} />
        <Route path="/admin" element={<AdminPlaceholder />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
