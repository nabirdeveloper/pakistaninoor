'use client';

import Link from 'next/link';
import {
  Facebook,
  Instagram,
  Twitter,
  Youtube,
  Mail,
  Phone,
  MapPin,
} from 'lucide-react';

const footerLinks = {
  shop: [
    { name: 'New Arrivals', href: '/products?newArrivals=true' },
    { name: 'Best Sellers', href: '/products?bestSellers=true' },
    { name: 'Sale', href: '/products?onSale=true' },
    { name: 'All Products', href: '/products' },
  ],
  customer: [
    { name: 'My Account', href: '/account' },
    { name: 'Order Tracking', href: '/account/orders' },
    { name: 'Wishlist', href: '/account/wishlist' },
    { name: 'Contact Us', href: 'mailto:support@pakistaninoor.com' },
  ],
  info: [
    { name: 'About Us', href: '/pages/about' },
    { name: 'Shipping Policy', href: '/pages/shipping-policy' },
    { name: 'Return Policy', href: '/pages/return-policy' },
    { name: 'Privacy Policy', href: '/pages/privacy' },
    { name: 'Terms & Conditions', href: '/pages/terms' },
  ],
};

const socialLinks = [
  { name: 'Facebook', icon: Facebook, href: '#' },
  { name: 'Instagram', icon: Instagram, href: '#' },
  { name: 'Twitter', icon: Twitter, href: '#' },
  { name: 'YouTube', icon: Youtube, href: '#' },
];

const paymentMethods = [
  { name: 'bKash', image: '/images/payments/bkash.png' },
  { name: 'Nagad', image: '/images/payments/nagad.png' },
  { name: 'SSLCommerz', image: '/images/payments/sslcommerz.png' },
  { name: 'COD', image: '/images/payments/cod.png' },
];

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-gray-300">
      {/* Main Footer */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="inline-block">
              <span className="text-2xl font-bold text-white">
                Pakistani Noor
              </span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-gray-400">
              Your trusted online shopping destination in Bangladesh. We offer
              high-quality products at competitive prices with fast delivery
              across the country.
            </p>
            <div className="mt-6 space-y-3">
              <a
                href="tel:+8801700000000"
                className="flex items-center gap-2 text-sm hover:text-white transition-colors"
              >
                <Phone className="h-4 w-4" />
                +880 1700 000 000
              </a>
              <a
                href="mailto:support@pakistaninoor.com"
                className="flex items-center gap-2 text-sm hover:text-white transition-colors"
              >
                <Mail className="h-4 w-4" />
                support@pakistaninoor.com
              </a>
              <p className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                House 123, Road 10, Gulshan-1, Dhaka-1212, Bangladesh
              </p>
            </div>
          </div>

          {/* Shop Links */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
              Shop
            </h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.shop.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm hover:text-white transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
              Customer Service
            </h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.customer.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm hover:text-white transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Information */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
              Information
            </h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.info.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm hover:text-white transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Newsletter & Social */}
        <div className="mt-12 pt-8 border-t border-gray-800">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            {/* Newsletter */}
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                Subscribe to our newsletter
              </h3>
              <p className="mt-2 text-sm text-gray-400">
                Get updates on new products, offers, and more.
              </p>
              <form className="mt-4 flex gap-2">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
                >
                  Subscribe
                </button>
              </form>
            </div>

            {/* Social Links */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4">
              <span className="text-sm text-gray-400">Follow us:</span>
              <div className="flex items-center gap-3">
                {socialLinks.map((social) => (
                  <a
                    key={social.name}
                    href={social.href}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-800 text-gray-400 hover:bg-primary hover:text-white transition-colors"
                    aria-label={social.name}
                  >
                    <social.icon className="h-5 w-5" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="mt-8 pt-8 border-t border-gray-800">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-400">We accept:</span>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 bg-gray-800 rounded text-xs font-medium">
                  bKash
                </span>
                <span className="px-3 py-1.5 bg-gray-800 rounded text-xs font-medium">
                  Nagad
                </span>
                <span className="px-3 py-1.5 bg-gray-800 rounded text-xs font-medium">
                  Card
                </span>
                <span className="px-3 py-1.5 bg-gray-800 rounded text-xs font-medium">
                  COD
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span>Secured by</span>
              <span className="px-3 py-1.5 bg-gray-800 rounded text-xs font-medium text-green-400">
                SSL
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="bg-gray-950 py-4">
        <div className="container mx-auto px-4">
          <p className="text-center text-sm text-gray-500">
            &copy; {currentYear} Pakistani Noor. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
