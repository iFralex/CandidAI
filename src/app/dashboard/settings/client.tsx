"use client"

import { useState, useTransition } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { updateSettings } from "@/actions/onboarding-actions"

interface SettingsFormProps {
    defaultMarketingEmails: boolean
    defaultReminderFrequency: string
}

export function SettingsForm({ defaultMarketingEmails, defaultReminderFrequency }: SettingsFormProps) {
    const [marketingEmails, setMarketingEmails] = useState(defaultMarketingEmails)
    const [reminderFrequency, setReminderFrequency] = useState(defaultReminderFrequency)
    const [saved, setSaved] = useState(false)
    const [isPending, startTransition] = useTransition()

    const handleSave = () => {
        startTransition(async () => {
            await updateSettings({ marketingEmails, reminderFrequency })
            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
        })
    }

    return (
        <div className="space-y-8 max-w-2xl">
            {/* Marketing Emails */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
                <div>
                    <h2 className="text-lg font-semibold text-white">Email Preferences</h2>
                    <p className="text-gray-400 text-sm mt-1">Control how we communicate with you.</p>
                </div>

                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label htmlFor="marketing-emails" className="text-white text-sm font-medium">
                            Marketing Emails
                        </Label>
                        <p className="text-gray-400 text-sm">
                            Receive updates, tips, and promotional offers from CandidAI.
                        </p>
                    </div>
                    <Switch
                        id="marketing-emails"
                        checked={marketingEmails}
                        onCheckedChange={setMarketingEmails}
                    />
                </div>
            </div>

            {/* Reminder Frequency */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
                <div>
                    <h2 className="text-lg font-semibold text-white">Reminder Emails</h2>
                    <p className="text-gray-400 text-sm mt-1">How often should we remind you to follow up on sent emails.</p>
                </div>

                <div className="flex items-center justify-between">
                    <Label className="text-white text-sm font-medium">Reminder Frequency</Label>
                    <Select value={reminderFrequency} onValueChange={setReminderFrequency}>
                        <SelectTrigger className="w-48 bg-white/5 border-white/10 text-white">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="biweekly">Every 2 weeks</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="never">Never</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center gap-4">
                <Button onClick={handleSave} disabled={isPending}>
                    {isPending ? "Saving..." : "Save Settings"}
                </Button>
                {saved && (
                    <span className="text-green-400 text-sm">Settings saved successfully.</span>
                )}
            </div>
        </div>
    )
}
