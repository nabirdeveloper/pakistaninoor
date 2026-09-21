'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Store,
  CreditCard,
  Truck,
  Mail,
  Search,
  Save,
  Globe,
  Bell,
  Shield,
  Award,
  MessageSquare,
  Upload,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Settings {
  siteName: string;
  siteTagline?: string;
  logo: string;
  favicon?: string;
  contact: {
    email: string;
    phone: string;
    alternatePhone?: string;
    address: string;
    city: string;
    country: string;
    mapUrl?: string;
  };
  social: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    youtube?: string;
    whatsapp?: string;
  };
  payment: {
    sslcommerzEnabled: boolean;
    sslcommerzStoreId?: string;
    sslcommerzStorePassword?: string;
    sslcommerzSandbox: boolean;
    bkashEnabled: boolean;
    bkashAppKey?: string;
    bkashAppSecret?: string;
    bkashUsername?: string;
    bkashPassword?: string;
    bkashSandbox: boolean;
    codEnabled: boolean;
    codExtraCharge: number;
    codMaxAmount: number;
    bankTransferEnabled: boolean;
    bankName?: string;
    bankAccountName?: string;
    bankAccountNumber?: string;
    bankBranch?: string;
  };
  shipping: {
    freeShippingThreshold: number;
    defaultShippingCost: number;
    expressShippingCost: number;
    estimatedDeliveryDays: number;
    expressDeliveryDays: number;
  };
  tax: {
    enableTax: boolean;
    taxRate: number;
    taxIncludedInPrice: boolean;
  };
  seo: {
    siteTitle: string;
    siteDescription: string;
    keywords: string[];
    googleAnalyticsId?: string;
    facebookPixelId?: string;
  };
  email: {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPassword: string;
    smtpSecure: boolean;
    fromEmail: string;
    fromName: string;
  };
  loyalty: {
    enabled: boolean;
    pointsPerPurchase: number;
    pointsRedemptionRate: number;
    minPointsForRedemption: number;
    referralBonus: number;
  };
  currency: string;
  currencySymbol: string;
  adminSecretKey: string;
}

const settingsTabs = [
  { id: 'general', label: 'General', icon: Store },
  { id: 'contact', label: 'Contact & Social', icon: Globe },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'shipping', label: 'Shipping & Tax', icon: Truck },
  { id: 'loyalty', label: 'Loyalty', icon: Award },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'seo', label: 'SEO', icon: Search },
  { id: 'admin', label: 'Admin', icon: Shield },
];

