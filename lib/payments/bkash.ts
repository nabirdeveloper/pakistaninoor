import axios from 'axios';
import Settings from '@/models/Settings';

interface BkashConfig {
  appKey: string;
  appSecret: string;
  username: string;
  password: string;
  isSandbox: boolean;
}

interface BkashToken {
  id_token: string;
  refresh_token: string;
  expires_in: number;
}

// Token cache
let tokenCache: BkashToken | null = null;
let tokenExpiry: number = 0;

const getBkashBaseUrl = (isSandbox: boolean) => {
  return isSandbox
    ? 'https://tokenized.sandbox.bka.sh/v1.2.0-beta'
    : 'https://tokenized.pay.bka.sh/v1.2.0-beta';
};

export async function getBkashConfig(): Promise<BkashConfig | null> {
  const settings = await Settings.findOne();

  if (!settings?.payment.bkashEnabled) {
    return null;
  }

  return {
    appKey: settings.payment.bkashAppKey || '',
    appSecret: settings.payment.bkashAppSecret || '',
    username: settings.payment.bkashUsername || '',
    password: settings.payment.bkashPassword || '',
    isSandbox: settings.payment.bkashSandbox,
  };
}

export async function getBkashToken(): Promise<string | null> {
  try {
    // Check cache
    if (tokenCache && Date.now() < tokenExpiry) {
      return tokenCache.id_token;
    }

    const config = await getBkashConfig();
    if (!config) return null;

    const baseUrl = getBkashBaseUrl(config.isSandbox);

    const response = await axios.post(
      `${baseUrl}/tokenized/checkout/token/grant`,
      {
        app_key: config.appKey,
        app_secret: config.appSecret,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          username: config.username,
          password: config.password,
        },
      }
    );

    if (response.data.id_token) {
      tokenCache = response.data;
      tokenExpiry = Date.now() + (response.data.expires_in - 60) * 1000;
      return response.data.id_token;
    }

    return null;
  } catch (error: any) {
    console.error('bKash token error:', error);
    return null;
  }
}

export async function createBkashPayment(data: {
  orderId: string;
  amount: number;
  payerReference: string;
  callbackURL: string;
}): Promise<{
  success: boolean;
  paymentID?: string;
  bkashURL?: string;
  error?: string;
}> {
  try {
    const config = await getBkashConfig();
    if (!config) {
      return { success: false, error: 'bKash is not configured' };
    }

    const token = await getBkashToken();
    if (!token) {
      return { success: false, error: 'Failed to get bKash token' };
    }

    const baseUrl = getBkashBaseUrl(config.isSandbox);

    const response = await axios.post(
      `${baseUrl}/tokenized/checkout/create`,
      {
        mode: '0011',
        payerReference: data.payerReference,
        callbackURL: data.callbackURL,
        amount: data.amount.toString(),
        currency: 'BDT',
        intent: 'sale',
        merchantInvoiceNumber: data.orderId,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: token,
          'X-APP-Key': config.appKey,
        },
      }
    );

    if (response.data.paymentID) {
      return {
        success: true,
        paymentID: response.data.paymentID,
        bkashURL: response.data.bkashURL,
      };
    }

    return {
      success: false,
      error: response.data.statusMessage || 'Payment creation failed',
    };
  } catch (error: any) {
    console.error('bKash create payment error:', error);
    return {
      success: false,
      error: error.response?.data?.statusMessage || error.message || 'Payment creation failed',
    };
  }
}

export async function executeBkashPayment(paymentID: string): Promise<{
  success: boolean;
  transactionId?: string;
  data?: any;
  error?: string;
}> {
  try {
    const config = await getBkashConfig();
    if (!config) {
      return { success: false, error: 'bKash is not configured' };
    }

    const token = await getBkashToken();
    if (!token) {
      return { success: false, error: 'Failed to get bKash token' };
    }

    const baseUrl = getBkashBaseUrl(config.isSandbox);

    const response = await axios.post(
      `${baseUrl}/tokenized/checkout/execute`,
      { paymentID },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: token,
          'X-APP-Key': config.appKey,
        },
      }
    );

    if (response.data.transactionStatus === 'Completed') {
      return {
        success: true,
        transactionId: response.data.trxID,
        data: response.data,
      };
    }

    return {
      success: false,
      error: response.data.statusMessage || 'Payment execution failed',
    };
  } catch (error: any) {
    console.error('bKash execute payment error:', error);
    return {
      success: false,
      error: error.response?.data?.statusMessage || error.message || 'Payment execution failed',
    };
  }
}

export async function queryBkashPayment(paymentID: string): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const config = await getBkashConfig();
    if (!config) {
      return { success: false, error: 'bKash is not configured' };
    }

    const token = await getBkashToken();
    if (!token) {
      return { success: false, error: 'Failed to get bKash token' };
    }

    const baseUrl = getBkashBaseUrl(config.isSandbox);

    const response = await axios.post(
      `${baseUrl}/tokenized/checkout/payment/status`,
      { paymentID },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: token,
          'X-APP-Key': config.appKey,
        },
      }
    );

    return {
      success: true,
      data: response.data,
    };
  } catch (error: any) {
    console.error('bKash query payment error:', error);
    return {
      success: false,
      error: error.message || 'Query failed',
    };
  }
}

export async function refundBkashPayment(data: {
  paymentID: string;
  trxID: string;
  amount: number;
  reason: string;
}): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const config = await getBkashConfig();
    if (!config) {
      return { success: false, error: 'bKash is not configured' };
    }

    const token = await getBkashToken();
    if (!token) {
      return { success: false, error: 'Failed to get bKash token' };
    }

    const baseUrl = getBkashBaseUrl(config.isSandbox);

    const response = await axios.post(
      `${baseUrl}/tokenized/checkout/payment/refund`,
      {
        paymentID: data.paymentID,
        trxID: data.trxID,
        amount: data.amount.toString(),
        reason: data.reason,
        sku: 'refund',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: token,
          'X-APP-Key': config.appKey,
        },
      }
    );

    if (response.data.transactionStatus === 'Completed') {
      return {
        success: true,
        data: response.data,
      };
    }

    return {
      success: false,
      error: response.data.statusMessage || 'Refund failed',
    };
  } catch (error: any) {
    console.error('bKash refund error:', error);
    return {
      success: false,
      error: error.message || 'Refund failed',
    };
  }
}
