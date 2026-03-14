import { fetchBillingHistory } from "@/actions/onboarding-actions";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

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

export default async function BillingPage() {
    const payments = await fetchBillingHistory();

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
