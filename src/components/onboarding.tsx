'use client'

import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements, CardNumberElement, CardExpiryElement, CardCvcElement, PaymentRequestButtonElement } from "@stripe/react-stripe-js";
import { useRef, useState, useTransition } from 'react'
import { motion, AnimatePresence } from "framer-motion"
import { selectPlan } from '@/actions/onboarding-actions'
import { Gift, Target, Rocket, Crown, Check, CheckCircle, ArrowRight, Loader2, Globe, Brain, User, Edit3, Link, Flag, Edit, Edit2, Edit3Icon, Edit2Icon, Scroll, Linkedin, CopyPlus, PlusSquare } from 'lucide-react'
import { submitCompanies } from '@/actions/onboarding-actions'
import { Building, Plus, X, Wand2 } from 'lucide-react'
import { Card } from './ui/card'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { submitProfile } from '@/actions/onboarding-actions'
import { Textarea } from './ui/textarea'
import { submitQueries } from '@/actions/onboarding-actions'
import {
    FileText,
    PlusCircle,
    RefreshCw,
    Upload,
    Trash2, MapPin, Clock, Users, Mail, Shield
} from 'lucide-react'
import { completeOnboarding } from '@/actions/onboarding-actions'

interface SetupCompleteClientProps {
    userId: string
}

interface Customizations {
    tone: string
    length: string
    instructions: string
}

const toneOptions = [
    { id: 'professional', label: 'Professional', description: 'Formal and business-focused' },
    { id: 'friendly', label: 'Friendly', description: 'Warm and approachable' },
    { id: 'confident', label: 'Confident', description: 'Bold and assertive' }
]

const lengthOptions = [
    { id: 'short', label: 'Short', description: '2-3 paragraphs, quick read' },
    { id: 'medium', label: 'Medium', description: '3-4 paragraphs, balanced' },
    { id: 'long', label: 'Long', description: '4-5 paragraphs, detailed' }
]

const focusOptions = [
    { id: 'experience', label: 'Experience', description: 'Highlight work history' },
    { id: 'skills', label: 'Skills', description: 'Emphasize technical abilities' },
    { id: 'achievements', label: 'Achievements', description: 'Showcase accomplishments' }
]

export function SetupCompleteClient({ userId }: SetupCompleteClientProps) {
    const [customizations, setCustomizations] = useState<Customizations>({
        //tone: 'professional',
        //length: 'medium',
        position_description: '',
        instructions: ''
    })
    const [isPending, startTransition] = useTransition()

    const handleStartGeneration = () => {
        startTransition(async () => {
            await completeOnboarding(userId, customizations)
        })
    }

    // Variants per animazione sequenziale delle card
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.15,
                delayChildren: 0.2
            }
        }
    }

    const itemVariants = {
        hidden: { opacity: 0, y: 30, scale: 0.95 },
        visible: {
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
                duration: 0.6,
                ease: [0.25, 0.1, 0.25, 1]
            }
        }
    }

    return (
        <>
            <motion.div
                className="space-y-8 mb-8"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {false && <>
                    {/* Email Tone */}
                    <motion.div
                        variants={itemVariants}
                        className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6"
                    >
                        <h3 className="text-xl font-semibold text-white mb-4">Email Tone</h3>
                        <div className="grid md:grid-cols-3 gap-4">
                            {toneOptions.map((option) => (
                                <div
                                    key={option.id}
                                    onClick={() => setCustomizations({ ...customizations, tone: option.id })}
                                    className={`bg-white/5  border rounded-xl p-4 cursor-pointer transition-all duration-300 ${customizations.tone === option.id
                                        ? 'ring-2 ring-violet-500 bg-white/10 border-violet-500'
                                        : 'border-white/10 hover:bg-white/10'
                                        }`}
                                >
                                    <h4 className="text-white font-medium mb-2">{option.label}</h4>
                                    <p className="text-gray-400 text-sm">{option.description}</p>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Email Length */}
                    <motion.div
                        variants={itemVariants}
                        className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6"
                    >
                        <h3 className="text-xl font-semibold text-white mb-4">Email Length</h3>
                        <div className="grid md:grid-cols-3 gap-4">
                            {lengthOptions.map((option) => (
                                <div
                                    key={option.id}
                                    onClick={() => setCustomizations({ ...customizations, length: option.id })}
                                    className={`bg-white/5 border rounded-xl p-4 cursor-pointer transition-all duration-300 ${customizations.length === option.id
                                        ? 'ring-2 ring-violet-500 bg-white/10 border-violet-500'
                                        : 'border-white/10 hover:bg-white/10'
                                        }`}
                                >
                                    <h4 className="text-white font-medium mb-2">{option.label}</h4>
                                    <p className="text-gray-400 text-sm">{option.description}</p>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </>}

                {/* Primary Focus */}
                <motion.div
                    variants={itemVariants}
                    className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6"
                >
                    <h3 className="text-xl font-semibold text-white mb-4">Target Position Description</h3>
                    <Textarea value={customizations.position_description} onChange={v => setCustomizations(prev => ({ ...prev, position_description: v.target.value }))} placeholder='I want to be...' rows={4} />
                </motion.div>

                {/* Primary Focus */}
                <motion.div
                    variants={itemVariants}
                    className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6"
                >
                    <h3 className="text-xl font-semibold text-white mb-4">Custom Instructions</h3>
                    <Textarea value={customizations.instructions} onChange={v => setCustomizations(prev => ({ ...prev, instructions: v.target.value }))} placeholder='Anything you want to specify; your instructions will be added in the mail generation prompt.' rows={4} />
                </motion.div>
            </motion.div>

            {/* Call to Action */}
            <motion.div
                className="text-center"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.7, ease: "easeOut" }}
            >
                <button
                    onClick={handleStartGeneration}
                    disabled={isPending || !customizations.position_description.trim()}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-3 px-8 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center space-x-2 shadow-lg shadow-green-500/20"
                >
                    {isPending ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Starting Generation...</span>
                        </>
                    ) : (
                        <>
                            <Rocket className="w-5 h-5" />
                            <span>Start Email Generation</span>
                        </>
                    )}
                </button>

                <div className="mt-6 grid md:grid-cols-3 gap-4 text-sm text-gray-400">
                    <div className="flex items-center justify-center space-x-2">
                        <Clock className="w-4 h-4 text-blue-400" />
                        <span>Processing: 24hrs - 7 days</span>
                    </div>
                    <div className="flex items-center justify-center space-x-2">
                        <Mail className="w-4 h-4 text-green-400" />
                        <span>Email updates included</span>
                    </div>
                    <div className="flex items-center justify-center space-x-2">
                        <Shield className="w-4 h-4 text-purple-400" />
                        <span>Premium queue priority</span>
                    </div>
                </div>
            </motion.div>
        </>
    )
}

export const PaymentStepClient = ({ serverResponse }) => {
    const cardRef = useRef(null);
    const [isSdkReady, setIsSdkReady] = useState(false);

    // Questa funzione viene chiamata SOLO quando lo script è carico
    const initXPay = useCallback(() => {
        if (!window.XPay) return;

        console.log("Inizializzazione XPay...");
        XPay.init();
        XPay.setConfig(serverResponse);

        // Stile
        const style = {
            common: { color: "#ffffff", fontSize: "16px" },
            "::placeholder": { color: "rgba(255,255,255,0.3)" },
            ":focus": { color: "#ffffff" },
            error: { color: "#ff0000", fontFamily: "Arial, monospace" },
            correct: { color: "white" }
        };

        const accepted = [
            XPay.CardBrand.MASTERCARD,
            XPay.CardBrand.VISA,
            XPay.CardBrand.MAESTRO
        ];

        // Creazione Campi
        const card = XPay.create(XPay.OPERATION_TYPES.SPLIT_CARD, style, accepted);
        cardRef.current = card;
        card.mount("xpay-pan", "xpay-expiry", "xpay-cvv");

        // Bottoni APM
        const buttons = XPay.create(XPay.OPERATION_TYPES.PAYMENT_BUTTON, []);
        buttons.mount("xpay-btn");

        setIsSdkReady(true);
    }, [serverResponse]);

    // Setup Event Listeners (puoi tenerlo in un useEffect che dipende da isSdkReady)
    useEffect(() => {
        if (!isSdkReady) return;

        // --------------------------------------------------------
        // EVENTI XPay
        // --------------------------------------------------------
        window.addEventListener("XPay_Ready", (e) =>
            console.log("XPay Ready", e.detail)
        );

        window.addEventListener("XPay_Card_Error", (event) => {
            const el = document.getElementById("xpay-card-errors");
            el.textContent = event.detail.errorMessage || "";
        });

        window.addEventListener("XPay_Payment_Started", (event) => {
            console.log("Metodo selezionato:", event.detail);
        });

        // --------------------------------------------------------
        // 👉 RISPOSTE APM (Google Pay, Apple Pay, PayPal, APM)
        // --------------------------------------------------------
        window.addEventListener("XPay_Payment_Result", async (event) => {
            console.log("APM RESULT =>", event.detail);

            const response = event.detail;

            if (response.esito === "OK") {
                alert("Pagamento completato con successo!");
            } else {
                document.getElementById("xpay-card-errors").textContent =
                    "[" + response.errore?.codice + "] " + response.errore?.messaggio;
            }
        });

        // --------------------------------------------------------
        // EVENTO NONCE PER PAGAMENTO CON CARTA
        // --------------------------------------------------------
        window.addEventListener("XPay_Nonce", async (event) => {
            const response = event.detail;
            if (response.esito === "OK") {
                try {
                    const result = await fetch("/api/protected/nexi-payment", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            xpayNonce: response.xpayNonce,
                            xpayIdOperazione: response.idOperazione,
                            xpayTimeStamp: response.timeStamp,
                            amount: serverResponse.paymentParams.amount,
                            transactionId: serverResponse.paymentParams.transactionId
                        })
                    });

                    const esitoPagamento = await result.json();

                    if (esitoPagamento.esito === "OK") {
                        alert("Pagamento riuscito! Codice autorizzazione: " +
                            esitoPagamento.codiceAutorizzazione);
                    } else {
                        document.getElementById("xpay-card-errors").textContent =
                            "[" + (esitoPagamento.errore?.codice || "") + "] " +
                            (esitoPagamento.errore?.messaggio || "Errore generico");
                    }
                } catch (err) {
                    document.getElementById("xpay-card-errors").textContent =
                        "Errore server: " + err;
                } finally {
                    document.getElementById("pagaBtn").disabled = false;
                }
            } else {
                document.getElementById("xpay-card-errors").textContent =
                    "[" + response.errore.codice + "] " + response.errore.messaggio;
                document.getElementById("pagaBtn").disabled = false;
            }
        });

        return () => {
            window.removeEventListener("XPay_Nonce", handleNonce);
        }
    }, [serverResponse, isSdkReady]);


    // --------------------------------------------------------
    // FUNZIONE PAGAMENTO CARTA
    // --------------------------------------------------------
    const handlePay = (e) => {
        e.preventDefault();
        document.getElementById("pagaBtn").disabled = true;

        // 3DS 2.2
        const infoSicurezza = { transType: "01" };
        XPay.setInformazioniSicurezza(infoSicurezza);

        XPay.createNonce("payment-form", cardRef.current);
    };


    // --------------------------------------------------------
    // RENDER COMPONENTE
    // --------------------------------------------------------
    return (
        <>
            <cript
                src={`https://ecommerce.nexi.it/ecomm/XPayBuild/js?alias=${process.env.NEXT_PUBLIC_NEXI_ALIAS}`}
                strategy="afterInteractive"
                onLoad={initXPay} // <--- Qui avviene la magia
            />

            <form id="payment-form" className="space-y-4">

                {/* 👉 DIV DEI METODI DI PAGAMENTO ALTERNATIVI */}
                <div id="xpay-btn" className="my-6"></div>

                {/* PAN */}
                <div className="relative w-full">
                    <div className="p-4 bg-white/10 border border-white/20 rounded-full focus-within:ring-2 focus-within:ring-violet-500 transition-all duration-300">
                        <div id="xpay-pan"></div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {/* Expiry */}
                    <div className="relative w-full">
                        <div className="p-4 bg-white/10 border border-white/20 rounded-full focus-within:ring-2 focus-within:ring-violet-500 transition-all duration-300">
                            <div id="xpay-expiry" />
                        </div>
                    </div>

                    {/* CVV */}
                    <div className="relative w-full">
                        <div className="p-4 bg-white/10 border border-white/20 rounded-full focus-within:ring-2 focus-within:ring-violet-500 transition-all duration-300">
                            <div id="xpay-cvv"></div>
                        </div>
                    </div>
                </div>

                <div id="xpay-card-errors" className="text-red-500 mt-2"></div>

                <Button
                    id="pagaBtn"
                    onClick={handlePay}
                    className="w-full"
                >
                    Paga con carta
                </Button>
            </form>
        </>
    );
};

export function PaymentRedirectClient({ payload }) {
    const handleSubmit = () => {
        document.getElementById("nexiForm").submit();
    };

    return (
        <div className="p-6 bg-gray-900 rounded-xl shadow-lg">
            <p className="text-gray-300 mb-4">
                Verrai reindirizzato al sistema di pagamento sicuro Nexi.
            </p>

            <form
                id="nexiForm"
                method="POST"
                action="https://ecommerce.nexi.it/ecomm/ecomm/DispatcherServlet"
                acceptCharset="ISO-8859-1"
            >
                {Object.entries(payload).map(([key, value]) => (
                    <input key={key} type="hidden" name={key} value={value} />
                ))}
            </form>

            <button
                onClick={handleSubmit}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white mt-4"
            >
                Paga ora 💳
            </button>
        </div>
    );
}

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

function CheckoutForm({ email }: { email: string }) {
    const stripe = useStripe();
    const elements = useElements();
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handlePay = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (!stripe || !elements) return;
        setLoading(true);

        setError("");

        // 1. Crea PaymentMethod
        const cardNumberElement = elements.getElement(CardNumberElement);
        if (!cardNumberElement) return;

        const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
            type: "card",
            card: cardNumberElement,
            billing_details: { email },
        });

        if (pmError) {
            setError(pmError.message || "Errore nel metodo di pagamento");
            setLoading(false);
            return;
        }

        // 2. Chiama API per creare subscription
        const res = await fetch("/api/create-subscription", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, payment_method_id: paymentMethod.id }),
        });

        const data = await res.json();
        if (data.error) {
            setError(data.error);
            setLoading(false);
            return;
        }

        // 3. Conferma il pagamento lato client
        const { error: confirmError } = await stripe.confirmCardPayment(data.client_secret);
        if (confirmError) {
            setError(confirmError.message);
            setLoading(false);
            return;
        }

        setLoading(false);
        alert("Abbonamento attivato con successo!");
    };

    // Opzioni di stile per Elements
    const elementOptions = {
        style: {
            base: {
                color: "#fff",
                fontSize: "16px",
                fontFamily: "Inter, sans-serif",
                "::placeholder": { color: "#a1a1aa" },
            },
            invalid: { color: "#f87171", iconColor: "#f87171" },
        },
    };

    return (
        <form id="payment-form" className="space-y-4">
            {/* Payment Request Button (Apple/Google Pay) */}
            <div id="xpay-btn" className="my-6">
                <PaymentRequestButton email={email} amount={2500} />
            </div>

            {/* Card Elements come prima */}
            <div className="relative w-full">
                <div className="p-4 bg-white/10 border border-white/20 rounded-full focus-within:ring-2 focus-within:ring-violet-500 transition-all duration-300">
                    <CardNumberElement options={elementOptions} />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="relative w-full">
                    <div className="p-4 bg-white/10 border border-white/20 rounded-full focus-within:ring-2 focus-within:ring-violet-500 transition-all duration-300">
                        <CardExpiryElement options={elementOptions} />
                    </div>
                </div>

                <div className="relative w-full">
                    <div className="p-4 bg-white/10 border border-white/20 rounded-full focus-within:ring-2 focus-within:ring-violet-500 transition-all duration-300">
                        <CardCvcElement options={elementOptions} />
                    </div>
                </div>
            </div>

            <div id="xpay-card-errors" className="text-red-500 mt-2">{error}</div>

            <Button id="pagaBtn" onClick={handlePay} className="w-full" disabled={loading}>
                {loading ? "Elaborazione..." : "Paga con carta"}
            </Button>
        </form>
    );
}

function PaymentRequestButton({ email, amount }) {
    const stripe = useStripe();
    const [paymentRequest, setPaymentRequest] = useState(null);
    const [canMakePayment, setCanMakePayment] = useState(false);

    useEffect(() => {
        if (!stripe) return;

        const pr = stripe.paymentRequest({
            country: "IT",
            currency: "eur",
            total: {
                label: "Abbonamento biennale",
                amount: amount, // in centesimi, es. 2500
            },
            requestPayerName: true,
            requestPayerEmail: true,
        });

        // Controlla se il browser supporta Apple/Google Pay
        pr.canMakePayment().then((result) => {
            if (result) setCanMakePayment(true);
        });

        // Quando l’utente completa il pagamento
        pr.on("paymentmethod", async (ev) => {
            try {
                const res = await fetch("/api/create-subscription", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, payment_method_id: ev.paymentMethod.id }),
                });
                const data = await res.json();

                if (data.error) {
                    ev.complete("fail");
                    alert(data.error);
                    return;
                }

                const { error: confirmError } = await stripe.confirmCardPayment(
                    data.client_secret,
                    { payment_method: ev.paymentMethod.id },
                    { handleActions: true }
                );

                if (confirmError) {
                    ev.complete("fail");
                    alert(confirmError.message);
                } else {
                    ev.complete("success");
                    alert("Abbonamento attivato con successo!");
                }
            } catch (err) {
                ev.complete("fail");
                alert(err.message);
            }
        });

        setPaymentRequest(pr);
    }, [stripe]);

    if (!canMakePayment || !paymentRequest) return null;

    return <PaymentRequestButtonElement options={{ paymentRequest }} />;
}

export function SubscribeWrapper({ email }: { email: string }) {
    return (
        <Elements stripe={stripePromise}>
            <CheckoutForm email={email} />
        </Elements>
    );
}

interface AdvancedFiltersClientProps {
    userId: string
    maxFilters: number
}

interface FilterValues {
    location: { country: string, continent: string };
    experience: string
    industry: string
    companySize: string
}

