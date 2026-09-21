import crypto from 'crypto';
import axios from 'axios';
import Settings from '@/models/Settings';

interface NagadConfig {
  merchantId: string;
  merchantPrivateKey: string;
  isSandbox: boolean;
}

const getNagadBaseUrl = (isSandbox: boolean) => {
  return isSandbox
    ? 'http://sandbox.mynagad.com:10080/remote-payment-gateway-1.0/api/dfs'
    : 'https://api.mynagad.com/api/dfs';
};

export async function getNagadConfig(): Promise<NagadConfig | null> {
  const settings = await Settings.findOne();

  if (!settings?.payment.nagadEnabled) {
    return null;
  }

  return {
    merchantId: settings.payment.nagadMerchantId || '',
    merchantPrivateKey: settings.payment.nagadMerchantPrivateKey || '',
    isSandbox: settings.payment.nagadSandbox,
  };
}

// Nagad Public Key (provided by Nagad)
const NAGAD_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAjBH1pFNSSRKPuMcNxmU5
jZ1x8K9LPFM4XSu11m7uCfLUSE4SEjL30w3ockFvwAcuJffCUwtSpbjr34cSTD7R
Kd+5TbBBhLUIRNCQsAO4p1K1mOVHpWahoIvxDRoRQwvnAYfYZhS7WCSG+sPGkjUB
kWXVbEMu4i7XUE9O24LxjNVnYbQMFbxu9tLVGDVV3K5EYJr3ILo47x/NPHbKsVlZ
hLJYDOTr8r+cEQnHJVbcPMpHLsv/N5x45cHrZ7HAbQx5RYMcfMSC8mS5tLg/RBz5
vKmJXjN7cw2hLxExKAInA1wG9wJ3XWBM+rBnmJKH+Q8hQyrAqYWbtmfwYKGaHGlv
rQIDAQAB
-----END PUBLIC KEY-----`;

function encryptWithPublicKey(data: string, publicKey: string): string {
  const buffer = Buffer.from(data, 'utf8');
  const encrypted = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    buffer
  );
  return encrypted.toString('base64');
}

function signWithPrivateKey(data: string, privateKey: string): string {
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(data);
  return sign.sign(privateKey, 'base64');
}

function generateTimestamp(): string {
  const now = new Date();
  return (
    now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0') +
    now.getHours().toString().padStart(2, '0') +
    now.getMinutes().toString().padStart(2, '0') +
    now.getSeconds().toString().padStart(2, '0')
  );
}

export async function initNagadPayment(data: {
  orderId: string;
  amount: number;
  callbackURL: string;
}): Promise<{
  success: boolean;
  paymentReferenceId?: string;
  callBackUrl?: string;
  error?: string;
}> {
  try {
    const config = await getNagadConfig();
    if (!config) {
      return { success: false, error: 'Nagad is not configured' };
    }

    const baseUrl = getNagadBaseUrl(config.isSandbox);
    const timestamp = generateTimestamp();

    // Step 1: Initialize payment
    const sensitiveData = {
      merchantId: config.merchantId,
      datetime: timestamp,
      orderId: data.orderId,
      challenge: crypto.randomBytes(16).toString('hex'),
    };

    const sensitiveDataEncrypted = encryptWithPublicKey(
      JSON.stringify(sensitiveData),
      NAGAD_PUBLIC_KEY
    );

    const signature = signWithPrivateKey(
      JSON.stringify(sensitiveData),
      config.merchantPrivateKey
    );

    const initResponse = await axios.post(
      `${baseUrl}/check-out/initialize/${config.merchantId}/${data.orderId}`,
      {
        accountNumber: config.merchantId,
        dateTime: timestamp,
        sensitiveData: sensitiveDataEncrypted,
        signature: signature,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-KM-IP-V4': '127.0.0.1',
          'X-KM-Client-Type': 'PC_WEB',
          'X-KM-Api-Version': 'v-0.2.0',
        },
      }
    );

    if (initResponse.data.sensitiveData && initResponse.data.signature) {
      // Step 2: Complete payment
      const completeSensitiveData = {
        merchantId: config.merchantId,
        orderId: data.orderId,
        currencyCode: '050',
        amount: data.amount.toString(),
        challenge: initResponse.data.challenge,
      };

      const completeSensitiveDataEncrypted = encryptWithPublicKey(
        JSON.stringify(completeSensitiveData),
        NAGAD_PUBLIC_KEY
      );

      const completeSignature = signWithPrivateKey(
        JSON.stringify(completeSensitiveData),
        config.merchantPrivateKey
      );

      const completeResponse = await axios.post(
        `${baseUrl}/check-out/complete/${initResponse.data.paymentReferenceId}`,
        {
          sensitiveData: completeSensitiveDataEncrypted,
          signature: completeSignature,
          merchantCallbackURL: data.callbackURL,
          additionalMerchantInfo: {
            orderId: data.orderId,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-KM-IP-V4': '127.0.0.1',
            'X-KM-Client-Type': 'PC_WEB',
            'X-KM-Api-Version': 'v-0.2.0',
          },
        }
      );

      if (completeResponse.data.status === 'Success') {
        return {
          success: true,
          paymentReferenceId: initResponse.data.paymentReferenceId,
          callBackUrl: completeResponse.data.callBackUrl,
        };
      }

      return {
        success: false,
        error: completeResponse.data.message || 'Payment completion failed',
      };
    }

    return {
      success: false,
      error: initResponse.data.message || 'Payment initialization failed',
    };
  } catch (error: any) {
    console.error('Nagad init error:', error);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Payment initialization failed',
    };
  }
}

export async function verifyNagadPayment(paymentRefId: string): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const config = await getNagadConfig();
    if (!config) {
      return { success: false, error: 'Nagad is not configured' };
    }

    const baseUrl = getNagadBaseUrl(config.isSandbox);

    const response = await axios.get(
      `${baseUrl}/verify/payment/${paymentRefId}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-KM-IP-V4': '127.0.0.1',
          'X-KM-Client-Type': 'PC_WEB',
          'X-KM-Api-Version': 'v-0.2.0',
        },
      }
    );

    if (response.data.status === 'Success') {
      return {
        success: true,
        data: response.data,
      };
    }

    return {
      success: false,
      error: response.data.message || 'Payment verification failed',
    };
  } catch (error: any) {
    console.error('Nagad verify error:', error);
    return {
      success: false,
      error: error.message || 'Verification failed',
    };
  }
}
