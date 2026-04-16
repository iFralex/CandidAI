import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { getSettings } from "@/actions/onboarding-actions"
import { SettingsForm } from "./client"

export const metadata = { title: "Settings" };

const SettingsSkeleton = () => (
    <div className="space-y-8">
        {/* Email Preferences */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
            <div className="flex items-center justify-between">
                <div className="space-y-1.5">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-4 w-72" />
                </div>
                <Skeleton className="h-6 w-11 rounded-full" />
            </div>
        </div>

        {/* Reminder Emails */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-72" />
            <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-10 w-48 rounded-md" />
            </div>
        </div>

        {/* Email Generation Notifications */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-80" />
            <div className="flex items-center justify-between">
                <div className="space-y-1.5">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-10 w-48 rounded-md" />
            </div>
        </div>

        <Skeleton className="h-10 w-32" />
    </div>
)

async function SettingsContent() {
    const settings = await getSettings()
    return (
        <SettingsForm
            defaultMarketingEmails={settings.marketingEmails}
            defaultReminderFrequency={settings.reminderFrequency}
            defaultEmailNotificationThreshold={settings.emailNotificationThreshold}
        />
    )
}

export default function SettingsPage() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
                <p className="text-gray-400">Manage your notification preferences and account settings.</p>
            </div>

            <Suspense fallback={<SettingsSkeleton />}>
                <SettingsContent />
            </Suspense>
        </div>
    )
}
