'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Heart, ShoppingCart, Eye, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Product {
  _id: string;
  name: string;
  slug: string;
  price: number;
  compareAtPrice?: number;
  images: Array<{ url: string; isPrimary: boolean }>;
  averageRating: number;
  totalReviews: number;
  badges: string[];
  isNewArrival: boolean;
  isBestSeller: boolean;
  isOnSale: boolean;
  stock?: number;
  hasVariants?: boolean;
  variants?: Array<{ stock: number }>;
}

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);

  const primaryImage =
    product.images?.find((img) => img.isPrimary) || product.images?.[0];
  const secondaryImage =
    product.images?.length > 1
      ? product.images.find((img) => !img.isPrimary)
      : null;

  const discountPercentage =
    product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round(
          ((product.compareAtPrice - product.price) / product.compareAtPrice) *
            100
        )
      : 0;

  const isInStock = product.hasVariants
    ? product.variants?.some((v) => v.stock > 0)
    : (product.stock || 0) > 0;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsAddingToCart(true);
    try {
      await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product._id, quantity: 1 }),
      });
      // Trigger cart update event
      window.dispatchEvent(new CustomEvent('cart-updated'));
    } catch (error) {
      console.error('Failed to add to cart:', error);
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsWishlisted(!isWishlisted);
    // TODO: Implement wishlist API call
  };

  return (
    <motion.div
      className="group relative bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-300"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ y: -5 }}
      transition={{ duration: 0.2 }}
    >
      <Link href={`/product/${product.slug}`}>
        {/* Image Container */}
        <div className="relative aspect-square overflow-hidden bg-gray-100 dark:bg-gray-700">
          {/* Primary Image */}
          <img
            src={primaryImage?.url || '/images/placeholder-product.png'}
            alt={product.name}
            className={cn(
              'w-full h-full object-cover transition-opacity duration-500',
              isHovered && secondaryImage ? 'opacity-0' : 'opacity-100'
            )}
          />

          {/* Secondary Image (on hover) */}
          {secondaryImage && (
            <img
              src={secondaryImage.url}
              alt={product.name}
              className={cn(
                'absolute inset-0 w-full h-full object-cover transition-opacity duration-500',
                isHovered ? 'opacity-100' : 'opacity-0'
              )}
            />
          )}

          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {product.isNewArrival && (
              <span className="px-2 py-1 text-xs font-medium bg-blue-500 text-white rounded">
                New
              </span>
            )}
            {product.isBestSeller && (
              <span className="px-2 py-1 text-xs font-medium bg-orange-500 text-white rounded">
                Best Seller
              </span>
            )}
            {discountPercentage > 0 && (
              <span className="px-2 py-1 text-xs font-medium bg-red-500 text-white rounded">
                -{discountPercentage}%
              </span>
            )}
            {!isInStock && (
              <span className="px-2 py-1 text-xs font-medium bg-gray-500 text-white rounded">
                Out of Stock
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div
            className={cn(
              'absolute top-2 right-2 flex flex-col gap-2 transition-all duration-300',
              isHovered
                ? 'opacity-100 translate-x-0'
                : 'opacity-0 translate-x-4'
            )}
          >
            <button
              onClick={handleWishlist}
              className={cn(
                'p-2 rounded-full bg-white shadow-md hover:bg-gray-100 transition-colors',
                isWishlisted && 'bg-red-50'
              )}
            >
              <Heart
                className={cn(
                  'h-4 w-4',
                  isWishlisted
                    ? 'fill-red-500 text-red-500'
                    : 'text-gray-600'
                )}
              />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                router.push(`/product/${product.slug}`);
              }}
              aria-label={`View ${product.name}`}
              className="p-2 rounded-full bg-white shadow-md hover:bg-gray-100 transition-colors"
            >
              <Eye className="h-4 w-4 text-gray-600" />
            </button>
          </div>

          {/* Quick Add to Cart */}
          <div
            className={cn(
              'absolute bottom-0 left-0 right-0 p-3 transition-all duration-300',
              isHovered
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-4'
            )}
          >
            <button
              onClick={handleAddToCart}
              disabled={!isInStock || isAddingToCart}
              className={cn(
                'w-full py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2',
                isInStock
                  ? 'bg-primary text-white hover:bg-primary/90'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              )}
            >
              {isAddingToCart ? (
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4" />
                  {isInStock ? 'Add to Cart' : 'Out of Stock'}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Product Info */}
        <div className="p-4">
          {/* Rating */}
          {product.totalReviews > 0 && (
            <div className="flex items-center gap-1 mb-2">
              <div className="flex items-center">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      'h-3 w-3',
                      i < Math.round(product.averageRating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'fill-gray-200 text-gray-200'
                    )}
                  />
                ))}
              </div>
              <span className="text-xs text-gray-500">
                ({product.totalReviews})
              </span>
            </div>
          )}

          {/* Name */}
          <h3 className="font-medium text-gray-900 dark:text-white line-clamp-2 group-hover:text-primary transition-colors">
            {product.name}
          </h3>

          {/* Price */}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              ৳{product.price.toLocaleString()}
            </span>
            {product.compareAtPrice && product.compareAtPrice > product.price && (
              <span className="text-sm text-gray-500 line-through">
                ৳{product.compareAtPrice.toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
