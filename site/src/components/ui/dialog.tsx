"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"

import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerClose,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer"

type DialogContextType = {
  responsive: boolean
  isDesktop: boolean
}

const DialogContext = React.createContext<DialogContextType>({
  responsive: true,
  isDesktop: true,
})

/* ---------------- ROOT ---------------- */

function Dialog({
  responsive = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root> & {
  responsive?: boolean
}) {
  const isDesktop = !useIsMobile()

  const value = React.useMemo(
    () => ({
      responsive,
      isDesktop,
    }),
    [responsive, isDesktop]
  )

  if (responsive && !isDesktop) {
    return (
      <DialogContext.Provider value={value}>
        <Drawer {...props} />
      </DialogContext.Provider>
    )
  }

  return (
    <DialogContext.Provider value={value}>
      <DialogPrimitive.Root data-slot="dialog" {...props} />
    </DialogContext.Provider>
  )
}

/* ---------------- TRIGGER ---------------- */

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  const { responsive, isDesktop } = React.useContext(DialogContext)

  if (responsive && !isDesktop) {
    return <DrawerTrigger {...props} />
  }

  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

/* ---------------- CLOSE ---------------- */

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  const { responsive, isDesktop } = React.useContext(DialogContext)

  if (responsive && !isDesktop) {
    return <DrawerClose {...props} />
  }

  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

/* ---------------- PORTAL ---------------- */

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  const { responsive, isDesktop } = React.useContext(DialogContext)

  if (responsive && !isDesktop) {
    return <>{props.children}</>
  }

  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

/* ---------------- OVERLAY ---------------- */

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  const { responsive, isDesktop } = React.useContext(DialogContext)

  if (responsive && !isDesktop) {
    return null
  }

  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

/* ---------------- CONTENT ---------------- */

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  const { responsive, isDesktop } = React.useContext(DialogContext)

  if (responsive && !isDesktop) {
    return (
      <DrawerContent className={className} {...props}>
        {children}
      </DrawerContent>
    )
  }

  return (
    <DialogPortal>
      <DialogOverlay />

      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-background fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
          "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}

        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="absolute top-4 right-4 opacity-70 hover:opacity-100"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

/* ---------------- HEADER ---------------- */

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  const { responsive, isDesktop } = React.useContext(DialogContext)

  if (responsive && !isDesktop) {
    return <DrawerHeader className={className} {...props} />
  }

  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

/* ---------------- FOOTER ---------------- */

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  const { responsive, isDesktop } = React.useContext(DialogContext)

  if (responsive && !isDesktop) {
    return <DrawerFooter className={className} {...props} />
  }

  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

/* ---------------- TITLE ---------------- */

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  const { responsive, isDesktop } = React.useContext(DialogContext)

  if (responsive && !isDesktop) {
    return <DrawerTitle className={className} {...props} />
  }

  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg font-semibold", className)}
      {...props}
    />
  )
}

/* ---------------- DESCRIPTION ---------------- */

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  const { responsive, isDesktop } = React.useContext(DialogContext)

  if (responsive && !isDesktop) {
    return <DrawerDescription className={className} {...props} />
  }

  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogClose,
  DialogOverlay,
  DialogPortal,
}