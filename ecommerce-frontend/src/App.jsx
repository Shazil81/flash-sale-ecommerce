import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Cart from './pages/Cart';
import Orders from './pages/Orders';
import Profile from './pages/Profile';
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const DeliveryDashboard = lazy(() => import('./pages/DeliveryDashboard'));
import './App.css';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <div className="d-flex flex-column min-vh-100 bg-light">
        {/* Global Navigation Bar */}
        <Navbar />

        {/* Application Routes */}
        <div className="flex-grow-1">
          <Suspense fallback={<div className="container py-5" role="status">Loading page…</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login portal="USER" />} />
            <Route path="/delivery-login" element={<Login portal="DELIVERY" />} />
            <Route path="/admin-login" element={<Login portal="ADMIN" />} />
            <Route path="/register" element={<Register />} />
            <Route path="/cart" element={<ProtectedRoute role="USER"><Cart /></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute role="USER"><Orders /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/admin-dashboard" element={<ProtectedRoute role="ADMIN"><AdminDashboard /></ProtectedRoute>} />
            <Route path="/delivery-dashboard" element={<ProtectedRoute role="DELIVERY"><DeliveryDashboard /></ProtectedRoute>} />
          </Routes>
          </Suspense>
        </div>

        {/* Global Footer */}
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