export default function AdminSettingsPage() {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(() =>
    requestedTab && settingsTabs.some((t) => t.id === requestedTab)
      ? requestedTab
      : 'general'
  );
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/settings');
      const data = await response.json();
      if (data.settings) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to save settings' });
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (section: keyof Settings | null, key: string, value: any) => {
    if (!settings) return;

    setSettings((prev) => {
      if (!prev) return prev;
      if (section) {
        return {
          ...prev,
          [section]: {
            ...(prev[section] as any),
            [key]: value,
          },
        };
      }
      return { ...prev, [key]: value };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage your store configuration
          </p>
        </div>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Message */}
      {message.text && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'p-4 rounded-lg',
            message.type === 'success'
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          )}
        >
          {message.text}
        </motion.div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="lg:w-64 space-y-1">
          {settingsTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
              )}
            >
              <tab.icon className="h-5 w-5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1">
          {settings && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              {/* General Settings */}
              {activeTab === 'general' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">General Settings</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Site Name
                      </label>
                      <input
                        type="text"
                        value={settings.siteName || ''}
                        onChange={(e) => updateSetting(null, 'siteName', e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Site Tagline
                      </label>
                      <input
                        type="text"
                        value={settings.siteTagline || ''}
                        onChange={(e) => updateSetting(null, 'siteTagline', e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Currency
                      </label>
                      <input
                        type="text"
                        value={settings.currency || 'BDT'}
                        onChange={(e) => updateSetting(null, 'currency', e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Currency Symbol
                      </label>
                      <input
                        type="text"
                        value={settings.currencySymbol || '৳'}
                        onChange={(e) => updateSetting(null, 'currencySymbol', e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Contact & Social */}
              {activeTab === 'contact' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Contact Information</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={settings.contact?.email || ''}
                        onChange={(e) => updateSetting('contact', 'email', e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={settings.contact?.phone || ''}
                        onChange={(e) => updateSetting('contact', 'phone', e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Address
                      </label>
                      <textarea
                        value={settings.contact?.address || ''}
                        onChange={(e) => updateSetting('contact', 'address', e.target.value)}
                        rows={2}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none resize-none"
                      />
                    </div>
                  </div>

                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white pt-4">Social Links</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Facebook
                      </label>
                      <input
                        type="url"
                        value={settings.social?.facebook || ''}
                        onChange={(e) => updateSetting('social', 'facebook', e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                        placeholder="https://facebook.com/..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Instagram
                      </label>
                      <input
                        type="url"
                        value={settings.social?.instagram || ''}
                        onChange={(e) => updateSetting('social', 'instagram', e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                        placeholder="https://instagram.com/..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        WhatsApp
                      </label>
                      <input
                        type="text"
                        value={settings.social?.whatsapp || ''}
                        onChange={(e) => updateSetting('social', 'whatsapp', e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                        placeholder="+880..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        YouTube
                      </label>
                      <input
                        type="url"
                        value={settings.social?.youtube || ''}
                        onChange={(e) => updateSetting('social', 'youtube', e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                        placeholder="https://youtube.com/..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Settings */}
              {activeTab === 'payments' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Payment Methods</h2>

                  {/* COD */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium text-gray-900 dark:text-white">Cash on Delivery</h3>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.payment?.codEnabled || false}
                          onChange={(e) => updateSetting('payment', 'codEnabled', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>
                    {settings.payment?.codEnabled && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Extra Charge (৳)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={settings.payment?.codExtraCharge || 0}
                            onChange={(e) => updateSetting('payment', 'codExtraCharge', parseFloat(e.target.value) || 0)}
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Max Amount (৳)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={settings.payment?.codMaxAmount || 50000}
                            onChange={(e) => updateSetting('payment', 'codMaxAmount', parseFloat(e.target.value) || 50000)}
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SSLCommerz */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium text-gray-900 dark:text-white">SSLCommerz</h3>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.payment?.sslcommerzEnabled || false}
                          onChange={(e) => updateSetting('payment', 'sslcommerzEnabled', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>
                    {settings.payment?.sslcommerzEnabled && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Store ID
                            </label>
                            <input
                              type="text"
                              value={settings.payment?.sslcommerzStoreId || ''}
                              onChange={(e) => updateSetting('payment', 'sslcommerzStoreId', e.target.value)}
                              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Store Password
                            </label>
                            <input
                              type="password"
                              value={settings.payment?.sslcommerzStorePassword || ''}
                              onChange={(e) => updateSetting('payment', 'sslcommerzStorePassword', e.target.value)}
                              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                            />
                          </div>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.payment?.sslcommerzSandbox || false}
                            onChange={(e) => updateSetting('payment', 'sslcommerzSandbox', e.target.checked)}
                            className="rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Sandbox Mode</span>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Bank Transfer */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium text-gray-900 dark:text-white">Bank Transfer</h3>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.payment?.bankTransferEnabled || false}
                          onChange={(e) => updateSetting('payment', 'bankTransferEnabled', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>
                    {settings.payment?.bankTransferEnabled && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Bank Name
                          </label>
                          <input
                            type="text"
                            value={settings.payment?.bankName || ''}
                            onChange={(e) => updateSetting('payment', 'bankName', e.target.value)}
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Account Name
                          </label>
                          <input
                            type="text"
                            value={settings.payment?.bankAccountName || ''}
                            onChange={(e) => updateSetting('payment', 'bankAccountName', e.target.value)}
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Account Number
                          </label>
                          <input
                            type="text"
                            value={settings.payment?.bankAccountNumber || ''}
                            onChange={(e) => updateSetting('payment', 'bankAccountNumber', e.target.value)}
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Branch
                          </label>
                          <input
                            type="text"
                            value={settings.payment?.bankBranch || ''}
                            onChange={(e) => updateSetting('payment', 'bankBranch', e.target.value)}
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Shipping & Tax */}
              {activeTab === 'shipping' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Shipping Settings</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Free Shipping Threshold (৳)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={settings.shipping?.freeShippingThreshold || 0}
                        onChange={(e) => updateSetting('shipping', 'freeShippingThreshold', parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Default Shipping Cost (৳)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={settings.shipping?.defaultShippingCost || 0}
                        onChange={(e) => updateSetting('shipping', 'defaultShippingCost', parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Express Shipping Cost (৳)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={settings.shipping?.expressShippingCost || 0}
                        onChange={(e) => updateSetting('shipping', 'expressShippingCost', parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Estimated Delivery Days
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={settings.shipping?.estimatedDeliveryDays || 5}
                        onChange={(e) => updateSetting('shipping', 'estimatedDeliveryDays', parseInt(e.target.value) || 5)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white pt-4">Tax Settings</h2>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">Enable Tax</h3>
                        <p className="text-sm text-gray-500">Apply tax to orders</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.tax?.enableTax || false}
                          onChange={(e) => updateSetting('tax', 'enableTax', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>
                    {settings.tax?.enableTax && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Tax Rate (%)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={settings.tax?.taxRate || 0}
                            onChange={(e) => updateSetting('tax', 'taxRate', parseFloat(e.target.value) || 0)}
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                          />
                        </div>
                        <div className="flex items-end">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.tax?.taxIncludedInPrice || false}
                              onChange={(e) => updateSetting('tax', 'taxIncludedInPrice', e.target.checked)}
                              className="rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Prices include tax</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Loyalty */}
              {activeTab === 'loyalty' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Loyalty Program</h2>
                      <p className="text-sm text-gray-500">Reward customers with points</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.loyalty?.enabled || false}
                        onChange={(e) => updateSetting('loyalty', 'enabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                  {settings.loyalty?.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Points per ৳100 spent
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={settings.loyalty?.pointsPerPurchase || 1}
                          onChange={(e) => updateSetting('loyalty', 'pointsPerPurchase', parseInt(e.target.value) || 1)}
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          ৳ value per point
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={settings.loyalty?.pointsRedemptionRate || 1}
                          onChange={(e) => updateSetting('loyalty', 'pointsRedemptionRate', parseFloat(e.target.value) || 1)}
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Min Points to Redeem
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={settings.loyalty?.minPointsForRedemption || 100}
                          onChange={(e) => updateSetting('loyalty', 'minPointsForRedemption', parseInt(e.target.value) || 100)}
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Referral Bonus Points
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={settings.loyalty?.referralBonus || 50}
                          onChange={(e) => updateSetting('loyalty', 'referralBonus', parseInt(e.target.value) || 50)}
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Email */}
              {activeTab === 'email' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Email Settings (SMTP)</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        SMTP Host
                      </label>
                      <input
                        type="text"
                        value={settings.email?.smtpHost || ''}
                        onChange={(e) => updateSetting('email', 'smtpHost', e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                        placeholder="smtp.gmail.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        SMTP Port
                      </label>
                      <input
                        type="number"
                        value={settings.email?.smtpPort || 587}
                        onChange={(e) => updateSetting('email', 'smtpPort', parseInt(e.target.value) || 587)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        SMTP Username
                      </label>
                      <input
                        type="text"
                        value={settings.email?.smtpUser || ''}
                        onChange={(e) => updateSetting('email', 'smtpUser', e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        SMTP Password
                      </label>
                      <input
                        type="password"
                        value={settings.email?.smtpPassword || ''}
                        onChange={(e) => updateSetting('email', 'smtpPassword', e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        From Email
                      </label>
                      <input
                        type="email"
                        value={settings.email?.fromEmail || ''}
                        onChange={(e) => updateSetting('email', 'fromEmail', e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        From Name
                      </label>
                      <input
                        type="text"
                        value={settings.email?.fromName || ''}
                        onChange={(e) => updateSetting('email', 'fromName', e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SEO */}
              {activeTab === 'seo' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">SEO Settings</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Site Title
                      </label>
                      <input
                        type="text"
                        value={settings.seo?.siteTitle || ''}
                        onChange={(e) => updateSetting('seo', 'siteTitle', e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Site Description
                      </label>
                      <textarea
                        value={settings.seo?.siteDescription || ''}
                        onChange={(e) => updateSetting('seo', 'siteDescription', e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Google Analytics ID
                        </label>
                        <input
                          type="text"
                          value={settings.seo?.googleAnalyticsId || ''}
                          onChange={(e) => updateSetting('seo', 'googleAnalyticsId', e.target.value)}
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                          placeholder="G-XXXXXXXXXX"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Facebook Pixel ID
                        </label>
                        <input
                          type="text"
                          value={settings.seo?.facebookPixelId || ''}
                          onChange={(e) => updateSetting('seo', 'facebookPixelId', e.target.value)}
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Admin */}
              {activeTab === 'admin' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Admin Settings</h2>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      <strong>Warning:</strong> The admin secret key is used to verify admin registration.
                      Keep this secure and share only with trusted administrators.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Admin Secret Key
                    </label>
                    <input
                      type="password"
                      value={settings.adminSecretKey || ''}
                      onChange={(e) => updateSetting(null, 'adminSecretKey', e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                      placeholder="Enter admin secret key"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      New admins will need to provide this key during registration
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
