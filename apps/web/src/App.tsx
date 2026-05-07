import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicOnlyRoute } from './components/PublicOnlyRoute';
import { AccountsPage } from './features/accounts/AccountsPage';
import { AuthPage } from './features/auth/AuthPage';
import { PasswordRecoveryPage } from './features/auth/PasswordRecoveryPage';
import { PasswordResetPage } from './features/auth/PasswordResetPage';
import { ContractsPage } from './features/contracts/ContractsPage';
import { CreditCardsPage } from './features/creditCards/CreditCardsPage';
import { AccessPage } from './features/dashboard/AccessPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { TransactionsPage } from './features/transactions/TransactionsPage';
import { queryClient } from './lib/query-client';

function LandingPage() {
  return <Navigate replace to="/app" />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<LandingPage />} path="/" />
          <Route
            element={
              <PublicOnlyRoute>
                <AuthPage mode="login" />
              </PublicOnlyRoute>
            }
            path="/login"
          />
          <Route
            element={
              <PublicOnlyRoute>
                <AuthPage mode="register" />
              </PublicOnlyRoute>
            }
            path="/cadastro"
          />
          <Route
            element={
              <PublicOnlyRoute>
                <PasswordRecoveryPage />
              </PublicOnlyRoute>
            }
            path="/esqueci-senha"
          />
          <Route
            element={
              <PublicOnlyRoute>
                <PasswordResetPage />
              </PublicOnlyRoute>
            }
            path="/redefinir-senha"
          />
          <Route
            element={
              <ProtectedRoute>
                <AppShell>
                  <DashboardPage />
                </AppShell>
              </ProtectedRoute>
            }
            path="/app"
          />
          <Route
            element={
              <ProtectedRoute>
                <AppShell>
                  <AccountsPage />
                </AppShell>
              </ProtectedRoute>
            }
            path="/app/contas"
          />
          <Route
            element={
              <ProtectedRoute>
                <AppShell>
                  <TransactionsPage />
                </AppShell>
              </ProtectedRoute>
            }
            path="/app/lancamentos"
          />
          <Route
            element={
              <ProtectedRoute>
                <AppShell>
                  <ContractsPage />
                </AppShell>
              </ProtectedRoute>
            }
            path="/app/contratos"
          />
          <Route
            element={
              <ProtectedRoute>
                <AppShell>
                  <CreditCardsPage />
                </AppShell>
              </ProtectedRoute>
            }
            path="/app/cartoes"
          />
          <Route
            element={
              <ProtectedRoute>
                <AppShell>
                  <AccessPage />
                </AppShell>
              </ProtectedRoute>
            }
            path="/app/acesso"
          />
          <Route element={<Navigate replace to="/" />} path="*" />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