export function AdvancedFiltersClientOld({ userId, maxFilters }: AdvancedFiltersClientProps) {
    const availableFilters = [
        { id: 'location', label: 'Location', icon: 'MapPin', placeholder: 'e.g., San Francisco, Remote' },
        { id: 'experience', label: 'Years of Experience', icon: 'Clock', placeholder: 'e.g., 3-5 years' },
        { id: 'industry', label: 'Industry Focus', icon: 'Building', placeholder: 'e.g., FinTech, SaaS' },
        { id: 'companySize', label: 'Company Size', icon: 'Users', placeholder: 'e.g., Startup, Enterprise' }
    ]

    const iconMap = {
        MapPin,
        Clock,
        Building,
        Users
    }

    const [filters, setFilters] = useState<FilterValues>({
        location: '',
        experience: '',
        industry: '',
        companySize: ''
    })
    const [selectedFilters, setSelectedFilters] = useState<string[]>([])
    const [isPending, startTransition] = useTransition()

    const toggleFilter = (filterId: string) => {
        if (selectedFilters.includes(filterId)) {
            setSelectedFilters(selectedFilters.filter(id => id !== filterId))
            setFilters({ ...filters, [filterId]: '' })
        } else if (selectedFilters.length < maxFilters) {
            setSelectedFilters([...selectedFilters, filterId])
        }
    }

    const updateFilter = (filterId: string, value: string) => {
        setFilters({ ...filters, [filterId]: value })
    }

    const handleContinue = () => {
        const activeFilters: Record<string, string> = {}
        selectedFilters.forEach(filterId => {
            if (filters[filterId as keyof FilterValues].trim()) {
                activeFilters[filterId] = filters[filterId as keyof FilterValues]
            }
        })

        startTransition(async () => {
            console.log(activeFilters)
            await submitQueries(userId, activeFilters)
        })
    }

    const handleSkip = () => {
        startTransition(async () => {
            await submitQueries(userId, {})
        })
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
                duration: 0.8,
                ease: [0.16, 1, 0.3, 1]
            }}
        >
            <motion.div
                className="bg-white/5 border border-white/10 rounded-xl p-8 mb-8"
                initial="hidden"
                animate="visible"
                variants={{
                    hidden: { opacity: 0 },
                    visible: {
                        opacity: 1,
                        transition: {
                            staggerChildren: 0.12,
                            delayChildren: 0.25
                        }
                    }
                }}
            >
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold text-white">Filter Options</h3>
                    <span className="bg-gradient-to-r from-violet-500 to-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg shadow-violet-500/20">
                        {selectedFilters.length} / {maxFilters} filters selected
                    </span>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mb-8">
                    {availableFilters.map((filter, index) => {
                        const isSelected = selectedFilters.includes(filter.id)
                        const isDisabled = !isSelected && selectedFilters.length >= maxFilters
                        const Icon = iconMap[filter.icon as keyof typeof iconMap]

                        return (
                            <motion.div
                                key={filter.id}
                                variants={{
                                    hidden: { opacity: 0, y: 20, scale: 0.98 },
                                    visible: {
                                        opacity: 1,
                                        y: 0,
                                        scale: 1,
                                        transition: {
                                            type: "spring",
                                            stiffness: 120,
                                            damping: 12,
                                            duration: 0.5,
                                            delay: index * 0.05
                                        }
                                    }
                                }}
                                onClick={() => !isDisabled && toggleFilter(filter.id)}
                                className={`bg-white/5 border rounded-xl p-6 cursor-pointer transition-all duration-300 ${isSelected
                                    ? "ring-2 ring-violet-500 bg-white/10 border-violet-500 shadow-md shadow-violet-500/10"
                                    : "border-white/10 hover:bg-white/10"
                                    } ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center space-x-3">
                                        <div
                                            className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSelected
                                                ? "bg-violet-500 text-white"
                                                : "bg-white/10 text-gray-400"
                                                }`}
                                        >
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <span
                                            className={`font-medium ${isSelected ? "text-white" : "text-gray-300"
                                                }`}
                                        >
                                            {filter.label}
                                        </span>
                                    </div>

                                    {isSelected ? (
                                        <CheckCircle className="w-5 h-5 text-green-400" />
                                    ) : (
                                        <div className="w-5 h-5 border-2 border-gray-600 rounded-full" />
                                    )}
                                </div>

                                {isSelected && (
                                    <input
                                        type="text"
                                        placeholder={filter.placeholder}
                                        value={filters[filter.id as keyof FilterValues]}
                                        onChange={(e) => updateFilter(filter.id, e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                    />
                                )}
                            </motion.div>
                        )
                    })}
                </div>

                <motion.div
                    variants={{
                        hidden: { opacity: 0, y: 20 },
                        visible: {
                            opacity: 1,
                            y: 0,
                            transition: { duration: 0.6, ease: "easeOut" }
                        }
                    }}
                    className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4"
                >
                    <h4 className="text-blue-400 font-semibold mb-2">💡 Smart Filtering</h4>
                    <p className="text-gray-300 text-sm">
                        If your filters result in no matches or poor quality matches, our AI will automatically
                        retry without the most restrictive filter to ensure you always get great results.
                    </p>
                </motion.div>
            </motion.div>

            <motion.div
                className="text-center"
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
                <div className="flex items-center justify-center space-x-4">
                    <button
                        onClick={handleSkip}
                        disabled={isPending}
                        className="text-gray-300 hover:text-white font-semibold py-3 px-8 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Skip Filters
                    </button>

                    <button
                        onClick={handleContinue}
                        disabled={isPending}
                        className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white font-semibold py-3 px-8 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center space-x-2 shadow-lg shadow-violet-500/20"
                    >
                        {isPending ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Saving...</span>
                            </>
                        ) : (
                            <>
                                <span>Continue Setup</span>
                                <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    )
}

import { Reorder } from 'framer-motion';
import {
    GripVertical,
    Save,
    RotateCcw,
    GraduationCap,
    Briefcase,
    TrendingUp,

    Star,
    AlertCircle,
    CheckCircle2,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import {
    Search,
    Award,
    Building2,
    Calendar,
    DollarSign,
    Code,
    Languages,
    Lightbulb,
    MessageSquare,
    ArrowDown,
    Play,
    Sparkles,
    BookOpen
} from 'lucide-react';
import { useMemo } from 'react';

// --- NUOVI CRITERI DISPONIBILI ---
// Basati sulle interfacce fornite
/*const aavailableCriteria = {
  industry: {
    label: 'Settore Industriale',
    icon: Building2,
    color: 'cyan',
    description: 'Il settore più rilevante della persona',
    inputType: 'select',
    options: [
      "accounting",
      "airlines/aviation",
      "alternative dispute resolution",
      "alternative medicine",
      "animation",
      "apparel & fashion",
      "architecture & planning",
      "arts and crafts",
      "automotive",
      "aviation & aerospace",
      "banking",
      "biotechnology",
      "broadcast media",
      "building materials",
      "business supplies and equipment",
      "capital markets",
      "chemicals",
      "civic & social organization",
      "civil engineering",
      "commercial real estate",
      "computer & network security",
      "computer games",
      "computer hardware",
      "computer networking",
      "computer software",
      "construction",
      "consumer electronics",
      "consumer goods",
      "consumer services",
      "cosmetics",
      "dairy",
      "defense & space",
      "design",
      "e-learning",
      "education management",
      "electrical/electronic manufacturing",
      "entertainment",
      "environmental services",
      "events services",
      "executive office",
      "facilities services",
      "farming",
      "financial services",
      "fine art",
      "fishery",
      "food & beverages",
      "food production",
      "fund-raising",
      "furniture",
      "gambling & casinos",
      "glass, ceramics & concrete",
      "government administration",
      "government relations",
      "graphic design",
      "health, wellness and fitness",
      "higher education",
      "hospital & health care",
      "hospitality",
      "human resources",
      "import and export",
      "individual & family services",
      "industrial automation",
      "information services",
      "information technology and services",
      "insurance",
      "international affairs",
      "international trade and development",
      "internet",
      "investment banking",
      "investment management",
      "judiciary",
      "law enforcement",
      "law practice",
      "legal services",
      "legislative office",
      "leisure, travel & tourism",
      "libraries",
      "logistics and supply chain",
      "luxury goods & jewelry",
      "machinery",
      "management consulting",
      "maritime",
      "market research",
      "marketing and advertising",
      "mechanical or industrial engineering",
      "media production",
      "medical devices",
      "medical practice",
      "mental health care",
      "military",
      "mining & metals",
      "motion pictures and film",
      "museums and institutions",
      "music",
      "nanotechnology",
      "newspapers",
      "non-profit organization management",
      "oil & energy",
      "online media",
      "outsourcing/offshoring",
      "package/freight delivery",
      "packaging and containers",
      "paper & forest products",
      "performing arts",
      "pharmaceuticals",
      "philanthropy",
      "photography",
      "plastics",
      "political organization",
      "primary/secondary education",
      "printing",
      "professional training & coaching",
      "program development",
      "public policy",
      "public relations and communications",
      "public safety",
      "publishing",
      "railroad manufacture",
      "ranching",
      "real estate",
      "recreational facilities and services",
      "religious institutions",
      "renewables & environment",
      "research",
      "restaurants",
      "retail",
      "security and investigations",
      "semiconductors",
      "shipbuilding",
      "sporting goods",
      "sports",
      "staffing and recruiting",
      "supermarkets",
      "telecommunications",
      "textiles",
      "think tanks",
      "tobacco",
      "translation and localization",
      "transportation/trucking/railroad",
      "utilities",
      "venture capital & private equity",
      "veterinary",
      "warehousing",
      "wholesale",
      "wine and spirits",
      "wireless",
      "writing and editing"]
  },
  job_title_role: {
    label: 'Ruolo Lavorativo',
    icon: Briefcase,
    color: 'emerald',
    description: 'Il ruolo derivato dal titolo lavorativo attuale',
    inputType: 'select',
    options: ["advisory",
"analyst",
"creative",
"education",
"engineering",
"finance",
"fulfillment",
"health",
"hospitality",
"human_resources",
"legal",
"manufacturing",
"marketing",
"operations",
"partnerships",
"product",
"professional_service",
"public_service",
"research",
"sales",
"sales_engineering",
"support",
"trade",
"unemployed"]
  },
  job_title_sub_role: {
    label: 'Sotto-Ruolo Lavorativo',
    icon: Briefcase,
    color: 'emerald',
    description: 'Il sotto-ruolo derivato dal titolo lavorativo',
    inputType: 'select',
    options: ["academic",
"account_executive",
"account_management",
"accounting",
"accounting_services",
"administrative",
"advisor",
"agriculture",
"aides",
"architecture",
"artist",
"board_member",
"bookkeeping",
"brand",
"building_and_grounds",
"business_analyst",
"business_development",
"chemical",
"compliance",
"construction",
"consulting",
"content",
"corporate_development",
"curation",
"customer_success",
"customer_support",
"data_analyst",
"data_engineering",
"data_science",
"dental",
"devops",
"doctor",
"electric",
"electrical",
"emergency_services",
"entertainment",
"executive",
"fashion",
"financial",
"fitness",
"fraud",
"graphic_design",
"growth",
"hair_stylist",
"hardware",
"health_and_safety",
"human_resources",
"implementation",
"industrial",
"information_technology",
"insurance",
"investment_banking",
"investor",
"investor_relations",
"journalism",
"judicial",
"legal",
"legal_services",
"logistics",
"machinist",
"marketing_design",
"marketing_services",
"mechanic",
"mechanical",
"military",
"network",
"nursing",
"partnerships",
"pharmacy",
"planning_and_analysis",
"plumbing",
"political",
"primary_and_secondary",
"procurement",
"product_design",
"product_management",
"professor",
"project_management",
"protective_service",
"qa_engineering",
"quality_assurance",
"realtor",
"recruiting",
"restaurants",
"retail",
"revenue_operations",
"risk",
"sales_development",
"scientific",
"security",
"social_service",
"software",
"solutions_engineer",
"strategy",
"student",
"talent_analytics",
"therapy",
"tour_and_travel",
"training",
"translation",
"transport",
"unemployed",
"veterinarian",
"warehouse",
"web",
"wellness"]
  },
  job_title_levels: {
    label: 'Livello di Seniority',
    icon: TrendingUp,
    color: 'amber',
    description: 'Il livello derivato dal titolo lavorativo',
    inputType: 'multiselect',
    options: JOB_LEVELS
  },
  location_country: {
    label: 'Paese',
    icon: MapPin,
    color: 'rose',
    description: 'Il paese di residenza attuale della persona',
    inputType: 'select',
    options: COUNTRIES
  },
  location_continent: {
    label: 'Continente',
    icon: Globe,
    color: 'sky',
    description: 'Il continente di residenza attuale',
    inputType: 'select',
    options: CONTINENTS
  },
  skills: {
    label: 'Competenze (Skills)',
    icon: Code,
    color: 'purple',
    description: 'Competenza specifica (es. Python, React)',
    inputType: 'text',
  },
  job_title: {
    label: 'Nome Posizione Lavorativa Precedente',
    icon: Target,
    color: 'fuchsia',
    description: 'Il titolo lavorativo esatto (es. "Software Engineer")',
    inputType: 'text',
  },
  company_name: {
    label: 'Azienda attuale o Precedente',
    icon: Briefcase,
    color: 'blue',
    description: 'Nome dell\'azienda in cui ha lavorato in passato',
    inputType: 'text',
  },
  company_location_country: {
    label: 'Paese Azienda attuale o precedente',
    icon: MapPin,
    color: 'rose',
    description: 'Il paese dell\'Azienda attuale o precedente',
    inputType: 'select',
    options: COUNTRIES
  },
  company_location_continent: {
    label: 'Continente Azienda attuale o precedente',
    icon: Globe,
    color: 'sky',
    description: 'Il continente dell\'Azienda attuale o precedente',
    inputType: 'select',
    options: CONTINENTS
  },
  company_linkedin_url: {
    label: 'Profilo Linkedin dell\'Azienda attuale o precedente',
    icon: GraduationCap,
    color: 'indigo',
    description: 'Profilo Linkedin dell\'Azienda attuale o precedente',
    inputType: 'text',
  },
  company_domain: {
    label: 'Dominio dell\'Azienda attuale o precedente',
    icon: GraduationCap,
    color: 'indigo',
    description: 'Il dominio dell\'Azienda attuale o precedente',
    inputType: 'text',
  },
  school_name: {
    label: 'Università',
    icon: GraduationCap,
    color: 'indigo',
    description: 'Nome dell\'università frequentata',
    inputType: 'text',
  },
  school_location_country: {
    label: 'Paese Università',
    icon: MapPin,
    color: 'rose',
    description: 'Il paese dell\'università frequentata',
    inputType: 'select',
    options: COUNTRIES
  },
  school_location_continent: {
    label: 'Continente Università',
    icon: Globe,
    color: 'sky',
    description: 'Il continente dell\'università frequentata',
    inputType: 'select',
    options: CONTINENTS
  },
  school_linkedin_url: {
    label: 'Profilo Linkedin dell\'Università',
    icon: GraduationCap,
    color: 'indigo',
    description: 'Profilo Linkedin dell\'università frequentata',
    inputType: 'text',
  },
  school_domain: {
    label: 'Dominio dell\'Università',
    icon: GraduationCap,
    color: 'indigo',
    description: 'Il dominio dell\'università frequentata',
    inputType: 'text',
  },
  school_majors: {
    label: 'Facoltà dell\'Università',
    icon: Globe,
    color: 'sky',
    description: 'La facoltà dell\'università frequentata',
    inputType: 'select',
    options: MAJORS
  },
  school_degrees: {
    label: 'Grado universitario',
    icon: Globe,
    color: 'sky',
    description: 'Il grado di studi universitario',
    inputType: 'select',
    options: DEGREES
  },
};*/

const JOB_LEVELS = [
    { value: 'cxo', label: 'C-Level / Executive' },
    { value: 'director', label: 'Director' },
    { value: 'entry', label: 'Entry Level' },
    { value: 'manager', label: 'Manager' },
    { value: 'owner', label: 'Owner' },
    { value: 'partner', label: 'Partner' },
    { value: 'senior', label: 'Senior' },
    { value: 'training', label: 'Training' },
    { value: 'unpaid', label: 'Unpaid' },
    { value: 'vp', label: 'Vice President' }
];

const COUNTRIES = [
    { value: "afghanistan", label: "Afghanistan" },
    { value: "albania", label: "Albania" },
    { value: "algeria", label: "Algeria" },
    { value: "american samoa", label: "American Samoa" },
    { value: "andorra", label: "Andorra" },
    { value: "angola", label: "Angola" },
    { value: "anguilla", label: "Anguilla" },
    { value: "antigua and barbuda", label: "Antigua and Barbuda" },
    { value: "argentina", label: "Argentina" },
    { value: "armenia", label: "Armenia" },
    { value: "aruba", label: "Aruba" },
    { value: "australia", label: "Australia" },
    { value: "austria", label: "Austria" },
    { value: "azerbaijan", label: "Azerbaijan" },
    { value: "bahamas", label: "Bahamas" },
    { value: "bahrain", label: "Bahrain" },
    { value: "bangladesh", label: "Bangladesh" },
    { value: "barbados", label: "Barbados" },
    { value: "belarus", label: "Belarus" },
    { value: "belgium", label: "Belgium" },
    { value: "belize", label: "Belize" },
    { value: "benin", label: "Benin" },
    { value: "bermuda", label: "Bermuda" },
    { value: "bhutan", label: "Bhutan" },
    { value: "bolivia", label: "Bolivia" },
    { value: "bosnia and herzegovina", label: "Bosnia and Herzegovina" },
    { value: "botswana", label: "Botswana" },
    { value: "bouvet island", label: "Bouvet Island" },
    { value: "brazil", label: "Brazil" },
    { value: "british indian ocean territory", label: "British Indian Ocean Territory" },
    { value: "british virgin islands", label: "British Virgin Islands" },
    { value: "brunei", label: "Brunei" },
    { value: "bulgaria", label: "Bulgaria" },
    { value: "burkina faso", label: "Burkina Faso" },
    { value: "burundi", label: "Burundi" },
    { value: "cambodia", label: "Cambodia" },
    { value: "cameroon", label: "Cameroon" },
    { value: "canada", label: "Canada" },
    { value: "cape verde", label: "Cape Verde" },
    { value: "caribbean netherlands", label: "Caribbean Netherlands" },
    { value: "cayman islands", label: "Cayman Islands" },
    { value: "central african republic", label: "Central African Republic" },
    { value: "chad", label: "Chad" },
    { value: "chile", label: "Chile" },
    { value: "china", label: "China" },
    { value: "christmas island", label: "Christmas Island" },
    { value: "cocos (keeling) islands", label: "Cocos (Keeling) Islands" },
    { value: "colombia", label: "Colombia" },
    { value: "comoros", label: "Comoros" },
    { value: "cook islands", label: "Cook Islands" },
    { value: "costa rica", label: "Costa Rica" },
    { value: "croatia", label: "Croatia" },
    { value: "cuba", label: "Cuba" },
    { value: "curaçao", label: "Curaçao" },
    { value: "cyprus", label: "Cyprus" },
    { value: "czechia", label: "Czechia" },
    { value: "côte d'ivoire", label: "Côte d'Ivoire" },
    { value: "democratic republic of the congo", label: "Democratic Republic of the Congo" },
    { value: "denmark", label: "Denmark" },
    { value: "djibouti", label: "Djibouti" },
    { value: "dominica", label: "Dominica" },
    { value: "dominican republic", label: "Dominican Republic" },
    { value: "ecuador", label: "Ecuador" },
    { value: "egypt", label: "Egypt" },
    { value: "el salvador", label: "El Salvador" },
    { value: "equatorial guinea", label: "Equatorial Guinea" },
    { value: "eritrea", label: "Eritrea" },
    { value: "estonia", label: "Estonia" },
    { value: "eswatini", label: "Eswatini" },
    { value: "ethiopia", label: "Ethiopia" },
    { value: "falkland islands", label: "Falkland Islands" },
    { value: "faroe islands", label: "Faroe Islands" },
    { value: "fiji", label: "Fiji" },
    { value: "finland", label: "Finland" },
    { value: "france", label: "France" },
    { value: "french guiana", label: "French Guiana" },
    { value: "french polynesia", label: "French Polynesia" },
    { value: "french southern territories", label: "French Southern Territories" },
    { value: "gabon", label: "Gabon" },
    { value: "georgia", label: "Georgia" },
    { value: "germany", label: "Germany" },
    { value: "ghana", label: "Ghana" },
    { value: "gibraltar", label: "Gibraltar" },
    { value: "greece", label: "Greece" },
    { value: "greenland", label: "Greenland" },
    { value: "grenada", label: "Grenada" },
    { value: "guadeloupe", label: "Guadeloupe" },
    { value: "guam", label: "Guam" },
    { value: "guatemala", label: "Guatemala" },
    { value: "guernsey", label: "Guernsey" },
    { value: "guinea", label: "Guinea" },
    { value: "guinea-bissau", label: "Guinea-Bissau" },
    { value: "guyana", label: "Guyana" },
    { value: "haiti", label: "Haiti" },
    { value: "heard island and mcdonald islands", label: "Heard Island and McDonald Islands" },
    { value: "honduras", label: "Honduras" },
    { value: "hong kong", label: "Hong Kong" },
    { value: "hungary", label: "Hungary" },
    { value: "iceland", label: "Iceland" },
    { value: "india", label: "India" },
    { value: "indonesia", label: "Indonesia" },
    { value: "iran", label: "Iran" },
    { value: "iraq", label: "Iraq" },
    { value: "ireland", label: "Ireland" },
    { value: "isle of man", label: "Isle of Man" },
    { value: "israel", label: "Israel" },
    { value: "italy", label: "Italy" },
    { value: "ivory coast", label: "Ivory Coast" },
    { value: "jamaica", label: "Jamaica" },
    { value: "japan", label: "Japan" },
    { value: "jersey", label: "Jersey" },
    { value: "jordan", label: "Jordan" },
    { value: "kazakhstan", label: "Kazakhstan" },
    { value: "kenya", label: "Kenya" },
    { value: "kiribati", label: "Kiribati" },
    { value: "kosovo", label: "Kosovo" },
    { value: "kuwait", label: "Kuwait" },
    { value: "kyrgyzstan", label: "Kyrgyzstan" },
    { value: "laos", label: "Laos" },
    { value: "latvia", label: "Latvia" },
    { value: "lebanon", label: "Lebanon" },
    { value: "lesotho", label: "Lesotho" },
    { value: "liberia", label: "Liberia" },
    { value: "libya", label: "Libya" },
    { value: "liechtenstein", label: "Liechtenstein" },
    { value: "lithuania", label: "Lithuania" },
    { value: "luxembourg", label: "Luxembourg" },
    { value: "macau", label: "Macau" },
    { value: "madagascar", label: "Madagascar" },
    { value: "malawi", label: "Malawi" },
    { value: "malaysia", label: "Malaysia" },
    { value: "maldives", label: "Maldives" },
    { value: "mali", label: "Mali" },
    { value: "malta", label: "Malta" },
    { value: "marshall islands", label: "Marshall Islands" },
    { value: "martinique", label: "Martinique" },
    { value: "mauritania", label: "Mauritania" },
    { value: "mauritius", label: "Mauritius" },
    { value: "mayotte", label: "Mayotte" },
    { value: "mexico", label: "Mexico" },
    { value: "micronesia", label: "Micronesia" },
    { value: "moldova", label: "Moldova" },
    { value: "monaco", label: "Monaco" },
    { value: "mongolia", label: "Mongolia" },
    { value: "montenegro", label: "Montenegro" },
    { value: "montserrat", label: "Montserrat" },
    { value: "morocco", label: "Morocco" },
    { value: "mozambique", label: "Mozambique" },
    { value: "myanmar", label: "Myanmar" },
    { value: "namibia", label: "Namibia" },
    { value: "nauru", label: "Nauru" },
    { value: "nepal", label: "Nepal" },
    { value: "netherlands", label: "Netherlands" },
    { value: "new caledonia", label: "New Caledonia" },
    { value: "new zealand", label: "New Zealand" },
    { value: "nicaragua", label: "Nicaragua" },
    { value: "niger", label: "Niger" },
    { value: "nigeria", label: "Nigeria" },
    { value: "niue", label: "Niue" },
    { value: "norfolk island", label: "Norfolk Island" },
    { value: "north korea", label: "North Korea" },
    { value: "north macedonia", label: "North Macedonia" },
    { value: "northern mariana islands", label: "Northern Mariana Islands" },
    { value: "norway", label: "Norway" },
    { value: "oman", label: "Oman" },
    { value: "pakistan", label: "Pakistan" },
    { value: "palau", label: "Palau" },
    { value: "palestine", label: "Palestine" },
    { value: "panama", label: "Panama" },
    { value: "papua new guinea", label: "Papua New Guinea" },
    { value: "paraguay", label: "Paraguay" },
    { value: "peru", label: "Peru" },
    { value: "philippines", label: "Philippines" },
    { value: "pitcairn", label: "Pitcairn" },
    { value: "pitcairn islands", label: "Pitcairn Islands" },
    { value: "poland", label: "Poland" },
    { value: "portugal", label: "Portugal" },
    { value: "puerto rico", label: "Puerto Rico" },
    { value: "qatar", label: "Qatar" },
    { value: "republic of the congo", label: "Republic of the Congo" },
    { value: "romania", label: "Romania" },
    { value: "russia", label: "Russia" },
    { value: "rwanda", label: "Rwanda" },
    { value: "réunion", label: "Réunion" },
    { value: "saint barthélemy", label: "Saint Barthélemy" },
    { value: "saint helena", label: "Saint Helena" },
    { value: "saint kitts and nevis", label: "Saint Kitts and Nevis" },
    { value: "saint lucia", label: "Saint Lucia" },
    { value: "saint martin", label: "Saint Martin" },
    { value: "saint pierre and miquelon", label: "Saint Pierre and Miquelon" },
    { value: "saint vincent and the grenadines", label: "Saint Vincent and the Grenadines" },
    { value: "samoa", label: "Samoa" },
    { value: "san marino", label: "San Marino" },
    { value: "saudi arabia", label: "Saudi Arabia" },
    { value: "senegal", label: "Senegal" },
    { value: "serbia", label: "Serbia" },
    { value: "seychelles", label: "Seychelles" },
    { value: "sierra leone", label: "Sierra Leone" },
    { value: "singapore", label: "Singapore" },
    { value: "sint maarten", label: "Sint Maarten" },
    { value: "slovakia", label: "Slovakia" },
    { value: "slovenia", label: "Slovenia" },
    { value: "solomon islands", label: "Solomon Islands" },
    { value: "somalia", label: "Somalia" },
    { value: "south africa", label: "South Africa" },
    { value: "south georgia and the south sandwich islands", label: "South Georgia and the South Sandwich Islands" },
    { value: "south korea", label: "South Korea" },
    { value: "south sudan", label: "South Sudan" },
    { value: "spain", label: "Spain" },
    { value: "sri lanka", label: "Sri Lanka" },
    { value: "sudan", label: "Sudan" },
    { value: "suriname", label: "Suriname" },
    { value: "svalbard and jan mayen", label: "Svalbard and Jan Mayen" },
    { value: "sweden", label: "Sweden" },
    { value: "switzerland", label: "Switzerland" },
    { value: "syria", label: "Syria" },
    { value: "são tomé and príncipe", label: "São Tomé and Príncipe" },
    { value: "taiwan", label: "Taiwan" },
    { value: "tajikistan", label: "Tajikistan" },
    { value: "tanzania", label: "Tanzania" },
    { value: "thailand", label: "Thailand" },
    { value: "the gambia", label: "The Gambia" },
    { value: "timor-leste", label: "Timor-Leste" },
    { value: "togo", label: "Togo" },
    { value: "tokelau", label: "Tokelau" },
    { value: "tonga", label: "Tonga" },
    { value: "trinidad and tobago", label: "Trinidad and Tobago" },
    { value: "tunisia", label: "Tunisia" },
    { value: "turkey", label: "Turkey" },
    { value: "turkmenistan", label: "Turkmenistan" },
    { value: "turks and caicos islands", label: "Turks and Caicos Islands" },
    { value: "tuvalu", label: "Tuvalu" },
    { value: "u.s. virgin islands", label: "U.S. Virgin Islands" },
    { value: "uganda", label: "Uganda" },
    { value: "ukraine", label: "Ukraine" },
    { value: "united arab emirates", label: "United Arab Emirates" },
    { value: "united kingdom", label: "United Kingdom" },
    { value: "united states", label: "United States" },
    { value: "united states minor outlying islands", label: "United States Minor Outlying Islands" },
    { value: "uruguay", label: "Uruguay" },
    { value: "uzbekistan", label: "Uzbekistan" },
    { value: "vanuatu", label: "Vanuatu" },
    { value: "vatican city", label: "Vatican City" },
    { value: "venezuela", label: "Venezuela" },
    { value: "vietnam", label: "Vietnam" },
    { value: "wallis and futuna", label: "Wallis and Futuna" },
    { value: "western sahara", label: "Western Sahara" },
    { value: "yemen", label: "Yemen" },
    { value: "zambia", label: "Zambia" },
    { value: "zimbabwe", label: "Zimbabwe" },
    { value: "åland islands", label: "Åland Islands" }
];

const CONTINENTS = [
    { value: 'africa', label: 'Africa' },
    { value: 'antarctica', label: 'Antarctica' },
    { value: 'asia', label: 'Asia' },
    { value: 'europe', label: 'Europe' },
    { value: 'north america', label: 'North America' },
    { value: 'oceania', label: 'Oceania' },
    { value: 'south america', label: 'South America' }
];

const MAJORS = [
    { value: 'agriculture', label: 'Agriculture' },
    { value: 'architecture', label: 'Architecture' },
    { value: 'arts', label: 'Arts' },
    { value: 'business', label: 'Business' },
    { value: 'communications', label: 'Communications' },
    { value: 'computer science', label: 'Computer Science' },
    { value: 'education', label: 'Education' },
    { value: 'engineering', label: 'Engineering' },
    { value: 'environmental studies', label: 'Environmental Studies' },
    { value: 'health sciences', label: 'Health Sciences' },
    { value: 'humanities', label: 'Humanities' },
    { value: 'law', label: 'Law' },
    { value: 'life sciences', label: 'Life Sciences' },
    { value: 'mathematics', label: 'Mathematics' },
    { value: 'physical sciences', label: 'Physical Sciences' },
    { value: 'social sciences', label: 'Social Sciences' },
    { value: 'other', label: 'Other' }
];

const DEGREES = [
    { value: 'high school', label: 'High School' },
    { value: 'associate', label: 'Associate Degree' },
    { value: 'bachelor', label: "Bachelor's Degree" },
    { value: 'master', label: "Master's Degree" },
    { value: 'doctorate', label: 'Doctorate' },
    { value: 'professional', label: 'Professional Degree' },
    { value: 'other', label: 'Other' }
];

const availableCriteria = {
    job_title_levels: {
        label: 'Seniority Level',
        icon: TrendingUp,
        color: 'amber',
        description: 'Level derived from job title',
        inputType: 'multiselect',
        options: JOB_LEVELS
    },
    location_country: {
        label: 'Country',
        icon: MapPin,
        color: 'green',
        description: 'Current country of residence',
        inputType: 'multiselect',
        options: COUNTRIES
    },
    location_continent: {
        label: 'Continent',
        icon: Globe,
        color: 'blue',
        description: 'Current continent of residence',
        inputType: 'multiselect',
        options: CONTINENTS
    },
    skills: {
        label: 'Skills',
        icon: Code,
        color: 'purple',
        description: 'Specific skills (e.g., Python, React, AI)',
        inputType: 'tags',
    },
    job_title: {
        label: 'Previous Job Title',
        icon: Briefcase,
        color: 'indigo',
        description: 'Exact job title (e.g., "Software Engineer")',
        inputType: 'tags',
    },
    company_name: {
        label: 'Current or Previous Company',
        icon: Building,
        color: 'cyan',
        description: 'Name of company they worked at',
        inputType: 'tags',
    },
    company_location_country: {
        label: 'Company Country',
        icon: MapPin,
        color: 'green',
        description: 'Country of current or previous company',
        inputType: 'multiselect',
        options: COUNTRIES
    },
    company_location_continent: {
        label: 'Company Continent',
        icon: Globe,
        color: 'blue',
        description: 'Continent of current or previous company',
        inputType: 'multiselect',
        options: CONTINENTS
    },
    company_linkedin_url: {
        label: 'Company LinkedIn',
        icon: Linkedin,
        color: 'blue',
        description: 'LinkedIn profile of company',
        inputType: 'tags',
    },
    company_domain: {
        label: 'Company Domain',
        icon: Globe,
        color: 'teal',
        description: 'Website domain of company',
        inputType: 'tags',
    },
    school_name: {
        label: 'University',
        icon: GraduationCap,
        color: 'violet',
        description: 'Name of university attended',
        inputType: 'tags',
    },
    school_location_country: {
        label: 'University Country',
        icon: MapPin,
        color: 'green',
        description: 'Country of university',
        inputType: 'multiselect',
        options: COUNTRIES
    },
    school_location_continent: {
        label: 'University Continent',
        icon: Globe,
        color: 'blue',
        description: 'Continent of university',
        inputType: 'multiselect',
        options: CONTINENTS
    },
    school_linkedin_url: {
        label: 'University LinkedIn',
        icon: Linkedin,
        color: 'blue',
        description: 'LinkedIn profile of university',
        inputType: 'tags',
    },
    school_domain: {
        label: 'University Domain',
        icon: Globe,
        color: 'rose',
        description: 'Website domain of university',
        inputType: 'tags',
    },
    school_majors: {
        label: 'University Major',
        icon: BookOpen,
        color: 'orange',
        description: 'Field of study',
        inputType: 'multiselect',
        options: MAJORS
    },
    school_degrees: {
        label: 'Degree Level',
        icon: Award,
        color: 'yellow',
        description: 'University degree level',
        inputType: 'multiselect',
        options: DEGREES
    },
};

export const CriteriaDisplay = ({ criteria }) => {
    if (!criteria || criteria.length === 0) {
        return (
            <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-gray-400" />
                <span className="text-gray-300 italic text-sm">Any available recruiter</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 flex-wrap">
            {criteria.map((c, idx) => {
                const criterionInfo = availableCriteria[c.key];
                if (!criterionInfo) return null;
                const Icon = criterionInfo.icon;

                return (
                    <React.Fragment key={c.key}>
                        <div className={`bg-${criterionInfo.color}-500/20 border border-${criterionInfo.color}-500/30 text-${criterionInfo.color}-300 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center space-x-2 shadow-sm`}>
                            <Icon className="w-4 h-4" />
                            <div className='flex flex-wrap'>{criterionInfo.label}:
                                {Array.isArray(c.value) ? c.value.map((v, i, self) => <>
                                    <strong className="text-white px-1">{criterionInfo.inputType === "multiselect" ? criterionInfo.options.find(o => o.value === v)?.label || "Missed" : v}</strong>
                                    {i < self.length - 1 && <span className="text-violet-400 font-bold">or</span>}
                                </>)
                                    : <strong className="text-white">{c.value}</strong>}
                            </div>
                        </div>
                        {idx < criteria.length - 1 && <span className="text-violet-400 font-bold">AND</span>}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

export function AddStrategyButton({
    strategy,
    maxStrategies,
    openAddForm,
}) {
    return (
        <motion.button
            initial={{ y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.log(strategy.length + 1) * 0.1 + 0.7 }}
            whileHover={{
                scale: strategy.length >= maxStrategies ? 1 : 1.02,
                boxShadow:
                    strategy.length >= maxStrategies
                        ? '0 0 0 rgba(139, 92, 246, 0)'
                        : '0 20px 60px rgba(139, 92, 246, 0.4)',
            }}
            whileTap={{ scale: strategy.length >= maxStrategies ? 1 : 0.98 }}
            onClick={openAddForm}
            disabled={strategy.length >= maxStrategies}
            className="relative my-4 w-full group overflow-hidden rounded-xl border-2 border-dashed border-white/20 
                 hover:border-violet-500/50 bg-white/5 hover:bg-violet-500/10 transition-all duration-300 
                 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-white/20 
                 disabled:hover:bg-white/5"
        >
            <div className="flex items-center justify-center gap-4 py-8">
                <motion.div
                    className="relative"
                    whileHover={{ rotate: 180 }}
                    transition={{ duration: 0.5 }}
                >
                    <motion.div
                        className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl blur-md"
                        animate={{
                            opacity: [0.3, 0.6, 0.3],
                            scale: [1, 1.2, 1],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: 'easeInOut',
                        }}
                    />
                    <div className="relative bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl p-3 shadow-lg">
                        <Plus className="w-6 h-6 text-white" />
                    </div>
                </motion.div>

                <div className="flex flex-col items-start">
                    <motion.span
                        className="text-white font-semibold text-lg group-hover:text-violet-300 transition-colors"
                        whileHover={{ x: 5 }}
                    >
                        Add Strategy
                    </motion.span>
                    <span className="text-gray-400 text-sm">
                        {strategy.length >= maxStrategies
                            ? `Maximum limit reached (${maxStrategies})`
                            : 'Create a new query'}
                    </span>
                </div>
            </div>

            <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                initial={{ x: '-100%' }}
                animate={{ x: '-100%' }}
                whileHover={{ x: '100%' }}
                transition={{ duration: 0.6 }}
            />
        </motion.button>
    );
}

export function AdvancedFiltersClientWrapper({ defaultStrategy, maxStrategies, userId }) {
    const [strategy, setStrategy] = useState(defaultStrategy);
    const [isPending, startTransition] = useTransition();
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        setHasChanges(JSON.stringify(strategy) !== JSON.stringify(defaultStrategy))
    }, [strategy])

    const resetStrategy = () => {
        setStrategy(defaultStrategy);
    };

    const handleContinue = () => {
        startTransition(async () => {
            await submitQueries(userId, strategy)
        })
    };

    return (
        <AdvancedFiltersClient strategy={strategy} setStrategy={setStrategy} maxStrategies={maxStrategies}>
            {/* Action Buttons */}
            <motion.div
                className="flex flex-wrap items-center justify-center gap-3 mb-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
            >
                <motion.button
                    onClick={resetStrategy}
                    disabled={!hasChanges}
                    className="bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-8 rounded-lg transition-all flex items-center space-x-2 border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    whileHover={{ scale: hasChanges ? 1.05 : 1, boxShadow: hasChanges ? '0 5px 20px rgba(255, 255, 255, 0.1)' : '0 0 0 rgba(255, 255, 255, 0)' }}
                    whileTap={{ scale: hasChanges ? 0.95 : 1 }}
                >
                    <motion.div
                        animate={hasChanges ? { rotate: [0, -180, -360] } : {}}
                        transition={{ duration: 0.6 }}
                    >
                        <RotateCcw className="w-5 h-5" />
                    </motion.div>
                    <span>Reset to Default</span>
                </motion.button>

                <motion.button
                    onClick={handleContinue}
                    disabled={isPending}
                    className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white font-semibold py-3 px-8 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center space-x-2 shadow-lg shadow-violet-500/50"
                    whileHover={{ scale: isPending ? 1 : 1.05 }}
                    whileTap={{ scale: isPending ? 1 : 0.95 }}
                >
                    {isPending ? (
                        <>
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            >
                                <Loader2 className="w-5 h-5" />
                            </motion.div>
                            <span>Saving...</span>
                        </>
                    ) : (
                        <>
                            <span>Continue Setup</span>
                            <motion.div
                                animate={{ x: [0, 5, 0] }}
                                transition={{ duration: 1, repeat: Infinity }}
                            >
                                <ArrowRight className="w-5 h-5" />
                            </motion.div>
                        </>
                    )}
                </motion.button>
            </motion.div>

            {/* Changes Indicator */}
            <AnimatePresence>
                {hasChanges && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.8 }}
                        transition={{ type: "spring", stiffness: 200 }}
                        className="text-center"
                    >
                        <motion.span
                            className="text-amber-400 text-sm flex items-center justify-center space-x-2 bg-amber-500/10 px-4 py-2 rounded-full inline-flex border border-amber-500/20"
                            animate={{
                                boxShadow: [
                                    '0 0 0 0 rgba(251, 191, 36, 0.4)',
                                    '0 0 0 10px rgba(251, 191, 36, 0)',
                                ]
                            }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                        >
                            <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 1, repeat: Infinity }}
                            >
                                <AlertCircle className="w-4 h-4" />
                            </motion.div>
                            <span>You have unsaved changes</span>
                        </motion.span>
                    </motion.div>
                )}
            </AnimatePresence>
        </AdvancedFiltersClient>
    )
}

export function AdvancedFiltersClient({ maxStrategies, strategy, setStrategy, children }) {
    const [showFormModal, setShowFormModal] = useState(false);
    const [editingQuery, setEditingQuery] = useState(null);
    const [addPosition, setAddPosition] = useState("first");

    const [queryName, setQueryName] = useState('');
    const [queryCriteria, setQueryCriteria] = useState([]);

    const handleReorder = (newOrder) => {
        setStrategy(newOrder);
    };

    const deleteQuery = (id) => {
        if (strategy.length <= 1) return;
        setStrategy(strategy.filter(q => q.id !== id));
    };

    const openAddForm = (position) => {
        setEditingQuery(null);
        setQueryName('');
        setQueryCriteria([]);
        setShowFormModal(true);
        setAddPosition(position)
    };

    const openEditForm = (query) => {
        setEditingQuery(query);
        setQueryName(query.name);
        setQueryCriteria(query.criteria);
        setShowFormModal(true);
    };

    const closeForm = () => {
        setShowFormModal(false);
        setEditingQuery(null);
        setQueryName('');
        setQueryCriteria([]);
    };

    const addCriterion = (key) => {
        if (!queryCriteria.find(c => c.key === key)) {
            const criterion = availableCriteria[key];
            let defaultValue = criterion.inputType === 'multiselect' || criterion.inputType === 'tags' ? [] : '';
            setQueryCriteria([...queryCriteria, { key, value: defaultValue }]);
        }
    };

    const removeCriterion = (key) => {
        setQueryCriteria(queryCriteria.filter(c => c.key !== key));
    };

    const updateCriterionValue = useCallback((key, value) => {
        setQueryCriteria(prev => prev.map(c => c.key === key ? { ...c, value } : c));
    }, [])

    const saveQuery = () => {
        if (!queryName.trim()) {
            alert('Please provide a strategy name!');
            return;
        }
        if (queryCriteria.some(c => Array.isArray(c.value) ? c.value.length === 0 : !c.value)) {
            alert('Please complete all criteria values!');
            return;
        }

        if (editingQuery) {
            setStrategy(strategy.map(q => q.id === editingQuery.id ? { ...q, name: queryName.trim(), criteria: queryCriteria } : q));
        } else {
            const newId = Math.max(...strategy.map(q => q.id), 0) + 1;
            const newQuery = { id: newId, name: queryName.trim(), criteria: queryCriteria };
            setStrategy(addPosition === "first" ? [newQuery, ...strategy] : [...strategy, newQuery]);
        }

        closeForm();
    };

    const duplicateQuery = (query) => {
        if (strategy.length >= maxStrategies) return

        const newId = Math.max(...strategy.map(q => q.id), 0) + 1;
        const duplicatedQuery = {
            id: newId,
            name: `${query.name} (Copy)`,
            criteria: query.criteria.map(c => ({ ...c }))
        };

        const queryIndex = strategy.findIndex(q => q.id === query.id);
        const newStrategy = [
            ...strategy.slice(0, queryIndex + 1),
            duplicatedQuery,
            ...strategy.slice(queryIndex + 1)
        ];

        setStrategy(newStrategy);
    };

    const startDemo = () => {
        const interval = setInterval(() => {
            /*setDemoStep(prev => {
                if (prev >= strategy.length - 1) {
                    clearInterval(interval);
                    return prev;
                }
                return prev + 1;
            });*/
        }, 1500);
    };

    const CriterionInput = ({ criterionKey, value }) => {
        const criterion = availableCriteria[criterionKey];

        if (criterion.inputType === 'tags') {
            const [inputValue, setInputValue] = useState('');
            const [adding, setAdding] = useState(false);
            const insertValue = () => {
                if (inputValue.trim() && !value.includes(inputValue.trim())) {
                    updateCriterionValue(criterionKey, [...value, inputValue.trim()]);
                    setInputValue('');
                }
            }

            return (
                <div className="space-y-2">
                    {(
                        <div className="flex flex-wrap gap-2 items-start">
                            {value.map((tag, i, self) => (
                                <><Badge key={tag} className="font-bold relative group px-0">
                                    <div className='flex justify-between items-center pl-2 pr-1 gap-2'>
                                        {tag}
                                        <button
                                            type="button"
                                            onClick={() => updateCriterionValue(criterionKey, value.filter(v => v !== tag))}
                                            className="bg-black/20 hover:bg-red-500/50 rounded-full transition-colors"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                </Badge>
                                    {i < self.length - 1 && <span className="text-violet-400 font-bold align-middle">or</span>}
                                </>
                            ))}

                            {adding ? (
                                <div className="flex items-center gap-1 border rounded-full px-2 py-1">
                                    <input
                                        type="text"
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && insertValue()}
                                        onBlur={() => !inputValue.trim() && setAdding(false)}
                                        placeholder="New item"
                                        maxLength={50}
                                        className="bg-transparent outline-none text-sm"
                                        autoFocus
                                    />

                                    {inputValue.trim() ? (
                                        <button onClick={insertValue}>
                                            <Plus className="w-4 h-4 text-green-500" />
                                        </button>
                                    ) : (
                                        <button onClick={() => setAdding(false)}>
                                            <X className="text-red-400 size-4" />
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <Badge
                                    onClick={() => setAdding(true)}
                                    className="cursor-pointer flex items-center gap-1 font-bold bg-transparent text-white hover:bg-white/5 transition border border-white/90"
                                >
                                    <Plus className="w-4 h-4" /> Add
                                </Badge>
                            )}
                        </div>
                    )}

                    {false && <div className="flex gap-2">
                        <Input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && inputValue.trim()) {
                                    e.preventDefault();
                                    if (!value.includes(inputValue.trim())) {
                                        updateCriterionValue(criterionKey, [...value, inputValue.trim()]);
                                    }
                                    setInputValue('');
                                }
                            }}
                            placeholder="Type and press Enter"

                        />
                        <Button
                            onClick={() => {
                                if (inputValue.trim() && !value.includes(inputValue.trim())) {
                                    updateCriterionValue(criterionKey, [...value, inputValue.trim()]);
                                    setInputValue('');
                                }
                            }}
                            className="bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 px-4 py-2 rounded-md text-sm"
                        >
                            Add
                        </Button>
                    </div>}
                </div>
            );
        }

        if (criterion.inputType === 'multiselect') {
            const defaultValues = useMemo(() =>
                queryCriteria.filter(c => c.key === criterionKey).map(c => c.value).flat(),
                [criterionKey] // Nota: ho rimosso queryCriteria dalle dipendenze
            );

            return (
                <div>
                    <MultiSelect
                        modalPopover
                        options={criterion.options}
                        onClose={(newValues) => updateCriterionValue(criterionKey, newValues)}
                        variant={'inverted'}
                        maxCount={10}
                        badgeSeparator="or"
                        defaultValue={defaultValues}
                        hideSelectAll
                    />
                </div>
            );
        }

        return null;
    });

    const availableFilters = useMemo(() => {
        const selectedKeys = queryCriteria.map(c => c.key);
        return Object.entries(availableCriteria).filter(([key]) => !selectedKeys.includes(key));
    }, [queryCriteria]);

    return (
        <div className="min-h-screen  p-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="max-w-6xl mx-auto"
            >
                {/* Strategy List */}
                <motion.div
                    className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 backdrop-blur-xl"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                >
                    <motion.div
                        className="flex items-center justify-between mb-3"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                    >
                        <h3 className="text-white font-bold text-xl flex items-center space-x-2">
                            <motion.div
                                animate={{
                                    rotate: [0, 5, -5, 0],
                                    scale: [1, 1.1, 1.1, 1]
                                }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    repeatDelay: 3
                                }}
                            >
                                <Target className="w-6 h-6 text-violet-400" />
                            </motion.div>
                            <span>Strategy Priority Order</span>
                        </h3>
                        <motion.span
                            className="bg-gradient-to-r from-violet-500 to-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg shadow-violet-500/50"
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5, delay: 0.3, type: "spring", stiffness: 200 }}
                            whileHover={{ scale: 1.1 }}
                        >
                            {strategy.length} / {maxStrategies} strategies
                        </motion.span>
                    </motion.div>

                    <Reorder.Group axis="y" values={strategy} onReorder={handleReorder} className="space-y-3">
                        <AddStrategyButton maxStrategies={maxStrategies} strategy={strategy} openAddForm={() => openAddForm("first")} />

                        {strategy.map((query, idx) => (
                            <Reorder.Item key={query.id} value={query} layoutId={`strategy-${query.id}`}>
                                <motion.div
                                    layout
                                    initial={{ x: -50, rotateX: -15 }}
                                    animate={{
                                        opacity: 1,
                                        x: 0,
                                        rotateX: 0,
                                        backgroundColor: 'rgba(255, 255, 255, 0.05)'
                                    }}
                                    exit={{
                                        opacity: 0,
                                        x: -50,
                                        scale: 0.8,
                                        transition: { duration: 0.3 }
                                    }}
                                    transition={{
                                        delay: Math.log(idx + 1) * 0.1,
                                        duration: 0.5,
                                        type: "spring",
                                        stiffness: 100
                                    }}
                                    whileHover={{
                                        scale: 1.02,
                                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                        boxShadow: '0 10px 40px rgba(139, 92, 246, 0.3)',
                                        transition: { duration: 0.2 }
                                    }}
                                    className="group rounded-xl border transition-all relative border-white/10 overflow-hidden cursor-grab active:cursor-grabbing"
                                >
                                    {/* Glow effect on hover */}
                                    <motion.div
                                        className="absolute inset-0 bg-gradient-to-r from-violet-500/0 via-violet-500/20 to-purple-500/0"
                                        initial={{ x: '-100%', opacity: 0 }}
                                        whileHover={{
                                            x: '100%',
                                            opacity: 1,
                                            transition: { duration: 0.8, ease: "easeInOut" }
                                        }}
                                    />

                                    <div className="p-5 relative z-10">
                                        <div className="flex items-start space-x-4">
                                            <div className="flex flex-col items-center space-y-2 flex-shrink-0">
                                                <motion.div
                                                    whileHover={{ scale: 1.2, rotate: 90 }}
                                                    whileTap={{ scale: 0.9 }}
                                                    transition={{ type: "spring", stiffness: 300 }}
                                                >
                                                    <GripVertical className="w-5 h-5 text-gray-500 opacity-50 group-hover:opacity-100 group-hover:text-violet-400 transition-all" />
                                                </motion.div>
                                                <motion.div
                                                    className="bg-gradient-to-br from-violet-500 to-purple-600 text-white w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shadow-md"
                                                    initial={{ scale: 0, rotate: -180 }}
                                                    animate={{ scale: 1, rotate: 0 }}
                                                    transition={{
                                                        delay: Math.log(idx + 1) * 0.1 + 0.2,
                                                        type: "spring",
                                                        stiffness: 200
                                                    }}
                                                    whileHover={{
                                                        scale: 1.2,
                                                        rotate: 360,
                                                        transition: { duration: 0.6 }
                                                    }}
                                                >
                                                    {idx + 1}
                                                </motion.div>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-3">
                                                    <motion.h4
                                                        className="text-white font-semibold text-lg"
                                                        initial={{ opacity: 0, y: -10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: Math.log(idx + 1) * 0.1 + 0.3 }}
                                                    >
                                                        {query.name}
                                                    </motion.h4>
                                                    <motion.div
                                                        className="flex items-center gap-2 transition-all duration-200 
             opacity-0 translate-x-5 group-hover:opacity-100 group-hover:translate-x-0"
                                                        initial={false} // disattiva animazione iniziale di framer
                                                    >
                                                        <motion.button
                                                            onClick={() => openEditForm(query)}
                                                            className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 p-2 rounded-lg"
                                                            whileHover={{ scale: 1.1, rotate: 15 }}
                                                            whileTap={{ scale: 0.9 }}
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </motion.button>

                                                        {strategy.length < maxStrategies && <motion.button
                                                            onClick={() => duplicateQuery(query)}
                                                            className="bg-green-500/20 hover:bg-green-500/30 text-green-400 p-2 rounded-lg"
                                                            whileHover={{ scale: 1.1, rotate: -15 }}
                                                            whileTap={{ scale: 0.9 }}
                                                        >
                                                            <CopyPlus className="w-4 h-4" />
                                                        </motion.button>}

                                                        <motion.button
                                                            onClick={() => deleteQuery(query.id)}
                                                            disabled={strategy.length <= 1}
                                                            className="bg-red-500/20 hover:bg-red-500/30 text-red-400 p-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                                                            whileHover={{ scale: strategy.length > 1 ? 1.1 : 1 }}
                                                            whileTap={{ scale: strategy.length > 1 ? 0.9 : 1 }}
                                                        >
                                                            <motion.div
                                                                animate={
                                                                    strategy.length > 1
                                                                        ? { rotate: [0, -10, 10, -10, 0] }
                                                                        : {}
                                                                }
                                                                transition={{ duration: 0.5 }}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </motion.div>
                                                        </motion.button>
                                                    </motion.div>

                                                </div>
                                                <motion.div
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ delay: Math.log(idx + 1) * 0.1 + 0.5, duration: 0.5 }}
                                                >
                                                    <CriteriaDisplay criteria={query.criteria} />
                                                </motion.div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Shimmer effect */}
                                    <motion.div
                                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
                                        animate={{
                                            x: ['-100%', '200%'],
                                        }}
                                        transition={{
                                            duration: 3,
                                            repeat: Infinity,
                                            repeatDelay: 5,
                                            ease: "linear"
                                        }}
                                    />
                                </motion.div>

                                {idx < strategy.length - 1 && (
                                    <motion.div
                                        className="flex justify-center py-2"
                                        initial={{ opacity: 0, scale: 0 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: idx * 0.08 + 0.5 }}
                                    >
                                        <motion.div
                                            className="flex flex-col items-center"
                                            animate={{
                                                y: [0, 5, 0],
                                            }}
                                            transition={{
                                                duration: 1.5,
                                                repeat: Infinity,
                                                ease: "easeInOut"
                                            }}
                                        >
                                            <ArrowDown className="w-5 h-5 text-violet-500 drop-shadow-[0_0_8px_rgba(139,92,246,0.6)]" />
                                        </motion.div>
                                    </motion.div>
                                )}
                            </Reorder.Item>
                        ))}

                        <AddStrategyButton maxStrategies={maxStrategies} strategy={strategy} openAddForm={() => openAddForm("last")} />
                    </Reorder.Group>
                </motion.div>

                {children}
            </motion.div>

            {/* Add/Edit Form Modal */}
            <AnimatePresence>
                {showFormModal && (
                    <Dialog open={showFormModal} onOpenChange={o => !o ? closeForm() : null}>

                        <DialogContent>
                            <DialogHeader>
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.1 }}
                                >
                                    <DialogTitle>
                                        {editingQuery ? 'Edit Strategy' : 'Create New Strategy'}
                                    </DialogTitle>
                                </motion.div>
                            </DialogHeader>

                            <ScrollArea className="max-h-[70vh]">
                                <motion.div
                                    className='p-1 gap-6'
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.2 }}
                                >
                                    <div className="space-y-4">
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.3 }}
                                        >
                                            <label className="text-gray-300 text-sm font-medium mb-2 block">Strategy Name</label>
                                            <Input
                                                type="text"
                                                value={queryName}
                                                onChange={(e) => setQueryName(e.target.value)}
                                                placeholder='e.g., "Marketing Managers in Milan"'
                                            />
                                        </motion.div>

                                        <motion.h4
                                            className="text-gray-300 text-sm font-medium pt-2"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 0.4 }}
                                        >
                                            Added Criteria
                                        </motion.h4>
                                        <div className="space-y-3">
                                            <AnimatePresence mode="popLayout">
                                                {queryCriteria.length > 0 ? (
                                                    queryCriteria.map(({ key, value }, index) => {
                                                        const criterion = availableCriteria[key];
                                                        const Icon = criterion.icon;
                                                        return (
                                                            <motion.div
                                                                key={key}
                                                                layout
                                                                initial={{ opacity: 0, x: -20, scale: 0.8 }}
                                                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                                                exit={{ opacity: 0, x: 20, scale: 0.8 }}
                                                                transition={{ type: "spring", stiffness: 200, delay: index * 0.05 }}
                                                                className={`p-4 rounded-lg border bg-${criterion.color}-500/10 border-${criterion.color}-500/20`}
                                                            >
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <motion.div
                                                                        className="flex items-center space-x-2"
                                                                        whileHover={{ x: 5 }}
                                                                    >
                                                                        <Icon className={`w-4 h-4 text-${criterion.color}-300`} />
                                                                        <span className="text-white font-medium text-sm">{criterion.label}</span>
                                                                    </motion.div>
                                                                    <motion.button
                                                                        onClick={() => removeCriterion(key)}
                                                                        className="text-red-400 hover:text-red-300"
                                                                        whileHover={{ scale: 1.2, rotate: 90 }}
                                                                        whileTap={{ scale: 0.9 }}
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </motion.button>
                                                                </div>
                                                                <CriterionInput criterionKey={key} value={value} />
                                                            </motion.div>
                                                        );
                                                    })
                                                ) : (
                                                    <motion.p
                                                        className="text-gray-400 text-sm italic"
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                    >
                                                        No criteria added. Select one from the list below.
                                                    </motion.p>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>

                                    <Separator className='my-3' />

                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.5 }}
                                    >
                                        <h4 className="text-gray-300 text-sm font-medium mb-3">Available Criteria</h4>
                                        <div className="grid grid-cols-3 gap-3">
                                            {availableFilters.map(([key, criterion], index) => {
                                                const Icon = criterion.icon;
                                                return (
                                                    <motion.div
                                                        key={key}
                                                        initial={{ opacity: 0, y: 20, scale: 0.8 }}
                                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                                        transition={{
                                                            delay: 0.6 + index * 0.05,
                                                            type: "spring",
                                                            stiffness: 200
                                                        }}
                                                        whileHover={{
                                                            scale: 1.05,
                                                            y: -5,
                                                            transition: { duration: 0.2 }
                                                        }}
                                                    >
                                                        <Card
                                                            onClick={() => addCriterion(key)}
                                                            className={`bg-${criterion.color}-500/20 group p-4 relative overflow-hidden`}
                                                        >
                                                            {/* Animated background gradient */}
                                                            <motion.div
                                                                className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/5 to-white/0"
                                                                initial={{ opacity: 0 }}
                                                                whileHover={{ opacity: 1 }}
                                                                transition={{ duration: 0.3 }}
                                                            />

                                                            <div className="flex flex-col space-y-3 relative z-10">
                                                                <div className="flex items-start justify-between">
                                                                    <motion.div
                                                                        className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/10 group-hover:bg-white/15 transition-colors"
                                                                        whileHover={{ rotate: 360 }}
                                                                        transition={{ duration: 0.6 }}
                                                                    >
                                                                        <Icon className="w-5 h-5 text-gray-400 group-hover:text-gray-300 transition-colors" />
                                                                    </motion.div>
                                                                    <motion.div
                                                                        className="w-2 h-2 rounded-full bg-white/20 group-hover:bg-white/40 transition-colors"
                                                                        animate={{
                                                                            scale: [1, 1.3, 1],
                                                                            opacity: [0.5, 1, 0.5]
                                                                        }}
                                                                        transition={{
                                                                            duration: 2,
                                                                            repeat: Infinity,
                                                                            ease: "easeInOut"
                                                                        }}
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <motion.span
                                                                        className="text-sm font-semibold text-gray-200 group-hover:text-white transition-colors block mb-1"
                                                                        whileHover={{ x: 2 }}
                                                                    >
                                                                        {criterion.label}
                                                                    </motion.span>
                                                                    <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors leading-relaxed">
                                                                        {criterion.description}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {/* Shimmer effect */}
                                                            <motion.div
                                                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                                                                initial={{ x: '-100%' }}
                                                                animate={{ x: '-100%' }}
                                                                whileHover={{ x: '100%' }}
                                                                transition={{ duration: 0.5 }}
                                                            />
                                                        </Card>
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                </motion.div>
                                <ScrollBar orientation='vertical' />
                            </ScrollArea>

                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.7 }}
                            >
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <motion.div
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                        >
                                            <Button variant={"ghost"}>
                                                Cancel
                                            </Button>
                                        </motion.div>
                                    </DialogClose>
                                    <DialogClose asChild>
                                        <motion.div
                                            whileHover={{
                                                scale: (!queryName.trim() || queryCriteria.length === 0) ? 1 : 1.05,
                                                boxShadow: (!queryName.trim() || queryCriteria.length === 0) ? '0 0 0 rgba(139, 92, 246, 0)' : '0 10px 30px rgba(139, 92, 246, 0.4)'
                                            }}
                                            whileTap={{ scale: (!queryName.trim() || queryCriteria.length === 0) ? 1 : 0.95 }}
                                        >
                                            <Button
                                                onClick={saveQuery}
                                                disabled={!queryName.trim() || queryCriteria.length === 0}
                                            >
                                                <motion.div
                                                    animate={(!queryName.trim() || queryCriteria.length === 0) ? {} : {
                                                        rotate: [0, 10, -10, 0],
                                                        scale: [1, 1.1, 1.1, 1]
                                                    }}
                                                    transition={{ duration: 0.5 }}
                                                >
                                                    <CheckCircle2 className="w-5 h-5" />
                                                </motion.div>
                                                <span>{editingQuery ? 'Update Strategy' : 'Add Strategy'}</span>
                                            </Button>
                                        </motion.div>
                                    </DialogClose>
                                </DialogFooter>
                            </motion.div>
                        </DialogContent>
                    </Dialog>
                )}
            </AnimatePresence>
        </div>
    );
}

