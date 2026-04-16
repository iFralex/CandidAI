import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { getProfileData } from "@/actions/onboarding-actions"
import { ProfileClient } from "./client"

export const metadata = { title: "Profile" };

const ProfileSkeleton = () => (
    <div className="space-y-8">
        {/* Basic Info */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-6">
            <Skeleton className="h-6 w-24" />
            <div className="flex items-center gap-6">
                <Skeleton className="w-20 h-20 rounded-full" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-32" />
                </div>
            </div>
            <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-32" />
        </div>

        {/* Email Update */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-6">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-80" />
            <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-32" />
        </div>

        {/* Account Data sections */}
        <div className="space-y-6">
            <Skeleton className="h-6 w-36" />
            {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-64" />
                    <Skeleton className="h-32 w-full" />
                </div>
            ))}
        </div>
    </div>
)

async function ProfileContent() {
    const { name, picture, plan, account } = await getProfileData()
    return (
        <ProfileClient
            defaultName={name}
            defaultPicture={picture}
            plan={plan}
            account={account}
        />
    )
}

export default function ProfilePage() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">Profile</h1>
                <p className="text-gray-400">Manage your profile information and account preferences.</p>
            </div>

            <Suspense fallback={<ProfileSkeleton />}>
                <ProfileContent />
            </Suspense>
        </div>
    )
}
