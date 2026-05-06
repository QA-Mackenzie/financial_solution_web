import type { PropsWithChildren } from 'react';
import { Navigate } from 'react-router-dom';

import { useSessionQuery } from '../features/auth/use-session';

export function ProtectedRoute({ children }: PropsWithChildren) {
  const { data: session, isLoading } = useSessionQuery();

  if (isLoading) {
    return <div className="screen-message">Carregando sessao...</div>;
  }

  if (!session) {
    return <Navigate replace to="/login" />;
  }

  return <>{children}</>;
}
