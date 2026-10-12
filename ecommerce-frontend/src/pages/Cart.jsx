import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { getAuthToken, getAuthUsername } from '../utils/auth';

function Cart() {
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);

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

  const checkRoleAndFetchCart = useCallback(async () => {
    try {
      const meRes = await api.get('/me/');
      const role = meRes.data.profile?.role || meRes.data.role;
      if (role === 'DELIVERY') {
        navigate('/delivery-dashboard');
        return;
      }
      if (role === 'ADMIN') {
        navigate('/admin-dashboard');
        return;
      }
    } catch {
      // ignore
    }
  }, [navigate]);

  const fetchCart = useCallback(async () => {
    await checkRoleAndFetchCart();
    try {
      const response = await api.get('/cart/');
      setCart(response.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching cart:", error);
      setLoading(false);
    }
  }, [checkRoleAndFetchCart]);

  useEffect(() => {
    let active = true;
    const token = getAuthToken();
    if (!token) {
      navigate('/login');
    } else {
      api.get('/cart/').then(({ data }) => { if (active) { setCart(data); setLoading(false); } }).catch(() => { if (active) { setMessage('Unable to load data. Please try again.'); setLoading(false); } });
    }
      return () => { active = false; };
  }, [navigate]);

  const handleRemove = async (productId) => {
    try {
      await api.post('/cart/remove/', { product_id: productId });
      setMessage("Item removed");
      fetchCart();
      dispatchCartEvent();
      setTimeout(() => setMessage(''), 3000);
    } catch {
      setMessage("Failed to remove item");
      setTimeout(() => setMessage(''), 3000);
    }
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
    try {
      await api.post('/cart/add/', { product_id: productId, quantity: change });
      fetchCart();
      dispatchCartEvent();
    } catch {
      setMessage("Failed to update quantity");
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleCheckout = async () => {
    if (checkingOut) return;
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

    try {
      setCheckingOut(true);
      // 1. Create order on backend
      const response = await api.post('/payment/create-order/', { address: fullAddress });
      const { order_id, amount, currency, key } = response.data;

      // 2. Open Razorpay Checkout popup
      const options = {
        key: key,
        amount: amount,
        currency: currency,
        name: "Flash Sale Store",
        description: "Test Transaction",
        order_id: order_id,
        modal: { ondismiss: () => setCheckingOut(false) },
        handler: async function (response) {
          // 3. Verify Payment
          try {
            await api.post('/payment/verify/', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              address: fullAddress
            });
            setMessage("Payment Successful! Your order has been placed.");
            fetchCart();
            dispatchCartEvent();
            setTimeout(() => setMessage(''), 5000);
            navigate('/orders');
          } catch (error) {
            setMessage(error.response?.data?.error || 'Payment verification failed. Please contact support.');
            setCheckingOut(false);
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
        setCheckingOut(false);
        setMessage(`Payment Failed: ${response.error.description}`);
      });
      rzp.open();

    } catch (error) {
      setCheckingOut(false);
      if (error.response && error.response.data && error.response.data.error) {
        setMessage(error.response.data.error);
      } else {
        setMessage("Failed to initiate checkout. Please try again later.");
      }
      setTimeout(() => setMessage(''), 3000);
    }
  };

  if (loading) {
    return <div className="container mt-5 text-center"><h5>Loading Cart...</h5></div>;
  }

  return (
    <div className="container mt-4 pb-5">
      <h2 className="mb-4">Shopping Cart</h2>

      {message && (
        <div className="alert alert-info text-center position-fixed start-50 translate-middle-x shadow-lg" role="alert" style={{top: '20px', zIndex: 1050, minWidth: '300px', borderRadius: '8px'}}>
          {message}
        </div>
      )}

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
                    <img
                      src={item.product.image_url || 'https://via.placeholder.com/150'}
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
                            style={{width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: '1'}}
                            onClick={() => handleUpdateQuantity(item.product.id, item.quantity, -1)}
                          >
                            -
                          </button>
                          <span className="mx-3 fw-bold fs-5">{item.quantity}</span>
                          <button
                            className="btn btn-outline-secondary btn-sm fw-bold fs-5"
                            style={{width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: '1'}}
                            onClick={() => handleUpdateQuantity(item.product.id, item.quantity, 1)}
                            disabled={item.product.stock <= item.quantity}
                          >
                            +
                          </button>
                        </div>

                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleRemove(item.product.id)}
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
                    <input type="text" className="form-control form-control-sm" name="flat" placeholder="Flat No, House or Building" aria-label="Flat No, House or Building" value={addressObj.flat} onChange={handleAddressChange} />
                  </div>
                  <div className="col-12">
                    <input type="text" className="form-control form-control-sm" name="street" placeholder="Area, Street or Sector" aria-label="Area, Street or Sector" value={addressObj.street} onChange={handleAddressChange} />
                  </div>
                  <div className="col-md-6">
                    <input type="text" className="form-control form-control-sm" name="city" placeholder="Town / City" aria-label="Town / City" value={addressObj.city} onChange={handleAddressChange} />
                  </div>
                  <div className="col-md-6">
                      <input type="text" className="form-control form-control-sm" name="pincode" placeholder="Pincode" aria-label="Pincode" value={addressObj.pincode} onChange={handleAddressChange} />
                    </div>
                    <div className="col-12 mt-2">
                      <input type="tel" className="form-control form-control-sm" name="mobile" placeholder="Mobile Number" aria-label="Mobile Number" value={addressObj.mobile} onChange={handleAddressChange} maxLength="10" />
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
                  disabled={checkingOut}
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
