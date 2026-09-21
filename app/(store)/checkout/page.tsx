'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  MapPin,
  CreditCard,
  Package,
  Truck,
  Shield,
  Plus,
  Edit2,
  Trash2,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CartItem {
  _id: string;
  name: string;
  slug: string;
  image: string;
  price: number;
  quantity: number;
  attributes?: Record<string, string>;
}

interface Cart {
  items: CartItem[];
  subtotal: number;
  couponCode?: string;
  couponDiscount: number;
  isGiftWrapped: boolean;
  giftMessage?: string;
}

interface Address {
  _id: string;
  label: string;
  fullName: string;
  phone: string;
  street: string;
  city: string;
  district: string;
  division: string;
  postalCode: string;
  isDefault: boolean;
}

const steps = [
  { id: 1, name: 'Shipping', icon: MapPin },
  { id: 2, name: 'Payment', icon: CreditCard },
  { id: 3, name: 'Review', icon: Package },
];

const divisions = [
  'Dhaka',
  'Chittagong',
  'Rajshahi',
  'Khulna',
  'Barisal',
  'Sylhet',
  'Rangpur',
  'Mymensingh',
];

const paymentMethods = [
  {
    id: 'cod',
    name: 'Cash on Delivery',
    description: 'Pay when you receive your order',
    icon: '💵',
    available: true,
  },
  {
    id: 'sslcommerz',
    name: 'SSLCommerz',
    description: 'Credit/Debit Card, Mobile Banking',
    icon: '💳',
    available: true,
  },
  {
    id: 'bkash',
    name: 'bKash',
    description: 'Pay with bKash mobile wallet',
    icon: '📱',
    available: true,
  },
  {
    id: 'nagad',
    name: 'Nagad',
    description: 'Pay with Nagad mobile wallet',
    icon: '📲',
    available: true,
  },
];

const GIFT_WRAP_PRICE = 50;
const FREE_SHIPPING_THRESHOLD = 3000;
const SHIPPING_COST = 80;

