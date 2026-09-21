import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import Page from '@/models/Page';

/** Default content for the standard storefront pages (created on first visit
 *  so About / Privacy / Terms work even on a fresh database). */
const DEFAULT_PAGES: Record<string, { title: string; content: string }> = {
  about: {
    title: 'About Us',
    content: `## Welcome to Pakistani Noor

Pakistani Noor is your trusted online store for quality products, delivered across Bangladesh.

We believe shopping should be simple, safe and delightful. From carefully curated products to fast nationwide delivery, every detail is designed around you.

### Why shop with us

- Curated collections of quality products
- Secure payments — bKash, Nagad, SSLCommerz, COD
- Fast delivery across all districts
- 7-day easy returns
- Friendly 24/7 support

Thank you for choosing Pakistani Noor. We're always here to help — reach out any time.`,
  },
  privacy: {
    title: 'Privacy Policy',
    content: `## Privacy Policy

Last updated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

Your privacy matters to us. This policy explains what information we collect and how we use it.

### Information we collect

- Account details (name, email, phone) you provide when registering
- Order and delivery information needed to fulfil your purchases
- Payment confirmation data from our trusted gateway partners

### How we use your information

- To process and deliver your orders
- To keep you updated on order status
- To improve your shopping experience and customer support

### Your rights

You may request access to, or deletion of, your personal data at any time by contacting our support team.

We never sell your personal information to third parties.`,
  },
  terms: {
    title: 'Terms & Conditions',
    content: `## Terms & Conditions

Last updated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

By using Pakistani Noor you agree to the following terms.

### Orders & pricing

- All prices are listed in Bangladeshi Taka (৳) and include applicable charges unless stated otherwise.
- Orders are confirmed once payment is verified or, for Cash on Delivery, once our team confirms availability.
- We reserve the right to cancel orders affected by pricing errors or stock unavailability, with a full refund.

### Delivery

- We aim to deliver within the estimated time shown at checkout.
- Delivery times may vary by district and courier availability.

### Returns & refunds

- Most items can be returned within 7 days of delivery.
- Refunds are processed within 3-5 working days after approval through the original payment method.

### Contact

Questions about these terms? Email support@pakistaninoor.com — we're happy to help.`,
  },
  'shipping-policy': {
    title: 'Shipping Policy',
    content: `## Shipping Policy

Last updated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

We deliver across Bangladesh through trusted courier partners (Pathao, RedX, Sundarban and others).

### Delivery time

- Dhaka: 1-2 business days
- Outside Dhaka: 2-5 business days
- Express delivery is available at checkout for faster dispatch

### Shipping cost

- Free shipping on orders over the threshold shown at checkout.
- Standard delivery has a small flat fee per order.
- Exact charges are calculated at checkout before you pay.

### Delivery process

- Once your order ships you will receive a tracking number.
- Our delivery partner will call before delivering.
- Please keep your phone available during the delivery window.

If your order hasn't arrived within the estimated time, contact support@pakistaninoor.com.`,
  },
  'return-policy': {
    title: 'Return Policy',
    content: `## Return & Refund Policy

Last updated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

We want you to love what you ordered. If something isn't right, here's how returns work.

### Return window

- Most items can be returned within 7 days of delivery.
- Items must be unused, in original packaging, with tags attached.

### When you can return

- Wrong item or wrong size delivered
- Damaged or defective product
- Missing parts or accessories

### How returns work

1. Contact support@pakistaninoor.com with your order number and issue.
2. Our team verifies and approves the return.
3. Arrange pickup or drop-off of the item.
4. Refund is processed within 3-5 working days after we receive the item, via your original payment method.

### Non-returnable items

- Personal care / hygiene products once opened
- Items marked final sale

Questions? Reach out anytime — we're happy to help.`,
  },
};

// GET /api/pages/[slug] — published page; auto-creates standard pages on first visit
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await connectDB();

    const { slug } = await params;
    if (!slug) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    let page = await Page.findOne({ slug, status: 'published' }).lean();

    if (!page && DEFAULT_PAGES[slug]) {
      // First visit to a standard page → create and publish the template.
      const template = DEFAULT_PAGES[slug];
      page = await Page.findOneAndUpdate(
        { slug },
        {
          $setOnInsert: {
            title: template.title,
            content: template.content,
            status: 'published',
            metaTitle: `${template.title} — Pakistani Noor`,
            metaDescription: template.content.slice(0, 155),
          },
        },
        { new: true, upsert: true }
      ).lean();
    }

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    return NextResponse.json({ page });
  } catch (error: any) {
    console.error('Page fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load page' },
      { status: 500 }
    );
  }
}