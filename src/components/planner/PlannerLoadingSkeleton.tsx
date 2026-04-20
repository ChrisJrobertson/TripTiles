"use client";

type Props = {
  variant?: "overview" | "planning" | "payments";
};

function Block({
  className,
}: {
  className: string;
}) {
  return <div className={`animate-pulse rounded bg-royal/10 ${className}`} />;
}

export function PlannerLoadingSkeleton({ variant = "overview" }: Props) {
  if (variant === "payments") {
    return (
      <div className="space-y-3">
        <Block className="h-6 w-40" />
        <Block className="h-16 w-full" />
        <Block className="h-16 w-full" />
        <Block className="h-16 w-full" />
      </div>
    );
  }

  if (variant === "planning") {
    return (
      <div className="space-y-4">
        <Block className="h-12 w-full" />
        <Block className="h-40 w-full" />
        <Block className="h-12 w-full" />
        <Block className="h-32 w-full" />
        <Block className="h-12 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Block className="h-10 w-60" />
      <Block className="h-24 w-full" />
      <Block className="h-28 w-full" />
      <div className="grid gap-3 md:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <Block key={i} className="h-24 w-full" />
        ))}
      </div>
    </div>
  );
}
