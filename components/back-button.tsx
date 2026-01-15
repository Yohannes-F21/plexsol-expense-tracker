"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BackButtonProps = {
  href?: string;
  className?: string;
  label?: string;
};

export function BackButton({
  href,
  className,
  label = "Back",
}: BackButtonProps) {
  const router = useRouter();

  const content = (
    <>
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />
      </span>
      <span className="text-sm font-medium text-foreground">{label}</span>
    </>
  );

  return (
    <div
      className={cn(
        "inline-flex rounded-full border bg-background/80 p-1 shadow-sm backdrop-blur",
        className
      )}
    >
      {href ? (
        <Button
          asChild
          variant="ghost"
          className="group h-8 gap-2 rounded-full px-3"
        >
          <Link href={href}>{content}</Link>
        </Button>
      ) : (
        <Button
          type="button"
          onClick={() => router.back()}
          variant="ghost"
          className="group h-8 gap-2 rounded-full px-3"
        >
          {content}
        </Button>
      )}
    </div>
  );
}
