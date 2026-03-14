'use client'

import { useState } from "react";
import { motion } from "framer-motion";
import { Zap, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CREDIT_PACKAGES } from "@/config";
import { formatPrice } from "@/lib/utils";

export interface CreditPackage {
    id: string;
    credits: number;
    price: number;
}

export interface CreditSelectorProps {
    onSelect: (pkg: CreditPackage) => void;
    selectedId?: string;
    showBuyButton?: boolean;
    onBuyClick?: (pkg: CreditPackage) => void;
}

export function CreditSelector({ onSelect, selectedId, showBuyButton = false, onBuyClick }: CreditSelectorProps) {
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    const packageLabels: Record<string, string> = {
        pkg_1000: "Starter",
        pkg_2500: "Popular",
        pkg_5000: "Power",
    };

    const packageDescriptions: Record<string, string> = {
        pkg_1000: "Great for occasional use",
        pkg_2500: "Best value per credit",
        pkg_5000: "For heavy job seekers",
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {CREDIT_PACKAGES.map((pkg, index) => {
                const isSelected = selectedId === pkg.id;
                const isHovered = hoveredId === pkg.id;
                const isPopular = pkg.id === "pkg_2500";

                return (
                    <motion.div
                        key={pkg.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: index * 0.1 }}
                        onMouseEnter={() => setHoveredId(pkg.id)}
                        onMouseLeave={() => setHoveredId(null)}
                    >
                        <Card
                            className={`relative p-5 cursor-pointer transition-all duration-200 flex flex-col gap-3 ${
                                isSelected
                                    ? "ring-2 ring-violet-500 bg-violet-500/10"
                                    : isHovered
                                    ? "ring-1 ring-white/20"
                                    : ""
                            } ${isPopular ? "ring-2 ring-violet-400" : ""}`}
                            onClick={() => onSelect(pkg)}
                        >
                            {isPopular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <Badge className="bg-violet-500 text-white text-xs px-3 py-1">
                                        Most Popular
                                    </Badge>
                                </div>
                            )}

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                        isSelected ? "bg-violet-500" : "bg-white/10"
                                    }`}>
                                        <Zap className={`w-4 h-4 ${isSelected ? "text-white" : "text-violet-400"}`} />
                                    </div>
                                    <span className="text-sm font-medium text-gray-300">
                                        {packageLabels[pkg.id] || pkg.id}
                                    </span>
                                </div>
                                {isSelected && (
                                    <Check className="w-4 h-4 text-violet-400" />
                                )}
                            </div>

                            <div>
                                <div className="text-2xl font-bold text-white">
                                    {pkg.credits.toLocaleString()}
                                    <span className="text-sm font-normal text-gray-400 ml-1">credits</span>
                                </div>
                                <div className="text-violet-300 font-semibold mt-1">
                                    {formatPrice(pkg.price)}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                    {packageDescriptions[pkg.id]}
                                </div>
                            </div>

                            {showBuyButton && (
                                <Button
                                    variant={isPopular ? "primary" : "secondary"}
                                    size="sm"
                                    className="w-full mt-1"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onBuyClick?.(pkg);
                                    }}
                                >
                                    Buy {formatPrice(pkg.price)}
                                </Button>
                            )}
                        </Card>
                    </motion.div>
                );
            })}
        </div>
    );
}
