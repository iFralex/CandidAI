"use client"
import { content } from '../_content/complete-platform-documentation'
import { MDContent } from '../_components/MDContent'

export { MDContent }

const Page = () => <MDContent content={content} />

export default Page
