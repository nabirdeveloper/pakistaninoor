'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  ShoppingCart,
  Heart,
  User,
  Menu,
  X,
  ChevronDown,
  LogOut,
  Package,
  Settings,
  Phone,
  FolderOpen,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import NotificationBell from '@/components/store/NotificationBell';

interface Category {
  _id: string;
  name: string;
  slug: string;
  children?: Category[];
}

interface SearchSuggestion {
  type: 'product' | 'category' | 'query';
  text: string;
  score: number;
  id?: string;
  slug?: string;
}

export default function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [scrolled, setScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // AI search suggestions state
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [didYouMean, setDidYouMean] = useState<string | null>(null);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Debounced AI autocomplete as the user types
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const query = searchQuery.trim().toLowerCase();
    // Clear stale results from the previous keystroke immediately.
    setSuggestions([]);
    setActiveIndex(-1);
    if (!searchOpen || query.length < 2) {
      setDidYouMean(null);
      setSuggestionsLoaded(false);
      return;
    }

    setSuggestionsLoaded(false);
    debounceRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search/suggestions?q=${encodeURIComponent(query)}&limit=8`
        );
        const data = await response.json();
        setSuggestions(data.suggestions || []);
        setDidYouMean(
          data.didYouMean &&
            data.didYouMean.toLowerCase() !== query &&
            !(data.suggestions || []).some(
              (s: SearchSuggestion) =>
                s.type === 'query' && s.text.toLowerCase() === data.didYouMean.toLowerCase()
            )
            ? data.didYouMean
            : null
        );
        setActiveIndex(-1);
      } catch {
        setSuggestions([]);
        setDidYouMean(null);
      } finally {
        setSuggestionsLoaded(true);
      }
    }, 250);
  }, [searchQuery, searchOpen]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchCartCount();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories?showInMenu=true');
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchCartCount = async () => {
    try {
      const response = await fetch('/api/cart');
      const data = await response.json();
      setCartCount(data.cart?.itemCount || 0);
    } catch (error) {
      console.error('Failed to fetch cart:', error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchOpen(false);
      setSuggestions([]);
      setDidYouMean(null);
    }
  };

  const suggestionItems = buildSuggestionItems(suggestions, didYouMean);

  const selectSuggestion = (item: { type: 'product' | 'category' | 'query' | 'didyoumean'; text: string; slug?: string }) => {
    if (item.type === 'product' && item.slug) {
      router.push(`/product/${item.slug}`);
    } else if (item.type === 'category' && item.slug) {
      router.push(`/category/${item.slug}`);
    } else {
      router.push(`/search?q=${encodeURIComponent(item.text)}`);
    }
    setSearchOpen(false);
    setSuggestions([]);
    setDidYouMean(null);
    setSearchQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, suggestionItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      const item = suggestionItems[activeIndex];
      if (item) selectSuggestion(item);
    }
  };

  function buildSuggestionItems(
    suggs: SearchSuggestion[],
    dym: string | null
  ): Array<{ type: 'product' | 'category' | 'query' | 'didyoumean'; text: string; slug?: string }> {
    const items: Array<{ type: 'product' | 'category' | 'query' | 'didyoumean'; text: string; slug?: string }> = [];
    if (dym) items.push({ type: 'didyoumean', text: dym });
    for (const s of suggs) {
      if (items.length >= 8) break;
      items.push({ type: s.type, text: s.text, slug: s.slug });
    }
    return items;
  }

  return (
    <>
      {/* Top Bar */}
      <div className="bg-primary text-white text-sm py-2">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="tel:+8801700000000" className="flex items-center gap-1 hover:underline">
              <Phone className="h-3 w-3" />
              <span>+880 1700 000 000</span>
            </a>
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <span>Free shipping on orders over ৳3,000</span>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header
        className={cn(
          'sticky top-0 z-50 bg-white dark:bg-gray-900 transition-shadow duration-300',
          scrolled && 'shadow-md'
        )}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
            >
              <Menu className="h-6 w-6" />
            </button>

            {/* Logo */}
            <Link href="/" className="flex items-center">
              <span className="text-2xl font-bold text-primary">
                Pakistani Noor
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-8">
              <Link
                href="/"
                className={cn(
                  'text-sm font-medium transition-colors hover:text-primary',
                  pathname === '/'
                    ? 'text-primary'
                    : 'text-gray-700 dark:text-gray-200'
                )}
              >
                Home
              </Link>
              <Link
                href="/products"
                className={cn(
                  'text-sm font-medium transition-colors hover:text-primary',
                  pathname.startsWith('/products')
                    ? 'text-primary'
                    : 'text-gray-700 dark:text-gray-200'
                )}
              >
                Shop
              </Link>
              {categories.slice(0, 4).map((category) => (
                <div key={category._id} className="relative group">
                  <Link
                    href={`/category/${category.slug}`}
                    className={cn(
                      'flex items-center text-sm font-medium transition-colors hover:text-primary',
                      pathname.includes(category.slug)
                        ? 'text-primary'
                        : 'text-gray-700 dark:text-gray-200'
                    )}
                  >
                    {category.name}
                    {category.children && category.children.length > 0 && (
                      <ChevronDown className="h-4 w-4 ml-1" />
                    )}
                  </Link>
                  {category.children && category.children.length > 0 && (
                    <div className="absolute left-0 top-full pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 py-2 min-w-[200px]">
                        {category.children.map((child) => (
                          <Link
                            key={child._id}
                            href={`/category/${child.slug}`}
                            className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            {child.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Search */}
              <button
                onClick={() => setSearchOpen(true)}
                className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              >
                <Search className="h-5 w-5" />
              </button>

              {/* Wishlist */}
              <Link
                href="/account/wishlist"
                className="hidden sm:flex relative p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              >
                <Heart className="h-5 w-5" />
                {wishlistCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-white text-[10px] font-medium flex items-center justify-center">
                    {wishlistCount}
                  </span>
                )}
              </Link>

              {/* Cart */}
              <Link
                href="/cart"
                className="relative p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              >
                <ShoppingCart className="h-5 w-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-white text-[10px] font-medium flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </Link>

              {/* Notifications */}
              <NotificationBell />

              {/* User */}
              {session ? (
                <div className="relative">
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                  >
                    {session.user.image ? (
                      <img
                        src={session.user.image}
                        alt={session.user.name}
                        className="h-6 w-6 rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-5 w-5" />
                    )}
                  </button>

                  <AnimatePresence>
                    {profileOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setProfileOpen(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute right-0 z-20 mt-2 w-48 rounded-lg bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black/5 dark:ring-white/10"
                        >
                          <div className="p-3 border-b border-gray-100 dark:border-gray-700">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {session.user.name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {session.user.email}
                            </p>
                          </div>
                          <div className="py-1">
                            <Link
                              href="/account"
                              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              <User className="h-4 w-4" />
                              My Account
                            </Link>
                            <Link
                              href="/account/orders"
                              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              <Package className="h-4 w-4" />
                              My Orders
                            </Link>
                            {(session.user.role === 'admin' ||
                              session.user.role === 'superadmin') && (
                              <Link
                                href="/admin"
                                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                <Settings className="h-4 w-4" />
                                Admin Panel
                              </Link>
                            )}
                            <button
                              onClick={() => signOut()}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <LogOut className="h-4 w-4" />
                              Logout
                            </button>
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <Link
                  href="/auth/login"
                  className="hidden sm:inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Search Modal */}
      <AnimatePresence>
        {searchOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50"
              onClick={() => setSearchOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 p-4 shadow-lg"
            >
              <div className="container mx-auto">
                <form onSubmit={handleSearch} className="relative">
                  <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search products..."
                    autoFocus
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-3 pl-12 pr-12 text-gray-900 dark:text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setSearchOpen(false)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>

                  {/* AI Autocomplete Dropdown */}
                  {(suggestionItems.length > 0 ||
                    (searchQuery.trim().length >= 2 && !suggestionsLoaded)) && (
                    <div className="absolute top-full left-0 right-0 mt-2 rounded-xl bg-white dark:bg-gray-800 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 overflow-hidden z-50">
                      {searchQuery.trim().length >= 2 && !suggestionsLoaded && (
                        <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                          Searching…
                        </div>
                      )}

                      {suggestionItems.map((item, index) => {
                        const active = index === activeIndex;
                        return (
                          <button
                            key={`${item.type}:${item.text}`}
                            type="button"
                            onMouseEnter={() => setActiveIndex(index)}
                            onClick={() => selectSuggestion(item)}
                            className={cn(
                              'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                              active
                                ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                                : 'text-gray-700 dark:text-gray-200'
                            )}
                          >
                            {item.type === 'didyoumean' ? (
                              <>
                                <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
                                <span>
                                  Did you mean{' '}
                                  <span className="font-semibold text-primary">
                                    “{item.text}”
                                  </span>
                                  ?
                                </span>
                              </>
                            ) : item.type === 'product' ? (
                              <>
                                <Package className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                <span className="truncate">{item.text}</span>
                              </>
                            ) : item.type === 'category' ? (
                              <>
                                <FolderOpen className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                <span className="truncate">{item.text}</span>
                              </>
                            ) : (
                              <>
                                <TrendingUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                <span className="truncate">{item.text}</span>
                              </>
                            )}
                          </button>
                        );
                      })}

                      <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-2 text-[11px] uppercase tracking-wide text-gray-400">
                        <span className="flex items-center gap-1">
                          AI-powered search <Sparkles className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  )}
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 25 }}
              className="fixed inset-y-0 left-0 z-50 w-80 bg-white dark:bg-gray-900 lg:hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
                <span className="text-xl font-bold text-primary">
                  Pakistani Noor
                </span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 text-gray-500 hover:text-gray-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="p-4 space-y-2">
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-2 text-gray-700 dark:text-gray-200 hover:text-primary"
                >
                  Home
                </Link>
                <Link
                  href="/products"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-2 text-gray-700 dark:text-gray-200 hover:text-primary"
                >
                  Shop All
                </Link>
                {categories.map((category) => (
                  <Link
                    key={category._id}
                    href={`/category/${category.slug}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block py-2 text-gray-700 dark:text-gray-200 hover:text-primary"
                  >
                    {category.name}
                  </Link>
                ))}
                <hr className="my-4 border-gray-100 dark:border-gray-800" />
                {!session && (
                  <Link
                    href="/auth/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block py-2 text-primary font-medium"
                  >
                    Sign In
                  </Link>
                )}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
