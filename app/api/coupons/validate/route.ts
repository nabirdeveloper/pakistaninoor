import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import Coupon from '@/models/Coupon';
import Cart from '@/models/Cart';
import { auth } from '@/auth';

// POST - Validate coupon
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const session = await auth();
    const body = await request.json();

    const { code } = body;

    if (!code) {
      return NextResponse.json({ error: 'Coupon code is required' }, { status: 400 });
    }

    // Get cart for order total
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

    // Validate coupon
    const result = await (Coupon as any).validateForOrder(
      code,
      session?.user?.id,
      cart.subtotal,
      cart.items
    );

    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const coupon = result.coupon;
    const discount = coupon.calculateDiscount(cart.subtotal, cart.items);

    // Apply coupon to cart
    cart.couponCode = code.toUpperCase();
    cart.couponDiscount = discount;
    await cart.save();

    return NextResponse.json({
      valid: true,
      coupon: {
        code: coupon.code,
        name: coupon.name,
        type: coupon.type,
        discount,
        description: coupon.description,
      },
      cart,
    });
  } catch (error: any) {
    console.error('Error validating coupon:', error);
    return NextResponse.json(
      { error: 'Failed to validate coupon' },
      { status: 500 }
    );
  }
}

// DELETE - Remove coupon from cart
export async function DELETE(request: NextRequest) {
  try {
    await connectDB();

    const session = await auth();

    let cart;
    if (session?.user?.id) {
      cart = await Cart.findOne({ user: session.user.id });
    } else {
      const sessionId = request.cookies.get('cart_session')?.value;
      cart = await Cart.findOne({ sessionId });
    }

    if (!cart) {
      return NextResponse.json({ error: 'Cart not found' }, { status: 404 });
    }

    cart.couponCode = undefined;
    cart.couponDiscount = 0;
    await cart.save();

    return NextResponse.json({
      message: 'Coupon removed',
      cart,
    });
  } catch (error: any) {
    console.error('Error removing coupon:', error);
    return NextResponse.json(
      { error: 'Failed to remove coupon' },
      { status: 500 }
    );
  }
}
