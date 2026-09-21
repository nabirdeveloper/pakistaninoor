'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  Heart,
  Share2,
  Minus,
  Plus,
  ShoppingCart,
  Truck,
  Shield,
  RefreshCw,
  Star,
  Check,
  ChevronLeft,
  ChevronDown,
  MessageSquare,
  Send,
  AlertCircle,
} from 'lucide-react';
import ProductCard from '@/components/store/ProductCard';
import RecommendationShelf from '@/components/store/RecommendationShelf';
import ReviewSummaryCard from '@/components/store/ReviewSummaryCard';
import ProductAlertBell from '@/components/store/ProductAlertBell';
import { recordRecentView } from '@/lib/store/recentViews';
import { cn } from '@/lib/utils';

interface ProductImage {
  url: string;
  publicId: string;
  alt?: string;
  isPrimary: boolean;
}

interface Variant {
  _id: string;
  sku: string;
  name: string;
  attributes: Record<string, string>;
  price: number;
  compareAtPrice?: number;
  stock: number;
  images: string[];
}

interface Review {
  _id: string;
  user: { name: string; avatar?: string };
  rating: number;
  title?: string;
  comment: string;
  images?: string[];
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  createdAt: string;
  reply?: string;
}

interface Question {
  _id: string;
  user: { name: string };
  question: string;
  answer?: string;
  answeredBy?: { name: string };
  answeredAt?: string;
  createdAt: string;
}

interface Product {
  _id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  brand?: string;
  category: { _id: string; name: string; slug: string };
  subcategory?: { _id: string; name: string; slug: string };
  tags: string[];
  price: number;
  compareAtPrice?: number;
  sku: string;
  stock: number;
  hasVariants: boolean;
  variantOptions?: Record<string, string[]>;
  variants: Variant[];
  images: ProductImage[];
  averageRating: number;
  totalReviews: number;
  reviews: Review[];
  questions: Question[];
  relatedProducts: Array<{
    _id: string;
    name: string;
    slug: string;
    price: number;
    compareAtPrice?: number;
    images: ProductImage[];
    averageRating: number;
    totalReviews: number;
    badges: string[];
    isNewArrival: boolean;
    isBestSeller: boolean;
    isOnSale: boolean;
  }>;
  frequentlyBoughtWith: Array<{
    _id: string;
    name: string;
    slug: string;
    price: number;
    compareAtPrice?: number;
    images: ProductImage[];
    averageRating: number;
    totalReviews: number;
    badges: string[];
    isNewArrival: boolean;
    isBestSeller: boolean;
    isOnSale: boolean;
  }>;
  isNewArrival: boolean;
  isBestSeller: boolean;
  isOnSale: boolean;
  badges: string[];
}

