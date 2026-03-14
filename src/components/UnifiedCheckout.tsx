'use client'

import { loadStripe } from "@stripe/stripe-js";
import {
    Elements,
    CardNumberElement,
    CardExpiryElement,
    CardCvcElement,
    PaymentRequestButtonElement,
    useStripe,
    useElements,
} from "@stripe/react-stripe-js";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Lock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { computePriceInCents, formatPrice, getPlanById } from "@/lib/utils";
import { CREDIT_PACKAGES } from "@/config";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const elementOptions = {
    style: {
        base: {
            color: "#fff",
            fontSize: "16px",
            fontFamily: "Inter, sans-serif",
            "::placeholder": { color: "#9ca3af" },
        },
        invalid: { color: "#f87171", iconColor: "#f87171" },
    },
};

function StripeCardInputs() {
    return (
        <div className="space-y-3">
            <label className="block">
                <div className="text-sm text-gray-300 mb-2">Card number</div>
                <div className="p-3 bg-white/6 rounded-full border border-white/12 focus-within:ring-2 focus-within:ring-violet-500">
                    <CardNumberElement options={elementOptions} />
                </div>
            </label>
            <div className="grid grid-cols-2 gap-3">
                <label>
                    <div className="text-sm text-gray-300 mb-2">Expiry</div>
                    <div className="p-3 bg-white/6 rounded-full border border-white/12 focus-within:ring-2 focus-within:ring-violet-500">
                        <CardExpiryElement options={elementOptions} />
                    </div>
                </label>
                <label>
                    <div className="text-sm text-gray-300 mb-2">CVC</div>
                    <div className="p-3 bg-white/6 rounded-full border border-white/12 focus-within:ring-2 focus-within:ring-violet-500">
                        <CardCvcElement options={elementOptions} />
                    </div>
                </label>
            </div>
        </div>
    );
}

interface PaymentRequestButtonProps {
    email: string;
    amountCents: number;
    purchaseType: "plan" | "credits";
    itemId: string;
    onSuccess?: (data: any) => void;
}

function PaymentRequestButton({ email, amountCents, purchaseType, itemId, onSuccess }: PaymentRequestButtonProps) {
    const stripe = useStripe();
    const [paymentRequest, setPaymentRequest] = useState<any>(null);
    const [supported, setSupported] = useState(false);

    useEffect(() => {
        if (!stripe) return;

        const pr = stripe.paymentRequest({
            country: "IT",
            currency: "eur",
            total: { label: "Purchase", amount: amountCents },
            requestPayerEmail: true,
        });

        pr.canMakePayment().then((res) => {
            if (res) setSupported(true);
        });

        pr.on("paymentmethod", async (ev) => {
            try {
                const res = await fetch("/api/create-payment", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ payment_method_id: ev.paymentMethod.id, purchaseType, itemId }),
                });
                const data = await res.json();
                if (data.error) { ev.complete("fail"); return; }

                const { error: confirmError } = await stripe.confirmCardPayment(
                    data.client_secret,
                    { payment_method: ev.paymentMethod.id },
                    { handleActions: true }
                );

                if (confirmError) {
                    ev.complete("fail");
                } else {
                    ev.complete("success");
                    onSuccess?.(data);
                }
            } catch {
                ev.complete("fail");
            }
        });

        setPaymentRequest(pr);
        return () => { try { pr?.off?.("paymentmethod"); } catch { } };
    }, [stripe, amountCents, purchaseType, itemId]);

    if (!supported || !paymentRequest) return null;

    return (
        <div className="mb-4">
            <PaymentRequestButtonElement options={{ paymentRequest }} />
        </div>
    );
}

interface CheckoutFormProps {
    email: string;
    purchaseType: "plan" | "credits";
    itemId: string;
    onSuccess?: (data: any) => void;
}

