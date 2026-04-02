import * as React from "react"
import { cn } from "@/lib/utils"

type InputProps = React.ComponentProps<"input"> & {
  error?: string
  icon?: React.ReactNode
}

function Input({ className, type = "text", error, icon, ...props }: InputProps) {
  return (
    <div className="w-full">
      <div className="relative w-full">
        {icon && (
          <span className="absolute inset-y-0 flex items-center ml-4 pointer-events-none">
            {icon}
          </span>
        )}
        <input
          type={type}
          data-slot="input"
          className={cn(
            "w-full py-4 bg-white/10 border border-white/20 rounded-full text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed",
            icon ? "pl-12 pr-6" : "px-6", // padding a sinistra se c'è l'icona
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="text-red-400 text-sm mt-2 ml-4">{error}</p>}
    </div>
  )
}

export { Input }
