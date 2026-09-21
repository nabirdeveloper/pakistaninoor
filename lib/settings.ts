import { connectDB } from '@/lib/db/mongodb';
import Settings from '@/models/Settings';
import { cache } from 'react';

export const getSettings = cache(async () => {
  await connectDB();
  const settings = await (Settings as any).getSettings();
  return settings;
});

export const getPublicSettings = cache(async () => {
  const settings = await getSettings();

  // Return only public settings (no sensitive data)
  return {
    siteName: settings.siteName,
    siteTagline: settings.siteTagline,
    logo: settings.logo,
    favicon: settings.favicon,
    contact: settings.contact,
    social: settings.social,
    shipping: {
      freeShippingThreshold: settings.shipping.freeShippingThreshold,
      estimatedDeliveryDays: settings.shipping.estimatedDeliveryDays,
    },
    currency: settings.currency,
    currencySymbol: settings.currencySymbol,
    seo: settings.seo,
    giftWrapEnabled: settings.giftWrapEnabled,
    giftWrapPrice: settings.giftWrapPrice,
    isMaintenanceMode: settings.isMaintenanceMode,
    maintenanceMessage: settings.maintenanceMessage,
    payment: {
      codEnabled: settings.payment.codEnabled,
      sslcommerzEnabled: settings.payment.sslcommerzEnabled,
      bkashEnabled: settings.payment.bkashEnabled,
      nagadEnabled: settings.payment.nagadEnabled,
      bankTransferEnabled: settings.payment.bankTransferEnabled,
    },
    loyalty: {
      enabled: settings.loyalty.enabled,
      pointsPerPurchase: settings.loyalty.pointsPerPurchase,
    },
  };
});
