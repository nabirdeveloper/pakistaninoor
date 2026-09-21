import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import Order from '@/models/Order';
import Cart from '@/models/Cart';
import Product from '@/models/Product';
import User from '@/models/User';
import Coupon from '@/models/Coupon';
import Settings from '@/models/Settings';
import { auth } from '@/auth';
import { z } from 'zod';
import { ai, localFraudDetection } from '@/lib/ai/client';
import TrafficEvent from '@/models/TrafficEvent';

const shippingAddressSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(11),
  email: z.string().email().optional(),
  street: z.string().min(5),
  city: z.string().min(2),
  district: z.string().min(2),
  division: z.string().min(2),
  postalCode: z.string().min(4),
  country: z.string().default('Bangladesh'),
  landmark: z.string().optional(),
});

const createOrderSchema = z.object({
  shippingAddress: shippingAddressSchema,
  billingAddress: shippingAddressSchema.optional(),
  sameAsBilling: z.boolean().default(true),
  paymentMethod: z.enum(['cod', 'sslcommerz', 'bkash', 'nagad', 'bank_transfer']),
  shippingMethod: z.string().default('standard'),
  isGiftWrapped: z.boolean().default(false),
  giftMessage: z.string().optional(),
  orderNotes: z.string().optional(),
  deliveryPreference: z.string().optional(),
  couponCode: z.string().optional(),
  loyaltyPointsToUse: z.number().default(0),
});

