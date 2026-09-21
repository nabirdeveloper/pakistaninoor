'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Eye,
  Newspaper,
  User,
  Tag,
} from 'lucide-react';

interface Post {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featuredImage?: string;
  category?: string;
  tags?: string[];
  author?: { name?: string } | null;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
}

const readTime = (content?: string) => {
  const words = (content || '').trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
};

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

/** Very small markdown-lite renderer: headings, bullet lists, paragraphs. */
function ArticleBody({ content }: { content: string }) {
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
        <ul key={key++} className="mb-4 list-disc space-y-1 pl-6 text-gray-700 dark:text-gray-300">
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

export default function BlogPostPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/blog/${slug}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok || !data.post) {
          setNotFound(true);
          return;
        }
        setPost(data.post);
      } catch (error) {
        console.error('Failed to load post:', error);
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

  if (notFound || !post) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <Newspaper className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
        <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">
          Article not found
        </h1>
        <Link
          href="/blog"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Journal
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
      <Link
        href="/blog"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary dark:text-gray-400"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Journal
      </Link>

      <article className="mt-6">
        <div className="flex flex-wrap items-center gap-2">
          {post.category && (
            <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {post.category}
            </span>
          )}
          {post.author?.name && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-400">
              <User className="h-3.5 w-3.5" /> By {post.author.name}
            </span>
          )}
        </div>

        <h1 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white leading-tight">
          {post.title}
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-4 border-b border-gray-200 dark:border-gray-700 pb-5 text-xs text-gray-400">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(post.publishedAt)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {readTime(post.content)} min read
          </span>
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" />
            {post.viewCount} views
          </span>
        </div>

        {post.featuredImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.featuredImage}
            alt={post.title}
            className="mt-6 w-full rounded-2xl object-cover"
          />
        )}

        {post.excerpt && (
          <p className="mt-6 text-lg font-medium text-gray-800 dark:text-gray-200 leading-relaxed">
            {post.excerpt}
          </p>
        )}

        <div className="mt-6">
          <ArticleBody content={post.content} />
        </div>

        {post.tags && post.tags.length > 0 && (
          <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-gray-200 dark:border-gray-700 pt-5">
            <Tag className="h-4 w-4 text-gray-400" />
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs text-gray-600 dark:text-gray-300"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}