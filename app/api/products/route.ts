import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import Product from '@/models/Product';
import { auth } from '@/auth';

// GET - List products with filters, pagination, and search
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);

    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const skip = (page - 1) * limit;

    // Filters
    const category = searchParams.get('category');
    const subcategory = searchParams.get('subcategory');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const search = searchParams.get('search');
    const status = searchParams.get('status') || 'active';
    const featured = searchParams.get('featured');
    const newArrivals = searchParams.get('newArrivals');
    const bestSellers = searchParams.get('bestSellers');
    const onSale = searchParams.get('onSale');
    const inStock = searchParams.get('inStock');

    // Sorting
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build query
    const query: Record<string, unknown> = {};

    // Status filter (for public, only show active)
    if (status === 'active') {
      query.status = 'active';
      query.visibility = { $in: ['visible', 'catalog', 'search'] };
    }

    // Category filter
    if (category) {
      query.category = category;
    }
    if (subcategory) {
      query.subcategory = subcategory;
    }

    // Price filter
    if (minPrice || maxPrice) {
      const price: Record<string, unknown> = {};
      if (minPrice) price.$gte = parseFloat(minPrice);
      if (maxPrice) price.$lte = parseFloat(maxPrice);
      query.price = price;
    }

    // Text search
    if (search) {
      query.$text = { $search: search };
    }

    // Boolean filters
    if (featured === 'true') query.isFeatured = true;
    if (newArrivals === 'true') query.isNewArrival = true;
    if (bestSellers === 'true') query.isBestSeller = true;
    if (onSale === 'true') query.isOnSale = true;
    if (inStock === 'true') {
      query.$or = [
        { stock: { $gt: 0 } },
        { hasVariants: true, 'variants.stock': { $gt: 0 } },
      ];
    }

    // Build sort
    type SortValue = 1 | -1 | { $meta: 'textScore' };
    const sort: Record<string, SortValue> = {};
    if (search) {
      sort.score = { $meta: 'textScore' };
    }
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const [products, total] = await Promise.all([
      Product.find(query)
        .populate('category', 'name slug')
        .populate('subcategory', 'name slug')
        .select('-reviews -questions -aiDescription')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(query),
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return NextResponse.json({
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

// POST - Create new product (Admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const body = await request.json();

    // Generate unique SKU if not provided
    if (!body.sku) {
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      body.sku = `NOOR-${timestamp}-${random}`;
    }

    // Generate slug from name
    if (!body.slug) {
      body.slug = body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      // Check if slug exists and make it unique
      const existingSlug = await Product.findOne({ slug: body.slug });
      if (existingSlug) {
        body.slug = `${body.slug}-${Date.now().toString(36)}`;
      }
    }

    const product = await Product.create(body);

    return NextResponse.json(
      { message: 'Product created successfully', product },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: (error as Error)?.message || 'Failed to create product' },
      { status: 500 }
    );
  }
}
