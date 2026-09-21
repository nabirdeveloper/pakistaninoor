import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import Product from '@/models/Product';
import User from '@/models/User';
import { auth } from '@/auth';
import { cookies } from 'next/headers';
import TrafficEvent from '@/models/TrafficEvent';

// GET - Get single product by slug
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await connectDB();

    const { slug } = await params;

    const product = await Product.findOne({ slug })
      .populate('category', 'name slug')
      .populate('subcategory', 'name slug')
      .populate('relatedProducts', 'name slug price images')
      .populate('frequentlyBoughtWith', 'name slug price images')
      .populate({
        path: 'reviews.user',
        select: 'name avatar',
      })
      .populate({
        path: 'questions.user',
        select: 'name',
      })
      .populate({
        path: 'questions.answeredBy',
        select: 'name',
      })
      .lean();

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Increment view count
    await Product.findByIdAndUpdate(product._id, { $inc: { viewCount: 1 } });

    // Best-effort traffic event for the dashboard's traffic/funnel analytics
    try {
      const session = await auth();
      const cookieStore = await cookies();
      await TrafficEvent.create({
        type: 'product_view',
        sessionId: session?.user?.id ? undefined : cookieStore.get('cart_session')?.value,
        userId: session?.user?.id,
        productId: product._id,
        categoryId: product.category?._id,
        path: `/product/${product.slug}`,
      });
    } catch (trafficError) {
      // Traffic logging is best-effort; never fail the product page
      console.error('Traffic event failed (view still recorded):', trafficError);
    }

    // Personalization: record this view in the signed-in user's recent history
    // (guests are tracked client-side in localStorage by the product page).
    try {
      const session = await auth();
      if (session?.user?.id) {
        const user = await User.findById(session.user.id).select('recentlyViewed');
        if (user) {
          const previous = (user.recentlyViewed || []).filter(
            (id) => String(id) !== String(product._id)
          );
          user.recentlyViewed = [product._id, ...previous].slice(0, 12);
          await user.save();

          // Phase 1: teach the AI taste profile a lightweight view signal.
          try {
            const { mergeViewSignal } = await import('@/lib/ai/personalization');
            await mergeViewSignal(session.user.id, String(product._id), 'view');
          } catch (profileError) {
            console.error('AI profile view signal failed (view still recorded):', profileError);
          }
        }
      }
    } catch (viewError) {
      // Recommendation tracking is best-effort; never fail the product page
      console.error('Error recording recent view:', viewError);
    }

    return NextResponse.json({ product });
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}

// PATCH - Update product (Admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { slug } = await params;
    const body = await request.json();

    // Don't allow changing the slug directly through update
    delete body.slug;

    // Snapshot stock/price before the update so alert triggers can diff
    const existing = await Product.findOne({ slug }).select('stock price compareAtPrice');
    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const product = await Product.findOneAndUpdate(
      { slug },
      { $set: body },
      { new: true, runValidators: true }
    );

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Phase 4: fire back-in-stock / price-drop alerts (best-effort)
    try {
      const { checkProductAlerts } = await import('@/lib/notifications/checkProductAlerts');
      await checkProductAlerts(
        {
          stock: existing.stock,
          price: existing.price,
          compareAtPrice: existing.compareAtPrice,
        },
        product
      );
    } catch (alertError) {
      console.error('Product alert triggers failed (update still saved):', alertError);
    }

    return NextResponse.json({
      message: 'Product updated successfully',
      product,
    });
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { error: (error as Error)?.message || 'Failed to update product' },
      { status: 500 }
    );
  }
}

// DELETE - Delete product (Admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { slug } = await params;

    const product = await Product.findOneAndDelete({ slug });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // TODO: Delete images from Cloudinary

    return NextResponse.json({
      message: 'Product deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}
