'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ArrowRight,
  Truck,
  Shield,
  RefreshCw,
  Headphones,
  ChevronLeft,
  ChevronRight,
  Star,
} from 'lucide-react';
import ProductCard from '@/components/store/ProductCard';
import RecommendationShelf from '@/components/store/RecommendationShelf';
import { cn } from '@/lib/utils';

gsap.registerPlugin(ScrollTrigger);

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
}

interface Banner {
  _id: string;
  title?: string;
  subtitle?: string;
  description?: string;
  buttonText?: string;
  buttonLink?: string;
  imageDesktop: string;
  imageMobile?: string;
}

interface Category {
  _id: string;
  name: string;
  slug: string;
  image?: string;
  productCount: number;
}

const features = [
  {
    icon: Truck,
    title: 'Free Shipping',
    description: 'On orders over ৳3,000',
  },
  {
    icon: Shield,
    title: 'Secure Payment',
    description: '100% secure checkout',
  },
  {
    icon: RefreshCw,
    title: 'Easy Returns',
    description: '7-day return policy',
  },
  {
    icon: Headphones,
    title: '24/7 Support',
    description: 'Dedicated support team',
  },
];

export default function HomePage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [bestSellers, setBestSellers] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);

  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(featuresRef, { once: true });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // GSAP animations
    if (heroRef.current) {
      gsap.fromTo(
        heroRef.current.querySelectorAll('.hero-text'),
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          stagger: 0.2,
          ease: 'power3.out',
        }
      );
    }

    // Auto-slide banner
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % Math.max(banners.length, 1));
    }, 5000);

    return () => clearInterval(interval);
  }, [banners.length]);

  const fetchData = async () => {
    try {
      const [bannersRes, featuredRes, newArrivalsRes, bestSellersRes, categoriesRes] =
        await Promise.all([
          fetch('/api/banners?position=homepage_hero'),
          fetch('/api/products?featured=true&limit=8'),
          fetch('/api/products?newArrivals=true&limit=8'),
          fetch('/api/products?bestSellers=true&limit=8'),
          fetch('/api/categories?featured=true'),
        ]);

      const [bannersData, featuredData, newArrivalsData, bestSellersData, categoriesData] =
        await Promise.all([
          bannersRes.json(),
          featuredRes.json(),
          newArrivalsRes.json(),
          bestSellersRes.json(),
          categoriesRes.json(),
        ]);

      setBanners(bannersData.banners || []);
      setFeaturedProducts(featuredData.products || []);
      setNewArrivals(newArrivalsData.products || []);
      setBestSellers(bestSellersData.products || []);
      setCategories(categoriesData.categories || []);
    } catch (error) {
      console.error('Failed to fetch homepage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % banners.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + banners.length) % banners.length);
  };

  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section ref={heroRef} className="relative bg-gray-100 dark:bg-gray-900">
        <div className="relative h-[500px] md:h-[600px] lg:h-[700px]">
          {banners.length > 0 ? (
            banners.map((banner, index) => (
              <motion.div
                key={banner._id}
                className={cn(
                  'absolute inset-0 transition-opacity duration-700',
                  index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'
                )}
              >
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${banner.imageDesktop})`,
                  }}
                >
                  <div className="absolute inset-0 bg-black/40" />
                </div>
                <div className="container mx-auto px-4 h-full flex items-center relative z-10">
                  <div className="max-w-xl text-white">
                    {banner.subtitle && (
                      <p className="hero-text text-sm md:text-base uppercase tracking-wider mb-2">
                        {banner.subtitle}
                      </p>
                    )}
                    {banner.title && (
                      <h1 className="hero-text text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
                        {banner.title}
                      </h1>
                    )}
                    {banner.description && (
                      <p className="hero-text text-lg md:text-xl mb-6 text-gray-200">
                        {banner.description}
                      </p>
                    )}
                    {banner.buttonText && banner.buttonLink && (
                      <Link
                        href={banner.buttonLink}
                        className="hero-text inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-lg font-medium transition-colors"
                      >
                        {banner.buttonText}
                        <ArrowRight className="h-5 w-5" />
                      </Link>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary/80">
              <div className="container mx-auto px-4 h-full flex items-center">
                <div className="max-w-xl text-white">
                  <p className="hero-text text-sm md:text-base uppercase tracking-wider mb-2">
                    Welcome to
                  </p>
                  <h1 className="hero-text text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
                    Pakistani Noor
                  </h1>
                  <p className="hero-text text-lg md:text-xl mb-6 text-gray-200">
                    Discover amazing products at incredible prices. Shop the
                    latest trends with fast delivery across Bangladesh.
                  </p>
                  <Link
                    href="/products"
                    className="hero-text inline-flex items-center gap-2 bg-white text-primary hover:bg-gray-100 px-8 py-3 rounded-lg font-medium transition-colors"
                  >
                    Shop Now
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Slider Controls */}
          {banners.length > 1 && (
            <>
              <button
                onClick={prevSlide}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={nextSlide}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
                {banners.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    className={cn(
                      'w-3 h-3 rounded-full transition-colors',
                      index === currentSlide
                        ? 'bg-white'
                        : 'bg-white/50 hover:bg-white/70'
                    )}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Features */}
      <section ref={featuresRef} className="py-8 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-4 p-4"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="py-12 md:py-16 bg-gray-50 dark:bg-gray-900/50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                Shop by Category
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mt-2">
                Browse our popular categories
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {categories.map((category, index) => (
                <motion.div
                  key={category._id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  viewport={{ once: true }}
                >
                  <Link
                    href={`/category/${category.slug}`}
                    className="group block bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="aspect-square relative overflow-hidden bg-gray-100 dark:bg-gray-700">
                      {category.image ? (
                        <img
                          src={category.image}
                          alt={category.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-gray-300">
                          {category.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="p-4 text-center">
                      <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-primary transition-colors">
                        {category.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {category.productCount} products
                      </p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured Products */}
      {featuredProducts.length > 0 && (
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                  Featured Products
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  Handpicked products just for you
                </p>
              </div>
              <Link
                href="/products?featured=true"
                className="hidden sm:inline-flex items-center gap-1 text-primary hover:underline font-medium"
              >
                View All <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {featuredProducts.map((product, index) => (
                <motion.div
                  key={product._id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  viewport={{ once: true }}
                >
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </div>
            <div className="mt-8 text-center sm:hidden">
              <Link
                href="/products?featured=true"
                className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
              >
                View All <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* AI Recommended for You */}
      <RecommendationShelf
        mode="for-you"
        limit={8}
        useLocalRecent
        subtitle="Personalized picks from your browsing history"
        className="bg-gray-50 dark:bg-gray-900/50"
      />

      {/* Promotional Banner */}
      <section className="py-12 md:py-16 bg-primary">
        <div className="container mx-auto px-4">
          <div className="text-center text-white">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Get 20% Off Your First Order
            </h2>
            <p className="text-lg text-white/80 mb-6 max-w-2xl mx-auto">
              Sign up for our newsletter and get an exclusive 20% discount on your first purchase. Don&apos;t miss out on this special offer!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white"
              />
              <button className="bg-white text-primary px-6 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors">
                Subscribe
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* New Arrivals */}
      {newArrivals.length > 0 && (
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                  New Arrivals
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  Check out our latest products
                </p>
              </div>
              <Link
                href="/products?newArrivals=true"
                className="hidden sm:inline-flex items-center gap-1 text-primary hover:underline font-medium"
              >
                View All <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {newArrivals.map((product, index) => (
                <motion.div
                  key={product._id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  viewport={{ once: true }}
                >
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Best Sellers */}
      {bestSellers.length > 0 && (
        <section className="py-12 md:py-16 bg-gray-50 dark:bg-gray-900/50">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                  Best Sellers
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  Our most popular products
                </p>
              </div>
              <Link
                href="/products?bestSellers=true"
                className="hidden sm:inline-flex items-center gap-1 text-primary hover:underline font-medium"
              >
                View All <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {bestSellers.map((product, index) => (
                <motion.div
                  key={product._id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  viewport={{ once: true }}
                >
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
