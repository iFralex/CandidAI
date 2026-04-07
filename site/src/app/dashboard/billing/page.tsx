"use client";
import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type Payment = {
    id: string;
    createdAt: string | null;
    description: string | null;
    amount: number | null;
    currency: string;
    status: string | null;
};

function formatAmount(amount: number | null, currency: string) {
    if (amount == null) return "—";
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency.toUpperCase(),
    }).format(amount / 100);
}

function formatDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

function statusVariant(status: string | null): "default" | "secondary" | "destructive" | "outline" {
    if (!status) return "outline";
    if (status === "succeeded" || status === "paid") return "default";
    if (status === "pending" || status === "processing") return "secondary";
    if (status === "failed" || status === "canceled") return "destructive";
    return "outline";
}

export default function BillingPage() {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        track({ name: "billing_page_view", params: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        fetch('/api/protected/billing')
            .then(r => {
                if (!r.ok) throw new Error(r.statusText);
                return r.json();
            })
            .then(data => {
                setPayments(data.payments ?? []);
                setLoading(false);
            })
            .catch((err: Error) => {
                setError(err.message || 'Failed to load billing history');
                setLoading(false);
            });
    }, []);

    if (loading) return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">Billing</h1>
                <p className="text-gray-400">Your payment history and invoices.</p>
            </div>
            <div className="rounded-md border border-white/10 overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="border-white/10 hover:bg-transparent">
                            <TableHead className="text-gray-400">Date</TableHead>
                            <TableHead className="text-gray-400">Description</TableHead>
                            <TableHead className="text-gray-400">Amount</TableHead>
                            <TableHead className="text-gray-400">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i} className="border-white/10">
                                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
    if (error) return <div className="text-red-400">Error: {error}</div>;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">Billing</h1>
                <p className="text-gray-400">Your payment history and invoices.</p>
            </div>

            {payments.length === 0 ? (
                <p className="text-gray-500 text-sm">No payment records found.</p>
            ) : (
                <div className="rounded-md border border-white/10 overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-white/10 hover:bg-transparent">
                                <TableHead className="text-gray-400">Date</TableHead>
                                <TableHead className="text-gray-400">Description</TableHead>
                                <TableHead className="text-gray-400">Amount</TableHead>
                                <TableHead className="text-gray-400">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {payments.map((payment) => (
                                <TableRow
                                    key={payment.id}
                                    className="border-white/10 hover:bg-white/5"
                                >
                                    <TableCell className="text-gray-300">
                                        {formatDate(payment.createdAt)}
                                    </TableCell>
                                    <TableCell className="text-gray-300">
                                        {payment.description ?? "—"}
                                    </TableCell>
                                    <TableCell className="text-gray-300">
                                        {formatAmount(payment.amount, payment.currency)}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={statusVariant(payment.status)}>
                                            {payment.status ?? "unknown"}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}
