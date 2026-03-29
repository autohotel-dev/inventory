"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        // Base styles - premium default
        "inline-flex h-auto items-center justify-center gap-1",
        "p-1.5 rounded-xl",
        "bg-muted/50 backdrop-blur-sm",
        "border border-border/50",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        // Base styles
        "inline-flex items-center justify-center gap-2",
        "px-4 py-2.5 rounded-lg",
        "text-sm font-semibold whitespace-nowrap",
        "transition-all duration-300",
        // Inactive state
        "text-muted-foreground",
        "hover:text-foreground hover:bg-muted/80",
        // Active state - colored gradient with GLOW
        "data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80",
        "data-[state=active]:text-primary-foreground",
        "data-[state=active]:shadow-[0_0_20px_rgba(16,185,129,0.4)]",
        "data-[state=active]:border data-[state=active]:border-primary/50",
        // Focus state
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        // Disabled
        "disabled:pointer-events-none disabled:opacity-50",
        // Icon sizing
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        "flex-1 outline-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
