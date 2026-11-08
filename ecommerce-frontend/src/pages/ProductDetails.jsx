import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import useApiResource from '../hooks/useApiResource';
import ProductImage from '../components/ProductImage';
import api from '../api';
import { getAuthToken } from '../utils/auth';

export default function ProductDetails() {
  const { id } = useParams();
  const { data: product, loading, error, reload } = useApiResource(`/products/${id}/`);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  async function addToCart() {
    if (!getAuthToken()) { navigate('/login'); return; }
    setBusy(true);
    try {
      await api.post('/cart/add/', { product_id: product.id, quantity: 1 });
      window.dispatchEvent(new Event('cartUpdated'));
      navigate('/cart');
    } catch (failure) { setMessage(failure.response?.data?.error || 'Unable to add this product. Please try again.'); }
    finally { setBusy(false); }
  }
  if (loading) return <div className="container py-5" role="status">Loading product…</div>;
  if (error) return <div className="container py-5" role="alert">{error} <button className="btn btn-outline-primary" onClick={reload}>Try again</button> <Link to="/">Back to products</Link></div>;
  return <main className="container pb-5">
    <Link to="/" className="d-inline-block mb-4">Back to products</Link>
    <div className="row g-4 align-items-start">
      <div className="col-md-6"><ProductImage src={product.image_url} alt={product.name} className="product-detail-image img-fluid" eager /></div>
      <div className="col-md-6">
        <p className="text-muted">{product.category_name}</p><h1 className="h2">{product.name}</h1>
        <p className="fs-3 fw-bold">₹ {Number(product.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
        <p className="product-description">{product.description}</p>
        <p>{product.stock > 0 ? `${product.stock} available` : 'Sold out'}</p>
        {message && <p role="alert" className="text-danger">{message}</p>}
        <button className="btn btn-primary-custom px-4" disabled={busy || product.stock <= 0} onClick={addToCart}>{busy ? 'Adding…' : 'Add to cart'}</button>
      </div>
    </div>
  </main>;
}
