import { NextRequest } from 'next/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let content: Record<string, string>
  try {
    const mod = await import(/* webpackInclude: /\.ts$/ */ `@/app/docs/_content/${slug}`)
    content = mod.content
  } catch {
    return new Response('Not found', { status: 404 })
  }
  const lang = req.nextUrl.searchParams.get('lang') || 'en'
  const markdown = content[lang] ?? content[Object.keys(content)[0]]
  if (!markdown) return new Response('Not found', { status: 404 })
  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
