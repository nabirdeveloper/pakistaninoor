import axios from 'axios';
import Settings from '@/models/Settings';
import { IOrder } from '@/models/Order';

interface SSLCommerzConfig {
  storeId: string;
  storePassword: string;
  isSandbox: boolean;
}

interface PaymentInitData {
  order: IOrder;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  customerCity: string;
  customerPostcode: string;
  customerCountry: string;
}

const getSSLCommerzBaseUrl = (isSandbox: boolean) => {
  return isSandbox
    ? 'https://sandbox.sslcommerz.com'
    : 'https://securepay.sslcommerz.com';
};

export async function getSSLCommerzConfig(): Promise<SSLCommerzConfig | null> {
  const settings = await Settings.findOne();

  if (!settings?.payment.sslcommerzEnabled) {
    return null;
  }

  return {
    storeId: settings.payment.sslcommerzStoreId || '',
    storePassword: settings.payment.sslcommerzStorePassword || '',
    isSandbox: settings.payment.sslcommerzSandbox,
  };
}

export async function initSSLCommerzPayment(data: PaymentInitData): Promise<{
  success: boolean;
  gatewayPageURL?: string;
  sessionKey?: string;
  error?: string;
}> {
  try {
    const config = await getSSLCommerzConfig();

    if (!config) {
      return { success: false, error: 'SSLCommerz is not configured' };
    }

    const baseUrl = getSSLCommerzBaseUrl(config.isSandbox);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const paymentData = {
      store_id: config.storeId,
      store_passwd: config.storePassword,
      total_amount: data.order.total,
      currency: 'BDT',
      tran_id: data.order.orderNumber,
      success_url: `${appUrl}/api/payments/sslcommerz/success`,
      fail_url: `${appUrl}/api/payments/sslcommerz/fail`,
      cancel_url: `${appUrl}/api/payments/sslcommerz/cancel`,
      ipn_url: `${appUrl}/api/payments/sslcommerz/ipn`,
      shipping_method: 'Courier',
      product_name: `Order ${data.order.orderNumber}`,
      product_category: 'E-commerce',
      product_profile: 'general',
      cus_name: data.customerName,
      cus_email: data.customerEmail,
      cus_add1: data.customerAddress,
      cus_city: data.customerCity,
      cus_postcode: data.customerPostcode,
      cus_country: data.customerCountry,
      cus_phone: data.customerPhone,
      ship_name: data.order.shippingAddress.fullName,
      ship_add1: data.order.shippingAddress.street,
      ship_city: data.order.shippingAddress.city,
      ship_postcode: data.order.shippingAddress.postalCode,
      ship_country: data.order.shippingAddress.country,
      value_a: data.order._id.toString(),
      value_b: data.order.user?.toString() || 'guest',
    };

    const response = await axios.post(
      `${baseUrl}/gwprocess/v4/api.php`,
      paymentData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    if (response.data.status === 'SUCCESS') {
      return {
        success: true,
        gatewayPageURL: response.data.GatewayPageURL,
        sessionKey: response.data.sessionkey,
      };
    }

    return {
      success: false,
      error: response.data.failedreason || 'Payment initiation failed',
    };
  } catch (error: any) {
    console.error('SSLCommerz init error:', error);
    return {
      success: false,
      error: error.message || 'Payment initiation failed',
    };
  }
}

export async function validateSSLCommerzPayment(validationId: string): Promise<{
  valid: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const config = await getSSLCommerzConfig();

    if (!config) {
      return { valid: false, error: 'SSLCommerz is not configured' };
    }

    const baseUrl = getSSLCommerzBaseUrl(config.isSandbox);

    const response = await axios.get(
      `${baseUrl}/validator/api/validationserverAPI.php`,
      {
        params: {
          val_id: validationId,
          store_id: config.storeId,
          store_passwd: config.storePassword,
          format: 'json',
        },
      }
    );

    if (response.data.status === 'VALID' || response.data.status === 'VALIDATED') {
      return {
        valid: true,
        data: response.data,
      };
    }

    return {
      valid: false,
      error: 'Payment validation failed',
    };
  } catch (error: any) {
    console.error('SSLCommerz validation error:', error);
    return {
      valid: false,
      error: error.message || 'Validation failed',
    };
  }
}