// Definisci i tipi in modo più completo per supportare le nuove sezioni
interface Experience {
    title?: {
        name: string;
    };
    company?: {
        name: string;
        website?: string;
        location?: {
            name: string
        };
    };
    start_date?: string;
    end_date?: string;
    logo?: string | null;
}

interface Education {
    school?: {
        name: string;
        website?: string;
    };
    debree: string;
    majors?: string[];
    start_date?: string;
    end_date?: string;
    logo?: string | null;
}

// NUOVI TIPI
interface Project {
    name: string;
    description: string;
    technologies: string[];
    start_date?: string;
    end_date?: string;
}

interface Certification {
    name: string;
    autority: string;
    issue_date: string;
    expired: boolean;
}

interface ProfileSummary {
    name: string;
    title: string;
    location?: string;
    skills: string[];
    experience: Experience[];
    education: Education[];
    projects: Project[];
    certifications: Certification[];
}

// Props del componente
interface ProfileAnalysisClientProps {
    userId: string;
    plan: string;
}

function ProfileNameTitle({ profileSummary, setProfileSummary }: any) {
    const [tempName, setTempName] = useState(profileSummary?.name || "");
    const [tempTitle, setTempTitle] = useState(profileSummary?.title || "");
    const [tempLocation, setTempLocation] = useState(profileSummary?.location.country || "");

    const handleSave = () => {
        if (!tempName.trim() || !tempLocation.trim() || !tempTitle.trim()) {
            setTempName(profileSummary?.name || "");
            setTempTitle(profileSummary?.title || "");
            setTempLocation(profileSummary?.location.country || "");
        }
        console.log(profileSummary)
        setProfileSummary((prev: any) =>
            prev
                ? {
                    ...prev,
                    name: tempName.trim() || prev.name,
                    title: tempTitle.trim() || prev.title,
                    location: { ...prev.location, country: tempLocation.trim() || prev.location.contry },
                }
                : null
        );
        console.log(tempLocation)
    };

    return (
        <div className="pb-4 border-b border-white/10">
            <Dialog>
                <div className="flex justify-start items-center space-x-2">
                    <p className="text-sm text-gray-400">Name & Title</p>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="p-1">
                            <Edit2Icon className="w-4 h-4" />
                        </Button>
                    </DialogTrigger>
                </div>

                {/* Nome */}
                <div className="flex justify-between items-center">
                    <p className="text-white font-semibold text-lg">{profileSummary?.name}</p>
                </div>

                {/* Titolo e location */}
                <div className="flex flex-wrap gap-1 items-center">
                    <p className="text-gray-300">{profileSummary?.title}</p>
                    •
                    {profileSummary?.location.country && (
                        <div className="flex items-center text-gray-300 space-x-1">
                            <Flag size={16} />
                            <span>{profileSummary.location.country}</span>
                        </div>
                    )}
                </div>
                <DialogContent className="space-y-4" onCloseAutoFocus={() => {
                    setTempName(profileSummary?.name || "");
                    setTempTitle(profileSummary?.title || "");
                    setTempLocation(profileSummary?.location.country || "");
                }}>
                    <DialogHeader>
                        <DialogTitle>
                            Edit name, title and location
                        </DialogTitle>
                    </DialogHeader>
                    <ScrollArea className='max-h-[calc(85vh-100px)]'>
                        <div className='space-y-4 p-1'>
                            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm text-gray-400">Name</label>
                                    <Input
                                        type="text"
                                        value={tempName}
                                        onChange={(e) => setTempName(e.target.value)}
                                        maxLength={50}
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm text-gray-400">Location</label>
                                    <Input
                                        type="text"
                                        value={tempLocation}
                                        onChange={(e) => setTempLocation(e.target.value)}
                                        maxLength={50}
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm text-gray-400">Title</label>
                                <Input
                                    type="text"
                                    value={tempTitle}
                                    onChange={(e) => setTempTitle(e.target.value)}
                                    maxLength={50}
                                />
                            </div>
                        </div>
                        <ScrollBar orientation='vertical' />
                    </ScrollArea>
                    <DialogFooter>
                        <DialogClose asChild onClick={() => {
                            setTempName(profileSummary?.name || "");
                            setTempTitle(profileSummary?.title || "");
                            setTempLocation(profileSummary?.location || "");
                        }}>
                            <Button variant="ghost">
                                Cancel
                            </Button>
                        </DialogClose>
                        <DialogClose asChild onClick={handleSave}>
                            <Button>Save</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function SkillsListClient({ profileSummary, setProfileSummary }: any) {
    const [newSkill, setNewSkill] = useState("");
    const [adding, setAdding] = useState(false);

    const addSkill = () => {
        if (
            !newSkill.trim() ||
            profileSummary.skills.length > 70 ||
            profileSummary.skills.find(
                (s: string) => s.trim().toUpperCase() === newSkill.trim().toUpperCase()
            )
        ) return;

        setProfileSummary((prev: any) =>
            prev ? { ...prev, skills: [...prev.skills, newSkill.trim()] } : null
        );
        setNewSkill("");
        setAdding(false);
    };

    const removeSkill = (index: number) => {
        setProfileSummary((prev: any) =>
            prev ? { ...prev, skills: prev.skills.filter((_: any, i: number) => i !== index) } : null
        );
    };

    return (
        <SkillsListBase
            skills={profileSummary.skills}
            editable={true}
            adding={adding}
            newSkill={newSkill}
            setNewSkill={setNewSkill}
            onAdd={addSkill}
            onRemove={removeSkill}
            onStartAdd={() => setAdding(true)}
            onCancelAdd={() => {
                setNewSkill("");
                setAdding(false);
            }}
        />
    );
}

function ExperienceEditor({ profileSummary, setProfileSummary }: any) {
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [tempExp, setTempExp] = useState<any>({
        title: { name: "" },
        company: { name: "", location: { name: "" } },
        logo: "",
        start_date: "",
        end_date: "",
    });

    const handleEdit = (index: number | null) => {
        setEditingIndex(index);
        setTempExp(
            index !== null ? { ...profileSummary.experience[index] } : {
                title: { name: "" },
                company: { name: "", location: { name: "" } },
                logo: "",
                start_date: "",
                end_date: "",
            }
        );
    };

    const handleSave = () => {
        if (!tempExp.title?.name.trim() || !tempExp.company?.name.trim()) return;

        setProfileSummary((prev: any) => {
            const newExp = [...(prev.experience || [])];
            if (editingIndex !== null) newExp[editingIndex] = tempExp;
            else newExp.push(tempExp);
            return { ...prev, experience: newExp };
        });
        setEditingIndex(null);
    };

    const handleDelete = (index: number) => {
        setProfileSummary((prev: any) => ({
            ...prev,
            experience: prev.experience.filter((_: any, i: number) => i !== index),
        }));
    };

    return (
        <div>
            <Dialog open={editingIndex !== null} onOpenChange={() => setEditingIndex(null)}>
                <div className="flex justify-between items-center mb-3">
                    <p className="text-sm text-gray-400">Experience</p>
                    <DialogTrigger asChild>
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(null)}>
                            <Plus className="w-4 h-4" />
                        </Button>
                    </DialogTrigger>
                </div>

                {/* stessa UI usata anche nel server */}
                <ul className="space-y-3">
                    <ExperienceList
                        experience={profileSummary.experience}
                        editable
                        onEdit={(idx) => handleEdit(idx)}
                    />
                </ul>

                <DialogContent>
                    <div className="space-y-4">
                        <Input
                            placeholder="Role"
                            value={tempExp.title.name}
                            onChange={(e) =>
                                setTempExp({ ...tempExp, title: { name: e.target.value } })
                            }
                        />
                        <Input
                            placeholder="Company"
                            value={tempExp.company.name}
                            onChange={(e) =>
                                setTempExp({
                                    ...tempExp,
                                    company: { ...tempExp.company, name: e.target.value },
                                })
                            }
                        />
                    </div>

                    <DialogFooter>
                        {editingIndex !== null && (
                            <DialogClose asChild>
                                <Button variant="destructive" onClick={() => handleDelete(editingIndex)}>
                                    <Trash2 className="w-4 h-4" /> Delete
                                </Button>
                            </DialogClose>
                        )}
                        <DialogClose asChild>
                            <Button onClick={handleSave}>Save</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function ExperienceSection({ profileSummary, setProfileSummary }: any) {
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [tempExp, setTempExp] = useState<any>({
        title: { name: "" },
        company: { name: "", location: { name: "" } },
        logo: "",
        start_date: "",
        end_date: "",
    });

    // Apri dialog per aggiungere o modificare
    const handleEdit = (index: number | null) => {
        setEditingIndex(index);
        if (index !== null && profileSummary?.experience?.[index]) {
            setTempExp({ ...profileSummary.experience[index] });
        } else {
            setTempExp({
                title: { name: "" },
                company: { name: "", location: { name: "" } },
                logo: "",
                start_date: "",
                end_date: "",
            });
        }
    };

    const handleSave = () => {
        if (!tempExp.title?.name.trim() || !tempExp.company?.name.trim()) return;

        setProfileSummary((prev: any) => {
            if (!prev) return prev;
            const newExp = [...(prev.experience || [])];

            if (editingIndex !== null) {
                // Modifica esperienza esistente
                newExp[editingIndex] = tempExp;
            } else {
                // Aggiungi nuova esperienza
                newExp.push(tempExp);
            }

            return { ...prev, experience: newExp };
        });

        setEditingIndex(null);
    };

    const handleDelete = (index: number) => {
        setProfileSummary((prev: any) => {
            if (!prev) return prev;
            const newExp = prev.experience.filter((_: any, i: number) => i !== index);
            return { ...prev, experience: newExp };
        });
    };

    return (
        <div>
            <Dialog>
                <div className="flex justify-start items-center mb-3 space-x-2">
                    <p className="text-sm text-gray-400">Experience</p>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="p-1" onClick={() => handleEdit(null)}>
                            <Plus className="w-4 h-4" />
                        </Button>
                    </DialogTrigger>
                </div>

                {/* Lista esperienze */}
                <ul className="space-y-3">
                    {profileSummary?.experience?.map((exp: any, idx: number) => (
                        <li
                            key={idx}
                            className="bg-white/5 hover:bg-white/10 rounded-lg p-4 border border-white/10 transition-colors"
                        >
                            <div className="flex items-start gap-3">
                                {/* Logo aziendale */}
                                {exp.logo ? (
                                    <img
                                        src={exp.logo}
                                        alt={exp.company?.name || "Company"}
                                        className="w-10 h-10 rounded-lg object-contain bg-white/5 p-1.5 border border-white/10 flex-shrink-0"
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-white/10 flex items-center justify-center flex-shrink-0">
                                        <span className="text-violet-400 text-xs font-bold">
                                            {exp.company?.name?.charAt(0) || "?"}
                                        </span>
                                    </div>
                                )}

                                <div className="flex-1 min-w-0">
                                    {/* Titolo ruolo */}
                                    <p className="text-white font-medium">{exp.title?.name || "Role not available"}</p>

                                    {/* Azienda */}
                                    {exp.company?.name && (
                                        <p className="text-gray-300 text-sm">
                                            {exp.company.name}
                                            {exp.company.location?.name && ` · ${exp.company.location.name}`}
                                        </p>
                                    )}

                                    {/* Date */}
                                    {(exp.start_date || exp.end_date) && (
                                        <p className="text-gray-400 text-xs mt-1">
                                            {exp.start_date || "?"} → {exp.end_date || "Current"}
                                        </p>
                                    )}
                                </div>

                                {/* Pulsante modifica singolo */}
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="p-1" onClick={() => handleEdit(idx)}>
                                        <Edit2 className="w-4 h-4" />
                                    </Button>
                                </DialogTrigger>
                            </div>
                        </li>
                    ))}

                    {!profileSummary?.experience?.length && <li
                        className="bg-white/5 hover:bg-white/10 rounded-lg p-4 border border-white/10 transition-colors"
                    >
                        <div className="flex-1 min-w-0 min-h-16 flex items-center justify-center text-gray-500">
                            No experience
                        </div>
                    </li>}
                </ul>

                <DialogContent className="">
                    <DialogHeader>
                        <DialogTitle>
                            {editingIndex !== null ? "Edit Experience" : "Add Experience"}
                        </DialogTitle>
                    </DialogHeader>

                    <ScrollArea className='max-h-[calc(85vh-100px)]'>
                        <div className='space-y-4 p-1'>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm text-gray-400">Role</label>
                                <Input
                                    type="text"
                                    value={tempExp.title?.name || ""}
                                    onChange={(e) => setTempExp({ ...tempExp, title: { ...tempExp.title, name: e.target.value } })}
                                    maxLength={50}
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm text-gray-400">Company</label>
                                <CompanyAutocomplete onChange={(e) =>
                                    setTempExp({
                                        ...tempExp,
                                        company: { domain: "", name: e },
                                    })
                                } onAddCompany={(e) => setTempExp({ ...tempExp, logo: e.icon, company: { domain: e.domain, name: e.name } })}
                                    value={tempExp.company?.name}
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm text-gray-400">Location</label>
                                <Input
                                    type="text"
                                    value={tempExp.company?.location?.name || ""}
                                    onChange={(e) =>
                                        setTempExp({
                                            ...tempExp,
                                            company: {
                                                ...tempExp.company,
                                                location: { ...tempExp.company.location, name: e.target.value },
                                            },
                                        })
                                    }
                                    maxLength={50}
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm text-gray-400">Logo URL</label>
                                <Input
                                    type="text"
                                    value={tempExp.logo || ""}
                                    onChange={(e) => setTempExp({ ...tempExp, logo: e.target.value })}
                                    className=""
                                    icon={tempExp.logo ? <img src={tempExp.logo} className='w-6 h-6 rounded-md' /> : null}
                                />
                            </div>

                            <div className="flex gap-3">
                                <div className="flex flex-col gap-2 w-1/2">
                                    <label className="text-sm text-gray-400">Start Date</label>
                                    <Input
                                        type="text"
                                        value={tempExp.start_date || ""}
                                        onChange={(e) => setTempExp({ ...tempExp, start_date: e.target.value })}
                                        placeholder="yyyy-mm"
                                    />
                                </div>
                                <div className="flex flex-col gap-2 w-1/2">
                                    <label className="text-sm text-gray-400">End Date</label>
                                    <Input
                                        type="text"
                                        value={tempExp.end_date || ""}
                                        onChange={(e) => setTempExp({ ...tempExp, end_date: e.target.value })}
                                        placeholder="yyyy-mm or Current"
                                    />
                                </div>
                            </div>
                        </div>
                        <ScrollBar orientation='vertical' />
                    </ScrollArea>

                    <DialogFooter>
                        <DialogClose asChild>
                            {editingIndex !== null && (
                                <Button variant="destructive" onClick={() => handleDelete(editingIndex)}>
                                    <Trash2 className="w-4 h-4" /> Delete
                                </Button>
                            )}
                        </DialogClose>
                        <DialogClose asChild>
                            <Button onClick={handleSave}>Save</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog >
        </div >
    );
}

function EducationEditor({ profileSummary, setProfileSummary }: any) {
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [tempEdu, setTempEdu] = useState<any>({
        school: { name: "" },
        degree: "",
        majors: [],
        logo: "",
        start_date: "",
        end_date: "",
    });

    const handleEdit = (index: number | null) => {
        setEditingIndex(index);
        setTempEdu(
            index !== null ? { ...profileSummary.education[index] } : {
                school: { name: "" },
                degree: "",
                majors: [],
                logo: "",
                start_date: "",
                end_date: "",
            }
        );
    };

    const handleSave = () => {
        if (!tempEdu.school?.name.trim() || !tempEdu.majors.length || tempEdu.majors.some((m: string) => !m.trim())) return;

        setProfileSummary((prev: any) => {
            const newEdu = [...(prev.education || [])];
            if (editingIndex !== null) newEdu[editingIndex] = tempEdu;
            else newEdu.push(tempEdu);
            return { ...prev, education: newEdu };
        });
        setEditingIndex(null);
    };

    const handleDelete = (index: number) => {
        setProfileSummary((prev: any) => ({
            ...prev,
            education: prev.education.filter((_: any, i: number) => i !== index),
        }));
    };

    return (
        <div>
            <Dialog open={editingIndex !== null} onOpenChange={() => setEditingIndex(null)}>
                <div className="flex justify-between items-center mb-3">
                    <p className="text-sm text-gray-400">Education</p>
                    <DialogTrigger asChild>
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(null)}>
                            <Plus className="w-4 h-4" />
                        </Button>
                    </DialogTrigger>
                </div>

                {/* UI condivisa */}
                <ul className="space-y-3">
                    <EducationList
                        education={profileSummary.education}
                        editable
                        onEdit={(idx) => handleEdit(idx)}
                    />
                </ul>


                <DialogContent>
                    <div className="space-y-4 p-1 max-h-[calc(85vh-100px)] overflow-auto">
                        {/* School */}
                        <div className="flex flex-col gap-2">
                            <label className="text-sm text-gray-400">School</label>
                            <CompanyAutocomplete
                                onChange={(e) =>
                                    setTempEdu({
                                        ...tempEdu,
                                        school: { domain: "", name: e },
                                    })
                                }
                                onAddCompany={(e) =>
                                    setTempEdu({
                                        ...tempEdu,
                                        logo: e.icon,
                                        school: { domain: e.domain, name: e.name },
                                    })
                                }
                                value={tempEdu.school?.name || ""}
                            />
                        </div>

                        {/* Degree */}
                        <div className="flex flex-col gap-2">
                            <label className="text-sm text-gray-400">Degree</label>
                            <Input
                                type="text"
                                value={tempEdu.degree || ""}
                                onChange={(e) => setTempEdu({ ...tempEdu, degree: e.target.value })}
                                placeholder="Bachelor"
                            />
                        </div>

                        {/* Majors */}
                        <div className="flex flex-col gap-2">
                            <label className="text-sm text-gray-400">Majors</label>
                            <Input
                                type="text"
                                value={tempEdu.majors?.join(", ") || ""}
                                onChange={(e) =>
                                    setTempEdu({
                                        ...tempEdu,
                                        majors: e.target.value.split(",").map((m) => m.trim()),
                                    })
                                }
                                placeholder="Computer Science, Mathematics"
                            />
                        </div>

                        {/* Logo */}
                        <div className="flex flex-col gap-2">
                            <label className="text-sm text-gray-400">Logo URL</label>
                            <Input
                                type="text"
                                value={tempEdu.logo || ""}
                                onChange={(e) => setTempEdu({ ...tempEdu, logo: e.target.value })}
                                icon={tempEdu.logo ? <img src={tempEdu.logo} className="w-6 h-6 rounded-md" /> : null}
                            />
                        </div>

                        {/* Dates */}
                        <div className="flex gap-3">
                            <div className="flex flex-col gap-2 w-1/2">
                                <label className="text-sm text-gray-400">Start Date</label>
                                <Input
                                    type="text"
                                    value={tempEdu.start_date || ""}
                                    onChange={(e) => setTempEdu({ ...tempEdu, start_date: e.target.value })}
                                    placeholder="yyyy-mm"
                                />
                            </div>
                            <div className="flex flex-col gap-2 w-1/2">
                                <label className="text-sm text-gray-400">End Date</label>
                                <Input
                                    type="text"
                                    value={tempEdu.end_date || ""}
                                    onChange={(e) => setTempEdu({ ...tempEdu, end_date: e.target.value })}
                                    placeholder="yyyy-mm or Current"
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        {editingIndex !== null && (
                            <DialogClose asChild>
                                <Button variant="destructive" onClick={() => handleDelete(editingIndex!)}>
                                    <Trash2 className="w-4 h-4" /> Delete
                                </Button>
                            </DialogClose>
                        )}
                        <DialogClose asChild>
                            <Button onClick={handleSave}>Save</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function EducationSection({ profileSummary, setProfileSummary }: any) {
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [tempEdu, setTempEdu] = useState<any>({
        school: { name: "" },
        degree: "",
        majors: [],
        logo: "",
        start_date: "",
        end_date: "",
    });

    // Apri dialog per aggiungere o modificare
    const handleEdit = (index: number | null) => {
        setEditingIndex(index);
        if (index !== null && profileSummary?.education?.[index]) {
            setTempEdu({ ...profileSummary.education[index] });
        } else {
            setTempEdu({
                school: { name: "" },
                degree: "",
                majors: [],
                logo: "",
                start_date: "",
                end_date: "",
            });
        }
    };

    const handleSave = () => {
        console.log(tempEdu.majors)
        if (!tempEdu.school?.name.trim() || !tempEdu.majors.length || tempEdu.majors.filter(m => !m.trim()).length) return;

        setProfileSummary((prev: any) => {
            if (!prev) return prev;
            const newEdu = [...(prev.education || [])];

            if (editingIndex !== null) {
                newEdu[editingIndex] = tempEdu;
            } else {
                newEdu.push(tempEdu);
            }

            return { ...prev, education: newEdu };
        });

        setEditingIndex(null);
    };

    const handleDelete = (index: number) => {
        setProfileSummary((prev: any) => {
            if (!prev) return prev;
            const newEdu = prev.education.filter((_: any, i: number) => i !== index);
            return { ...prev, education: newEdu };
        });
    };

    return (
        <div>
            <Dialog>
                <div className="flex justify-start items-center mb-3 space-x-2">
                    <p className="text-sm text-gray-400">Experience</p>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="p-1" onClick={() => handleEdit(null)}>
                            <Plus className="w-4 h-4" />
                        </Button>
                    </DialogTrigger>
                </div>

                {/* Lista education */}
                <ul className="space-y-3">
                    {profileSummary?.education?.map((edu: any, idx: number) => (
                        <li
                            key={idx}
                            className="bg-white/5 hover:bg-white/10 rounded-lg p-4 border border-white/10 transition-colors"
                        >
                            <div className="flex items-start gap-3">
                                {/* Logo scuola */}
                                {edu.logo ? (
                                    <img
                                        src={edu.logo}
                                        alt={edu.school?.name || "School"}
                                        className="w-10 h-10 rounded-lg object-contain bg-white/5 p-1.5 border border-white/10 flex-shrink-0"
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-600/20 border border-white/10 flex items-center justify-center flex-shrink-0">
                                        <span className="text-blue-400 text-xs font-bold">
                                            {edu.school?.name?.charAt(0) || "?"}
                                        </span>
                                    </div>
                                )}

                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-medium">
                                        {edu.majors?.join(", ") || "Major not available"}
                                    </p>

                                    {edu.school?.name && (
                                        <p className="text-gray-300 text-sm">{edu.school.name}</p>
                                    )}

                                    {(edu.start_date || edu.end_date || edu.degree) && (
                                        <p className="text-gray-400 text-xs mt-1">
                                            {edu.degree && <>{edu.degree} | </>}{edu.start_date || "?"} → {edu.end_date || "?"}
                                        </p>
                                    )}
                                </div>

                                {/* Modifica singolo */}
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="p-1" onClick={() => handleEdit(idx)}>
                                        <Edit2 className="w-4 h-4" />
                                    </Button>
                                </DialogTrigger>
                            </div>
                        </li>
                    ))}
                    {!profileSummary?.education?.length && <li
                        className="bg-white/5 hover:bg-white/10 rounded-lg p-4 border border-white/10 transition-colors"
                    >
                        <div className="flex-1 min-w-0 min-h-16 flex items-center justify-center text-gray-500">
                            No education
                        </div>
                    </li>}
                </ul>

                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingIndex !== null ? "Edit Education" : "Add Education"}
                        </DialogTitle>
                    </DialogHeader>

                    <ScrollArea className='max-h-[calc(85vh-100px)]'>
                        <div className='space-y-4 p-1'>
                            <div className="flex flex-cols md:flex-row gap-3">
                                {/* School */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm text-gray-400">School</label>
                                    <CompanyAutocomplete onChange={(e) =>
                                        setTempEdu({
                                            ...tempEdu,
                                            school: { domain: "", name: e },
                                        })
                                    } onAddCompany={(e) => setTempEdu({ ...tempEdu, logo: e.icon, school: { domain: e.domain, name: e.name } })}
                                        value={tempEdu.school?.name || ""}
                                    />
                                </div>

                                {/* Degree (lista separata da virgole) */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm text-gray-400">Degree</label>
                                    <Input
                                        type="text"
                                        value={tempEdu.degree || ""}
                                        onChange={(e) =>
                                            setTempEdu({
                                                ...tempEdu,
                                                degree: e.target.value,
                                            })
                                        }
                                        placeholder="Bachelor"
                                    />
                                </div>
                            </div>

                            {/* Majors (lista separata da virgole) */}
                            <div className="flex flex-col gap-2">
                                <label className="text-sm text-gray-400">Majors</label>
                                <Input
                                    type="text"
                                    value={tempEdu.majors?.join(", ") || ""}
                                    onChange={(e) =>
                                        setTempEdu({
                                            ...tempEdu,
                                            majors: e.target.value.split(",").map((m) => m.trim()),
                                        })
                                    }
                                    placeholder="Computer Science, Mathematics"
                                />
                            </div>

                            {/* Logo */}
                            <div className="flex flex-col gap-2">
                                <label className="text-sm text-gray-400">Logo URL</label>
                                <Input
                                    type="text"
                                    value={tempEdu.logo || ""}
                                    onChange={(e) => setTempEdu({ ...tempEdu, logo: e.target.value })}
                                    icon={tempEdu.logo ? <img src={tempEdu.logo} className="w-6 h-6 rounded-md" /> : null}
                                />
                            </div>

                            {/* Date */}
                            <div className="flex gap-3">
                                <div className="flex flex-col gap-2 w-1/2">
                                    <label className="text-sm text-gray-400">Start Date</label>
                                    <Input
                                        type="text"
                                        value={tempEdu.start_date || ""}
                                        onChange={(e) => setTempEdu({ ...tempEdu, start_date: e.target.value })}
                                        placeholder="yyyy-mm"
                                    />
                                </div>
                                <div className="flex flex-col gap-2 w-1/2">
                                    <label className="text-sm text-gray-400">End Date</label>
                                    <Input
                                        type="text"
                                        value={tempEdu.end_date || ""}
                                        onChange={(e) => setTempEdu({ ...tempEdu, end_date: e.target.value })}
                                        placeholder="yyyy-mm or Current"
                                    />
                                </div>
                            </div>
                        </div>
                        <ScrollBar orientation='vertical' />
                    </ScrollArea>
                    <DialogFooter>
                        <DialogClose asChild>
                            {editingIndex !== null && (
                                <Button variant="destructive" onClick={() => handleDelete(editingIndex)}>
                                    <Trash2 className="w-4 h-4" /> Delete
                                </Button>
                            )}
                        </DialogClose>
                        <DialogClose asChild>
                            <Button onClick={handleSave}>Save</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function CertificationsSection({ profileSummary, setProfileSummary }: any) {
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [tempCert, setTempCert] = useState<any>({
        name: "",
        authority: "",
        issue_date: "",
        expired: false,
    });

    const handleEdit = (index: number | null) => {
        setEditingIndex(index);
        if (index !== null && profileSummary?.certifications?.[index]) {
            setTempCert({ ...profileSummary.certifications[index] });
        } else {
            setTempCert({
                name: "",
                authority: "",
                issue_date: "",
                expired: false,
            });
        }
    };

    const handleSave = () => {
        if (!tempCert.name.trim() || !tempCert.authority.trim()) return;

        setProfileSummary((prev: any) => {
            if (!prev) return prev;
            const newCerts = [...(prev.certifications || [])];

            if (editingIndex !== null) {
                newCerts[editingIndex] = tempCert;
            } else {
                newCerts.push(tempCert);
            }

            return { ...prev, certifications: newCerts };
        });

        setEditingIndex(null);
    };

    const handleDelete = (index: number) => {
        setProfileSummary((prev: any) => {
            if (!prev) return prev;
            const newCerts = prev.certifications.filter((_: any, i: number) => i !== index);
            return { ...prev, certifications: newCerts };
        });
    };

    return (
        <div>
            <Dialog>
                <div className="flex justify-start items-center mb-3 space-x-2">
                    <p className="text-sm text-gray-400">Certifications</p>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="p-1" onClick={() => handleEdit(null)}>
                            <Plus className="w-4 h-4" />
                        </Button>
                    </DialogTrigger>
                </div>

                {/* Lista certificazioni */}
                <ul className="space-y-3">
                    {profileSummary?.certifications?.map((cert: any, idx: number) => (
                        <li
                            key={idx}
                            className="bg-white/5 hover:bg-white/10 rounded-lg p-4 border border-white/10 transition-colors"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-medium">{cert.name || "Certification not available"}</p>
                                    {cert.authority && (
                                        <p className="text-gray-300 text-sm">{cert.authority}</p>
                                    )}
                                    {cert.issue_date && (
                                        <p className="text-gray-400 text-xs mt-1">
                                            Issued: {cert.issue_date} {cert.expired ? "· Expired" : ""}
                                        </p>
                                    )}
                                </div>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="p-1" onClick={() => handleEdit(idx)}>
                                        <Edit2 className="w-4 h-4" />
                                    </Button>
                                </DialogTrigger>
                            </div>
                        </li>
                    ))}

                    {!profileSummary?.certifications?.length && (
                        <li className="bg-white/5 hover:bg-white/10 rounded-lg p-4 border border-white/10 transition-colors">
                            <div className="flex-1 min-w-0 min-h-16 flex items-center justify-center text-gray-500">
                                No certifications
                            </div>
                        </li>
                    )}
                </ul>

                {/* Dialog per aggiunta/modifica */}
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingIndex !== null ? "Edit Certification" : "Add Certification"}
                        </DialogTitle>
                    </DialogHeader>

                    <ScrollArea className='max-h-[calc(85vh-100px)]'>
                        <div className='space-y-4 p-1'>
                            <div className="flex flex-col gap-3">
                                <label className="text-sm text-gray-400">Certification Name</label>
                                <Input
                                    type="text"
                                    value={tempCert.name}
                                    onChange={(e) => setTempCert({ ...tempCert, name: e.target.value })}
                                    maxLength={100}
                                />
                            </div>

                            <div className="flex flex-col gap-3">
                                <label className="text-sm text-gray-400">Authority</label>
                                <Input
                                    type="text"
                                    value={tempCert.authority}
                                    onChange={(e) => setTempCert({ ...tempCert, authority: e.target.value })}
                                    maxLength={100}
                                />
                            </div>

                            <div className='flex gap-3 items-start w-full'>
                                <div className="flex flex-col gap-2 flex-1">
                                    <label className="text-sm text-gray-400">Issue Date</label>
                                    <Input
                                        type="text"
                                        value={tempCert.issue_date}
                                        onChange={(e) => setTempCert({ ...tempCert, issue_date: e.target.value })}
                                        placeholder="yyyy-mm"
                                    />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label htmlFor='expired' className="text-sm text-gray-400">Expired</label>
                                    <Checkbox
                                        id="expired"
                                        checked={tempCert.expired}
                                        onCheckedChange={(e) => setTempCert({ ...tempCert, expired: e })}
                                        className='w-12 h-12'
                                    />
                                </div>
                            </div>
                        </div>
                        <ScrollBar orientation='vertical' />
                    </ScrollArea>

                    <DialogFooter>
                        <DialogClose asChild>
                            {editingIndex !== null && (
                                <Button variant="destructive" onClick={() => handleDelete(editingIndex)}>
                                    <Trash2 className="w-4 h-4" /> Delete
                                </Button>
                            )}
                        </DialogClose>
                        <DialogClose asChild>
                            <Button onClick={handleSave}>Save</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function ProjectsSection({ profileSummary, setProfileSummary }: any) {
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [tempProject, setTempProject] = useState<any>({
        title: "",
        description: "",
        technologies: [],
        start_date: "",
        end_date: "",
    });

    // Apri dialog
    const handleEdit = (index: number | null) => {
        setEditingIndex(index);
        if (index !== null && profileSummary?.projects?.[index]) {
            setTempProject({ ...profileSummary.projects[index] });
        } else {
            setTempProject({
                title: "",
                description: "",
                technologies: [],
                start_date: "",
                end_date: "",
            });
        }
    };

    // Salvataggio
    const handleSave = () => {
        if (!tempProject.title.trim()) return;

        setProfileSummary((prev: any) => {
            if (!prev) return prev;
            const newProjects = [...(prev.projects || [])];

            if (editingIndex !== null) {
                newProjects[editingIndex] = tempProject;
            } else {
                newProjects.push(tempProject);
            }

            return { ...prev, projects: newProjects };
        });

        setEditingIndex(null);
    };

    // Eliminazione
    const handleDelete = (index: number) => {
        setProfileSummary((prev: any) => {
            if (!prev) return prev;
            const newProjects = prev.projects.filter((_: any, i: number) => i !== index);
            return { ...prev, projects: newProjects };
        });
    };

    return (
        <div>
            <Dialog>
                <div className="flex justify-start items-center mb-3 space-x-2">
                    <p className="text-sm text-gray-400">Projects</p>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="p-1" onClick={() => handleEdit(null)}>
                            <Plus className="w-4 h-4" />
                        </Button>
                    </DialogTrigger>
                </div>

                {/* Lista progetti */}
                <ul className="space-y-3">
                    {profileSummary?.projects?.map((proj: any, idx: number) => (
                        <li
                            key={idx}
                            className="bg-white/5 hover:bg-white/10 rounded-lg p-4 border border-white/10 transition-colors"
                        >
                            <div className="flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-medium">{proj.title || "Untitled Project"}</p>
                                    {proj.description && (
                                        <p className="text-gray-300 text-sm line-clamp-3">{proj.description}</p>
                                    )}
                                    {proj.technologies?.length > 0 && (
                                        <p className="text-gray-400 text-xs mt-1">
                                            {proj.technologies.join(", ")}
                                        </p>
                                    )}
                                    {(proj.start_date || proj.end_date) && (
                                        <p className="text-gray-500 text-xs mt-1">
                                            {proj.start_date || "?"} → {proj.end_date || "?"}
                                        </p>
                                    )}
                                    {proj.link && (
                                        <a
                                            href={proj.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-blue-400 underline mt-1 block"
                                        >
                                            {proj.link}
                                        </a>
                                    )}
                                </div>

                                {/* Modifica */}
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="p-1" onClick={() => handleEdit(idx)}>
                                        <Edit2 className="w-4 h-4" />
                                    </Button>
                                </DialogTrigger>
                            </div>
                        </li>
                    ))}

                    {!profileSummary?.projects?.length && (
                        <li className="bg-white/5 hover:bg-white/10 rounded-lg p-4 border border-white/10 transition-colors">
                            <div className="flex-1 min-w-0 min-h-16 flex items-center justify-center text-gray-500">
                                No projects
                            </div>
                        </li>
                    )}
                </ul>

                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingIndex !== null ? "Edit Project" : "Add Project"}
                        </DialogTitle>
                    </DialogHeader>

                    <ScrollArea className='max-h-[calc(85vh-100px)]'>
                        <div className='space-y-4 p-1'>
                            {/* Titolo */}
                            <div className="flex flex-col gap-2">
                                <label className="text-sm text-gray-400">Title</label>
                                <Input
                                    type="text"
                                    value={tempProject.title}
                                    onChange={(e) => setTempProject({ ...tempProject, title: e.target.value })}
                                    maxLength={100}
                                />
                            </div>

                            {/* Descrizione */}
                            <div className="flex flex-col gap-2">
                                <label className="text-sm text-gray-400">Description</label>
                                <Textarea
                                    value={tempProject.description}
                                    onChange={(e) => setTempProject({ ...tempProject, description: e.target.value })}
                                    rows={3}
                                    maxLength={300}
                                />
                            </div>

                            {/* Tecnologie */}
                            <div className="flex flex-col gap-2">
                                <label className="text-sm text-gray-400">Technologies (comma separated)</label>
                                <Input
                                    type="text"
                                    value={tempProject.technologies?.join(", ")}
                                    onChange={(e) =>
                                        setTempProject({
                                            ...tempProject,
                                            technologies: e.target.value.split(",").map((t) => t.trim()),
                                        })
                                    }
                                    placeholder="React, Node.js, Tailwind"
                                />
                            </div>

                            {/* Date */}
                            <div className="flex gap-3">
                                <div className="flex flex-col gap-2 w-1/2">
                                    <label className="text-sm text-gray-400">Start Date</label>
                                    <Input
                                        type="text"
                                        value={tempProject.start_date}
                                        onChange={(e) => setTempProject({ ...tempProject, start_date: e.target.value })}
                                        placeholder="yyyy-mm"
                                    />
                                </div>
                                <div className="flex flex-col gap-2 w-1/2">
                                    <label className="text-sm text-gray-400">End Date</label>
                                    <Input
                                        type="text"
                                        value={tempProject.end_date}
                                        onChange={(e) => setTempProject({ ...tempProject, end_date: e.target.value })}
                                        placeholder="yyyy-mm or Current"
                                    />
                                </div>
                            </div>
                        </div>
                        <ScrollBar orientation='vertical' />
                    </ScrollArea>

                    <DialogFooter>
                        <DialogClose asChild>
                            {editingIndex !== null && (
                                <Button variant="destructive" onClick={() => handleDelete(editingIndex)}>
                                    <Trash2 className="w-4 h-4" /> Delete
                                </Button>
                            )}
                        </DialogClose>
                        <DialogClose asChild>
                            <Button onClick={handleSave}>Save</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export function ProfileSummaryCard({
    cardVariants,
    profileSummary,
    setProfileSummary,
    cvFile,
    handleCvUpload
}) {
    return (
        <motion.div variants={cardVariants} className="h-full">
            <Card className="p-6 h-full">
                <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
                    <User className="w-5 h-5 mr-2 text-violet-400" />
                    Your Profile Summary
                </h3>

                <div className="space-y-6">
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                        {/* Name & Title */}
                        <ProfileNameTitle profileSummary={profileSummary} setProfileSummary={setProfileSummary} />

                        {cvFile && <div className="flex justify-between items-center md:flex-row flex-col gap-2 pb-4 border-b border-white/10 w-full">
                            <div className='flex gap-2 items-center w-full'>
                                <FileText size={48} className="text-violet-400" />
                                <div>
                                    <h3 className="text-xl font-semibold text-white flex items-center">
                                        Your CV
                                    </h3>
                                    <p className="text-gray-400">{cvFile.name || "No CV uploaded."}</p>
                                </div>
                            </div>
                            <label className="md:w-auto w-full flex justify-center bg-white/10 hover:bg-white/20 text-white font-semibold py-2 px-4 rounded-lg transition-colors cursor-pointer inline-flex items-center space-x-2">
                                <Upload className="w-4 h-4" />
                                <span>Change CV</span>
                                <input
                                    type="file"
                                    className="hidden"
                                    onChange={handleCvUpload}
                                    accept=".pdf,.doc,.docx"
                                />
                            </label>
                        </div>}
                    </div>

                    {/* Key Skills */}
                    <div className='pb-4 border-b border-white/10'>
                        <p className="text-sm text-gray-400 mb-3">Key Skills</p>
                        <SkillsListClient profileSummary={profileSummary} setProfileSummary={setProfileSummary} />
                    </div>

                    <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                        {/* Experience */}
                        <div>
                            <ExperienceSection profileSummary={profileSummary} setProfileSummary={setProfileSummary} />
                        </div>

                        {/* Education */}
                        <div>
                            <EducationSection profileSummary={profileSummary} setProfileSummary={setProfileSummary} />
                        </div>
                    </div>

                    <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                        {/* Experience */}
                        <div>
                            <ProjectsSection profileSummary={profileSummary} setProfileSummary={setProfileSummary} />
                        </div>

                        {/* Education */}
                        <div>
                            <CertificationsSection profileSummary={profileSummary} setProfileSummary={setProfileSummary} />
                        </div>
                    </div>
                </div>
            </Card>
        </motion.div>
    )
}

export function ProfileAnalysisClient({ userId, plan }: ProfileAnalysisClientProps) {
    const [linkedinUrl, setLinkedinUrl] = useState('')
    const [analyzing, setAnalyzing] = useState(false)
    const [analysisComplete, setAnalysisComplete] = useState(false)
    const [profileSummary, setProfileSummary] = useState<ProfileSummary>(null)
    //const [recruiterPersona, setRecruiterPersona] = useState('')
    const [isPending, startTransition] = useTransition()
    const [cvFile, setCvFile] = useState<{ name: string, blob: any } | null>()
    const [isRecalculating, setIsRecalculating] = useState(false)

    const analyzeProfile = async () => {
        try {
            setAnalyzing(true)

            // Parametri di ricerca (qui puoi passare anche un'email o altri identificatori)
            const record = await enrichProfile(
                linkedinUrl
            );

            if (!record) {
                throw new Error("Profilo non trovato")
            }

            // Mappiamo i dati del record in un formato simile al mock
            const profileSummary: ProfileSummary = {
                name: record.full_name || "",
                title: record.job_title || "",
                experience: await Promise.all((record.experience || []).map(async (exp) => {
                    let logo = null;
                    if (exp.company?.website) {
                        try {
                            const domain = exp.company.website
                                .replace(/^https?:\/\//i, "")
                                .replace(/^www\./i, "")
                                .split(/[/?#]/)[0];

                            const res = await fetch(
                                `https://api.brandfetch.io/v2/search/${encodeURIComponent(domain)}?limit=1`,
                                { cache: "force-cache" }
                            );

                            if (res.ok) {
                                const data = await res.json();
                                if (Array.isArray(data) && data[0]?.icon) {
                                    logo = data[0].icon;
                                }
                            }
                        } catch (e) {
                            console.warn("Logo fetch failed for", exp.company?.name, e);
                        }
                    }
                    return { ...exp, logo };
                })),
                skills: record.skills || [],
                education: await Promise.all((record.education || []).map(async (edu) => {
                    let logo = null;
                    if (edu.school?.website) {
                        try {
                            const domain = edu.school.website
                                .replace(/^https?:\/\//i, "")
                                .replace(/^www\./i, "")
                                .split(/[/?#]/)[0];

                            const res = await fetch(
                                `https://api.brandfetch.io/v2/search/${encodeURIComponent(domain)}?limit=1`
                            );
                            if (res.ok) {
                                const data = await res.json();
                                if (Array.isArray(data) && data[0]?.icon) {
                                    logo = data[0].icon;
                                }
                            }
                        } catch (e) {
                            console.warn("Logo fetch failed for", edu.school?.name, e);
                        }
                    }
                    return { ...edu, logo };
                })),
                location: { country: record.location_country, continent: record.location_continent },
                projects: [],
                certifications: [],
            }

            setProfileSummary(profileSummary)
            setAnalysisComplete(true)
        } catch (error) {
            console.error("Errore durante l'analisi del profilo:", error)
            setProfileSummary({
                name: "Your name",
                title: "Your current job title",
                experience: [],
                skills: [],
                education: [],
                location: { country: "Your country", continent: "Your continent" },
                projects: [],
                certifications: []
            })
            setAnalysisComplete(true)
        } finally {
            setAnalyzing(false)
        }
    }

    const handleRecalculatePersona = async () => {
        setIsRecalculating(true)
        try {
            // In un'app reale, faresti una chiamata API qui
            // passando `profileSummary` aggiornato.
            console.log("Recalculating persona with updated profile:", profileSummary)
            await new Promise(resolve => setTimeout(resolve, 2000)) // Simula chiamata API

            const newPersona = `Based on the updated profile, the ideal recruiter is now looking for a Lead Frontend Developer with expertise in Next.js and team management skills. They likely work at a high-growth startup in the fintech sector.`
            setRecruiterPersona(newPersona)
        } catch (error) {
            console.error("Failed to recalculate persona:", error)
        } finally {
            setIsRecalculating(false)
        }
    }

    const handleContinue = () => {
        if (!cvFile) return alert("Please upload your CV before continuing.")
        startTransition(async () => {
            await submitProfile(userId, plan, {
                linkedinUrl,
                profileSummary,
            }, cvFile?.blob)
        })
    }

    const handleCvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            setCvFile({ name: file.name, blob: file });
        }
    };

    const containerVariants = {
        hidden: { opacity: 0, y: 30 },
        show: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.6, ease: "easeOut" },
        },
    }

    const cardVariants = {
        hidden: { opacity: 0, scale: 0.95, y: 20 },
        show: {
            opacity: 1,
            scale: 1,
            y: 0,
            transition: { type: "spring", stiffness: 120, damping: 15 },
        },
    }

    return (
        <AnimatePresence mode="wait">
            {/* STEP 1 */}
            {!analysisComplete && !analyzing && (
                <motion.div
                    key="step1"
                    className="max-w-3xl mx-auto"
                    initial="hidden"
                    animate="show"
                    exit="hidden"
                    variants={containerVariants}
                >
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-bold text-white mb-4">Connect Your LinkedIn Profile</h2>
                        <p className="text-lg text-gray-400">
                            Our AI will analyze your profile to understand your background and create the perfect recruiter
                            matching strategy.
                        </p>
                    </div>

                    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-8">
                        {/* LinkedIn URL */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-300 mb-2">LinkedIn Profile URL</label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                                    <Globe className="w-4 h-4" />
                                </div>
                                <input
                                    type="url"
                                    placeholder="e.g. https://www.linkedin.com/in/..."
                                    value={linkedinUrl}
                                    onChange={(e) => setLinkedinUrl(e.target.value)}
                                    className="w-full bg-white/10 border border-white/20 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                />
                            </div>
                        </div>

                        {/* CV Upload */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-300 mb-2">Upload Your CV</label>

                            <label
                                htmlFor="cv-upload"
                                className={`
    group relative flex flex-col items-center justify-center w-full h-32 rounded-xl border-2 border-dashed cursor-pointer overflow-hidden
    ${cvFile ? "border-violet-500/50 bg-gradient-to-br from-violet-500/5 to-violet-500/10" : "border-white/20 hover:border-violet-500/50 hover:bg-white/5"}
    transition-colors duration-200
  `}
                            >
                                <input
                                    id="cv-upload"
                                    type="file"
                                    accept=".pdf,.doc,.docx"
                                    onChange={handleCvUpload}
                                    className="hidden"
                                />

                                {!cvFile ? (
                                    <div className="flex flex-col items-center space-y-2 text-gray-400 group-hover:text-violet-400 transition-colors">
                                        <Upload className="w-8 h-8" />
                                        <span className="text-sm font-medium">Click or drag your CV here</span>
                                        <span className="text-xs text-gray-500">PDF, DOC, DOCX up to 5MB</span>
                                    </div>
                                ) : (
                                    <div className="relative flex flex-col items-center justify-center w-full h-full px-4 py-3 text-center">
                                        <FileText className="w-10 h-10 text-violet-400 mb-2" />
                                        <span
                                            className="text-sm font-medium text-gray-200 truncate max-w-[80%]"
                                            title={cvFile.name}
                                        >
                                            {cvFile.name}
                                        </span>
                                    </div>
                                )}
                            </label>

                        </div>

                        {/* Privacy Info */}
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6">
                            <h3 className="text-blue-400 font-semibold mb-2">🔒 Privacy & Security</h3>
                            <p className="text-gray-300 text-sm">
                                We only read your public profile information and your uploaded CV to understand your background.
                                We never share your data without consent.
                            </p>
                        </div>

                        {/* Analyze button */}
                        <div className="text-center">
                            <button
                                onClick={analyzeProfile}
                                disabled={!linkedinUrl.trim() || (!linkedinUrl.startsWith("https://linkedin.com/in/") && !linkedinUrl.startsWith("https://www.linkedin.com/in/")) || !cvFile}
                                className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white font-semibold py-3 px-8 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center space-x-2"
                            >
                                <Brain className="w-5 h-5" />
                                <span>Analyze My Profile</span>
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* STEP 2 */}
            {analyzing && (
                <motion.div
                    key="step2"
                    className="max-w-3xl mx-auto text-center"
                    initial="hidden"
                    animate="show"
                    exit="hidden"
                    variants={containerVariants}
                >
                    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-12">
                        <div className="mb-8">
                            <div className="w-20 h-20 bg-gradient-to-r from-violet-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                                <Brain className="w-10 h-10 text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-4">Analyzing Your Profile</h2>
                            <p className="text-gray-400">
                                Our AI is studying your background, skills, and experience to create your perfect recruiter
                                matching strategy...
                            </p>
                        </div>

                        <motion.div
                            className="space-y-4 text-left max-w-md mx-auto"
                            initial="hidden"
                            animate="show"
                            variants={{
                                hidden: {},
                                show: {
                                    transition: { staggerChildren: 0.5 },
                                },
                            }}
                        >
                            {[
                                "Reading profile information...",
                                "Analyzing skills and experience...",
                                "Identifying career patterns...",
                                "Creating recruiter persona...",
                            ].map((step, index) => (
                                <motion.div
                                    key={index}
                                    className="flex items-center space-x-3 text-gray-300"
                                    variants={cardVariants}
                                >
                                    <div className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" />
                                    <span className="text-sm">{step}</span>
                                </motion.div>
                            ))}
                        </motion.div>
                    </div>
                </motion.div>
            )}

            {/* STEP 3 */}
            {analysisComplete && !analyzing && (
                <motion.div
                    key="step3"
                    className="max-w-4xl mx-auto"
                    initial="hidden"
                    animate="show"
                    exit="hidden"
                    variants={containerVariants}
                >
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-bold text-white mb-4">Profile Analysis Complete</h2>
                        <p className="text-lg text-gray-400">
                            Review your profile summary and ideal recruiter persona. You can edit anything before proceeding.
                        </p>
                    </div>

                    <div className="grid gap-8 mb-8 w-full">
                        <ProfileSummaryCard
                            cardVariants={cardVariants}
                            profileSummary={profileSummary}
                            setProfileSummary={setProfileSummary}
                            cvFile={cvFile}
                            handleCvUpload={handleCvUpload}
                        />

                        {/*<motion.div
                            variants={cardVariants}
                            className="flex w-full flex-col bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6"
                        >
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-semibold text-white flex items-center">
                                    <Target className="w-5 h-5 mr-2 text-violet-400" />
                                    Ideal Recruiter Persona
                                </h3>
                                <Button
                                    onClick={handleRecalculatePersona}
                                    disabled={isRecalculating}
                                    variant="outline"
                                >
                                    {isRecalculating ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Recalculating...
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw className="w-4 h-4 mr-2" />
                                            Recalculate with AI
                                        </>
                                    )}
                                </Button>
                            </div>

                            <div className="flex-1">
                                <Textarea
                                    value={recruiterPersona}
                                    onChange={(e) => setRecruiterPersona(e.target.value)}
                                    className="w-full h-32 p-4 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                                    placeholder="Describe your ideal recruiter..."
                                />
                            </div>
                        </motion.div>*/}
                    </div>

                    <motion.div
                        className="text-center"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5, duration: 0.6 }}
                    >
                        <button
                            onClick={handleContinue}
                            disabled={isPending}
                            className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white font-semibold py-3 px-8 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center space-x-2"
                        >
                            {isPending ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <span>Continue Setup</span>
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>

                        <p className="text-sm text-gray-500 mt-4">
                            This information helps us find the perfect recruiters for you
                        </p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

interface CompanyInputClientProps {
    userId: string
    maxCompanies: number
    planType: string
    isUltraPlan: boolean
}

import React, {
    ChangeEvent,
    useCallback,
    useEffect,
} from "react";
import { enrichProfile, translateSkillsToEnglish } from '@/actions/pdl'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Checkbox } from './ui/checkbox'
import { ScrollArea, ScrollBar } from './ui/scroll-area'
import { MultiSelect } from './multi-select'
import { Separator } from './ui/separator'
import SkillsListBase, { EducationList, ExperienceList } from '@/components/detailsServer'
import Script from 'next/script'

/**
 * Tipo risultato Brandfetch-like
 */
type TQuery = {
    name: string;
    domain: string;
    icon: string;
};

/**
 * Props del componente principale (mantengo la signature che hai fornito)
 */
type CompanyInputClientProps = {
    userId: string;
    maxCompanies: number;
    planType?: string;
    isUltraPlan?: boolean;
};

export function CompanyAutocomplete({
    value,
    onChange,
    onAddCompany,
    placeholder,
    isDisabled = false,
    debounce = 300,
}: {
    value: string;
    onChange: (v: string) => void;
    onAddCompany: (q: TQuery) => void;
    placeholder?: string;
    isDisabled?: boolean;
    debounce?: number;
}) {
    const [active, setActive] = useState(false);
    const [queries, setQueries] = useState<TQuery[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchQueries = useCallback(async (q: string) => {
        if (!q || q.trim() === "" || q.includes("linkedin.com")) {
            setQueries([]);
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(
                `https://api.brandfetch.io/v2/search/${encodeURIComponent(q.trim())}?limit=3`
            );
            if (res.ok) {
                const data = await res.json();
                setQueries(Array.isArray(data) ? data : []);
            } else {
                setQueries([]);
            }
        } catch (e) {
            console.warn("Autocomplete fetch failed", e);
            setQueries([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Debounce per la ricerca
    useEffect(() => {
        const t = setTimeout(() => {
            fetchQueries(value);
        }, debounce);
        return () => clearTimeout(t);
    }, [value, debounce, fetchQueries]);

    const handleAddRawInput = () => {
        const text = value.trim();
        if (!text) return;

        let newCompany: TQuery;
        const linkedinMatch = text.match(/linkedin\.com\/company\/([^/?]+)/);

        if (linkedinMatch && linkedinMatch[1]) {
            const slug = decodeURIComponent(linkedinMatch[1]);
            newCompany = {
                name: slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
                domain: `linkedin.com/company/${slug}`,
                icon: null, // Non abbiamo un'icona per gli URL diretti
            };
        } else {
            newCompany = {
                name: text,
                domain: text, // Usiamo il testo come chiave univoca per gli inserimenti manuali
                icon: null,
            };
        }
        onAddCompany(newCompany);
    };

    const isLinkedInUrl = value.includes("linkedin.com/company/");

    return (
        <div className="relative w-full">
            <div className="flex items-center">
                <Input
                    type="text"
                    value={value}
                    placeholder={placeholder}
                    disabled={isDisabled}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
                    onFocus={() => setActive(true)}
                    onBlur={() => setTimeout(() => setActive(false), 200)} // delay per permettere il click
                    aria-label={placeholder}
                    icon={<Building className="w-4 h-4" />}
                />
            </div>

            {/* Dropdown dei suggerimenti */}
            {active && value.trim() !== "" && !isDisabled && (
                <div className="absolute z-20 mt-2 w-full bg-black border border-white/20 rounded-xl overflow-y-auto divide-y divide-white/20">
                    {loading ? (
                        <div className="px-4 py-3 text-sm text-white/70">Searching...</div>
                    ) : (
                        queries.map((q) => (
                            <button
                                key={q.domain}
                                type="button"
                                onClick={() => onAddCompany(q)}
                                className="w-full text-left flex items-center gap-3 px-3 py-2 hover:bg-white/10 transition"
                            >
                                <img
                                    src={q.icon}
                                    alt={q.name}
                                    className="w-8 h-8 rounded-md border border-white/20 object-contain bg-white"
                                />
                                <div className="truncate">
                                    <div className="text-sm font-medium text-white truncate">{q.name}</div>
                                    <div className="text-xs text-white/60 truncate">{q.domain}</div>
                                </div>
                            </button>
                        ))
                    )}

                    {/* Opzione per aggiungere l'input corrente */}
                    {active && value.trim() !== "" && !loading && isLinkedInUrl && (
                        <button
                            type="button"
                            onClick={handleAddRawInput}
                            className="w-full text-left flex items-center gap-3 px-3 py-2 hover:bg-white/10 transition"
                        >
                            <Link className="w-8 h-8 p-2 rounded-md border border-white/20 text-white/60" />
                            <div className="truncate">
                                <div className="text-sm font-medium text-white truncate">
                                    Add "{value.trim()}"
                                </div>
                                <div className="text-xs text-white/60 truncate">
                                    Add from LinkedIn URL
                                </div>
                            </div>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

export function CompanyInputClient({
    userId,
    maxCompanies,
    planType,
    isUltraPlan,
}: CompanyInputClientProps) {
    const [selectedCompanies, setSelectedCompanies] = useState<TQuery[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [isPending, startTransition] = useTransition();

    const handleAddCompany = (company: TQuery) => {
        // Evita di aggiungere se si è raggiunto il limite
        if (selectedCompanies.length >= maxCompanies) {
            // Potresti mostrare una notifica qui
            console.warn("Limite massimo di strategie raggiunto.");
            return;
        }
        // Evita duplicati basati sul dominio
        if (!selectedCompanies.some((c) => c.domain === company.domain)) {
            setSelectedCompanies((prev) => [...prev, company]);
        }
        setInputValue(""); // Pulisce l'input dopo l'aggiunta
    };

    const handleRemoveCompany = (domainToRemove: string) => {
        setSelectedCompanies((prev) =>
            prev.filter((c) => c.domain !== domainToRemove)
        );
    };

    // La logica per creare l'URL di LinkedIn rimane simile
    const toLinkedInUrl = (domain: string) => {
        domain = domain.trim();
        if (!domain) return null;

        if (domain.includes("linkedin.com/company/")) {
            return domain.startsWith("http") ? domain : `https://${domain}`;
        }

        const cleaned = domain
            .replace(/^https?:\/\//i, "")
            .replace(/^www\./i, "")
            .split(/[/?#]/)[0];

        return cleaned;
    };

    const handleContinue = () => {
        const companies = selectedCompanies
            .map(c => {
                const url = toLinkedInUrl(c.domain);
                if (!url) return null;

                // Caso LinkedIn
                if (url.includes("linkedin.com/company/")) {
                    const linkedin_url = url;
                    const name =
                        c.name ||
                        linkedin_url
                            .split("linkedin.com/company/")[1]
                            ?.split(/[/?#]/)[0]
                            ?.replace(/-/g, " ") // openai-inc -> openai inc
                            .replace(/\b\w/g, l => l.toUpperCase()) // Capitalizza
                        || "";
                    return { linkedin_url, name };
                }

                // Caso dominio generico
                const domain = url;
                const name =
                    c.name ||
                    domain
                        .split(".")[0]
                        .replace(/-/g, " ")
                        .replace(/\b\w/g, l => l.toUpperCase()); // google.com -> Google
                return { domain, name };
            })
            .filter(Boolean);

        startTransition(async () => {
            try {
                console.log("Submitting:", companies);
                // La tua logica di submit
                await submitCompanies(userId, companies);
            } catch (err) {
                console.error("Errore in submitCompanies", err);
            }
        });
    };

    const canAddMore = selectedCompanies.length < maxCompanies;

    // Varianti per le animazioni
    const containerVariants = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.1 } },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } },
        exit: { opacity: 0, scale: 0.8, transition: { duration: 0.2 } },
    };

    return (
        <>
            <motion.div
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-8 mb-8 relative z-10"
                initial="hidden"
                animate="show"
                variants={containerVariants}
            >
                <motion.div className="flex items-center justify-between mb-6" variants={itemVariants}>
                    <h3 className="text-xl font-semibold text-white">Target Companies</h3>
                    <span className="bg-gradient-to-r from-violet-500 to-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                        {selectedCompanies.length} / {maxCompanies} companies
                    </span>
                </motion.div>

                {/* Area per le aziende selezionate */}
                <motion.div
                    className="min-h-[60px] bg-black/20 border border-white/10 rounded-lg p-3 mb-4 flex flex-wrap gap-2"
                    variants={itemVariants}
                >
                    <AnimatePresence mode="popLayout">
                        {selectedCompanies.length === 0 && (
                            <motion.div
                                key="placeholder"
                                className="w-full text-center text-sm text-white/50 self-center"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                Search for a company to add it here
                            </motion.div>
                        )}
                        {selectedCompanies.map((company) => (
                            <motion.div
                                key={company.domain}
                                layout
                                variants={itemVariants}
                                initial="hidden"
                                animate="show"
                                exit="exit"
                                className="bg-violet-500/50 flex items-center gap-2 pl-2 pr-1 py-1 rounded-full text-sm font-medium border border-violet-500"
                            >
                                {company.icon ? (
                                    <img src={company.icon} alt={company.name} className="w-5 h-5 rounded-full object-contain bg-white" />
                                ) : company.domain.includes("linkedin.com/company") ? (
                                    <Link className="w-5 h-5 p-0.5 text-white/70" />
                                ) : <Building className="w-5 h-5 p-0.5 text-white/70" />
                                }
                                <span className="truncate max-w-[200px]">{company.name}</span>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveCompany(company.domain)}
                                    className="bg-black/20 hover:bg-red-500/50 rounded-full p-1 transition-colors"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </motion.div>

                {/* Input di ricerca */}
                <motion.div variants={itemVariants}>
                    <CompanyAutocomplete
                        value={inputValue}
                        onChange={setInputValue}
                        onAddCompany={handleAddCompany}
                        placeholder={
                            canAddMore
                                ? "Search by company name or paste a LinkedIn URL..."
                                : "You have reached the maximum number of companies"
                        }
                        isDisabled={!canAddMore}
                    />
                </motion.div>

                {isUltraPlan && (
                    <motion.div className="flex justify-end mt-6" variants={itemVariants}>
                        <button
                            type="button"
                            className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2 rounded-lg transition-colors inline-flex items-center space-x-2"
                        >
                            <Wand2 className="w-4 h-4" />
                            <span>Let AI Recommend</span>
                        </button>
                    </motion.div>
                )}
            </motion.div >

            <motion.div className="text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                <button
                    onClick={handleContinue}
                    disabled={selectedCompanies.length === 0 || isPending}
                    className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white font-semibold py-3 px-8 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center space-x-2"
                >
                    {isPending ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Saving...</span>
                        </>
                    ) : (
                        <>
                            <span>Continue Setup</span>
                            <ArrowRight className="w-5 h-5" />
                        </>
                    )}
                </button>
            </motion.div >
        </>
    );
}

const iconMap = {
    Gift,
    Target,
    Rocket,
    Crown
}

interface Plan {
    id: string
    name: string
    price: number
    description: string
    features: string[]
    highlight: string
    icon: string
    color: string
    popular?: boolean
}

interface PlanSelectionClientProps {
    userId: string
    plans: Plan[]
}

export function PlanSelectionClient({ userId, plans }: PlanSelectionClientProps) {
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.15, // animazione sequenziale a cascata
            },
        },
    }

    const cardVariants = {
        hidden: { opacity: 0, y: 30, scale: 0.95 },
        show: {
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
                type: "spring",
                stiffness: 120,
                damping: 15,
            },
        },
    }

    const iconsMap = {
        Gift,
        Target,
        Rocket,
        Crown
    };

    const handleSubmit = () => {
        if (!selectedPlan) return

        startTransition(async () => {
            await selectPlan(userId, selectedPlan)
        })
    }

    return (
        <>
            <motion.div
                className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
                variants={containerVariants}
                initial="hidden"
                animate="show"
            >
                {plans.map((plan) => {
                    const Icon = iconMap[plan.icon as keyof typeof iconMap]
                    const isSelected = selectedPlan === plan.id

                    return (
                        <motion.div
                            key={plan.id}
                            variants={cardVariants}
                            onClick={() => setSelectedPlan(plan.id)}
                            className={`p-6 flex flex-col cursor-pointer transition-all duration-300 relative rounded-xl border ${isSelected
                                ? "ring-2 ring-violet-500 bg-white/10 border-violet-500"
                                : plan.popular
                                    ? "ring-2 ring-violet-500/50 bg-violet-500/30 border-violet-500/30"
                                    : "bg-white/5 border-white/10 hover:bg-white/10"
                                }`}
                            whileHover={{ scale: 1.03 }} // leggero zoom al passaggio
                            whileTap={{ scale: 0.97 }}   // leggera pressione al click
                        >
                            {plan.popular && (
                                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                                    <span className="bg-gradient-to-r from-violet-500 to-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                                        {plan.highlight}
                                    </span>
                                </div>
                            )}

                            <div className="text-center mb-6">
                                <div
                                    className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${plan.color} flex items-center justify-center mx-auto mb-4 text-white`}
                                >
                                    <Icon className="w-8 h-8" />
                                </div>

                                <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                                <p className="text-gray-400 text-sm mb-4">{plan.description}</p>

                                <div className="mb-2">
                                    {plan.price === 0 ? (
                                        <span className="text-3xl font-bold text-green-400">FREE</span>
                                    ) : (
                                        <>
                                            <span className="text-3xl font-bold text-white">€{plan.price}</span>
                                            <span className="text-gray-400">/mo</span>
                                        </>
                                    )}
                                </div>

                                {!plan.popular && plan.price > 0 && (
                                    <p className="text-sm text-violet-400">{plan.highlight}</p>
                                )}
                            </div>

                            <ul className="space-y-3 mb-6">
                                {plan.features.map((feature, index) => (
                                    <li key={index} className="flex items-start space-x-2 text-sm">
                                        <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                                        <span className="text-gray-300">{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            <div className="mt-auto">
                                {isSelected && (
                                    <div className="flex items-center justify-center space-x-2 text-violet-400 mb-3">
                                        <CheckCircle className="w-4 h-4" />
                                        <span className="text-sm">Selected</span>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )
                })}
            </motion.div>

            <motion.div
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.6, ease: "easeOut" }}
            >
                <button
                    onClick={handleSubmit}
                    disabled={!selectedPlan || isPending}
                    className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white font-semibold py-3 px-8 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center space-x-2"
                >
                    {isPending ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Loading...</span>
                        </>
                    ) : (
                        <>
                            <span>{selectedPlan === "free_trial" ? "Start Free Trial" : "Continue Setup"}</span>
                            <ArrowRight className="w-5 h-5" />
                        </>
                    )}
                </button>

                <p className="text-sm text-gray-500 mt-4">
                    {selectedPlan === "free_trial"
                        ? "No credit card required • Perfect for testing our AI"
                        : "You can change or cancel your plan anytime"}
                </p>
            </motion.div>
        </>
    )
}