// GET - List orders
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;
    const status = searchParams.get('status');

    const query: { user?: string; status?: string } = {};

    // Admin sees all orders, users see only their own
    if (session.user.role !== 'admin' && session.user.role !== 'superadmin') {
      query.user = session.user.id;
    }

    if (status) {
      query.status = status;
    }

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('user', 'name email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

// POST - Create new order
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const session = await auth();
    const body = await request.json();

    const validation = createOrderSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = validation.data;
    const settings = await Settings.findOne();

    // Get cart
    let cart;
    if (session?.user?.id) {
      cart = await Cart.findOne({ user: session.user.id });
    } else {
      const sessionId = request.cookies.get('cart_session')?.value;
      cart = await Cart.findOne({ sessionId });
    }

    if (!cart || cart.items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    // Validate stock and build order items
    const orderItems = [];
    let subtotal = 0;

    for (const item of cart.items) {
      const product = await Product.findById(item.product);

      if (!product) {
        return NextResponse.json(
          { error: `Product "${item.name}" is no longer available` },
          { status: 400 }
        );
      }

      // Check stock
      if (product.hasVariants && item.variant) {
        const variant = product.variants?.find((v) => v._id?.toString() === item.variant?.toString());
        if (!variant || variant.stock < item.quantity) {
          return NextResponse.json(
            { error: `Insufficient stock for "${item.name}"` },
            { status: 400 }
          );
        }
      } else if (product.trackInventory && product.stock < item.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for "${item.name}"` },
          { status: 400 }
        );
      }

      const itemTotal = item.price * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        product: item.product,
        variant: item.variant,
        name: item.name,
        slug: item.slug,
        sku: item.sku,
        image: item.image,
        price: item.price,
        compareAtPrice: item.compareAtPrice,
        quantity: item.quantity,
        attributes: item.attributes,
        total: itemTotal,
      });
    }

    // Calculate shipping
    let shippingCost = settings?.shipping.defaultShippingCost || 80;
    if (subtotal >= (settings?.shipping.freeShippingThreshold || 3000)) {
      shippingCost = 0;
    }
    if (data.shippingMethod === 'express') {
      shippingCost = settings?.shipping.expressShippingCost || 150;
    }

    // Calculate coupon discount
    let couponDiscount = 0;
    let couponCode;
    if (data.couponCode) {
      const couponResult = await (Coupon as unknown as {
        validateForOrder: (
          code: string,
          userId: string | undefined,
          orderTotal: number,
          items: Array<Record<string, unknown>>
        ) => Promise<{
          valid: boolean;
          error?: string;
          coupon?: {
            type?: string;
            calculateDiscount: (
              orderTotal: number,
              items: Array<Record<string, unknown>>
            ) => number;
          } | null;
        }>;
      }).validateForOrder(data.couponCode, session?.user?.id, subtotal, orderItems);

      if (couponResult.valid && couponResult.coupon) {
        const coupon = couponResult.coupon;
        couponDiscount = coupon.calculateDiscount(subtotal, orderItems);
        couponCode = data.couponCode.toUpperCase();

        if (coupon.type === 'free_shipping') {
          shippingCost = 0;
        }
      }
    }

    // Calculate gift wrap cost
    let giftWrapCost = 0;
    if (data.isGiftWrapped && settings?.giftWrapEnabled) {
      giftWrapCost = settings.giftWrapPrice || 50;
    }

    // Calculate loyalty points discount
    let loyaltyPointsUsed = 0;
    let loyaltyDiscount = 0;
    if (session?.user?.id && data.loyaltyPointsToUse > 0) {
      const user = await User.findById(session.user.id);
      if (user && settings?.loyalty.enabled) {
        const maxPoints = Math.min(data.loyaltyPointsToUse, user.loyaltyPoints);
        if (maxPoints >= (settings.loyalty.minPointsForRedemption || 100)) {
          loyaltyPointsUsed = maxPoints;
          loyaltyDiscount = maxPoints * (settings.loyalty.pointsRedemptionRate || 1);
        }
      }
    }

    // Calculate tax
    let taxAmount = 0;
    if (settings?.tax.enableTax && !settings.tax.taxIncludedInPrice) {
      taxAmount = (subtotal * (settings.tax.taxRate || 0)) / 100;
    }

    // Calculate total
    const total = subtotal - couponDiscount - loyaltyDiscount + shippingCost + giftWrapCost + taxAmount;

    // COD charge
    let codCharge = 0;
    if (data.paymentMethod === 'cod' && settings?.payment.codExtraCharge) {
      codCharge = settings.payment.codExtraCharge;
    }

    const finalTotal = total + codCharge;

    // Create order
    const order = new Order({
      user: session?.user?.id,
      guestEmail: !session?.user?.id ? data.shippingAddress.email : undefined,
      guestPhone: !session?.user?.id ? data.shippingAddress.phone : undefined,
      items: orderItems,
      shippingAddress: data.shippingAddress,
      billingAddress: data.sameAsBilling ? data.shippingAddress : data.billingAddress,
      sameAsBilling: data.sameAsBilling,
      subtotal,
      discountAmount: couponDiscount + loyaltyDiscount,
      couponCode,
      couponDiscount,
      taxAmount,
      shippingCost,
      giftWrapCost,
      total: finalTotal,
      payment: {
        method: data.paymentMethod,
        status: data.paymentMethod === 'cod' ? 'pending' : 'pending',
      },
      shipping: {
        method: data.shippingMethod,
        shippingCost,
        estimatedDelivery: new Date(
          Date.now() +
            (data.shippingMethod === 'express'
              ? (settings?.shipping.expressDeliveryDays || 2)
              : (settings?.shipping.estimatedDeliveryDays || 5)) *
              24 * 60 * 60 * 1000
        ),
      },
      isGiftWrapped: data.isGiftWrapped,
      giftMessage: data.giftMessage,
      orderNotes: data.orderNotes,
      deliveryPreference: data.deliveryPreference,
      loyaltyPointsUsed,
      source: 'website',
    });

    // Best-effort funnel event — checkout started (order attempt began)
    try {
      await TrafficEvent.create({
        type: 'checkout_start',
        sessionId: session?.user?.id
          ? undefined
          : request.cookies.get('cart_session')?.value,
        userId: session?.user?.id,
        path: '/checkout',
      });
    } catch (trafficError) {
      console.error('Traffic event failed (checkout still proceeds):', trafficError);
    }

    await order.save();

    // Best-effort funnel event — order placed successfully
    try {
      await TrafficEvent.create({
        type: 'order_placed',
        sessionId: session?.user?.id
          ? undefined
          : request.cookies.get('cart_session')?.value,
        userId: session?.user?.id,
        path: `/order-confirmation/${order._id}`,
      });
    } catch (trafficError) {
      console.error('Traffic event failed (order still saved):', trafficError);
    }

    // AI fraud screening — best-effort, never blocks checkout
    try {
      const pastOrders = session?.user?.id
        ? await Order.find({ user: session.user.id })
            .select('total')
            .sort({ createdAt: -1 })
            .limit(20)
            .lean<Array<{ total: number }>>()
        : [];
      const account = session?.user?.id
        ? await User.findById(session.user.id)
            .select('createdAt phone isVerified')
            .lean<{ createdAt?: Date; phone?: string; isVerified?: boolean } | null>()
        : null;

      const accountAgeDays =
        account?.createdAt && typeof account.createdAt !== 'string'
          ? Math.max(0, Math.floor((Date.now() - account.createdAt.getTime()) / 86400000))
          : 0;

      const ipAddress =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        undefined;

      const fraudInput = {
        orderId: order.orderNumber,
        userId: session?.user?.id as string | undefined,
        email: data.shippingAddress.email || session?.user?.email || '',
        phone: data.shippingAddress.phone || account?.phone || '',
        ipAddress,
        totalAmount: finalTotal,
        paymentMethod: data.paymentMethod,
        shippingAddress: data.shippingAddress as unknown as Record<string, string>,
        items: orderItems.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          price: i.price,
          productId: String(i.product),
        })),
        userOrderHistory: pastOrders,
        isFirstOrder: session?.user?.id ? pastOrders.length === 0 : undefined,
        accountAgeDays: session?.user?.id ? accountAgeDays : undefined,
        billingMatchesShipping: data.sameAsBilling,
      };

      const remote = await ai.detectFraud(fraudInput);
      const fraud = remote ?? localFraudDetection(fraudInput);

      // Service + local engines both return risk_score normalized 0..1;
      // store as an integer 0..100 for display.
      const score100 = Math.max(0, Math.min(100, Math.round(fraud.risk_score * 100)));

      order.fraudRisk = {
        score: score100,
        level: fraud.risk_level,
        factors: fraud.risk_factors,
        recommendedAction: fraud.recommended_action,
        userVerified: fraud.user_verified,
        analyzedAt: new Date(fraud.analyzed_at),
      };
      order.timeline.push({
        status: 'pending',
        message: `AI fraud screening: ${fraud.risk_level.toUpperCase()} risk (${score100}/100) — ${fraud.recommended_action.replace('_', ' ')}`,
        timestamp: new Date(),
      });
      await order.save();
    } catch (fraudError) {
      console.error('Fraud screening skipped (order still created):', fraudError);
    }

    // Update inventory
    for (const item of orderItems) {
      const product = await Product.findById(item.product);
      if (product) {
        if (product.hasVariants && item.variant) {
          const variant = product.variants?.find((v) => v._id?.toString() === item.variant?.toString());
          if (variant) {
            variant.stock -= item.quantity;
          }
        } else if (product.trackInventory) {
          product.stock -= item.quantity;
        }
        product.salesCount += item.quantity;
        await product.save();
      }
    }

    // Update coupon usage
    if (couponCode) {
      await Coupon.findOneAndUpdate(
        { code: couponCode },
        {
          $inc: { usedCount: 1 },
          $push: {
            usage: {
              user: session?.user?.id || null,
              order: order._id,
              discountAmount: couponDiscount,
              usedAt: new Date(),
            },
          },
        }
      );
    }

    // Update user stats
    if (session?.user?.id) {
      const loyaltyPointsEarned = Math.floor(
        (finalTotal / 100) * (settings?.loyalty.pointsPerPurchase || 1)
      );

      await User.findByIdAndUpdate(session.user.id, {
        $inc: {
          totalOrders: 1,
          totalSpent: finalTotal,
          loyaltyPoints: loyaltyPointsEarned - loyaltyPointsUsed,
        },
      });

      order.loyaltyPointsEarned = loyaltyPointsEarned;
      await order.save();

      // Phase 1: rebuild the AI taste profile after a purchase so
      // personalization reflects the new order (best-effort, non-blocking).
      try {
        const { buildTasteProfile } = await import('@/lib/ai/personalization');
        await buildTasteProfile(session.user.id);
      } catch (profileError) {
        console.error('AI profile rebuild after order failed (order still saved):', profileError);
      }
    }

    // Clear cart
    await Cart.findByIdAndDelete(cart._id);

    return NextResponse.json(
      {
        message: 'Order created successfully',
        order: {
          orderNumber: order.orderNumber,
          total: order.total,
          paymentMethod: order.payment.method,
          fraudRisk: order.fraudRisk || null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: (error as Error)?.message || 'Failed to create order' },
      { status: 500 }
    );
  }
}
