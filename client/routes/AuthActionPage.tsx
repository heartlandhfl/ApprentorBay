import { Navigate, useLocation } from 'react-router-dom';
import { parsePasswordResetAction } from '@apprentorbay/shared';

export function AuthActionPage() {
  const location = useLocation();
  const query = location.search || (location.hash ? `?${location.hash.replace(/^#/, '')}` : '');
  const action = parsePasswordResetAction({
    search: location.search,
    hash: location.hash,
  });

  if (action.kind === 'reset') {
    return <Navigate to={`/reset-password${query}`} replace />;
  }

  return <Navigate to="/login" replace />;
}
