import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/db/mongodb';
import Order from '@/models/Order';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    await connectDB();

    const query: any = { user: session.user.id };
    if (status) {
      query.status = status;
    }

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('orderNumber items total status paymentStatus paymentMethod createdAt'),
      Order.countDocuments(query),
    ]);

    return NextResponse.json({
      orders: orders.map((order) => ({
        _id: order._id,
        orderNumber: order.orderNumber,
        items: order.items.map((item: any) => ({
          name: item.name,
          image: item.image,
          quantity: item.quantity,
          price: item.price,
        })),
        total: order.total,
        status: order.status,
        paymentStatus: order.payment?.status,
        paymentMethod: order.payment?.method,
        createdAt: order.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Failed to fetch orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}
