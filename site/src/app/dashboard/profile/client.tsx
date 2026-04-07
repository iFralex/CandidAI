"use client"

import { useState, useTransition, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateUserBasicInfo, updateUserEmail, updateAccountData, submitProfile } from "@/actions/onboarding-actions"
import { track } from "@/lib/analytics"
import { ProfileAnalysisClient } from "@/components/onboarding"
import { AdvancedFiltersClientWrapper } from "@/components/onboarding"
import { SetupCompleteClient } from "@/components/onboarding"
import { User, Mail, Settings } from "lucide-react"
import Image from "next/image"

interface ProfileClientProps {
    defaultName: string
    defaultPicture: string | null
    plan: string
    account: Record<string, any>
}

function BasicInfoSection({ defaultName, defaultPicture }: { defaultName: string; defaultPicture: string | null }) {
    const [name, setName] = useState(defaultName)
    const [preview, setPreview] = useState<string | null>(defaultPicture)
    const [pictureFile, setPictureFile] = useState<File | null>(null)
    const [isPending, startTransition] = useTransition()
    const [saved, setSaved] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setPictureFile(file)
        setPreview(URL.createObjectURL(file))
    }

    const handleSave = () => {
        startTransition(async () => {
            await updateUserBasicInfo(name, pictureFile)
            const fields = []
            if (name !== defaultName) fields.push("name")
            if (pictureFile) fields.push("picture")
            if (fields.length) track({ name: "profile_update", params: { fields } })
            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
        })
    }

    return (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-3 mb-2">
                <User className="w-5 h-5 text-violet-400" />
                <h2 className="text-lg font-semibold text-white">Basic Info</h2>
            </div>

            <div className="flex items-center gap-6">
                <div className="relative">
                    <div
                        className="w-20 h-20 rounded-full overflow-hidden bg-white/10 border-2 border-white/20 flex items-center justify-center cursor-pointer hover:border-violet-500 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {preview ? (
                            <Image src={preview} alt="Profile" width={80} height={80} className="object-cover w-full h-full" unoptimized />
                        ) : (
                            <User className="w-8 h-8 text-gray-400" />
                        )}
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                    />
                </div>
                <div>
                    <p className="text-sm text-gray-300 font-medium">Profile Picture</p>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-sm text-violet-400 hover:text-violet-300 mt-1"
                    >
                        Upload new photo
                    </button>
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="name" className="text-white text-sm font-medium">Display Name</Label>
                <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                    placeholder="Your name"
                />
            </div>

            <div className="flex items-center gap-4">
                <Button onClick={handleSave} disabled={isPending}>
                    {isPending ? "Saving..." : "Save Changes"}
                </Button>
                {saved && <span className="text-green-400 text-sm">Saved successfully.</span>}
            </div>
        </div>
    )
}

function EmailUpdateSection() {
    const [email, setEmail] = useState("")
    const [isPending, startTransition] = useTransition()
    const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null)

    const handleUpdate = () => {
        if (!email.trim()) return
        startTransition(async () => {
            try {
                await updateUserEmail(email.trim())
                track({ name: "profile_update", params: { fields: ["email"] } })
                setResult({ success: true })
                setEmail("")
            } catch (err: any) {
                setResult({ error: err?.message || "Failed to update email." })
            }
        })
    }

    return (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-3 mb-2">
                <Mail className="w-5 h-5 text-violet-400" />
                <h2 className="text-lg font-semibold text-white">Email Address</h2>
            </div>

            <p className="text-gray-400 text-sm">
                Enter a new email address. A verification link will be sent to the new address.
            </p>

            <div className="space-y-2">
                <Label htmlFor="new-email" className="text-white text-sm font-medium">New Email Address</Label>
                <Input
                    id="new-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                    placeholder="new@example.com"
                />
            </div>

            <div className="flex items-center gap-4">
                <Button onClick={handleUpdate} disabled={isPending || !email.trim()}>
                    {isPending ? "Updating..." : "Update Email"}
                </Button>
                {result?.success && (
                    <span className="text-green-400 text-sm">
                        Email updated. Check your new inbox for the verification link.
                    </span>
                )}
                {result?.error && (
                    <span className="text-red-400 text-sm">{result.error}</span>
                )}
            </div>
        </div>
    )
}

export function ProfileClient({ defaultName, defaultPicture, plan, account }: ProfileClientProps) {
    const profileSummary = account?.profileSummary ?? null
    const queries = account?.queries ?? []
    const customizations = account?.customizations ?? {}
    const maxStrategies = plan === "ultra" ? 50 : 30

    const handleSaveProfile = async (planArg: string, profileData: any, cv?: File | null) => {
        await submitProfile(planArg, profileData, cv, true)
    }

    const handleSaveQueries = async (strategy: any) => {
        await updateAccountData({ queries: strategy })
    }

    const handleSaveCustomizations = async (data: any) => {
        await updateAccountData({ customizations: data })
    }

    return (
        <div className="space-y-8 max-w-4xl">
            {/* Section 1: Basic Info */}
            <BasicInfoSection defaultName={defaultName} defaultPicture={defaultPicture} />

            {/* Section 2: Email Update */}
            <EmailUpdateSection />

            {/* Section 3: Onboarding Data */}
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <Settings className="w-5 h-5 text-violet-400" />
                    <h2 className="text-lg font-semibold text-white">Account Data</h2>
                </div>

                {/* User Profile (Skills, Experience, Education) */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
                    <div>
                        <h3 className="text-base font-semibold text-white">User Profile</h3>
                        <p className="text-gray-400 text-sm mt-1">Update your skills, experience, and education.</p>
                    </div>
                    <ProfileAnalysisClient
                        userId=""
                        plan={plan}
                        initialProfile={profileSummary}
                        onSave={handleSaveProfile}
                    />
                </div>

                {/* Default Recruiter Criteria */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
                    <div>
                        <h3 className="text-base font-semibold text-white">Default Recruiter Criteria</h3>
                        <p className="text-gray-400 text-sm mt-1">Adjust the filters used to find recruiters.</p>
                    </div>
                    <AdvancedFiltersClientWrapper
                        defaultStrategy={queries}
                        maxStrategies={maxStrategies}
                        userId=""
                        onSave={handleSaveQueries}
                    />
                </div>

                {/* Default Custom Prompt */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
                    <div>
                        <h3 className="text-base font-semibold text-white">Default Custom Prompt</h3>
                        <p className="text-gray-400 text-sm mt-1">Set the default position description and custom instructions for email generation.</p>
                    </div>
                    <SetupCompleteClient
                        userId=""
                        defaultCustomizations={customizations}
                        onSave={handleSaveCustomizations}
                    />
                </div>
            </div>
        </div>
    )
}
