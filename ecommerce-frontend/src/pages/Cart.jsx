import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import useApiResource from '../hooks/useApiResource';
import ProductImage from '../components/ProductImage';
import { getAuthUsername } from '../utils/auth';

function Cart() {
  const { data: cart, loading, error, reload } = useApiResource('/cart/');
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);
  const [pendingPayment, setPendingPayment] = useState(() => sessionStorage.getItem('pending_payment_order') || '');

  // Expanded Address State
  const [addressObj, setAddressObj] = useState({
      flat: '',
      street: '',
      city: '',
      pincode: '',
      mobile: ''
    });
  const [locationLoading, setLocationLoading] = useState(false);

  const navigate = useNavigate();

  const dispatchCartEvent = () => {
    window.dispatchEvent(new Event('cartUpdated'));
  };

  const handleRemove = async (productId) => {
    if (updating) return;
    setUpdating(true);
    try {
      await api.post('/cart/remove/', { product_id: productId });
      setMessage("Item removed");
      reload();
      dispatchCartEvent();
      setTimeout(() => setMessage(''), 3000);
    } catch {
      setMessage("Failed to remove item");
      setTimeout(() => setMessage(''), 3000);
    } finally { setUpdating(false); }
  };

  const handleAddressChange = (e) => {
    setAddressObj({ ...addressObj, [e.target.name]: e.target.value });
  };

  const detectLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const { latitude, longitude } = position.coords;
        // Reverse Geocoding using OpenStreetMap Nominatim
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        const data = await response.json();

        if (data && data.address) {
          setAddressObj((prev) => ({
            ...prev,
            street: data.address.suburb || data.address.neighbourhood || data.address.road || '',
            city: data.address.city || data.address.town || data.address.state_district || '',
            pincode: data.address.postcode || ''
          }));
          setMessage("Location auto-detected successfully!");
          setTimeout(() => setMessage(''), 3000);
        }
      } catch (error) {
        console.error("Failed to detect location", error);
        alert("Failed to auto-detect location. Please enter manually.");
      } finally {
        setLocationLoading(false);
      }
    }, () => {
      alert("Permission to access location was denied");
      setLocationLoading(false);
    });
  };

  const handleUpdateQuantity = async (productId, currentQuantity, change) => {
    if (currentQuantity + change <= 0) {
      handleRemove(productId);
      return;
    }
    if (updating) return;
    setUpdating(true);
    try {
      await api.post('/cart/add/', { product_id: productId, quantity: change });
      reload();
      dispatchCartEvent();
    } catch {
      setMessage("Failed to update quantity");
      setTimeout(() => setMessage(''), 3000);
    } finally { setUpdating(false); }
  };

  const clearPendingPayment = () => {
    sessionStorage.removeItem('pending_payment_order');
    setPendingPayment('');
  };

  const showPaymentResult = (data) => {
    if (data.payment_status === 'FULFILLED') {
      clearPendingPayment();
      dispatchCartEvent();
      navigate('/orders');
    } else if (data.payment_status === 'REFUNDED' || data.payment_status === 'REFUND_PENDING') {
      clearPendingPayment();
      navigate('/orders');
    } else {
      setMessage(data.error || 'Payment confirmation is pending. Check its status before paying again.');
    }
    setCheckingOut(false);
  };

  const checkPendingPayment = async () => {
    setCheckingOut(true);
    try {
      const result = await api.get(`/payment/status/${encodeURIComponent(pendingPayment)}/`);
      showPaymentResult(result.data);
    } catch (failure) {
      showPaymentResult(failure.response?.data || { error: 'Unable to confirm payment. Please retry; do not pay again.' });
    }
  };

  const handleCheckout = async () => {
    if (checkingOut || pendingPayment) return;
    if (!/^[0-9]{6}$/.test(addressObj.pincode) || !/^[0-9]{10}$/.test(addressObj.mobile)) {
      setMessage('Enter a valid 6-digit pincode and 10-digit mobile number.');
      return;
    }
    if (!addressObj.flat || !addressObj.street || !addressObj.city || !addressObj.pincode || !addressObj.mobile) {
      setMessage("Please fill out all address fields before checkout.");
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    const fullAddress = `${addressObj.flat}, ${addressObj.street}, ${addressObj.city} - ${addressObj.pincode}, Ph: ${addressObj.mobile}`;

    if (typeof window.Razorpay !== 'function') {
      setMessage('Payment checkout could not load. Refresh the page and try again.');
      return;
    }
    let paymentSubmitted = false;
    try {
      setCheckingOut(true);
      // 1. Create order on backend
      const response = await api.post('/payment/create-order/', { address: fullAddress });
      const { order_id, amount, currency, key } = response.data;
      sessionStorage.setItem('pending_payment_order', order_id);
      setPendingPayment(order_id);

      // 2. Open Razorpay Checkout popup
      const options = {
        key: key,
        amount: amount,
        currency: currency,
        name: "Flash Sale Store",
        description: "Test Transaction",
        order_id: order_id,
        modal: {
          escape: true, confirm_close: false,
          ondismiss: () => {
            setCheckingOut(false);
            if (!paymentSubmitted) { clearPendingPayment(); setMessage('Checkout closed. Your cart has been kept.'); }
          }
        },
        handler: async function (response) {
          // Keep the reference if the connection is lost after payment.
          paymentSubmitted = true;
          try {
            const verification = await api.post('/payment/verify/', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              address: fullAddress
            });
            showPaymentResult(verification.data);
          } catch (error) {
            showPaymentResult(error.response?.data || { error: 'Payment confirmation interrupted. Check its status before paying again.' });
          }
        },
        prefill: {
          name: getAuthUsername() || "Customer",
          email: undefined,
          contact: addressObj.mobile
        },
        theme: {
          color: "#3399cc"
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response){
        setMessage(`Payment Failed: ${response.error.description}`);
      });
      rzp.open();

    } catch (error) {
      setCheckingOut(false);
      if (!paymentSubmitted) clearPendingPayment();
      if (error.response && error.response.data && error.response.data.error) {
        setMessage(error.response.data.error);
      } else {
        setMessage("Failed to initiate checkout. Please try again later.");
      }
      setTimeout(() => setMessage(''), 3000);
    }
  };

  if (loading && !cart) {
    return <div className="container mt-5 text-center"><h5>Loading Cart...</h5></div>;
  }

  if (error) return <div className="container py-5" role="alert">{error} <button className="btn btn-outline-primary" onClick={reload}>Try again</button></div>;

  return (
    <div className="container mt-4 pb-5">
      <h2 className="mb-4">Shopping Cart</h2>

      {message && (
        <div className="alert alert-info" role="status">
          {message}
        </div>
      )}

      {pendingPayment && <div className="alert alert-warning" role="status">
        <p>A previous checkout needs confirmation. Do not pay again until its status is checked.</p>
        <button className="btn btn-outline-dark" disabled={checkingOut} onClick={checkPendingPayment}>{checkingOut ? 'Checking...' : 'Check payment status'}</button>
        <button className="btn btn-link" disabled={checkingOut} onClick={() => { clearPendingPayment(); setMessage('Checkout cleared. If you were charged, check Payment updates in My Orders before trying again.'); }}>I did not complete payment</button>
      </div>}

      {!cart || !cart.items || cart.items.length === 0 ? (
        <div className="text-center mt-5">
          <h4>Your cart is empty</h4>
          <button className="btn btn-primary mt-3" onClick={() => navigate('/')}>
            Go Shopping
          </button>
        </div>
      ) : (
        <div className="row">
          <div className="col-md-7">
            {cart.items.map((item) => (
              <div className="card mb-3 shadow-sm border-0" key={item.id}>
                <div className="row g-0">
                  <div className="col-md-3 p-3 bg-light d-flex align-items-center justify-content-center">
                    <ProductImage
                      src={item.product.image_url}
                      className="img-fluid rounded-start"
                      alt={item.product.name}
                      style={{ maxHeight: '120px', objectFit: 'contain' }}
                    />
                  </div>
                  <div className="col-md-9">
                    <div className="card-body">
                      <div className="d-flex justify-content-between">
                        <h5 className="card-title text-truncate" style={{maxWidth: '80%'}}>{item.product.name}</h5>
                        <h5 className="text-danger fw-bold">₹ {item.product.price}</h5>
                      </div>
                      <p className="card-text text-muted mb-2">Category: {item.product.category_name}</p>
                      <div className="d-flex justify-content-between align-items-center mt-3">

                        {/* Quantity Controls */}
                        <div className="d-flex align-items-center">
                          <button
                            className="btn btn-outline-secondary btn-sm fw-bold fs-5"
                            className="btn btn-outline-secondary quantity-button"
                            aria-label={`Decrease quantity of ${item.product.name}`} disabled={updating || loading || checkingOut}
                            onClick={() => handleUpdateQuantity(item.product.id, item.quantity, -1)}
                          >
                            -
                          </button>
                          <span className="mx-3 fw-bold fs-5">{item.quantity}</span>
                          <button
                            className="btn btn-outline-secondary btn-sm fw-bold fs-5"
                            className="btn btn-outline-secondary quantity-button"
                            onClick={() => handleUpdateQuantity(item.product.id, item.quantity, 1)}
                            aria-label={`Increase quantity of ${item.product.name}`} disabled={item.product.stock <= item.quantity || updating || loading || checkingOut}
                          >
                            +
                          </button>
                        </div>

                        <button
                          className="btn btn-sm btn-outline-danger"
                          disabled={updating || loading || checkingOut} onClick={() => handleRemove(item.product.id)}
                        >
                          <i className="bi bi-trash"></i> Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="col-md-5">
            <div className="card shadow-sm border-0 mb-4 bg-light">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="card-title mb-0">Shipping Address <span className="text-danger">*</span></h5>
                  <button className="btn btn-outline-primary btn-sm" onClick={detectLocation} disabled={locationLoading}>
                    {locationLoading ? 'Detecting...' : <><i className="bi bi-geo-alt"></i> Auto Detect</>}
                  </button>
                </div>

                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label" htmlFor="address-flat">House or building</label>
                    <input id="address-flat" autoComplete="address-line1" type="text" className="form-control form-control-sm" name="flat" placeholder="Flat No, House or Building" value={addressObj.flat} onChange={handleAddressChange} />
                  </div>
                  <div className="col-12">
                    <label className="form-label" htmlFor="address-street">Street or area</label>
                    <input id="address-street" autoComplete="address-line2" type="text" className="form-control form-control-sm" name="street" placeholder="Area, Street or Sector" value={addressObj.street} onChange={handleAddressChange} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="address-city">Town or city</label>
                    <input id="address-city" autoComplete="address-level2" type="text" className="form-control form-control-sm" name="city" placeholder="Town / City" value={addressObj.city} onChange={handleAddressChange} />
                  </div>
                  <div className="col-md-6">
                      <label className="form-label" htmlFor="address-pincode">Pincode</label>
                    <input id="address-pincode" autoComplete="postal-code" type="text" className="form-control form-control-sm" name="pincode" placeholder="Pincode" value={addressObj.pincode} onChange={handleAddressChange} />
                    </div>
                    <div className="col-12 mt-2">
                      <label className="form-label" htmlFor="address-mobile">Mobile number</label>
                    <input id="address-mobile" autoComplete="tel" type="tel" className="form-control form-control-sm" name="mobile" placeholder="Mobile Number" value={addressObj.mobile} onChange={handleAddressChange} maxLength="10" />
                    </div>
                </div>
              </div>
            </div>

            <div className="card shadow-sm border-0">
              <div className="card-body">
                <h5 className="card-title mb-4">Order Summary</h5>
                <div className="d-flex justify-content-between mb-3">
                  <span>Total Items:</span>
                  <span>{cart.items.reduce((acc, item) => acc + item.quantity, 0)}</span>
                </div>
                <div className="d-flex justify-content-between mb-3">
                  <span>Delivery Charges:</span>
                  <span className="text-success">Free</span>
                </div>
                <hr />
                <div className="d-flex justify-content-between mb-4">
                  <h5 className="fw-bold">Total Amount:</h5>
                  <h5 className="text-danger fw-bold">₹ {cart.total_price}</h5>
                </div>
                <button
                  className="btn btn-warning w-100 fw-bold py-2 shadow-sm"
                  onClick={handleCheckout}
                  disabled={checkingOut || updating || loading || Boolean(pendingPayment)}
                >
                  {checkingOut ? 'Processing checkout…' : 'Proceed to Checkout'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Cart;
