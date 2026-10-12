import { Navigate } from 'react-router-dom';
import { getAuthToken, getAuthRole } from '../utils/auth';

export default function ProtectedRoute({ role, children }) {
  if (!getAuthToken()) return <Navigate to="/login" replace />;
  const currentRole = getAuthRole();
  if (role && currentRole !== role) {
    return <Navigate to={currentRole === 'ADMIN' ? '/admin-dashboard' : currentRole === 'DELIVERY' ? '/delivery-dashboard' : '/'} replace />;
  }
  return children;
}
