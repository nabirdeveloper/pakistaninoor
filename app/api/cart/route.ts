import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import Cart from '@/models/Cart';
import Product from '@/models/Product';
import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import TrafficEvent from '@/models/TrafficEvent';

async function getOrCreateSessionId() {
  const cookieStore = await cookies();
  let sessionId = cookieStore.get('cart_session')?.value;

  if (!sessionId) {
    sessionId = uuidv4();
  }

  return sessionId;
}

// GET - Get cart
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const session = await auth();
    const sessionId = await getOrCreateSessionId();

    let cart;

    if (session?.user?.id) {
      cart = await Cart.findOne({ user: session.user.id });
    } else {
      cart = await Cart.findOne({ sessionId });
    }

    if (!cart) {
      cart = {
        items: [],
        subtotal: 0,
        total: 0,
        itemCount: 0,
        couponDiscount: 0,
        isGiftWrapped: false,
      };
    }

    const response = NextResponse.json({ cart });
    response.cookies.set('cart_session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error: any) {
    console.error('Error fetching cart:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cart' },
      { status: 500 }
    );
  }
}

// POST - Add item to cart
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const session = await auth();
    const sessionId = await getOrCreateSessionId();
    const body = await request.json();

    const { productId, variantId, quantity = 1 } = body;

    // Get product
    const product = await Product.findById(productId);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Check stock
    let price = product.price;
    let compareAtPrice = product.compareAtPrice;
    let sku = product.sku;
    let attributes: Map<string, string> | undefined;

    if (product.hasVariants && variantId) {
      const variant = product.variants?.find((v: any) => v._id?.toString() === variantId);
      if (!variant) {
        return NextResponse.json({ error: 'Variant not found' }, { status: 404 });
      }
      if (variant.stock < quantity) {
        return NextResponse.json(
          { error: 'Insufficient stock for this variant' },
          { status: 400 }
        );
      }
      price = variant.price;
      compareAtPrice = variant.compareAtPrice;
      sku = variant.sku;
      attributes = variant.attributes;
    } else {
      if (product.trackInventory && product.stock < quantity) {
        return NextResponse.json(
          { error: 'Insufficient stock' },
          { status: 400 }
        );
      }
    }

    // Find or create cart
    let cart;
    if (session?.user?.id) {
      cart = await Cart.findOne({ user: session.user.id });
      if (!cart) {
        cart = new Cart({ user: session.user.id });
      }
    } else {
      cart = await Cart.findOne({ sessionId });
      if (!cart) {
        cart = new Cart({ sessionId });
      }
    }

    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(
      (item: any) => item.sku === sku
    );

    if (existingItemIndex > -1) {
      // Update quantity
      cart.items[existingItemIndex].quantity += quantity;
    } else {
      // Add new item
      const primaryImage = product.images.find((img: any) => img.isPrimary) || product.images[0];

      cart.items.push({
        product: product._id,
        variant: variantId,
        name: product.name,
        slug: product.slug,
        sku,
        image: primaryImage?.url || '',
        price,
        compareAtPrice,
        quantity,
        attributes,
        addedAt: new Date(),
      });
    }

    await cart.save();

    // Best-effort funnel event for dashboard traffic analytics
    try {
      await TrafficEvent.create({
        type: 'add_to_cart',
        sessionId: session?.user?.id ? undefined : sessionId,
        userId: session?.user?.id,
        productId: product._id,
        categoryId: (product as any).category,
        path: `/product/${product.slug}`,
      });
    } catch (trafficError) {
      console.error('Traffic event failed (cart still saved):', trafficError);
    }

    const response = NextResponse.json({
      message: 'Item added to cart',
      cart,
    });

    response.cookies.set('cart_session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    console.error('Error adding to cart:', error);
    return NextResponse.json(
      { error: 'Failed to add item to cart' },
      { status: 500 }
    );
  }
}

// PATCH - Update cart item quantity
export async function PATCH(request: NextRequest) {
  try {
    await connectDB();

    const session = await auth();
    const sessionId = await getOrCreateSessionId();
    const body = await request.json();

    const { itemId, quantity } = body;

    let cart;
    if (session?.user?.id) {
      cart = await Cart.findOne({ user: session.user.id });
    } else {
      cart = await Cart.findOne({ sessionId });
    }

    if (!cart) {
      return NextResponse.json({ error: 'Cart not found' }, { status: 404 });
    }

    const itemIndex = cart.items.findIndex(
      (item: any) => item._id.toString() === itemId
    );

    if (itemIndex === -1) {
      return NextResponse.json({ error: 'Item not found in cart' }, { status: 404 });
    }

    if (quantity <= 0) {
      // Remove item
      cart.items.splice(itemIndex, 1);
    } else {
      // Update quantity
      cart.items[itemIndex].quantity = quantity;
    }

    await cart.save();

    return NextResponse.json({
      message: 'Cart updated',
      cart,
    });
  } catch (error: any) {
    console.error('Error updating cart:', error);
    return NextResponse.json(
      { error: 'Failed to update cart' },
      { status: 500 }
    );
  }
}

// DELETE - Remove item from cart or clear cart
export async function DELETE(request: NextRequest) {
  try {
    await connectDB();

    const session = await auth();
    const sessionId = await getOrCreateSessionId();
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('itemId');
    const clearAll = searchParams.get('clearAll');

    let cart;
    if (session?.user?.id) {
      cart = await Cart.findOne({ user: session.user.id });
    } else {
      cart = await Cart.findOne({ sessionId });
    }

    if (!cart) {
      return NextResponse.json({ error: 'Cart not found' }, { status: 404 });
    }

    if (clearAll === 'true') {
      cart.items = [];
      cart.couponCode = undefined;
      cart.couponDiscount = 0;
    } else if (itemId) {
      cart.items = cart.items.filter(
        (item: any) => item._id.toString() !== itemId
      );
    }

    await cart.save();

    return NextResponse.json({
      message: clearAll ? 'Cart cleared' : 'Item removed from cart',
      cart,
    });
  } catch (error: any) {
    console.error('Error removing from cart:', error);
    return NextResponse.json(
      { error: 'Failed to remove from cart' },
      { status: 500 }
    );
  }
}