export default function CheckoutPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [currentStep, setCurrentStep] = useState(1);
  const [cart, setCart] = useState<Cart | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);

  // Shipping state
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [addressForm, setAddressForm] = useState({
    label: 'Home',
    fullName: '',
    phone: '',
    street: '',
    city: '',
    district: '',
    division: '',
    postalCode: '',
    isDefault: false,
  });

  // Payment state
  const [selectedPayment, setSelectedPayment] = useState('cod');
  const [orderNotes, setOrderNotes] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?redirect=/checkout');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchCart();
      fetchAddresses();
    }
  }, [session]);

  const fetchCart = async () => {
    try {
      const response = await fetch('/api/cart');
      const data = await response.json();
      if (!data.cart || data.cart.items.length === 0) {
        router.push('/cart');
        return;
      }
      setCart(data.cart);
    } catch (error) {
      console.error('Failed to fetch cart:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAddresses = async () => {
    try {
      const response = await fetch('/api/user/addresses');
      const data = await response.json();
      setAddresses(data.addresses || []);
      const defaultAddr = data.addresses?.find((a: Address) => a.isDefault);
      if (defaultAddr) {
        setSelectedAddress(defaultAddr._id);
      } else if (data.addresses?.length > 0) {
        setSelectedAddress(data.addresses[0]._id);
      }
    } catch (error) {
      console.error('Failed to fetch addresses:', error);
    }
  };

  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingAddress
        ? `/api/user/addresses/${editingAddress._id}`
        : '/api/user/addresses';
      const method = editingAddress ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addressForm),
      });

      if (response.ok) {
        await fetchAddresses();
        setShowAddressForm(false);
        setEditingAddress(null);
        setAddressForm({
          label: 'Home',
          fullName: '',
          phone: '',
          street: '',
          city: '',
          district: '',
          division: '',
          postalCode: '',
          isDefault: false,
        });
      }
    } catch (error) {
      console.error('Failed to save address:', error);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!confirm('Are you sure you want to delete this address?')) return;
    try {
      await fetch(`/api/user/addresses/${addressId}`, { method: 'DELETE' });
      await fetchAddresses();
      if (selectedAddress === addressId) {
        setSelectedAddress('');
      }
    } catch (error) {
      console.error('Failed to delete address:', error);
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      alert('Please select a shipping address');
      setCurrentStep(1);
      return;
    }

    setPlacing(true);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shippingAddressId: selectedAddress,
          paymentMethod: selectedPayment,
          notes: orderNotes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Failed to place order');
        return;
      }

      // Handle different payment methods
      if (selectedPayment === 'cod') {
        router.push(`/order-confirmation/${data.order._id}`);
      } else if (data.paymentUrl) {
        // Redirect to payment gateway
        window.location.href = data.paymentUrl;
      }
    } catch (error) {
      console.error('Failed to place order:', error);
      alert('Failed to place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  const subtotal = cart?.subtotal || 0;
  const couponDiscount = cart?.couponDiscount || 0;
  const giftWrapCost = cart?.isGiftWrapped ? GIFT_WRAP_PRICE : 0;
  const shippingCost = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
  const total = subtotal - couponDiscount + giftWrapCost + shippingCost;

  const selectedAddressData = addresses.find((a) => a._id === selectedAddress);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/cart"
            className="flex items-center gap-2 text-gray-500 hover:text-primary transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
            Back to Cart
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Checkout</h1>
          <div className="w-24" />
        </div>

        {/* Progress Steps */}
        <div className="max-w-3xl mx-auto mb-12">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all',
                      currentStep > step.id
                        ? 'bg-green-500 border-green-500 text-white'
                        : currentStep === step.id
                        ? 'bg-primary border-primary text-white'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400'
                    )}
                  >
                    {currentStep > step.id ? (
                      <Check className="h-6 w-6" />
                    ) : (
                      <step.icon className="h-6 w-6" />
                    )}
                  </div>
                  <span
                    className={cn(
                      'mt-2 text-sm font-medium',
                      currentStep >= step.id
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-400'
                    )}
                  >
                    {step.name}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'w-24 md:w-32 lg:w-40 h-1 mx-2 rounded',
                      currentStep > step.id ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {/* Step 1: Shipping */}
              {currentStep === 1 && (
                <motion.div
                  key="shipping"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6"
                >
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                    Shipping Address
                  </h2>

                  {/* Saved Addresses */}
                  {addresses.length > 0 && !showAddressForm && (
                    <div className="space-y-4 mb-6">
                      {addresses.map((address) => (
                        <div
                          key={address._id}
                          className={cn(
                            'relative p-4 rounded-lg border-2 cursor-pointer transition-all',
                            selectedAddress === address._id
                              ? 'border-primary bg-primary/5'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                          )}
                          onClick={() => setSelectedAddress(address._id)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div
                                className={cn(
                                  'w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5',
                                  selectedAddress === address._id
                                    ? 'border-primary'
                                    : 'border-gray-300'
                                )}
                              >
                                {selectedAddress === address._id && (
                                  <div className="w-3 h-3 rounded-full bg-primary" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {address.fullName}
                                  </span>
                                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400">
                                    {address.label}
                                  </span>
                                  {address.isDefault && (
                                    <span className="px-2 py-0.5 bg-primary/10 rounded text-xs text-primary">
                                      Default
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500 mt-1">{address.phone}</p>
                                <p className="text-sm text-gray-500">
                                  {address.street}, {address.city}, {address.district}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {address.division} - {address.postalCode}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingAddress(address);
                                  setAddressForm({
                                    label: address.label,
                                    fullName: address.fullName,
                                    phone: address.phone,
                                    street: address.street,
                                    city: address.city,
                                    district: address.district,
                                    division: address.division,
                                    postalCode: address.postalCode,
                                    isDefault: address.isDefault,
                                  });
                                  setShowAddressForm(true);
                                }}
                                className="p-2 text-gray-400 hover:text-primary transition-colors"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteAddress(address._id);
                                }}
                                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Address Button */}
                  {!showAddressForm && (
                    <button
                      onClick={() => setShowAddressForm(true)}
                      className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 hover:text-primary hover:border-primary transition-colors"
                    >
                      <Plus className="h-5 w-5" />
                      Add New Address
                    </button>
                  )}

                  {/* Address Form */}
                  {showAddressForm && (
                    <form onSubmit={handleAddressSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Address Label
                          </label>
                          <select
                            value={addressForm.label}
                            onChange={(e) =>
                              setAddressForm({ ...addressForm, label: e.target.value })
                            }
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                          >
                            <option value="Home">Home</option>
                            <option value="Office">Office</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Full Name
                          </label>
                          <input
                            type="text"
                            required
                            value={addressForm.fullName}
                            onChange={(e) =>
                              setAddressForm({ ...addressForm, fullName: e.target.value })
                            }
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          required
                          placeholder="01XXXXXXXXX"
                          value={addressForm.phone}
                          onChange={(e) =>
                            setAddressForm({ ...addressForm, phone: e.target.value })
                          }
                          className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Street Address
                        </label>
                        <textarea
                          required
                          rows={2}
                          placeholder="House no, Road no, Area"
                          value={addressForm.street}
                          onChange={(e) =>
                            setAddressForm({ ...addressForm, street: e.target.value })
                          }
                          className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Division
                          </label>
                          <select
                            required
                            value={addressForm.division}
                            onChange={(e) =>
                              setAddressForm({ ...addressForm, division: e.target.value })
                            }
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                          >
                            <option value="">Select Division</option>
                            {divisions.map((div) => (
                              <option key={div} value={div}>
                                {div}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            District
                          </label>
                          <input
                            type="text"
                            required
                            value={addressForm.district}
                            onChange={(e) =>
                              setAddressForm({ ...addressForm, district: e.target.value })
                            }
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            City/Upazila
                          </label>
                          <input
                            type="text"
                            required
                            value={addressForm.city}
                            onChange={(e) =>
                              setAddressForm({ ...addressForm, city: e.target.value })
                            }
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Postal Code
                          </label>
                          <input
                            type="text"
                            required
                            value={addressForm.postalCode}
                            onChange={(e) =>
                              setAddressForm({ ...addressForm, postalCode: e.target.value })
                            }
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                          />
                        </div>
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={addressForm.isDefault}
                          onChange={(e) =>
                            setAddressForm({ ...addressForm, isDefault: e.target.checked })
                          }
                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Set as default address
                        </span>
                      </label>

                      <div className="flex gap-3 pt-4">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddressForm(false);
                            setEditingAddress(null);
                          }}
                          className="flex-1 py-3 border border-gray-200 dark:border-gray-700 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
                        >
                          {editingAddress ? 'Update Address' : 'Save Address'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Continue Button */}
                  {!showAddressForm && (
                    <button
                      onClick={() => {
                        if (!selectedAddress) {
                          alert('Please select or add a shipping address');
                          return;
                        }
                        setCurrentStep(2);
                      }}
                      className="w-full mt-6 flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
                    >
                      Continue to Payment
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  )}
                </motion.div>
              )}

              {/* Step 2: Payment */}
              {currentStep === 2 && (
                <motion.div
                  key="payment"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6"
                >
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                    Payment Method
                  </h2>

                  <div className="space-y-4">
                    {paymentMethods.map((method) => (
                      <div
                        key={method.id}
                        className={cn(
                          'relative p-4 rounded-lg border-2 cursor-pointer transition-all',
                          selectedPayment === method.id
                            ? 'border-primary bg-primary/5'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300',
                          !method.available && 'opacity-50 cursor-not-allowed'
                        )}
                        onClick={() => method.available && setSelectedPayment(method.id)}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={cn(
                              'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                              selectedPayment === method.id
                                ? 'border-primary'
                                : 'border-gray-300'
                            )}
                          >
                            {selectedPayment === method.id && (
                              <div className="w-3 h-3 rounded-full bg-primary" />
                            )}
                          </div>
                          <span className="text-2xl">{method.icon}</span>
                          <div>
                            <h3 className="font-medium text-gray-900 dark:text-white">
                              {method.name}
                            </h3>
                            <p className="text-sm text-gray-500">{method.description}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Order Notes */}
                  <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Order Notes (Optional)
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Any special instructions for your order..."
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
                    />
                  </div>

                  {/* Navigation Buttons */}
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => setCurrentStep(1)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 border border-gray-200 dark:border-gray-700 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <ChevronLeft className="h-5 w-5" />
                      Back
                    </button>
                    <button
                      onClick={() => setCurrentStep(3)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
                    >
                      Review Order
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Review */}
              {currentStep === 3 && (
                <motion.div
                  key="review"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  {/* Shipping Info */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Shipping Address
                      </h2>
                      <button
                        onClick={() => setCurrentStep(1)}
                        className="text-primary text-sm hover:underline"
                      >
                        Edit
                      </button>
                    </div>
                    {selectedAddressData && (
                      <div className="text-gray-600 dark:text-gray-400">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {selectedAddressData.fullName}
                        </p>
                        <p>{selectedAddressData.phone}</p>
                        <p>{selectedAddressData.street}</p>
                        <p>
                          {selectedAddressData.city}, {selectedAddressData.district}
                        </p>
                        <p>
                          {selectedAddressData.division} - {selectedAddressData.postalCode}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Payment Info */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Payment Method
                      </h2>
                      <button
                        onClick={() => setCurrentStep(2)}
                        className="text-primary text-sm hover:underline"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">
                        {paymentMethods.find((m) => m.id === selectedPayment)?.icon}
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {paymentMethods.find((m) => m.id === selectedPayment)?.name}
                      </span>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Order Items ({cart?.items.length})
                    </h2>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      {cart?.items.map((item) => (
                        <div key={item._id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                          <img
                            src={item.image || '/images/placeholder-product.png'}
                            alt={item.name}
                            className="w-16 h-16 object-cover rounded-lg"
                          />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900 dark:text-white line-clamp-1">
                              {item.name}
                            </h3>
                            {item.attributes && Object.keys(item.attributes).length > 0 && (
                              <p className="text-sm text-gray-500">
                                {Object.entries(item.attributes).map(([key, value]) => (
                                  <span key={key}>
                                    {key}: {value}{' '}
                                  </span>
                                ))}
                              </p>
                            )}
                            <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                          </div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            ৳{(item.price * item.quantity).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Navigation Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setCurrentStep(2)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 border border-gray-200 dark:border-gray-700 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <ChevronLeft className="h-5 w-5" />
                      Back
                    </button>
                    <button
                      onClick={handlePlaceOrder}
                      disabled={placing}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {placing ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          Place Order
                          <Check className="h-5 w-5" />
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 sticky top-24">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                Order Summary
              </h2>

              {/* Items Preview */}
              <div className="space-y-3 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                {cart?.items.slice(0, 3).map((item) => (
                  <div key={item._id} className="flex items-center gap-3">
                    <img
                      src={item.image || '/images/placeholder-product.png'}
                      alt={item.name}
                      className="w-12 h-12 object-cover rounded-lg"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-500">x{item.quantity}</p>
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      ৳{(item.price * item.quantity).toLocaleString()}
                    </p>
                  </div>
                ))}
                {cart && cart.items.length > 3 && (
                  <p className="text-sm text-gray-500 text-center">
                    +{cart.items.length - 3} more items
                  </p>
                )}
              </div>

              {/* Price Breakdown */}
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="text-gray-900 dark:text-white">
                    ৳{subtotal.toLocaleString()}
                  </span>
                </div>
                {couponDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600">Discount</span>
                    <span className="text-green-600">-৳{couponDiscount.toLocaleString()}</span>
                  </div>
                )}
                {cart?.isGiftWrapped && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Gift Wrap</span>
                    <span className="text-gray-900 dark:text-white">৳{giftWrapCost}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Shipping</span>
                  <span
                    className={cn(
                      shippingCost === 0 ? 'text-green-600' : 'text-gray-900 dark:text-white'
                    )}
                  >
                    {shippingCost === 0 ? 'FREE' : `৳${shippingCost}`}
                  </span>
                </div>
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between">
                  <span className="font-semibold text-gray-900 dark:text-white">Total</span>
                  <span className="font-bold text-xl text-gray-900 dark:text-white">
                    ৳{total.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Trust Badges */}
              <div className="space-y-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <Truck className="h-5 w-5 text-green-500" />
                  <span>Free shipping over ৳3,000</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <Shield className="h-5 w-5 text-blue-500" />
                  <span>Secure checkout</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
