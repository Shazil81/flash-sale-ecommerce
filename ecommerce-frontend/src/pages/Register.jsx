import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';

function Register() {
  const [role, setRole] = useState('USER');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = { username, email, password, role, mobile };
      await api.post('/register/', payload);
      setSuccess('Registration successful! Redirecting to login...');
      setTimeout(() => navigate(role === 'DELIVERY' ? '/delivery-login' : '/login'), 1500);
    } catch (err) {
      if (err.response && err.response.data) {
        const firstError = Object.values(err.response.data)[0];
        setError(Array.isArray(firstError) ? firstError[0] : firstError);
      } else {
        setError('Registration failed. Try again.');
      }
    } finally { setSubmitting(false); }
  };

  return (
    <div className="container mt-5" style={{ maxWidth: '400px' }}>
      <h2 className="text-center mb-4">Register</h2>

      {/* Role Tabs */}
      <ul className="nav nav-pills nav-fill mb-4 roleTabs">
        <li className="nav-item">
          <button className={`nav-link ${role === 'USER' ? 'active' : ''}`} type="button" onClick={() => setRole('USER')}>Customer</button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${role === 'DELIVERY' ? 'active' : ''}`} type="button" onClick={() => setRole('DELIVERY')}>Delivery Partner</button>
        </li>
      </ul>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {success && <div className="alert alert-success" role="status">{success}</div>}

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label" htmlFor="username">Username</label>
          <input id="username" autoComplete="username"
                type="text"
            className="form-control"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="email">Email</label>
          <input id="email" autoComplete="email"
                type="email"
            className="form-control"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="mb-3">
          <label className="form-label" htmlFor="mobile">Mobile Number</label>
          <input id="mobile" autoComplete="tel"
                type="tel"
            className="form-control"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            required
          />
          {role === 'DELIVERY' && (
            <div className="form-text">Required for delivery verification. KYC status will be pending until approved by an admin.</div>
          )}
        </div>

        <div className="mb-3">
          <label className="form-label" htmlFor="password">Password</label>
          <input id="password" autoComplete="new-password"
                type="password"
            className="form-control"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={submitting || Boolean(success)} className="btn btn-primary-custom w-100 rounded-pill">Register</button>
      </form>
      <p className="text-center mt-3">
        Already have an account? <Link to="/login">Login here</Link>
      </p>
    </div>
  );
}

export default Register;
