import { notFound } from 'next/navigation'
import { MDContent } from '../_components/MDContent'

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let content: Record<string, string>
  try {
    // webpack bundles all modules under _content/ and resolves at runtime
    const mod = await import(/* webpackInclude: /\.ts$/ */ `@/app/docs/_content/${slug}`)
    content = mod.content
  } catch {
    notFound()
  }
  return <MDContent content={content!} />
}
