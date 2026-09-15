"use client";

import type { ReactNode } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/utils";

interface MobileDrawerProps {
  children: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  contentClassName?: string;
  headerClassName?: string;
  bodyClassName?: string;
}

interface ResponsiveDialogProps extends MobileDrawerProps {
  dialogContentClassName?: string;
  dialogHeaderClassName?: string;
  dialogBodyClassName?: string;
}

/**
 * Shared Android-style bottom drawer used by mobile menus and focused tasks.
 * The body owns scrolling while the title and drag handle remain stable.
 */
export function MobileDrawer({
  children,
  title,
  description,
  trigger,
  open,
  onOpenChange,
  contentClassName,
  headerClassName,
  bodyClassName,
}: MobileDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      {trigger && <DrawerTrigger asChild>{trigger}</DrawerTrigger>}
      <DrawerContent
        className={cn(
          "max-h-[min(88dvh,48rem)] rounded-t-[1.75rem]",
          contentClassName
        )}
      >
        <DrawerHeader className={cn("px-5 pb-2 pt-4 text-left", headerClassName)}>
          <DrawerTitle className="text-xl leading-tight">{title}</DrawerTitle>
          {description && (
            <DrawerDescription className="leading-relaxed">
              {description}
            </DrawerDescription>
          )}
        </DrawerHeader>
        <div
          className={cn(
            "overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]",
            bodyClassName
          )}
        >
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** Mobile drawer with a conventional dialog fallback for larger screens. */
export function ResponsiveDialog({
  children,
  title,
  description,
  trigger,
  open,
  onOpenChange,
  contentClassName,
  headerClassName,
  bodyClassName,
  dialogContentClassName,
  dialogHeaderClassName,
  dialogBodyClassName,
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <MobileDrawer
        open={open}
        onOpenChange={onOpenChange}
        trigger={trigger}
        title={title}
        description={description}
        contentClassName={contentClassName}
        headerClassName={headerClassName}
        bodyClassName={bodyClassName}
      >
        {children}
      </MobileDrawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className={dialogContentClassName}>
        <DialogHeader className={dialogHeaderClassName}>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className={dialogBodyClassName}>{children}</div>
      </DialogContent>
    </Dialog>
  );
}
