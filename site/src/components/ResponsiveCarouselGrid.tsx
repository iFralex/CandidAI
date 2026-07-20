"use client";

import { useCallback, useEffect, useState, type Key, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    type CarouselApi,
} from "@/components/ui/carousel";

type Breakpoint = "sm" | "md" | "lg";

const breakpointMedia: Record<Breakpoint, string> = {
    sm: "(min-width: 640px)",
    md: "(min-width: 768px)",
    lg: "(min-width: 1024px)",
};

const hideAtBreakpoint: Record<Breakpoint, string> = {
    sm: "sm:hidden",
    md: "md:hidden",
    lg: "lg:hidden",
};

interface ResponsiveCarouselGridProps<T> {
    items: readonly T[];
    renderItem: (item: T, index: number) => ReactNode;
    getKey: (item: T, index: number) => Key;
    ariaLabel: string;
    breakpoint?: Breakpoint;
    className?: string;
    contentClassName: string;
    itemClassName?: string;
    hint?: string;
    mobileOnly?: boolean;
}

/** One collection and one renderer: swipeable on mobile, a normal grid above the chosen breakpoint. */
export function ResponsiveCarouselGrid<T>({
    items,
    renderItem,
    getKey,
    ariaLabel,
    breakpoint = "md",
    className,
    contentClassName,
    itemClassName,
    hint,
    mobileOnly = false,
}: ResponsiveCarouselGridProps<T>) {
    const [api, setApi] = useState<CarouselApi>();
    const [selected, setSelected] = useState(0);
    const [count, setCount] = useState(items.length);

    const syncSelection = useCallback((carouselApi: NonNullable<CarouselApi>) => {
        setSelected(carouselApi.selectedScrollSnap());
        setCount(carouselApi.scrollSnapList().length || items.length);
    }, [items.length]);

    useEffect(() => {
        if (!api) return;
        syncSelection(api);
        api.on("select", syncSelection);
        api.on("reInit", syncSelection);
        return () => {
            api.off("select", syncSelection);
            api.off("reInit", syncSelection);
        };
    }, [api, syncSelection]);

    const mobileControlsClass = hideAtBreakpoint[breakpoint];

    return (
        <Carousel
            setApi={setApi}
            opts={{
                align: "start",
                containScroll: "trimSnaps",
                breakpoints: mobileOnly ? undefined : { [breakpointMedia[breakpoint]]: { active: false } },
            }}
            className={cn(mobileOnly && mobileControlsClass, className)}
            aria-label={ariaLabel}
        >
            <CarouselContent className={cn("-ml-3", !mobileOnly && contentClassName)}>
                {items.map((item, index) => (
                    <CarouselItem key={getKey(item, index)} className={cn("basis-[86%] pl-3", itemClassName)}>
                        {renderItem(item, index)}
                    </CarouselItem>
                ))}
            </CarouselContent>

            <div className={cn("mt-5 flex items-center justify-center gap-3", mobileControlsClass)}>
                <button
                    type="button"
                    onClick={() => api?.scrollPrev()}
                    disabled={!api?.canScrollPrev()}
                    aria-label="Previous item"
                    className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/[0.04] text-gray-300 transition hover:bg-white/10 disabled:opacity-30"
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex min-w-16 items-center justify-center gap-1.5" aria-hidden="true">
                    {Array.from({ length: count }, (_, index) => (
                        <button
                            key={index}
                            type="button"
                            tabIndex={-1}
                            onClick={() => api?.scrollTo(index)}
                            className={cn("h-1.5 rounded-full transition-all", index === selected ? "w-5 bg-violet-400" : "w-1.5 bg-white/25")}
                        />
                    ))}
                </div>
                <span className="sr-only">Item {selected + 1} of {count}</span>
                <button
                    type="button"
                    onClick={() => api?.scrollNext()}
                    disabled={!api?.canScrollNext()}
                    aria-label="Next item"
                    className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/[0.04] text-gray-300 transition hover:bg-white/10 disabled:opacity-30"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>
            {hint && <p className={cn("mt-2 text-center text-xs text-gray-600", mobileControlsClass)}>{hint}</p>}
        </Carousel>
    );
}
