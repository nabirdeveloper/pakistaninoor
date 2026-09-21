'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Tag,
  Ticket,
  FileText,
  Settings,
  Image,
  MessageSquare,
  BarChart3,
  Megaphone,
  Sparkles,
  ChevronDown,
  X,
  Store,
  Layers,
  Award,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface User {
  name: string;
  email: string;
  image?: string;
  role: string;
}

interface AdminSidebarProps {
  user: User;
}

const navigation = [
  {
    name: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    name: 'Products',
    icon: Package,
    children: [
      { name: 'All Products', href: '/admin/products' },
      { name: 'Add Product', href: '/admin/products/new' },
      { name: 'Categories', href: '/admin/categories' },
      { name: 'Inventory', href: '/admin/inventory' },
      { name: 'Product Q&A', href: '/admin/questions' },
    ],
  },
  {
    name: 'Orders',
    icon: ShoppingCart,
    children: [
      { name: 'All Orders', href: '/admin/orders' },
      { name: 'Pending', href: '/admin/orders?status=pending' },
      { name: 'Processing', href: '/admin/orders?status=processing' },
      { name: 'Returns', href: '/admin/orders?status=returned' },
    ],
  },
  {
    name: 'Customers',
    icon: Users,
    children: [
      { name: 'All Customers', href: '/admin/customers' },
      { name: 'Reviews', href: '/admin/reviews' },
      { name: 'Support Tickets', href: '/admin/support-triage' },
    ],
  },
  {
    name: 'Marketing',
    icon: Megaphone,
    children: [
      { name: 'Coupons', href: '/admin/coupons' },
      { name: 'Campaigns', href: '/admin/campaigns' },
      { name: 'Referrals', href: '/admin/referrals' },
      { name: 'Loyalty Program', href: '/admin/loyalty' },
      { name: 'Abandoned Carts', href: '/admin/abandoned-carts' },
    ],
  },
  {
    name: 'Content',
    icon: FileText,
    children: [
      { name: 'Banners', href: '/admin/banners' },
      { name: 'Blog Posts', href: '/admin/blog' },
      { name: 'Pages', href: '/admin/pages' },
    ],
  },
  {
    name: 'Analytics',
    icon: BarChart3,
    children: [
      { name: 'Analytics', href: '/admin/analytics' },
      { name: 'Store Intelligence', href: '/admin/store-intelligence' },
    ],
  },
  {
    name: 'AI Intelligence',
    icon: Sparkles,
    children: [
      { name: 'Merchandising', href: '/admin/ai-merchandising' },
      { name: 'Content Studio', href: '/admin/content-studio' },
      { name: 'Support Triage', href: '/admin/support-triage' },
      { name: 'Automation Runner', href: '/admin/automation' },
    ],
  },
  {
    name: 'Settings',
    icon: Settings,
    children: [
      { name: 'General', href: '/admin/settings' },
      { name: 'Payments', href: '/admin/settings?tab=payments' },
      { name: 'Shipping & Tax', href: '/admin/settings?tab=shipping' },
      { name: 'Loyalty', href: '/admin/settings?tab=loyalty' },
      { name: 'Email', href: '/admin/settings?tab=email' },
      { name: 'SEO', href: '/admin/settings?tab=seo' },
    ],
  },
];

export default function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState<string[]>(['Products']);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleMenu = (name: string) => {
    setOpenMenus((prev) =>
      prev.includes(name)
        ? prev.filter((item) => item !== name)
        : [...prev, name]
    );
  };

  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(href);
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-6 border-b border-gray-200 dark:border-gray-700">
        <Store className="h-8 w-8 text-primary" />
        <span className="text-xl font-bold text-gray-900 dark:text-white">
          Noor Admin
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {navigation.map((item) => (
            <li key={item.name}>
              {item.children ? (
                <div>
                  <button
                    onClick={() => toggleMenu(item.name)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      openMenus.includes(item.name)
                        ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <item.icon className="h-5 w-5" />
                      {item.name}
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 transition-transform',
                        openMenus.includes(item.name) && 'rotate-180'
                      )}
                    />
                  </button>
                  <AnimatePresence>
                    {openMenus.includes(item.name) && (
                      <motion.ul
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="mt-1 overflow-hidden"
                      >
                        {item.children.map((child) => (
                          <li key={child.name}>
                            <Link
                              href={child.href}
                              className={cn(
                                'block rounded-lg py-2 pl-11 pr-3 text-sm transition-colors',
                                isActive(child.href)
                                  ? 'bg-primary/10 text-primary font-medium'
                                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
                              )}
                            >
                              {child.name}
                            </Link>
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <Link
                  href={item.href!}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive(item.href!)
                      ? 'bg-primary text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* User Info */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <Link
          href="/admin/profile"
          className="flex items-center gap-3 p-2 -m-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
            {user.image ? (
              <img
                src={user.image}
                alt={user.name}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <span className="text-sm font-medium text-primary">
                {user.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {user.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {user.role === 'superadmin' ? 'Super Admin' : 'Admin'} · Edit Profile
            </p>
          </div>
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
          <SidebarContent />
        </div>
      </div>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 25 }}
              className="fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-900 lg:hidden"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute right-4 top-4 p-2 text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
              <SidebarContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Toggle Button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed bottom-4 left-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg lg:hidden"
      >
        <Layers className="h-6 w-6" />
      </button>
    </>
  );
}