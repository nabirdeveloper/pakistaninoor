import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Import models
import User from '../models/User';
import Category from '../models/Category';
import Product from '../models/Product';
import Banner from '../models/Banner';
import Coupon from '../models/Coupon';
import Settings from '../models/Settings';
import Order from '../models/Order';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pakistaninoor';

// Cloudinary placeholder image helpers
const IMG = (id: string) => `https://res.cloudinary.com/demo/image/upload/${id}.jpg`;
const PIMG = (id: string, alt: string, isPrimary = true) => ({ url: IMG(id), publicId: id, alt, isPrimary });

async function seed() {
  try {
    console.log('🌱 Starting database seeding...');

    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await Promise.all([
      User.deleteMany({}),
      Category.deleteMany({}),
      Product.deleteMany({}),
      Banner.deleteMany({}),
      Coupon.deleteMany({}),
      Settings.deleteMany({}),
      Order.deleteMany({}),
    ]);

    // Create admin user (the User model's pre-save hook hashes the password)
    console.log('👤 Creating admin user...');
    const admin = await User.create({
      name: 'Admin',
      email: 'admin@pakistaninoor.com',
      password: 'Admin@123',
      role: 'admin',
      isVerified: true,
      isActive: true,
      addresses: [{
        label: 'Office',
        fullName: 'Pakistani Noor Admin',
        phone: '01712345678',
        street: '123 Main Street, Dhanmondi',
        city: 'Dhaka',
        district: 'Dhaka',
        division: 'Dhaka',
        postalCode: '1205',
        isDefault: true,
      }],
    });
    console.log(`  ✅ Admin created: ${admin.email}`);

    // Create test user
    const testUser = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'Test@123',
      role: 'user',
      isVerified: true,
      isActive: true,
      loyaltyPoints: 500,
      addresses: [{
        label: 'Home',
        fullName: 'Test User',
        phone: '01812345678',
        street: '456 Test Road, Gulshan',
        city: 'Dhaka',
        district: 'Dhaka',
        division: 'Dhaka',
        postalCode: '1212',
        isDefault: true,
      }],
    });
    console.log(`  ✅ Test user created: ${testUser.email}`);

    // Create categories
    console.log('📁 Creating categories...');
    const categories = await Category.create([
      {
        name: 'Electronics',
        slug: 'electronics',
        description: 'Latest electronic gadgets and devices',
        image: IMG('electronics'),
        isActive: true,
        isFeatured: true,
        showInMenu: true,
        sortOrder: 1,
      },
      {
        name: 'Fashion',
        slug: 'fashion',
        description: 'Trendy clothes and accessories',
        image: IMG('fashion'),
        isActive: true,
        isFeatured: true,
        showInMenu: true,
        sortOrder: 2,
      },
      {
        name: 'Home & Living',
        slug: 'home-living',
        description: 'Home decor and furniture',
        image: IMG('home'),
        isActive: true,
        isFeatured: true,
        showInMenu: true,
        sortOrder: 3,
      },
      {
        name: 'Beauty & Health',
        slug: 'beauty-health',
        description: 'Beauty products and health essentials',
        image: IMG('beauty'),
        isActive: true,
        isFeatured: false,
        showInMenu: true,
        sortOrder: 4,
      },
      {
        name: 'Sports & Outdoors',
        slug: 'sports-outdoors',
        description: 'Sports equipment and outdoor gear',
        image: IMG('sports'),
        isActive: true,
        isFeatured: false,
        showInMenu: true,
        sortOrder: 5,
      },
    ]);
    console.log(`  ✅ Created ${categories.length} categories`);

    // Create products
    console.log('📦 Creating products...');
    const now = Date.now();
    const daysAgo = (d: number) => new Date(now - d * 24 * 60 * 60 * 1000);

    const products = await Product.create([
      {
        name: 'Premium Wireless Earbuds',
        slug: 'premium-wireless-earbuds',
        description: 'High-quality wireless earbuds with active noise cancellation, touch controls, and a 24-hour battery life with the charging case. Sweat-resistant for workouts and comfortable for all-day wear.',
        shortDescription: 'Premium sound quality with ANC',
        brand: 'Noor Audio',
        price: 2999,
        compareAtPrice: 4500,
        costPrice: 1800,
        sku: 'EAR-001',
        category: categories[0]._id,
        images: [
          PIMG('earbuds1', 'Wireless Earbuds'),
          PIMG('earbuds2', 'Earbuds Case', false),
        ],
        stock: 50,
        lowStockThreshold: 8,
        trackInventory: true,
        status: 'active',
        visibility: 'visible',
        isFeatured: true,
        isNewArrival: true,
        isBestSeller: true,
        isOnSale: true,
        badges: ['Best Seller', 'Sale'],
        tags: ['earbuds', 'wireless', 'bluetooth', 'audio'],
        averageRating: 4.5,
        totalReviews: 128,
        salesCount: 450,
        viewCount: 12400,
        publishedAt: daysAgo(20),
      },
      {
        name: 'Smart Watch Pro',
        slug: 'smart-watch-pro',
        description: 'Advanced smartwatch with heart-rate monitoring, SpO2 tracking, GPS, and a 7-day battery life. Features a bright AMOLED display, 100+ watch faces, and IP68 water resistance.',
        shortDescription: 'Premium smartwatch with health features',
        brand: 'Noor Wearables',
        price: 5999,
        compareAtPrice: 7999,
        costPrice: 3500,
        sku: 'WAT-001',
        category: categories[0]._id,
        images: [
          PIMG('watch1', 'Smart Watch'),
        ],
        stock: 30,
        lowStockThreshold: 6,
        trackInventory: true,
        status: 'active',
        visibility: 'visible',
        isFeatured: true,
        isBestSeller: true,
        badges: ['New', 'Hot'],
        tags: ['smartwatch', 'fitness', 'health', 'wearable'],
        averageRating: 4.7,
        totalReviews: 89,
        salesCount: 320,
        viewCount: 9800,
        publishedAt: daysAgo(12),
      },
      {
        name: 'Designer Cotton T-Shirt',
        slug: 'designer-cotton-tshirt',
        description: 'Premium quality cotton t-shirt with a modern design. Soft, breathable 100% combed cotton with a comfortable regular fit. Available in multiple sizes and colors.',
        shortDescription: '100% premium cotton t-shirt',
        brand: 'Noor Fashion',
        price: 799,
        compareAtPrice: 1299,
        costPrice: 400,
        sku: 'TSH-001',
        category: categories[1]._id,
        images: [
          PIMG('tshirt1', 'Cotton T-Shirt'),
        ],
        hasVariants: true,
        variantOptions: { Size: ['S', 'M', 'L', 'XL', 'XXL'], Color: ['White', 'Black', 'Navy', 'Gray'] },
        variants: [
          { sku: 'TSH-001-S-W', name: 'S / White', attributes: { Size: 'S', Color: 'White' }, price: 799, compareAtPrice: 1299, costPrice: 400, stock: 20, lowStockThreshold: 5, isActive: true },
          { sku: 'TSH-001-M-B', name: 'M / Black', attributes: { Size: 'M', Color: 'Black' }, price: 799, compareAtPrice: 1299, costPrice: 400, stock: 25, lowStockThreshold: 5, isActive: true },
          { sku: 'TSH-001-L-N', name: 'L / Navy', attributes: { Size: 'L', Color: 'Navy' }, price: 799, compareAtPrice: 1299, costPrice: 400, stock: 18, lowStockThreshold: 5, isActive: true },
          { sku: 'TSH-001-XL-G', name: 'XL / Gray', attributes: { Size: 'XL', Color: 'Gray' }, price: 799, compareAtPrice: 1299, costPrice: 400, stock: 12, lowStockThreshold: 5, isActive: true },
        ],
        stock: 75,
        lowStockThreshold: 10,
        trackInventory: true,
        status: 'active',
        visibility: 'visible',
        isNewArrival: true,
        badges: ['New'],
        tags: ['tshirt', 'cotton', 'fashion', 'clothing'],
        averageRating: 4.3,
        totalReviews: 56,
        salesCount: 180,
        viewCount: 6100,
        publishedAt: daysAgo(8),
      },
      {
        name: 'Premium Leather Wallet',
        slug: 'premium-leather-wallet',
        description: 'Handcrafted genuine leather wallet with multiple card slots, a coin pocket, and RFID protection. Ages beautifully with daily use.',
        shortDescription: 'Genuine leather with RFID protection',
        brand: 'Noor Accessories',
        price: 1499,
        compareAtPrice: 2499,
        costPrice: 700,
        sku: 'WAL-001',
        category: categories[1]._id,
        images: [
          PIMG('wallet1', 'Leather Wallet'),
        ],
        stock: 75,
        lowStockThreshold: 10,
        trackInventory: true,
        status: 'active',
        visibility: 'visible',
        isFeatured: true,
        badges: ['Premium'],
        tags: ['wallet', 'leather', 'accessories'],
        averageRating: 4.6,
        totalReviews: 42,
        salesCount: 95,
        viewCount: 3900,
        publishedAt: daysAgo(30),
      },
      {
        name: 'Modern Table Lamp',
        slug: 'modern-table-lamp',
        description: 'Elegant modern table lamp with adjustable brightness, touch control, and a warm LED that suits any desk or bedside table.',
        shortDescription: 'Touch control with adjustable brightness',
        brand: 'Noor Living',
        price: 1299,
        compareAtPrice: 1999,
        costPrice: 650,
        sku: 'LMP-001',
        category: categories[2]._id,
        images: [
          PIMG('lamp1', 'Table Lamp'),
        ],
        stock: 40,
        lowStockThreshold: 8,
        trackInventory: true,
        status: 'active',
        visibility: 'visible',
        isNewArrival: true,
        badges: ['New'],
        tags: ['lamp', 'lighting', 'home-decor'],
        averageRating: 4.4,
        totalReviews: 28,
        salesCount: 65,
        viewCount: 2700,
        publishedAt: daysAgo(6),
      },
      {
        name: 'Organic Face Cream',
        slug: 'organic-face-cream',
        description: '100% organic face cream with natural ingredients like aloe vera and vitamin E for glowing, hydrated skin. Dermatologically tested.',
        shortDescription: 'Natural ingredients for healthy skin',
        brand: 'Noor Beauty',
        price: 899,
        compareAtPrice: 1499,
        costPrice: 400,
        sku: 'CRM-001',
        category: categories[3]._id,
        images: [
          PIMG('cream1', 'Face Cream'),
        ],
        stock: 60,
        lowStockThreshold: 10,
        trackInventory: true,
        status: 'active',
        visibility: 'visible',
        isBestSeller: true,
        badges: ['Organic', 'Best Seller'],
        tags: ['skincare', 'organic', 'beauty', 'cream'],
        averageRating: 4.8,
        totalReviews: 156,
        salesCount: 520,
        viewCount: 14200,
        publishedAt: daysAgo(25),
      },
      {
        name: 'Yoga Mat Premium',
        slug: 'yoga-mat-premium',
        description: 'Extra thick 8mm yoga mat with a non-slip textured surface, alignment lines, and a free carrying strap. Made from eco-friendly TPE.',
        shortDescription: 'Non-slip surface with extra cushioning',
        brand: 'Noor Sports',
        price: 1599,
        compareAtPrice: 2299,
        costPrice: 800,
        sku: 'YOG-001',
        category: categories[4]._id,
        images: [
          PIMG('yogamat1', 'Yoga Mat'),
        ],
        stock: 45,
        lowStockThreshold: 8,
        trackInventory: true,
        status: 'active',
        visibility: 'visible',
        isFeatured: true,
        badges: ['Featured'],
        tags: ['yoga', 'fitness', 'exercise', 'mat'],
        averageRating: 4.5,
        totalReviews: 73,
        salesCount: 210,
        viewCount: 7200,
        publishedAt: daysAgo(18),
      },
      {
        name: 'Bluetooth Speaker',
        slug: 'bluetooth-speaker',
        description: 'Portable Bluetooth speaker with 360° sound, deep bass, and an IPX7 waterproof design. Up to 14 hours of playtime.',
        shortDescription: 'Waterproof with powerful bass',
        brand: 'Noor Audio',
        price: 1999,
        compareAtPrice: 2999,
        costPrice: 1100,
        sku: 'SPK-001',
        category: categories[0]._id,
        images: [
          PIMG('speaker1', 'Bluetooth Speaker'),
        ],
        stock: 35,
        lowStockThreshold: 6,
        trackInventory: true,
        status: 'active',
        visibility: 'visible',
        badges: ['Waterproof'],
        tags: ['speaker', 'bluetooth', 'audio', 'portable'],
        averageRating: 4.4,
        totalReviews: 64,
        salesCount: 145,
        viewCount: 5400,
        publishedAt: daysAgo(10),
      },
      {
        name: '4K Action Camera',
        slug: '4k-action-camera',
        description: 'Capture every moment in stunning 4K at 60fps. Includes image stabilization, a waterproof case, and Wi-Fi app control.',
        shortDescription: 'Ultra HD video with image stabilization',
        brand: 'Noor Cameras',
        price: 8499,
        compareAtPrice: 10999,
        costPrice: 5200,
        sku: 'CAM-001',
        category: categories[0]._id,
        images: [
          PIMG('camera1', '4K Action Camera'),
        ],
        stock: 15,
        lowStockThreshold: 4,
        trackInventory: true,
        status: 'active',
        visibility: 'visible',
        isNewArrival: true,
        badges: ['New'],
        tags: ['camera', 'action', 'video', '4k'],
        averageRating: 4.6,
        totalReviews: 31,
        salesCount: 58,
        viewCount: 3300,
        publishedAt: daysAgo(4),
      },
      {
        name: 'Wireless Keyboard & Mouse Combo',
        slug: 'wireless-keyboard-mouse-combo',
        description: 'Sleek 2.4GHz wireless keyboard and mouse combo with silent keys, a full-size layout, and a long battery life. Plug-and-play with Windows and Mac.',
        shortDescription: 'Silent, reliable wireless desktop combo',
        brand: 'Noor Tech',
        price: 1899,
        compareAtPrice: 2499,
        costPrice: 950,
        sku: 'KBM-001',
        category: categories[0]._id,
        images: [
          PIMG('keyboard1', 'Keyboard and Mouse Combo'),
        ],
        stock: 55,
        lowStockThreshold: 10,
        trackInventory: true,
        status: 'active',
        visibility: 'visible',
        badges: ['Value'],
        tags: ['keyboard', 'mouse', 'wireless', 'computer'],
        averageRating: 4.3,
        totalReviews: 47,
        salesCount: 120,
        viewCount: 4600,
        publishedAt: daysAgo(15),
      },
      {
        name: "Men's Denim Jacket",
        slug: 'mens-denim-jacket',
        description: 'Classic denim jacket in a mid-wash finish. Durable cotton denim with a tailored fit, chest pockets, and brass buttons.',
        shortDescription: 'Timeless denim style, tailored fit',
        brand: 'Noor Fashion',
        price: 2499,
        compareAtPrice: 3500,
        costPrice: 1300,
        sku: 'JCK-001',
        category: categories[1]._id,
        images: [
          PIMG('jacket1', 'Denim Jacket'),
        ],
        stock: 38,
        lowStockThreshold: 6,
        trackInventory: true,
        status: 'active',
        visibility: 'visible',
        isNewArrival: true,
        badges: ['New'],
        tags: ['jacket', 'denim', 'clothing', 'fashion'],
        averageRating: 4.5,
        totalReviews: 22,
        salesCount: 74,
        viewCount: 2800,
        publishedAt: daysAgo(3),
      },
      {
        name: 'Cotton Bed Sheet Set',
        slug: 'cotton-bed-sheet-set',
        description: 'Soft 300-thread-count pure cotton bed sheet set with pillow covers and a fitted sheet. Machine washable and breathable.',
        shortDescription: '300 TC pure cotton, full set',
        brand: 'Noor Living',
        price: 1899,
        compareAtPrice: 2700,
        costPrice: 1000,
        sku: 'BED-001',
        category: categories[2]._id,
        images: [
          PIMG('bedsheet1', 'Bed Sheet Set'),
        ],
        stock: 44,
        lowStockThreshold: 8,
        trackInventory: true,
        status: 'active',
        visibility: 'visible',
        badges: ['Value'],
        tags: ['bedsheet', 'bedding', 'cotton', 'home'],
        averageRating: 4.4,
        totalReviews: 35,
        salesCount: 88,
        viewCount: 3100,
        publishedAt: daysAgo(14),
      },
      {
        name: 'Vitamin C Serum',
        slug: 'vitamin-c-serum',
        description: 'Brightening vitamin C serum with hyaluronic acid to reduce dark spots and even out skin tone. Suitable for all skin types.',
        shortDescription: 'Brightens and evens skin tone',
        brand: 'Noor Beauty',
        price: 1099,
        compareAtPrice: 1699,
        costPrice: 550,
        sku: 'SRM-001',
        category: categories[3]._id,
        images: [
          PIMG('serum1', 'Vitamin C Serum'),
        ],
        stock: 70,
        lowStockThreshold: 12,
        trackInventory: true,
        status: 'active',
        visibility: 'visible',
        isBestSeller: true,
        badges: ['Best Seller'],
        tags: ['serum', 'skincare', 'vitamin-c', 'beauty'],
        averageRating: 4.7,
        totalReviews: 92,
        salesCount: 310,
        viewCount: 8900,
        publishedAt: daysAgo(22),
      },
      {
        name: 'Resistance Bands Set',
        slug: 'resistance-bands-set',
        description: 'Set of 5 resistance bands with different levels, plus handles, door anchor, and ankle straps. Perfect for home workouts.',
        shortDescription: '5-level bands for full-body workouts',
        brand: 'Noor Sports',
        price: 1299,
        compareAtPrice: 1899,
        costPrice: 600,
        sku: 'RBS-001',
        category: categories[4]._id,
        images: [
          PIMG('bands1', 'Resistance Bands Set'),
        ],
        stock: 80,
        lowStockThreshold: 12,
        trackInventory: true,
        status: 'active',
        visibility: 'visible',
        badges: ['Value'],
        tags: ['workout', 'resistance', 'fitness', 'bands'],
        averageRating: 4.5,
        totalReviews: 51,
        salesCount: 165,
        viewCount: 5200,
        publishedAt: daysAgo(9),
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any[]);
    console.log(`  ✅ Created ${products.length} products`);

    // Add sample approved reviews to a few products (powers review intelligence)
    console.log('💬 Adding sample reviews...');
    const reviewTargets: Array<{
      product: { _id: unknown; reviews: unknown[]; save: () => Promise<unknown> };
      rating: number; title: string; comment: string;
    }> = [
      { product: products[0], rating: 5, title: 'Excellent sound!', comment: 'The noise cancellation is amazing for the price. Battery easily lasts two days of heavy use.' },
      { product: products[0], rating: 4, title: 'Great value', comment: 'Very good earbuds, bass is punchy. Pairing was instant.' },
      { product: products[1], rating: 5, title: 'Loved the health tracking', comment: 'Heart rate and sleep tracking are accurate. Display is crisp in sunlight.' },
      { product: products[5], rating: 5, title: 'Skin feels amazing', comment: 'Bought this after reading reviews and it did not disappoint. Very light, non-greasy.' },
      { product: products[5], rating: 4, title: 'Good cream', comment: 'Works well, takes a couple of weeks to see results but worth it.' },
    ];
    for (const entry of reviewTargets) {
      const product = entry.product;
      const rating = entry.rating;
      const title = entry.title;
      const comment = entry.comment;
      product.reviews.push({
        user: testUser._id,
        rating,
        title,
        comment,
        isVerifiedPurchase: true,
        isApproved: true,
        helpfulCount: Math.floor(Math.random() * 12) + 1,
        createdAt: daysAgo(3 + Math.floor(Math.random() * 20)),
      });
      await product.save();
    }
    console.log(`  ✅ Added ${reviewTargets.length} approved reviews`);

    // Create banners (current Banner schema)
    console.log('🖼️ Creating banners...');
    await Banner.create([
      {
        name: 'Summer Sale Hero',
        type: 'hero',
        position: 'homepage_hero',
        imageDesktop: IMG('banner1'),
        imageDesktopPublicId: 'banner1',
        imageMobile: IMG('banner1-mobile'),
        title: 'Summer Sale',
        subtitle: 'Up to 50% Off',
        description: 'Shop the biggest sale of the season',
        buttonText: 'Shop Now',
        buttonLink: '/products?onSale=true',
        buttonColor: '#16a34a',
        textPosition: 'left',
        sortOrder: 1,
        isActive: true,
        startDate: new Date(),
        endDate: new Date(now + 30 * 24 * 60 * 60 * 1000),
      },
      {
        name: 'New Arrivals Hero',
        type: 'hero',
        position: 'homepage_hero',
        imageDesktop: IMG('banner2'),
        imageDesktopPublicId: 'banner2',
        title: 'New Arrivals',
        subtitle: 'Fresh Collection',
        description: 'Discover the latest products',
        buttonText: 'Explore',
        buttonLink: '/products?newArrivals=true',
        buttonColor: '#0f172a',
        textPosition: 'center',
        sortOrder: 2,
        isActive: true,
        startDate: new Date(),
      },
      {
        name: 'Free Shipping Promo',
        type: 'promotional',
        position: 'homepage_middle',
        imageDesktop: IMG('banner3'),
        imageDesktopPublicId: 'banner3',
        title: 'Free Shipping',
        subtitle: 'On orders over ৳3,000',
        buttonText: 'Learn More',
        buttonLink: '/products',
        sortOrder: 1,
        isActive: true,
        startDate: new Date(),
      },
    ]);
    console.log('  ✅ Created 3 banners');

    // Create coupons (current Coupon schema)
    console.log('🎟️ Creating coupons...');
    await Coupon.create([
      {
        code: 'WELCOME10',
        name: 'Welcome 10% Off',
        description: 'Get 10% off on your first order',
        type: 'percentage',
        value: 10,
        minOrderAmount: 500,
        maxDiscountAmount: 500,
        usageLimit: 1000,
        isActive: true,
        startDate: new Date(),
        endDate: new Date(now + 90 * 24 * 60 * 60 * 1000),
      },
      {
        code: 'SAVE200',
        name: 'Save ৳200',
        description: 'Flat ৳200 off on orders above ৳2,000',
        type: 'fixed',
        value: 200,
        minOrderAmount: 2000,
        usageLimit: 500,
        isActive: true,
        startDate: new Date(),
        endDate: new Date(now + 30 * 24 * 60 * 60 * 1000),
      },
      {
        code: 'SUMMER25',
        name: 'Summer 25% Off',
        description: '25% off on summer collection',
        type: 'percentage',
        value: 25,
        minOrderAmount: 1000,
        maxDiscountAmount: 1000,
        usageLimit: 200,
        isActive: true,
        startDate: new Date(),
        endDate: new Date(now + 60 * 24 * 60 * 60 * 1000),
      },
    ]);
    console.log('  ✅ Created 3 coupons');

    // Create sample orders (powers co-occurrence "bought together" + revenue analytics)
    console.log('🧾 Creating sample orders...');
    const address = {
      fullName: 'Test User',
      phone: '01812345678',
      email: 'test@example.com',
      street: '456 Test Road, Gulshan',
      city: 'Dhaka',
      district: 'Dhaka',
      division: 'Dhaka',
      postalCode: '1212',
      country: 'Bangladesh',
    };
    const orderDefs = [
      { daysBack: 28, items: [products[0], products[1], products[7]] },
      { daysBack: 24, items: [products[0], products[7]] },
      { daysBack: 19, items: [products[2], products[3]] },
      { daysBack: 15, items: [products[3], products[2]] },
      { daysBack: 12, items: [products[4], products[11]] },
      { daysBack: 9, items: [products[5], products[12]] },
      { daysBack: 6, items: [products[6], products[13]] },
      { daysBack: 3, items: [products[1], products[0]] },
      { daysBack: 1, items: [products[8], products[0]] },
    ];
    for (let i = 0; i < orderDefs.length; i++) {
      const def = orderDefs[i];
      const items = def.items.map((p: { _id: mongoose.Types.ObjectId; name: string; slug: string; sku: string; price: number; images?: Array<{ url: string }> }) => {
        const price = p.price;
        const quantity = i % 2 === 0 ? 1 : 2;
        const image = p.images && p.images[0] ? p.images[0].url : '';
        return {
          product: p._id,
          name: p.name,
          slug: p.slug,
          sku: p.sku,
          image,
          price,
          quantity,
          total: price * quantity,
        };
      });
      const subtotal = items.reduce((sum: number, it: { total: number }) => sum + it.total, 0);
      const shippingCost = subtotal >= 3000 ? 0 : 80;
      const total = subtotal + shippingCost;
      await Order.create({
        orderNumber: `SEED-${1000 + i}`,
        user: testUser._id,
        items,
        shippingAddress: address,
        sameAsBilling: true,
        subtotal,
        discountAmount: 0,
        couponCode: undefined,
        couponDiscount: 0,
        taxAmount: 0,
        shippingCost,
        giftWrapCost: 0,
        total,
        payment: { method: 'cod', status: 'completed', paidAt: daysAgo(def.daysBack), paidAmount: total },
        shipping: { method: 'Standard', carrier: 'Pathao', shippingCost, estimatedDelivery: daysAgo(def.daysBack - 3) },
        status: 'delivered',
        source: 'website',
        loyaltyPointsEarned: Math.floor(total / 100),
        createdAt: daysAgo(def.daysBack),
        updatedAt: daysAgo(def.daysBack),
      });
    }
    console.log(`  ✅ Created ${orderDefs.length} sample orders`);

    // Create settings
    console.log('⚙️ Creating settings...');
    await Settings.create({
      siteName: 'Pakistani Noor',
      siteTagline: 'Your one-stop shop for quality products in Bangladesh',
      logo: '',
      logoPublicId: '',
      contact: {
        email: 'support@pakistaninoor.com',
        phone: '+880 1700-000000',
        address: 'Dhaka, Bangladesh',
        city: 'Dhaka',
        country: 'Bangladesh',
      },
      social: {
        facebook: 'https://facebook.com/pakistaninoor',
        instagram: 'https://instagram.com/pakistaninoor',
        twitter: 'https://twitter.com/pakistaninoor',
      },
      currency: 'BDT',
      currencySymbol: '৳',
      shipping: {
        freeShippingThreshold: 3000,
        defaultShippingCost: 80,
        expressShippingCost: 150,
        estimatedDeliveryDays: 5,
        expressDeliveryDays: 2,
      },
      tax: {
        enableTax: false,
        taxRate: 0,
        taxIncludedInPrice: true,
      },
      seo: {
        siteTitle: 'Pakistani Noor',
        siteDescription: 'Your one-stop shop for quality products in Bangladesh',
        keywords: ['online store', 'Bangladesh', 'products'],
      },
      payment: {
        sslcommerzEnabled: false,
        bkashEnabled: false,
        nagadEnabled: false,
        codEnabled: true,
        codExtraCharge: 0,
        codMaxAmount: 100000,
        bankTransferEnabled: false,
        bkashSandbox: true,
        sslcommerzSandbox: true,
        nagadSandbox: true,
      },
      email: {
        smtpHost: '',
        smtpPort: 587,
        smtpUser: '',
        smtpPassword: '',
        smtpSecure: false,
        fromEmail: 'support@pakistaninoor.com',
        fromName: 'Pakistani Noor',
      },
      sms: {
        smsEnabled: false,
        smsProvider: 'bulksmsbd',
      },
      loyalty: {
        enabled: false,
        pointsPerPurchase: 1,
        pointsRedemptionRate: 1,
        minPointsForRedemption: 100,
        referralBonus: 50,
      },
      giftWrapEnabled: true,
      giftWrapPrice: 50,
      isMaintenanceMode: false,
      adminSecretKey: process.env.ADMIN_SECRET_KEY || 'default-secret-key-change-me',
    });
    console.log('  ✅ Settings created');

    console.log('\n✨ Database seeding completed successfully!');
    console.log('\n📝 Test Credentials:');
    console.log('   Admin: admin@pakistaninoor.com / Admin@123');
    console.log('   User: test@example.com / Test@123');
    console.log('\n🎟️ Test Coupon Codes: WELCOME10, SAVE200, SUMMER25');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();