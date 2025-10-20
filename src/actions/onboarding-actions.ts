'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db, storage } from '@/lib/firebase'
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export async function selectPlan(userId: string, planId: string) {
    // Salva nel database
    const ref = doc(db, "users", userId);

    await updateDoc(ref, {
        "onboardingStep": 2,
        "plan": planId
    });

    // Revalida la pagina per mostrare il nuovo step
    revalidatePath('/dashboard')
}

export async function submitCompanies(userId: string, companies: { name: string, domain: string }[]) {
    await setDoc(doc(db, "users", userId, "data", "account"), { companies }, { merge: true });
    await updateDoc(doc(db, "users", userId), { onboardingStep: 3 });

    revalidatePath('/dashboard')
}

export async function submitProfile(
    userId: string,
    plan: string,
    profileData: any,
    cv?: File | null
) {
    let cvUrl = profileData.cvUrl || null;

    if (cv) {
        const fileRef = ref(storage, `cv/${userId}/${cv.name}`);
        await uploadBytes(fileRef, cv);
        cvUrl = await getDownloadURL(fileRef);
    }

    const updatedProfile = {
        ...profileData,
        cvUrl: cvUrl || null
    };

    await updateDoc(doc(db, "users", userId, "data", "account"), updatedProfile);
    await updateDoc(doc(db, "users", userId), { onboardingStep: 4 });

    revalidatePath("/dashboard");
}

export async function submitQueries(userId: string, queries: any) {
    await updateDoc(doc(db, "users", userId, "data", "account"), { queries: queries });
    await updateDoc(doc(db, "users", userId), { onboardingStep: 5 });

    if (typeof window !== "undefined")
        revalidatePath('/dashboard')
    else
        redirect("/dashboard")
}

export async function completeOnboarding(userId: string, customizations: any) {
    await updateDoc(doc(db, "users", userId, "data", "account"), { customizations });
    await updateDoc(doc(db, "users", userId), { onboardingStep: 50 });

    // Reindirizza alla dashboard dopo il completamento
    redirect('/dashboard')
}