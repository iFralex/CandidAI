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
import { computePriceInCents, formatPrice, getPlanById, getDiscountCode, applyDiscount } from "@/lib/utils";
import { CREDIT_PACKAGES } from "@/config";
import { track, updateUserProperties } from "@/lib/analytics";

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

async function confirmPaymentAndNavigate(
    paymentIntentId: string,
    onSuccess?: (data: any) => void,
    data?: any,
    analyticsParams?: { type: "plan" | "credits"; item_id: string; amount_cents: number }
) {
    try {
        await fetch("/api/payment-confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentIntentId }),
        });
    } catch { /* webhook will handle it as fallback */ }

    if (analyticsParams) {
        track({ name: "checkout_success", params: analyticsParams });
        if (analyticsParams.type === "plan") {
            updateUserProperties({ plan: analyticsParams.item_id });
        }
    }

    if (onSuccess) {
        onSuccess(data);
    } else {
        window.location.href = "/dashboard";
    }
}

interface PaymentRequestButtonProps {
    email: string;
    amountCents: number;
    purchaseType: "plan" | "credits";
    itemId: string;
    discountCode?: string | null;
    onSuccess?: (data: any) => void;
}

function PaymentRequestButton({ email, amountCents, purchaseType, itemId, discountCode, onSuccess }: PaymentRequestButtonProps) {
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
                    body: JSON.stringify({ payment_method_id: ev.paymentMethod.id, purchaseType, itemId, discountCode }),
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
                    await confirmPaymentAndNavigate(data.paymentIntentId, onSuccess, data, { type: purchaseType, item_id: itemId, amount_cents: amountCents });
                }
            } catch {
                ev.complete("fail");
            }
        });

        setPaymentRequest(pr);
        return () => { try { pr?.off?.("paymentmethod"); } catch { } };
    }, [stripe, amountCents, purchaseType, itemId, discountCode]);

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
    discountCode?: string | null;
    onSuccess?: (data: any) => void;
}

function CheckoutForm({ email, purchaseType, itemId, discountCode, onSuccess }: CheckoutFormProps) {
    const stripe = useStripe();
    const elements = useElements();
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const baseAmountCents = computePriceInCents(purchaseType, itemId);
    const amountCents = discountCode ? applyDiscount(baseAmountCents, discountCode) : baseAmountCents;

    const isFree = amountCents < 100;

    const handlePay = async (e?: React.FormEvent) => {
        e?.preventDefault();
        setLoading(true);
        setError("");

        track({ name: "checkout_submit", params: { type: purchaseType, item_id: itemId, amount_cents: amountCents } });

        try {
            if (isFree) {
                const res = await fetch("/api/create-payment", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ purchaseType, itemId, discountCode }),
                });
                const data = await res.json();
                if (data.error) { setError(data.error); setLoading(false); return; }
                setSuccess(true);
                setLoading(false);
                track({ name: "checkout_free_success", params: { item_id: itemId } });
                if (purchaseType === "plan") updateUserProperties({ plan: itemId });
                if (onSuccess) onSuccess(data); else window.location.href = "/dashboard";
                return;
            }

            if (!stripe || !elements) return;

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
                track({ name: "checkout_error", params: { error_message: pmError.message ?? "pm_error", item_id: itemId } });
                setError(pmError.message || "Payment method error");
                setLoading(false);
                return;
            }

            const res = await fetch("/api/create-payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ payment_method_id: paymentMethod!.id, purchaseType, itemId, discountCode }),
            });

            const data = await res.json();
            if (data.error) {
                track({ name: "checkout_error", params: { error_message: data.error, item_id: itemId } });
                setError(data.error);
                setLoading(false);
                return;
            }

            const { error: confirmError } = await stripe.confirmCardPayment(data.client_secret);
            if (confirmError) {
                track({ name: "checkout_error", params: { error_message: confirmError.message ?? "confirm_error", item_id: itemId } });
                setError(confirmError.message || "Payment confirmation failed");
                setLoading(false);
                return;
            }

            setSuccess(true);
            setLoading(false);
            await confirmPaymentAndNavigate(data.paymentIntentId, onSuccess, data, { type: purchaseType, item_id: itemId, amount_cents: amountCents });
        } catch (err: any) {
            track({ name: "checkout_error", params: { error_message: err.message ?? "unexpected_error", item_id: itemId } });
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
            {!isFree && (
                <>
                    <PaymentRequestButton
                        email={email}
                        amountCents={amountCents}
                        purchaseType={purchaseType}
                        itemId={itemId}
                        discountCode={discountCode}
                        onSuccess={onSuccess}
                    />
                    <StripeCardInputs />
                </>
            )}

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
                ) : isFree ? (
                    <span className="flex items-center gap-2">
                        Confirm free purchase <ArrowRight className="w-4 h-4" />
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
    discountCode?: string | null;
}

function PurchaseSummary({ purchaseType, itemId, discountCode }: PurchaseSummaryProps) {
    const baseAmountCents = computePriceInCents(purchaseType, itemId);
    const amountCents = discountCode ? applyDiscount(baseAmountCents, discountCode) : baseAmountCents;
    const hasDiscount = discountCode && amountCents !== baseAmountCents;

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
                    <div className="text-right">
                        {hasDiscount && <div className="text-sm text-gray-400 line-through">{formatPrice(baseAmountCents)}</div>}
                        <div className="text-white font-bold text-xl">{formatPrice(amountCents)}</div>
                    </div>
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
                <div className="text-right">
                    {hasDiscount && <div className="text-sm text-gray-400 line-through">{formatPrice(baseAmountCents)}</div>}
                    <div className="text-white font-bold text-xl">{formatPrice(amountCents)}</div>
                </div>
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
    const [discountCode, setDiscountCode] = useState<string | null>(null);

    useEffect(() => {
        const code = getDiscountCode();
        setDiscountCode(code);
        const baseAmount = computePriceInCents(purchaseType, itemId);
        const finalAmount = code ? applyDiscount(baseAmount, code) : baseAmount;
        track({ name: "checkout_open", params: { type: purchaseType, item_id: itemId, amount_cents: finalAmount } });
        if (code) {
            track({ name: "discount_code_apply", params: { code, discount_type: "auto", discount_value: baseAmount - finalAmount } });
        }
    }, [purchaseType, itemId]);

    return (
        <div className="no-scrollbar overflow-y-auto space-y-4">
            <Elements stripe={stripePromise}>
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <PurchaseSummary purchaseType={purchaseType} itemId={itemId} discountCode={discountCode} />
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
                        <h3 className="text-lg font-semibold text-white mb-4">Payment details</h3>
                        <CheckoutForm
                            email={email}
                            purchaseType={purchaseType}
                            itemId={itemId}
                            discountCode={discountCode}
                            onSuccess={onSuccess}
                        />
                    </Card>
                </div>
            </Elements>
        </div>
    );
}
