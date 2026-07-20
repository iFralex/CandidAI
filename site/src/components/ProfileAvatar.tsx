'use client'

import { cn } from '@/lib/utils'

type ProfileAvatarProps = {
  name?: string
  imageUrl?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'h-16 w-16 text-base',
  md: 'h-20 w-20 text-xl',
  lg: 'h-24 w-24 text-2xl',
}

function initialsFor(name?: string) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '??'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function ProfileAvatar({ name, imageUrl, size = 'md', className }: ProfileAvatarProps) {
  return <div className={cn('relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-violet-400/30 bg-violet-500/15 font-semibold text-violet-100', sizes[size], className)}>
    <span>{initialsFor(name)}</span>
    {imageUrl && <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" onError={event => { event.currentTarget.style.display = 'none' }} />}
  </div>
}
