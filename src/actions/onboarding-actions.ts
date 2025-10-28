'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db, storage } from '@/lib/firebase'
import { arrayRemove, deleteDoc, deleteField, doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { cookies } from 'next/headers';
import { getTokens } from 'next-firebase-auth-edge';
import { clientConfig, serverConfig } from '@/config';
import { adminStorage } from '@/lib/firebase-admin';

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

export async function refindRecruiter(companyId: string, strategy: any, name, linkedinUrl) {
    const tokens = await getTokens(await cookies(), {
        apiKey: clientConfig.apiKey,
        cookieName: serverConfig.cookieName,
        cookieSignatureKeys: serverConfig.cookieSignatureKeys,
        serviceAccount: serverConfig.serviceAccount,
    });

    const decodedToken = tokens?.decodedToken
    const userId = decodedToken?.uid

    strategy = strategy.map(item => {
        const newCriteria = [...item.criteria]; // copia array

        // helper per aggiungere valori evitando duplicati
        function addOrUpdate(key: string, value: string) {
            const existing = newCriteria.find(c => c.key === key);
            if (existing) {
                if (!existing.value.includes(value)) existing.value.push(value);
            } else {
                newCriteria.push({ key, value: [value] });
            }
        }

        addOrUpdate("exclude_names", name);
        if (linkedinUrl)
            addOrUpdate("exclude_linkedin_urls", linkedinUrl);

        return { ...item, criteria: newCriteria };
    });
    const resultsRef = doc(db, "users", userId, "data", "results");
    const detailsRef = doc(db, "users", userId, "data", "results", companyId, "details");
    const rowRef = doc(db, "users", userId, "data", "results", companyId, "row");
    const customizationsRef = doc(db, "users", userId, "data", "results", companyId, "customizations");
    const emailsRef = doc(db, "users", userId, "data", "emails");

    // Salva la nuova strategia
    const setStrategy = setDoc(customizationsRef, { queries: strategy }, { merge: true });

    // Cancella campi in parallelo
    const updates = Promise.all([
        // Cancella campi in results
        updateDoc(resultsRef, {
            [`${companyId}.recruiter`]: deleteField(),
            [`${companyId}.email_generated`]: deleteField()
        }),
        // Cancella campi in details
        updateDoc(detailsRef, {
            recruiter_summary: deleteField(),
            query: deleteField(),
            email: deleteField()
        }),
        // Cancella campi in row
        updateDoc(rowRef, {
            recruiter: deleteField(),
            query: deleteField(),
            email: deleteField()
        }),
        // Cancella companyId dentro emails
        updateDoc(emailsRef, {
            [companyId]: deleteField()
        })
    ]);

    // Esegui tutto in parallelo
    await Promise.all([setStrategy, updates]);

    redirect("/dashboard/" + companyId);
}

export async function regenerateEmail(companyId: string, instructions: string) {
    const tokens = await getTokens(await cookies(), {
        apiKey: clientConfig.apiKey,
        cookieName: serverConfig.cookieName,
        cookieSignatureKeys: serverConfig.cookieSignatureKeys,
        serviceAccount: serverConfig.serviceAccount,
    });

    const decodedToken = tokens?.decodedToken
    const userId = decodedToken?.uid

    const resultsRef = doc(db, "users", userId, "data", "results");
    const detailsRef = doc(db, "users", userId, "data", "results", companyId, "details");
    const rowRef = doc(db, "users", userId, "data", "results", companyId, "row");
    const customizationsRef = doc(db, "users", userId, "data", "results", companyId, "customizations");
    const emailsRef = doc(db, "users", userId, "data", "emails");

    // Salva la nuova strategia
    const setInstructions = setDoc(customizationsRef, { instructions: instructions }, { merge: true });

    // Cancella campi in parallelo
    const updates = Promise.all([
        // Cancella campi in results
        updateDoc(resultsRef, {
            [`${companyId}.email_generated`]: deleteField()
        }),
        // Cancella campi in details
        updateDoc(detailsRef, {
            email: deleteField()
        }),
        // Cancella campi in row
        updateDoc(rowRef, {
            email: deleteField()
        }),
        // Cancella companyId dentro emails
        updateDoc(emailsRef, {
            [companyId]: deleteField()
        })
    ]);

    // Esegui tutto in parallelo
    await Promise.all([setInstructions, updates]);

    redirect("/dashboard/" + companyId);
}

export async function confirmCompany(userId: string, selections: Object, strategies: Object, instructions) {
    const batch = writeBatch(db);

    for (const [companyId, selection] of Object.entries(selections)) {
        selection.newData = Object.fromEntries(Object.entries(selection.newData).filter(([_, v]) => v != null && v !== ""));

        if (selection.action === 'confirm') {
            batch.update(doc(db, "users", userId, "data", "results"), {
                [companyId]: { company: selection.newData }
            });
            batch.set(doc(db, "users", userId, "data", "results"), {
                companies_to_confirm: arrayRemove(companyId)
            }, { merge: true });
            batch.update(doc(db, "users", userId, "data", "results", companyId, "details"), {
                company: selection.newData
            });
            if (strategies[companyId] && strategies[companyId].length > 0)
                batch.set(doc(db, "users", userId, "data", "results", companyId, "customizations"), { queries: strategies[companyId] }, { merge: true });
            if (instructions[companyId])
                batch.set(doc(db, "users", userId, "data", "results", companyId, "customizations"), { instructions: instructions[companyId] }, { merge: true });
        } else if (selection.action === 'wrong') {
            batch.delete(doc(db, "users", userId, "data", "results", companyId, "row"));
            batch.delete(doc(db, "users", userId, "data", "results", companyId, "details"));
            batch.update(doc(db, "users", userId, "data", "results"), { [companyId]: deleteField() });
            batch.set(doc(db, "users", userId, "data", "results"), {
                companies_to_confirm: arrayRemove(companyId)
            }, { merge: true });
            await setDoc(doc(db, "users", userId, "data", "changed_companies"),
                { [companyId]: selection.newData },
                { merge: true }
            )
            //Replace in doc(db, "users", userId, "data", "account"), in the array companies, remove the object selection.oldData and push selection.newData
        }
    }

    await batch.commit();
    // Reindirizza alla dashboard dopo il completamento
    redirect('/dashboard')
}


export async function getFileFromFirebase(publicUrl: string) {
  try {
    // ✅ 1. Estrai il percorso interno del file dal public URL
    // Esempio URL:
    // https://firebasestorage.googleapis.com/v0/b/tuo-bucket/o/offerte%2Fcliente123%2Fofferta.pdf?alt=media
    const match = publicUrl.match(/\/o\/([^?]+)/);
    if (!match) throw new Error("URL Firebase non valido");
    const encodedPath = match[1];
    const filePath = decodeURIComponent(encodedPath); // "offerte/cliente123/offerta.pdf"

    // ✅ 2. Recupera il file tramite Firebase Admin SDK
    const bucket = adminStorage.bucket();
    const file = bucket.file(filePath);
    const [data] = await file.download();

    // ✅ 3. Recupera i metadati (tipo MIME)
    const [metadata] = await file.getMetadata();

    // ✅ 4. Restituisci il contenuto codificato in base64 e il MIME type
    return {
      base64: data.toString("base64"),
      mimeType: metadata.contentType || "application/octet-stream",
    };
  } catch (error) {
    console.error("❌ Errore nel recupero file da Firebase:", error);
    throw new Error("Impossibile scaricare il file da Firebase Storage");
  }
}