export default function ProductDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { data: session, status: sessionStatus } = useSession();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [activeTab, setActiveTab] = useState<'description' | 'reviews' | 'questions'>('description');
  const [showAllReviews, setShowAllReviews] = useState(false);

  // Ask-a-question state
  const [questionText, setQuestionText] = useState('');
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  const [questionNotice, setQuestionNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (slug) {
      fetchProduct();
    }
  }, [slug]);

  const fetchProduct = async () => {
    try {
      const response = await fetch(`/api/products/${slug}`);
      const data = await response.json();
      setProduct(data.product);

      // Personalization: track this view locally for guest recommendations
      // (signed-in views are recorded server-side by /api/products/[slug])
      if (data.product?._id) {
        recordRecentView(String(data.product._id));
      }

      // Set initial variant if product has variants
      if (data.product?.hasVariants && data.product?.variants?.length > 0) {
        setSelectedVariant(data.product.variants[0]);
        if (data.product.variants[0].attributes) {
          setSelectedAttributes(data.product.variants[0].attributes);
        }
      }
    } catch (error) {
      console.error('Failed to fetch product:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAskQuestion = async () => {
    const text = questionText.trim();
    if (text.length < 3) {
      setQuestionNotice({ type: 'error', text: 'Please enter a question (at least 3 characters).' });
      return;
    }
    if (text.length > 500) {
      setQuestionNotice({ type: 'error', text: 'Please keep your question under 500 characters.' });
      return;
    }
    setSubmittingQuestion(true);
    setQuestionNotice(null);
    try {
      const response = await fetch(`/api/products/${slug}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      });
      const data = await response.json();
      if (!response.ok) {
        setQuestionNotice({ type: 'error', text: data.error || 'Could not submit your question.' });
        return;
      }
      setQuestionText('');
      setQuestionNotice({
        type: 'success',
        text: data.isAutoAnswered
          ? 'Question submitted — our AI assistant answered it instantly.'
          : 'Question submitted — our team will answer it shortly.',
      });
      // Refresh so the new question (and any auto-answer) appears immediately
      await fetchProduct();
    } catch (error) {
      console.error('Failed to submit question:', error);
      setQuestionNotice({ type: 'error', text: 'Network error — please try again.' });
    } finally {
      setSubmittingQuestion(false);
    }
  };

  const handleAttributeChange = (attributeName: string, value: string) => {
    const newAttributes = { ...selectedAttributes, [attributeName]: value };
    setSelectedAttributes(newAttributes);

    // Find matching variant
    if (product?.variants) {
      const matchingVariant = product.variants.find((variant) => {
        return Object.entries(newAttributes).every(
          ([key, val]) => variant.attributes[key] === val
        );
      });
      if (matchingVariant) {
        setSelectedVariant(matchingVariant);
      }
    }
  };

  const currentPrice = selectedVariant?.price || product?.price || 0;
  const currentCompareAtPrice = selectedVariant?.compareAtPrice || product?.compareAtPrice;
  const currentStock = selectedVariant?.stock ?? product?.stock ?? 0;
  const isInStock = currentStock > 0;

  const handleAddToCart = async () => {
    if (!product || !isInStock) return;

    setAddingToCart(true);
    try {
      await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product._id,
          variantId: selectedVariant?._id,
          quantity,
        }),
      });
      window.dispatchEvent(new CustomEvent('cart-updated'));
    } catch (error) {
      console.error('Failed to add to cart:', error);
    } finally {
      setAddingToCart(false);
    }
  };

  const discountPercentage =
    currentCompareAtPrice && currentCompareAtPrice > currentPrice
      ? Math.round(((currentCompareAtPrice - currentPrice) / currentCompareAtPrice) * 100)
      : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="aspect-square bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />
            <div className="space-y-4">
              <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-3/4 animate-pulse" />
              <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-1/4 animate-pulse" />
              <div className="h-24 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Product not found
          </h1>
          <Link href="/products" className="text-primary hover:underline">
            Browse all products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Breadcrumb */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/" className="text-gray-500 hover:text-primary">Home</Link>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <Link href="/products" className="text-gray-500 hover:text-primary">Products</Link>
            {product.category && (
              <>
                <ChevronRight className="h-4 w-4 text-gray-400" />
                <Link
                  href={`/category/${product.category.slug}`}
                  className="text-gray-500 hover:text-primary"
                >
                  {product.category.name}
                </Link>
              </>
            )}
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <span className="text-gray-900 dark:text-white font-medium truncate">
              {product.name}
            </span>
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Images */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="relative aspect-square bg-white dark:bg-gray-800 rounded-xl overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.img
                  key={selectedImage}
                  src={product.images[selectedImage]?.url || '/images/placeholder-product.png'}
                  alt={product.name}
                  className="w-full h-full object-contain"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
              </AnimatePresence>

              {/* Badges */}
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                {product.isNewArrival && (
                  <span className="px-3 py-1 text-xs font-medium bg-blue-500 text-white rounded-full">
                    New
                  </span>
                )}
                {product.isBestSeller && (
                  <span className="px-3 py-1 text-xs font-medium bg-orange-500 text-white rounded-full">
                    Best Seller
                  </span>
                )}
                {discountPercentage > 0 && (
                  <span className="px-3 py-1 text-xs font-medium bg-red-500 text-white rounded-full">
                    -{discountPercentage}%
                  </span>
                )}
              </div>

              {/* Navigation Arrows */}
              {product.images.length > 1 && (
                <>
                  <button
                    onClick={() => setSelectedImage((prev) => (prev === 0 ? product.images.length - 1 : prev - 1))}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 shadow hover:bg-white transition-colors"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setSelectedImage((prev) => (prev === product.images.length - 1 ? 0 : prev + 1))}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 shadow hover:bg-white transition-colors"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {product.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={cn(
                      'flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors',
                      selectedImage === index
                        ? 'border-primary'
                        : 'border-transparent hover:border-gray-300'
                    )}
                  >
                    <img
                      src={image.url}
                      alt={`${product.name} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Title & Rating */}
            <div>
              {product.brand && (
                <p className="text-sm text-primary font-medium mb-1">{product.brand}</p>
              )}
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                {product.name}
              </h1>

              {product.totalReviews > 0 && (
                <div className="flex items-center gap-2 mt-3">
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          'h-4 w-4',
                          i < Math.round(product.averageRating)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'fill-gray-200 text-gray-200'
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-gray-500">
                    {product.averageRating.toFixed(1)} ({product.totalReviews} reviews)
                  </span>
                </div>
              )}
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">
                ৳{currentPrice.toLocaleString()}
              </span>
              {currentCompareAtPrice && currentCompareAtPrice > currentPrice && (
                <>
                  <span className="text-xl text-gray-500 line-through">
                    ৳{currentCompareAtPrice.toLocaleString()}
                  </span>
                  <span className="px-2 py-1 bg-red-100 text-red-600 text-sm font-medium rounded">
                    Save ৳{(currentCompareAtPrice - currentPrice).toLocaleString()}
                  </span>
                </>
              )}
            </div>

            {/* Short Description */}
            {product.shortDescription && (
              <p className="text-gray-600 dark:text-gray-400">
                {product.shortDescription}
              </p>
            )}

            {/* Variants */}
            {product.hasVariants && product.variantOptions && (
              <div className="space-y-4">
                {Object.entries(product.variantOptions).map(([attributeName, options]) => (
                  <div key={attributeName}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {attributeName}: <span className="text-gray-900 dark:text-white">{selectedAttributes[attributeName]}</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(options as string[]).map((option) => (
                        <button
                          key={option}
                          onClick={() => handleAttributeChange(attributeName, option)}
                          className={cn(
                            'px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors',
                            selectedAttributes[attributeName] === option
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                          )}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Stock Status */}
            <div className="flex items-center gap-2">
              {isInStock ? (
                <>
                  <Check className="h-5 w-5 text-green-500" />
                  <span className="text-green-600 font-medium">In Stock</span>
                  {currentStock <= 10 && (
                    <span className="text-orange-500 text-sm">
                      (Only {currentStock} left)
                    </span>
                  )}
                </>
              ) : (
                <span className="text-red-500 font-medium">Out of Stock</span>
              )}
            </div>

            {/* Product alerts */}
            {product._id && (
              <ProductAlertBell
                productId={String(product._id)}
                slug={product.slug}
                price={currentPrice}
                outOfStock={!isInStock}
              />
            )}

            {/* Quantity & Add to Cart */}
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Quantity */}
              <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-12 text-center font-medium">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => Math.min(currentStock, q + 1))}
                  disabled={quantity >= currentStock}
                  className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {/* Add to Cart */}
              <button
                onClick={handleAddToCart}
                disabled={!isInStock || addingToCart}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-lg font-medium transition-colors',
                  isInStock
                    ? 'bg-primary text-white hover:bg-primary/90'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                )}
              >
                {addingToCart ? (
                  <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <>
                    <ShoppingCart className="h-5 w-5" />
                    Add to Cart
                  </>
                )}
              </button>

              {/* Wishlist */}
              <button
                onClick={() => setIsWishlisted(!isWishlisted)}
                className={cn(
                  'p-3 rounded-lg border transition-colors',
                  isWishlisted
                    ? 'border-red-500 bg-red-50 text-red-500'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                )}
              >
                <Heart className={cn('h-5 w-5', isWishlisted && 'fill-current')} />
              </button>

              {/* Share */}
              <button className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 transition-colors">
                <Share2 className="h-5 w-5" />
              </button>
            </div>

            {/* Features */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="text-center">
                <Truck className="h-6 w-6 mx-auto text-primary mb-2" />
                <p className="text-xs text-gray-500">Free Delivery</p>
              </div>
              <div className="text-center">
                <Shield className="h-6 w-6 mx-auto text-primary mb-2" />
                <p className="text-xs text-gray-500">Secure Payment</p>
              </div>
              <div className="text-center">
                <RefreshCw className="h-6 w-6 mx-auto text-primary mb-2" />
                <p className="text-xs text-gray-500">7-Day Return</p>
              </div>
            </div>

            {/* SKU */}
            <p className="text-sm text-gray-500">
              SKU: {selectedVariant?.sku || product.sku}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-12">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex gap-8">
              {['description', 'reviews', 'questions'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as 'description' | 'reviews' | 'questions')}
                  className={cn(
                    'pb-4 text-sm font-medium border-b-2 transition-colors capitalize',
                    activeTab === tab
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  )}
                >
                  {tab}
                  {tab === 'reviews' && product.totalReviews > 0 && (
                    <span className="ml-1">({product.totalReviews})</span>
                  )}
                  {tab === 'questions' && product.questions?.length > 0 && (
                    <span className="ml-1">({product.questions.length})</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="py-8">
            {activeTab === 'description' && (
              <div
                className="prose prose-gray dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-6">
                {product._id && product.reviews?.length > 0 && (
                  <ReviewSummaryCard productId={String(product._id)} productName={product.name} />
                )}
                {product.reviews?.length > 0 ? (
                  <>
                    {product.reviews
                      .slice(0, showAllReviews ? undefined : 5)
                      .map((review) => (
                        <div
                          key={review._id}
                          className="bg-white dark:bg-gray-800 rounded-xl p-6"
                        >
                          <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              {review.user.avatar ? (
                                <img
                                  src={review.user.avatar}
                                  alt={review.user.name}
                                  className="w-10 h-10 rounded-full object-cover"
                                />
                              ) : (
                                <span className="text-primary font-medium">
                                  {review.user.name.charAt(0)}
                                </span>
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-gray-900 dark:text-white">
                                  {review.user.name}
                                </span>
                                {review.isVerifiedPurchase && (
                                  <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded">
                                    Verified Purchase
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mb-2">
                                <div className="flex">
                                  {[...Array(5)].map((_, i) => (
                                    <Star
                                      key={i}
                                      className={cn(
                                        'h-4 w-4',
                                        i < review.rating
                                          ? 'fill-yellow-400 text-yellow-400'
                                          : 'fill-gray-200 text-gray-200'
                                      )}
                                    />
                                  ))}
                                </div>
                                <span className="text-sm text-gray-500">
                                  {new Date(review.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                              {review.title && (
                                <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                                  {review.title}
                                </h4>
                              )}
                              <p className="text-gray-600 dark:text-gray-400">
                                {review.comment}
                              </p>
                              {review.reply && (
                                <div className="mt-3 rounded-lg bg-primary/5 p-4 border-l-2 border-primary">
                                  <p className="text-sm font-medium text-primary">
                                    Reply from seller
                                  </p>
                                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                    {review.reply}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    {product.reviews.length > 5 && !showAllReviews && (
                      <button
                        onClick={() => setShowAllReviews(true)}
                        className="text-primary hover:underline font-medium"
                      >
                        Show all {product.reviews.length} reviews
                      </button>
                    )}
                  </>
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    No reviews yet. Be the first to review this product!
                  </p>
                )}
              </div>
            )}

            {activeTab === 'questions' && (
              <div className="space-y-6">
                {/* Ask a question */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                    Ask a question
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Common questions are answered instantly by our AI assistant;
                    the rest reach our team for a personal reply.
                  </p>
                  {sessionStatus === 'loading' ? null : session?.user ? (
                    <>
                      <textarea
                        value={questionText}
                        onChange={(e) => setQuestionText(e.target.value)}
                        maxLength={500}
                        rows={3}
                        placeholder={`Ask about ${product?.name || 'this product'} — e.g. "Is it in stock?"`}
                        className="w-full rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      />
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <span className="text-xs text-gray-400">
                          {questionText.length}/500
                        </span>
                        <button
                          onClick={handleAskQuestion}
                          disabled={submittingQuestion}
                          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                        >
                          <Send className="h-4 w-4" />
                          {submittingQuestion ? 'Submitting…' : 'Ask question'}
                        </button>
                      </div>
                      {questionNotice && (
                        <p
                          className={
                            questionNotice.type === 'success'
                              ? 'mt-3 flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400'
                              : 'mt-3 flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400'
                          }
                        >
                          {questionNotice.type === 'success' ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <AlertCircle className="h-4 w-4" />
                          )}
                          {questionNotice.text}
                        </p>
                      )}
                    </>
                  ) : (
                    <Link
                      href={`/auth/login?redirect=/product/${slug}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/10"
                    >
                      <MessageSquare className="h-4 w-4" />
                      Sign in to ask a question
                    </Link>
                  )}
                </div>

                {product.questions?.length > 0 ? (
                  product.questions.map((q) => (
                    <div
                      key={q._id}
                      className="bg-white dark:bg-gray-800 rounded-xl p-6"
                    >
                      <div className="flex items-start gap-3">
                        <MessageSquare className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {q.question}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            Asked by {q.user.name} on{' '}
                            {new Date(q.createdAt).toLocaleDateString()}
                            {!q.answer && (
                              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                <AlertCircle className="h-3 w-3" /> Awaiting answer
                              </span>
                            )}
                          </p>
                          {q.answer && (
                            <div className="mt-3 pl-4 border-l-2 border-primary">
                              <p className="text-gray-600 dark:text-gray-400">
                                {q.answer}
                              </p>
                              <p className="text-sm text-gray-500 mt-1">
                                {q.answeredBy?.name
                                  ? `Answered by ${q.answeredBy.name}`
                                  : 'Answered by AI assistant'}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    No questions yet. Ask a question about this product!
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Related Products */}
        {product.relatedProducts?.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Related Products
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {product.relatedProducts.slice(0, 4).map((relatedProduct) => (
                <ProductCard key={relatedProduct._id} product={relatedProduct} />
              ))}
            </div>
          </div>
        )}

        {/* Frequently Bought Together */}
        {product._id && (
          <RecommendationShelf
            mode="frequently-bought"
            productId={String(product._id)}
            limit={4}
            className="mt-12"
          />
        )}

        {/* You May Also Like */}
        {product._id && (
          <RecommendationShelf
            mode="related"
            productId={String(product._id)}
            limit={4}
            className="mt-4"
          />
        )}
      </div>
    </div>
  );
}
