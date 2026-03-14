import { getSettings } from "@/actions/onboarding-actions"
import { SettingsForm } from "./client"

export default async function SettingsPage() {
    const settings = await getSettings()

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
                <p className="text-gray-400">Manage your notification preferences and account settings.</p>
            </div>

            <SettingsForm
                defaultMarketingEmails={settings.marketingEmails}
                defaultReminderFrequency={settings.reminderFrequency}
            />
        </div>
    )
}
