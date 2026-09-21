'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, FileText } from 'lucide-react';

interface PageData {
  title: string;
  slug: string;
  content: string;
  metaTitle?: string;
  updatedAt: string;
}

/** Markdown-lite renderer shared by CMS pages (## h2, ### h3, - bullets). */
function PageBody({ content }: { content: string }) {
  const lines = content.split('\n');
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let list: string[] = [];
  let key = 0;

  const flush = () => {
    if (para.length > 0) {
      blocks.push(
        <p key={key++} className="mb-4 leading-relaxed text-gray-700 dark:text-gray-300">
          {para.join(' ')}
        </p>
      );
      para = [];
    }
    if (list.length > 0) {
      blocks.push(
        <ul key={key++} className="mb-4 list-disc space-y-1.5 pl-6 text-gray-700 dark:text-gray-300">
          {list.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
      list = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (line.startsWith('### ')) {
      flush();
      blocks.push(
        <h3 key={key++} className="mb-3 mt-6 text-lg font-semibold text-gray-900 dark:text-white">
          {line.slice(4)}
        </h3>
      );
    } else if (line.startsWith('## ')) {
      flush();
      blocks.push(
        <h2 key={key++} className="mb-3 mt-7 text-xl font-bold text-gray-900 dark:text-white">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      list.push(line.slice(2));
    } else {
      para.push(line);
    }
  }
  flush();

  return <div>{blocks}</div>;
}

export default function PagesPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [page, setPage] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/pages/${slug}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok || !data.page) {
          setNotFound(true);
          return;
        }
        setPage(data.page);
      } catch (error) {
        console.error('Failed to load page:', error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center text-gray-500">
        Loading…
      </div>
    );
  }

  if (notFound || !page) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <FileText className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
        <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">
          Page not found
        </h1>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          Go to homepage
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-6">
        <Link href="/" className="hover:text-primary">
          Home
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-900 dark:text-white font-medium">
          {page.title}
        </span>
      </nav>

      <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-6">
        {page.title}
      </h1>

      <div className="prose prose-gray dark:prose-invert max-w-none">
        <PageBody content={page.content} />
      </div>

      <p className="mt-10 text-xs text-gray-400">
        Last updated:{' '}
        {new Date(page.updatedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </p>
    </div>
  );
}