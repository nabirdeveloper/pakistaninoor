import { NextResponse } from 'next/server';
import { ai } from '@/lib/ai/client';

// GET /api/ai/health — reports AI service connectivity (public)
export async function GET() {
  const health = await ai.health();

  if (!health) {
    return NextResponse.json(
      {
        status: 'unavailable',
        message:
          'AI service is not reachable. AI features fall back to the deterministic local engine. Start the service with: cd microservices/ai-python && uvicorn main:app --port 8000, or docker-compose up ai',
      },
      { status: 200 }
    );
  }

  return NextResponse.json({
    status: health.status,
    engine: health.engine,
    llm_provider: health.llm_provider,
    version: health.version,
  });
}