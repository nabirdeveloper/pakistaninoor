'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, MessageCircle, Send, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const GREETING: ChatMessage = {
  role: 'assistant',
  content:
    "Hello! 👋 Welcome to Pakistani Noor. I'm the AI shopping assistant — ask me about orders, shipping, returns, payments, or products.",
};

const QUICK_SUGGESTIONS = ['Track my order', 'Shipping info', 'Return policy', 'How do loyalty points work?'];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(QUICK_SUGGESTIONS);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Scroll to the latest message whenever the chat changes
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing, open]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || typing) return;

    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setInput('');
    setSuggestions([]);
    setTyping(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = await response.json();

      const answer: string =
        typeof data?.answer === 'string' && data.answer.length > 0
          ? data.answer
          : "Sorry, I couldn't process that. Please try again in a moment.";
      const nextSuggestions: string[] = Array.isArray(data?.suggestions) ? data.suggestions : [];

      setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
      setSuggestions(nextSuggestions);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            "I seem to be having trouble connecting right now. Please try again in a moment, or reach our team at support@pakistannoor.com.",
        },
      ]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <>
      {/* Floating toggle button */}
      <button
        aria-label="Chat with Pakistani Noor assistant"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all hover:scale-105',
          open
            ? 'bg-gray-900 text-white dark:bg-gray-200 dark:text-gray-900'
            : 'bg-primary text-white'
        )}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-50 flex w-[calc(100vw-2.5rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
          {/* Header */}
          <div className="flex items-center gap-3 bg-primary px-4 py-3 text-white">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
              <Bot className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Pakistani Noor Assistant</p>
              <p className="flex items-center gap-1 text-xs text-white/80">
                <Sparkles className="h-3 w-3" /> AI-powered · replies instantly
              </p>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex max-h-80 min-h-64 flex-col gap-3 overflow-y-auto bg-gray-50 px-4 py-4 dark:bg-gray-950"
          >
            {messages.map((msg, index) => (
              <div
                key={index}
                className={cn(
                  'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
                  msg.role === 'assistant'
                    ? 'bg-white text-gray-800 border border-gray-200 self-start dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700'
                    : 'bg-primary text-white self-end'
                )}
              >
                {msg.content}
              </div>
            ))}
            {typing && (
              <div className="flex items-center gap-1 self-start rounded-2xl bg-white border border-gray-200 px-4 py-3 dark:bg-gray-800 dark:border-gray-700">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:240ms]" />
              </div>
            )}
          </div>

          {/* Suggestion chips */}
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => sendMessage(suggestion)}
                  className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10 dark:border-primary/40"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="flex items-center gap-2 border-t border-gray-100 bg-white px-3 py-3 dark:border-gray-800 dark:bg-gray-900"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about orders, shipping, returns…"
              maxLength={500}
              className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
            <button
              type="submit"
              aria-label="Send message"
              disabled={!input.trim() || typing}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}