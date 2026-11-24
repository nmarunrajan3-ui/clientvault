import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import DashboardPage from './pages/DashboardPage';
import CustomersPage from './pages/CustomersPage';
import CustomerProfilePage from './pages/CustomerProfilePage';
import LicensesPage from './pages/LicensesPage';
import RemindersPage from './pages/RemindersPage';
import ActivityPage from './pages/ActivityPage';
import SettingsPage from './pages/SettingsPage';

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/customers/:id" element={<CustomerProfilePage />} />
        <Route path="/licenses" element={<LicensesPage />} />
        <Route path="/reminders" element={<RemindersPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
