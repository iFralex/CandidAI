"use client"
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export const MDContent = ({ content }: { content: Record<string, string> }) => {
  const keys = Object.keys(content)
  const [lang, setLang] = useState(keys.includes('en') ? 'en' : keys[0])
  const [copied, setCopied] = useState(false)

  const copyMd = async () => {
    await navigator.clipboard.writeText(content[lang])
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="flex justify-end gap-2 mb-2">
        {keys.length > 1 && (
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="bg-gray-800 text-white text-sm border border-gray-700 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {keys.map((key) => (
              <option key={key} value={key}>{key}</option>
            ))}
          </select>
        )}
        <button
          onClick={copyMd}
          className="bg-gray-800 text-white text-sm border border-gray-700 rounded px-3 py-1 hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
        >
          {copied ? '✓ Copied' : 'Copy MD'}
        </button>
      </div>
      <div className="prose prose-invert mx-auto">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content[lang]}</ReactMarkdown>
      </div>
    </div>
  )
}
