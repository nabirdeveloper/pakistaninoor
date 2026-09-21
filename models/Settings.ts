import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISocialLinks {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  youtube?: string;
  linkedin?: string;
  tiktok?: string;
  whatsapp?: string;
}

export interface IContactInfo {
  email: string;
  phone: string;
  alternatePhone?: string;
  address: string;
  city: string;
  country: string;
  mapUrl?: string;
}

export interface IPaymentSettings {
  // SSLCOMMERZ
  sslcommerzEnabled: boolean;
  sslcommerzStoreId?: string;
  sslcommerzStorePassword?: string;
  sslcommerzSandbox: boolean;

  // bKash
  bkashEnabled: boolean;
  bkashAppKey?: string;
  bkashAppSecret?: string;
  bkashUsername?: string;
  bkashPassword?: string;
  bkashSandbox: boolean;

  // Nagad
  nagadEnabled: boolean;
  nagadMerchantId?: string;
  nagadMerchantPrivateKey?: string;
  nagadSandbox: boolean;

  // COD
  codEnabled: boolean;
  codExtraCharge: number;
  codMaxAmount: number;

  // Bank Transfer
  bankTransferEnabled: boolean;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankBranch?: string;
  bankRoutingNumber?: string;
}

export interface IShippingSettings {
  freeShippingThreshold: number;
  defaultShippingCost: number;
  expressShippingCost: number;
  estimatedDeliveryDays: number;
  expressDeliveryDays: number;
}

export interface ITaxSettings {
  enableTax: boolean;
  taxRate: number;
  taxIncludedInPrice: boolean;
}

export interface ISEOSettings {
  siteTitle: string;
  siteDescription: string;
  keywords: string[];
  ogImage?: string;
  googleAnalyticsId?: string;
  facebookPixelId?: string;
}

export interface IEmailSettings {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  smtpSecure: boolean;
  fromEmail: string;
  fromName: string;
}

export interface ISMSSettings {
  smsEnabled: boolean;
  smsProvider: 'bulksmsbd' | 'smsq' | 'other';
  smsApiKey?: string;
  smsApiSecret?: string;
  smsSenderId?: string;
}

export interface ILoyaltySettings {
  enabled: boolean;
  pointsPerPurchase: number; // Points per 100 taka
  pointsRedemptionRate: number; // 1 point = X taka
  minPointsForRedemption: number;
  referralBonus: number;
}

export interface ISettings extends Document {
  // Site Info
  siteName: string;
  siteTagline?: string;
  logo: string;
  logoPublicId: string;
  favicon?: string;
  faviconPublicId?: string;

  // Contact
  contact: IContactInfo;

  // Social
  social: ISocialLinks;

  // Payment
  payment: IPaymentSettings;

  // Shipping
  shipping: IShippingSettings;

  // Tax
  tax: ITaxSettings;

  // SEO
  seo: ISEOSettings;

  // Email
  email: IEmailSettings;

  // SMS
  sms: ISMSSettings;

  // Loyalty
  loyalty: ILoyaltySettings;

  // Gift Wrap
  giftWrapEnabled: boolean;
  giftWrapPrice: number;

  // Store Status
  isMaintenanceMode: boolean;
  maintenanceMessage?: string;

  // Currency
  currency: string;
  currencySymbol: string;

  // Admin Secret Key
  adminSecretKey: string;

  updatedAt: Date;
}

