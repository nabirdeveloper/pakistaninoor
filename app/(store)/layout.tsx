import Header from '@/components/store/Header';
import Footer from '@/components/store/Footer';
import ChatWidget from '@/components/store/ChatWidget';

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-950">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <ChatWidget />
    </div>
  );
}
