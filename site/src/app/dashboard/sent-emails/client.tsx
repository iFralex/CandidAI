"use client"

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CalendarIcon, X } from "lucide-react";
import type { DateRange } from "react-day-picker";

interface SentEmailsFilterProps {
    preset: string;
    from?: string;
    to?: string;
    totalCount: number;
}

export function SentEmailsFilter({ preset, from, to, totalCount }: SentEmailsFilterProps) {
    const router = useRouter();
    const [dateRange, setDateRange] = useState<DateRange | undefined>(
        from ? { from: new Date(from), to: to ? new Date(to) : undefined } : undefined
    );

    const pushUpdate = (newPreset: string, range?: DateRange) => {
        const params = new URLSearchParams();
        if (newPreset !== "all") params.set("preset", newPreset);
        if (newPreset === "custom" && range?.from) {
            params.set("from", range.from.toISOString().split("T")[0]);
            if (range.to) params.set("to", range.to.toISOString().split("T")[0]);
        }
        const qs = params.toString();
        router.push(`/dashboard/sent-emails${qs ? `?${qs}` : ""}`);
    };

    const handlePresetChange = (value: string) => {
        if (value === "custom") {
            // Don't navigate yet — wait for the user to pick dates in the calendar
            setDateRange(undefined);
            return;
        }
        setDateRange(undefined);
        pushUpdate(value, undefined);
    };

    const handleDateRangeSelect = (range: DateRange | undefined) => {
        setDateRange(range);
        if (range?.from) pushUpdate("custom", range);
    };

    const handleClear = () => {
        setDateRange(undefined);
        router.push("/dashboard/sent-emails");
    };

    const rangeLabel =
        dateRange?.from
            ? dateRange.to
                ? `${dateRange.from.toLocaleDateString()} – ${dateRange.to.toLocaleDateString()}`
                : dateRange.from.toLocaleDateString()
            : "Pick a range";

    return (
        <div className="flex items-center gap-3 flex-wrap">
            <Select value={preset} onValueChange={handlePresetChange}>
                <SelectTrigger className="w-40 bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="Filter by date" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="7">Last 7 Days</SelectItem>
                    <SelectItem value="30">Last 30 Days</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
            </Select>

            {preset === "custom" && (
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="secondary" size="sm" icon={<CalendarIcon className="w-4 h-4" />}>
                            {rangeLabel}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="range"
                            selected={dateRange}
                            onSelect={handleDateRangeSelect}
                            numberOfMonths={2}
                        />
                    </PopoverContent>
                </Popover>
            )}

            {preset !== "all" && (
                <Button variant="ghost" size="sm" icon={<X className="w-4 h-4" />} onClick={handleClear}>
                    Clear
                </Button>
            )}

            <span className="text-gray-400 text-sm ml-auto">
                {totalCount} email{totalCount !== 1 ? "s" : ""} sent
            </span>
        </div>
    );
}
