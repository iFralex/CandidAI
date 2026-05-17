import { MDContent } from "../_components/MDContent"
import { content } from "../_content/video-promo-scripts"

export const metadata = { title: "Video Promo Scripts" }

export default function Page() {
  return <MDContent content={content} />
}
