import { getProfileData } from "@/actions/onboarding-actions"
import { ProfileClient } from "./client"

export default async function ProfilePage() {
    const { name, picture, plan, account } = await getProfileData()

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">Profile</h1>
                <p className="text-gray-400">Manage your profile information and account preferences.</p>
            </div>

            <ProfileClient
                defaultName={name}
                defaultPicture={picture}
                plan={plan}
                account={account}
            />
        </div>
    )
}
