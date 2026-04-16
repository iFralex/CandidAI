"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, Mail, MessageSquare, Send } from "lucide-react";

const SUBJECTS = [
    { value: "Support", label: "Support" },
    { value: "Billing", label: "Billing" },
    { value: "General", label: "General" },
];

interface HelpClientProps {
    userId: string;
    initialEmail: string;
}

export default function HelpClient({ userId, initialEmail }: HelpClientProps) {
    const [form, setForm] = useState({ name: "", email: initialEmail, subject: "", message: "" });
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitError, setSubmitError] = useState("");

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!form.name.trim()) newErrors.name = "Name is required";
        if (!form.email.trim()) {
            newErrors.email = "Email is required";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
            newErrors.email = "Enter a valid email address";
        }
        if (!form.subject) newErrors.subject = "Please select a topic";
        if (!form.message.trim()) newErrors.message = "Message is required";
        return newErrors;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const newErrors = validate();
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }
        setErrors({});
        setStatus("loading");
        setSubmitError("");

        try {
            const res = await fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...form, userId }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Something went wrong");
            }

            setStatus("success");
        } catch (err: any) {
            setStatus("error");
            setSubmitError(err.message || "Failed to send message. Please try again.");
        }
    };

    return (
        <div className="w-full">
            {/* Header */}
            <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-sm text-violet-300 mb-6">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Support &amp; Help Center
                </div>
                <h1 className="text-4xl font-bold mb-3">
                    Contact{" "}
                    <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                        Us
                    </span>
                </h1>
                <p className="text-gray-400 text-base">
                    We typically reply within a few hours.
                </p>
            </div>

            {/* Card */}
            <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-8 shadow-2xl shadow-black/40 backdrop-blur-sm">
                {status === "success" ? (
                    <div className="flex flex-col items-center text-center py-8 gap-4">
                        <div className="w-16 h-16 rounded-full bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
                            <CheckCircle className="w-8 h-8 text-violet-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-white mb-1">Message sent!</h2>
                            <p className="text-gray-400 text-sm">
                                We'll get back to you at <span className="text-violet-300">{form.email}</span> as soon as possible.
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => {
                                setForm({ name: "", email: initialEmail, subject: "", message: "" });
                                setStatus("idle");
                            }}
                        >
                            Send another message
                        </Button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="bg-white/[0.03] border border-white/10 rounded-lg px-4 py-3 space-y-1 text-xs text-gray-400">
                            <div className="flex items-center gap-2">
                                <span className="text-gray-500">Account:</span>
                                <span className="text-gray-300 truncate">{initialEmail}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-gray-500">User ID:</span>
                                <span className="text-gray-300 font-mono truncate">{userId}</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    placeholder="Your name"
                                    value={form.name}
                                    onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(v => ({ ...v, name: "" })); }}
                                    error={errors.name}
                                    disabled={status === "loading"}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    placeholder="you@example.com"
                                    value={form.email}
                                    onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setErrors(v => ({ ...v, email: "" })); }}
                                    error={errors.email}
                                    disabled={status === "loading"}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="subject">Subject</Label>
                            <Select
                                value={form.subject}
                                onValueChange={val => { setForm(f => ({ ...f, subject: val })); setErrors(v => ({ ...v, subject: "" })); }}
                                disabled={status === "loading"}
                            >
                                <SelectTrigger id="subject" className="w-full">
                                    <SelectValue placeholder="Select a topic" />
                                </SelectTrigger>
                                <SelectContent>
                                    {SUBJECTS.map(s => (
                                        <SelectItem key={s.value} value={s.value}>
                                            {s.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.subject && <p className="text-red-400 text-sm mt-1 ml-4">{errors.subject}</p>}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="message">Message</Label>
                            <Textarea
                                id="message"
                                placeholder="Describe your issue or question..."
                                rows={5}
                                value={form.message}
                                onChange={e => { setForm(f => ({ ...f, message: e.target.value })); setErrors(v => ({ ...v, message: "" })); }}
                                disabled={status === "loading"}
                                className="resize-none"
                            />
                            {errors.message && <p className="text-red-400 text-sm mt-1 ml-4">{errors.message}</p>}
                        </div>

                        {status === "error" && (
                            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                                {submitError}
                            </p>
                        )}

                        <Button
                            type="submit"
                            variant="primary"
                            className="w-full"
                            disabled={status === "loading"}
                        >
                            {status === "loading" ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4 mr-2" />
                                    Send Message
                                </>
                            )}
                        </Button>
                    </form>
                )}
            </div>

            {/* Alt contact */}
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-500">
                <Mail className="w-4 h-4" />
                <span>Or email us directly at</span>
                <a
                    href="mailto:support@candidai.tech"
                    className="text-violet-400 hover:text-violet-300 transition-colors"
                >
                    support@candidai.tech
                </a>
            </div>
        </div>
    );
}
