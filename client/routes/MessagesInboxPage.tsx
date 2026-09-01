import { Navigate, useLocation } from 'react-router-dom';

export function MessagesInboxPage() {
  const location = useLocation();
  return <Navigate to="/dashboard" replace state={location.state} />;
}