function CheckoutForm({ email, purchaseType, itemId, onSuccess }: CheckoutFormProps) {
    const stripe = useStripe();
    const elements = useElements();
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const amountCents = computePriceInCents(purchaseType, itemId);

    const handlePay = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!stripe || !elements) return;

        setLoading(true);
        setError("");

        const cardNumberElement = elements.getElement(CardNumberElement);
        if (!cardNumberElement) {
            setError("Card element not available");
            setLoading(false);
            return;
        }

        const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
            type: "card",
            card: cardNumberElement,
            billing_details: { email },
        });

        if (pmError) {
            setError(pmError.message || "Payment method error");
            setLoading(false);
            return;
        }

        try {
            const res = await fetch("/api/create-payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ payment_method_id: paymentMethod!.id, purchaseType, itemId }),
            });

            const data = await res.json();
            if (data.error) { setError(data.error); setLoading(false); return; }

            const { error: confirmError } = await stripe.confirmCardPayment(data.client_secret);
            if (confirmError) {
                setError(confirmError.message || "Payment confirmation failed");
                setLoading(false);
                return;
            }

            setSuccess(true);
            setLoading(false);
            onSuccess?.(data);
        } catch (err: any) {
            setError(err.message || "Unexpected error");
            setLoading(false);
        }
    };

    if (success) {
        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-6">
                <Card className="p-4 bg-emerald-900/10 border-emerald-700">
                    <div className="flex items-center gap-3">
                        <Check className="w-6 h-6 text-emerald-400" />
                        <div>
                            <div className="text-sm text-white font-medium">Payment successful!</div>
                            <div className="text-xs text-gray-300">A receipt has been sent to {email}</div>
                        </div>
                    </div>
                </Card>
            </motion.div>
        );
    }

    return (
        <form onSubmit={handlePay} className="space-y-6">
            <PaymentRequestButton
                email={email}
                amountCents={amountCents}
                purchaseType={purchaseType}
                itemId={itemId}
                onSuccess={onSuccess}
            />

            <StripeCardInputs />

            {error && <div className="text-red-400 text-sm">{error}</div>}

            <Separator />

            <div className="flex items-center justify-between">
                <div className="text-sm text-gray-400">Total</div>
                <div className="text-white font-bold text-lg">{formatPrice(amountCents)}</div>
            </div>

            <Button className="w-full" onClick={handlePay} disabled={loading}>
                {loading ? (
                    <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                    </span>
                ) : (
                    <span className="flex items-center gap-2">
                        Pay {formatPrice(amountCents)} <ArrowRight className="w-4 h-4" />
                    </span>
                )}
            </Button>
        </form>
    );
}

interface PurchaseSummaryProps {
    purchaseType: "plan" | "credits";
    itemId: string;
}

function PurchaseSummary({ purchaseType, itemId }: PurchaseSummaryProps) {
    const amountCents = computePriceInCents(purchaseType, itemId);

    if (purchaseType === "credits") {
        const pkg = CREDIT_PACKAGES.find((p) => p.id === itemId);
        if (!pkg) return null;
        return (
            <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-white font-semibold">{pkg.credits.toLocaleString()} Credits</div>
                        <div className="text-sm text-gray-400">One-time purchase</div>
                    </div>
                    <div className="text-white font-bold text-xl">{formatPrice(amountCents)}</div>
                </div>
            </Card>
        );
    }

    const plan = getPlanById(itemId);
    if (!plan) return null;

    return (
        <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-white font-semibold">{plan.name} Plan</div>
                    <div className="text-sm text-gray-400">{plan.description}</div>
                </div>
                <div className="text-white font-bold text-xl">{formatPrice(amountCents)}</div>
            </div>
            <ul className="space-y-1">
                {plan.features.slice(0, 4).map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-gray-300">
                        <Check className="w-3 h-3 text-green-400 flex-shrink-0" />
                        {feature}
                    </li>
                ))}
            </ul>
        </Card>
    );
}

export interface UnifiedCheckoutProps {
    purchaseType: "plan" | "credits";
    itemId: string;
    email?: string;
    onSuccess?: (data: any) => void;
}

export function UnifiedCheckout({ purchaseType, itemId, email = "", onSuccess }: UnifiedCheckoutProps) {
    return (
        <div className="no-scrollbar overflow-y-auto space-y-4">
            <Elements stripe={stripePromise}>
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <PurchaseSummary purchaseType={purchaseType} itemId={itemId} />
                        <Card className="p-4">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-gray-300">Payment method</div>
                                <Badge className="bg-slate-700/30">Secure <Lock className="w-3 h-3 ml-1" /></Badge>
                            </div>
                            <div className="mt-3 text-xs text-gray-400">
                                Card details are processed securely by Stripe — we never see full card numbers.
                            </div>
                        </Card>
                    </div>

                    <Card className="p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">Complete your purchase</h3>
                        <CheckoutForm
                            email={email}
                            purchaseType={purchaseType}
                            itemId={itemId}
                            onSuccess={onSuccess}
                        />
                    </Card>
                </div>
            </Elements>
        </div>
    );
}