const SettingsSchema = new Schema<ISettings>(
  {
    siteName: { type: String, required: true, default: 'Pakistani Noor' },
    siteTagline: String,
    logo: { type: String, default: '' },
    logoPublicId: { type: String, default: '' },
    favicon: String,
    faviconPublicId: String,

    contact: {
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      alternatePhone: String,
      address: { type: String, default: '' },
      city: { type: String, default: 'Dhaka' },
      country: { type: String, default: 'Bangladesh' },
      mapUrl: String,
    },

    social: {
      facebook: String,
      instagram: String,
      twitter: String,
      youtube: String,
      linkedin: String,
      tiktok: String,
      whatsapp: String,
    },

    payment: {
      sslcommerzEnabled: { type: Boolean, default: false },
      sslcommerzStoreId: String,
      sslcommerzStorePassword: String,
      sslcommerzSandbox: { type: Boolean, default: true },

      bkashEnabled: { type: Boolean, default: false },
      bkashAppKey: String,
      bkashAppSecret: String,
      bkashUsername: String,
      bkashPassword: String,
      bkashSandbox: { type: Boolean, default: true },

      nagadEnabled: { type: Boolean, default: false },
      nagadMerchantId: String,
      nagadMerchantPrivateKey: String,
      nagadSandbox: { type: Boolean, default: true },

      codEnabled: { type: Boolean, default: true },
      codExtraCharge: { type: Number, default: 0 },
      codMaxAmount: { type: Number, default: 50000 },

      bankTransferEnabled: { type: Boolean, default: false },
      bankName: String,
      bankAccountName: String,
      bankAccountNumber: String,
      bankBranch: String,
      bankRoutingNumber: String,
    },

    shipping: {
      freeShippingThreshold: { type: Number, default: 3000 },
      defaultShippingCost: { type: Number, default: 80 },
      expressShippingCost: { type: Number, default: 150 },
      estimatedDeliveryDays: { type: Number, default: 5 },
      expressDeliveryDays: { type: Number, default: 2 },
    },

    tax: {
      enableTax: { type: Boolean, default: false },
      taxRate: { type: Number, default: 0 },
      taxIncludedInPrice: { type: Boolean, default: true },
    },

    seo: {
      siteTitle: { type: String, default: 'Pakistani Noor - Your Trusted Online Store' },
      siteDescription: { type: String, default: 'Shop the best products at Pakistani Noor' },
      keywords: [String],
      ogImage: String,
      googleAnalyticsId: String,
      facebookPixelId: String,
    },

    email: {
      smtpHost: { type: String, default: '' },
      smtpPort: { type: Number, default: 587 },
      smtpUser: { type: String, default: '' },
      smtpPassword: { type: String, default: '' },
      smtpSecure: { type: Boolean, default: false },
      fromEmail: { type: String, default: '' },
      fromName: { type: String, default: 'Pakistani Noor' },
    },

    sms: {
      smsEnabled: { type: Boolean, default: false },
      smsProvider: { type: String, enum: ['bulksmsbd', 'smsq', 'other'], default: 'bulksmsbd' },
      smsApiKey: String,
      smsApiSecret: String,
      smsSenderId: String,
    },

    loyalty: {
      enabled: { type: Boolean, default: false },
      pointsPerPurchase: { type: Number, default: 1 }, // 1 point per 100 taka
      pointsRedemptionRate: { type: Number, default: 1 }, // 1 point = 1 taka
      minPointsForRedemption: { type: Number, default: 100 },
      referralBonus: { type: Number, default: 50 },
    },

    giftWrapEnabled: { type: Boolean, default: true },
    giftWrapPrice: { type: Number, default: 50 },

    isMaintenanceMode: { type: Boolean, default: false },
    maintenanceMessage: String,

    currency: { type: String, default: 'BDT' },
    currencySymbol: { type: String, default: '৳' },

    adminSecretKey: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

// Static: Get settings (singleton pattern)
SettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({
      siteName: 'Pakistani Noor',
      adminSecretKey: process.env.ADMIN_SECRET_KEY || 'default-secret-key-change-me',
    });
  }
  return settings;
};

// Static: Update settings
SettingsSchema.statics.updateSettings = async function (data: Partial<ISettings>) {
  let settings = await this.findOne();
  if (!settings) {
    settings = new this(data);
  } else {
    Object.assign(settings, data);
  }
  await settings.save();
  return settings;
};

const Settings: Model<ISettings> = mongoose.models.Settings || mongoose.model<ISettings>('Settings', SettingsSchema);

export default Settings;
