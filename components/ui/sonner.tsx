"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      {...props}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      // Sonner only knows light and dark; most of our themes are neither, so
      // its built-in description grey can land on a dark popover. Use tokens.
      toastOptions={{
        ...props.toastOptions,
        classNames: {
          description: "!text-muted-foreground",
          ...props.toastOptions?.classNames,
        },
      }}
    />
  )
}

export { Toaster }
