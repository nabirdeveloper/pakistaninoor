'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  Trash2,
  ShoppingCart,
  Share2,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WishlistItem {
  _id: string;
  name: string;
  slug: string;
  price: number;
  compareAtPrice?: number;
  images: Array<{ url: string; isPrimary: boolean }>;
  stockStatus: string;
  averageRating: number;
}

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);

  useEffect(() => {
    fetchWishlist();
  }, []);

  const fetchWishlist = async () => {
    try {
      const response = await fetch('/api/user/wishlist');
      const data = await response.json();
      setItems(data.items || []);
    } catch (error) {
      console.error('Failed to fetch wishlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeFromWishlist = async (productId: string) => {
    setRemoving(productId);
    try {
      await fetch(`/api/user/wishlist?productId=${productId}`, {
        method: 'DELETE',
      });
      setItems(items.filter((item) => item._id !== productId));
    } catch (error) {
      console.error('Failed to remove from wishlist:', error);
    } finally {
      setRemoving(null);
    }
  };

  const addToCart = async (productId: string) => {
    setAddingToCart(productId);
    try {
      await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity: 1 }),
      });
      window.dispatchEvent(new CustomEvent('cart-updated'));
    } catch (error) {
      console.error('Failed to add to cart:', error);
    } finally {
      setAddingToCart(null);
    }
  };

  const shareWishlist = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Wishlist - Pakistani Noor',
          text: 'Check out my wishlist!',
          url: window.location.href,
        });
      } catch (error) {
        console.error('Failed to share:', error);
      }
    }
  };

  const getImage = (item: WishlistItem) => {
    const primary = item.images.find((img) => img.isPrimary);
    return primary?.url || item.images[0]?.url || '/images/placeholder-product.png';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-1/4 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-80 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Wishlist</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {items.length} {items.length === 1 ? 'item' : 'items'} saved
          </p>
        </div>
        {items.length > 0 && (
          <button
            onClick={shareWishlist}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
        )}
      </div>

      {/* Wishlist Grid */}
      {items.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center">
          <Heart className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Your wishlist is empty
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Save items you love by clicking the heart icon on products
          </p>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Browse Products
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {items.map((item) => (
              <motion.div
                key={item._id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden group"
              >
                {/* Image */}
                <Link href={`/product/${item.slug}`} className="block relative aspect-square">
                  <img
                    src={getImage(item)}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {item.compareAtPrice && item.compareAtPrice > item.price && (
                    <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-medium px-2 py-1 rounded">
                      {Math.round(((item.compareAtPrice - item.price) / item.compareAtPrice) * 100)}% OFF
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      removeFromWishlist(item._id);
                    }}
                    disabled={removing === item._id}
                    className="absolute top-3 right-3 p-2 bg-white dark:bg-gray-800 rounded-full shadow-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    {removing === item._id ? (
                      <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    ) : (
                      <Trash2 className="h-5 w-5 text-red-500" />
                    )}
                  </button>
                </Link>

                {/* Content */}
                <div className="p-4">
                  <Link
                    href={`/product/${item.slug}`}
                    className="font-medium text-gray-900 dark:text-white hover:text-primary line-clamp-2"
                  >
                    {item.name}
                  </Link>

                  {/* Rating */}
                  {item.averageRating > 0 && (
                    <div className="flex items-center gap-1 mt-2">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          className={cn(
                            'h-4 w-4',
                            i < Math.round(item.averageRating)
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-gray-300'
                          )}
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      ))}
                      <span className="text-sm text-gray-500 ml-1">
                        ({item.averageRating.toFixed(1)})
                      </span>
                    </div>
                  )}

                  {/* Price */}
                  <div className="flex items-center gap-2 mt-3">
                    <span className="font-bold text-lg text-gray-900 dark:text-white">
                      ৳{item.price.toLocaleString()}
                    </span>
                    {item.compareAtPrice && item.compareAtPrice > item.price && (
                      <span className="text-sm text-gray-500 line-through">
                        ৳{item.compareAtPrice.toLocaleString()}
                      </span>
                    )}
                  </div>

                  {/* Stock Status */}
                  <p
                    className={cn(
                      'text-sm mt-2',
                      item.stockStatus === 'in_stock' ? 'text-green-500' : 'text-red-500'
                    )}
                  >
                    {item.stockStatus === 'in_stock' ? 'In Stock' : 'Out of Stock'}
                  </p>

                  {/* Add to Cart */}
                  <button
                    onClick={() => addToCart(item._id)}
                    disabled={item.stockStatus !== 'in_stock' || addingToCart === item._id}
                    className={cn(
                      'w-full mt-4 flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition-colors',
                      item.stockStatus === 'in_stock'
                        ? 'bg-primary text-white hover:bg-primary/90'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                    )}
                  >
                    {addingToCart === item._id ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <ShoppingCart className="h-5 w-5" />
                        Add to Cart
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
