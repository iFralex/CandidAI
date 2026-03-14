'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { adminStorage, adminDb } from '@/lib/firebase-admin'
import { cookies } from 'next/headers';
import { getTokens } from 'next-firebase-auth-edge';
import { clientConfig, creditsInfo, plansData, serverConfig } from '@/config';
import { FieldValue } from 'firebase-admin/firestore'

export async function startServer(userId = null) {
    if (!userId)
        userId = await checkAuth()

    fetch(process.env.SERVER_RUNNER_URL || "", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ user_id: userId })
    })
}

export async function selectPlan(planId: string, billingType: string) {
    const userId = await checkAuth()

    // Riferimento al documento utente
    const ref = adminDb.collection("users").doc(userId)

    // Batch write
    const batch = adminDb.batch()

    batch.update(ref, {
        onboardingStep: 2,
        plan: planId,
        credits: plansData[planId].credits || 0,
        billingType: billingType
    })

    // Esegui batch
    await batch.commit()

    // Revalida la pagina per mostrare il nuovo step
    revalidatePath('/dashboard')
}

export async function submitCompanies(companies: { name: string, domain: string }[]) {
    const userId = await checkAuth()

    const accountRef = adminDb.collection("users").doc(userId).collection("data").doc("account")
    const userRef = adminDb.collection("users").doc(userId)

    // Batch per unire le due operazioni in un'unica commit
    const batch = adminDb.batch()

    // Equivalente a setDoc(..., { merge: true })
    batch.set(accountRef, { companies }, { merge: true })

    // Equivalente a updateDoc(...)
    batch.update(userRef, { onboardingStep: 3 })

    await batch.commit()

    revalidatePath('/dashboard')
}

export async function submitProfile(
    plan: string,
    profileData: any,
    cv?: File | null
) {
    const userId = await checkAuth();

    let cvUrl = profileData.cvUrl || null;

    // --- Upload CV con Firebase Admin Storage ---
    if (cv) {
        const bucket = adminStorage.bucket();
        const filePath = `cv/${userId}/${cv.name}`;
        const file = bucket.file(filePath);

        // Convertiamo il File/Blob in Buffer
        const arrayBuffer = await cv.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload
        await file.save(buffer, {
            contentType: cv.type,
            resumable: false,
        });

        // Otteniamo una signed URL equivalente al getDownloadURL()
        const [signedUrl] = await file.getSignedUrl({
            action: "read",
            expires: "2100-01-01", // simile a un URL permanente
        });

        cvUrl = signedUrl;
    }

    const updatedProfile = {
        ...profileData,
        cvUrl: cvUrl || null,
    };

    // --- Batch Firestore (più efficiente: una sola commit) ---
    const batch = adminDb.batch();

    const accountRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("account");

    const userRef = adminDb.collection("users").doc(userId);

    batch.update(accountRef, updatedProfile);
    batch.update(userRef, { onboardingStep: 4 });

    await batch.commit();

    // Revalida la dashboard (Next.js)
    revalidatePath("/dashboard");
}

export async function submitQueries(queries: any) {
    const userId = await checkAuth();

    const accountRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("account");

    const userRef = adminDb.collection("users").doc(userId);

    // Batch: 2 scritture → 1 sola commit, più efficiente
    const batch = adminDb.batch();

    batch.update(accountRef, { queries: queries });
    batch.update(userRef, { onboardingStep: 5 });

    await batch.commit();

    redirect("/dashboard");
}

export async function completeOnboarding(customizations: any) {
    const userId = await checkAuth();

    const accountRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("account");

    const userRef = adminDb.collection("users").doc(userId);

    // Batch: più efficiente e atomicamente equivalente
    const batch = adminDb.batch();

    batch.update(accountRef, { customizations });
    batch.update(userRef, { onboardingStep: 6 });

    await batch.commit();

    // Redirect identico alla versione originale
    redirect('/dashboard');
}

export async function refindRecruiter(companyId: string, strategy: any, name, linkedinUrl) {
    const userId = await checkAuth();

    // --- Ricostruzione identica della strategia (solo JS, invariata) ---
    strategy = strategy.map(item => {
        const newCriteria = [...item.criteria];

        function addOrUpdate(key: string, value: string) {
            const existing = newCriteria.find(c => c.key === key);
            if (existing) {
                if (!existing.value.includes(value)) existing.value.push(value);
            } else {
                newCriteria.push({ key, value: [value] });
            }
        }

        addOrUpdate("exclude_names", name);
        if (linkedinUrl) addOrUpdate("exclude_linkedin_urls", linkedinUrl);

        return { ...item, criteria: newCriteria };
    });

    // --- Riferimenti Admin SDK ---
    const resultsRef = adminDb.collection("users").doc(userId).collection("data").doc("results");
    const detailsRef = adminDb.collection("users").doc(userId).collection("data").doc("results").collection(companyId).doc("details");
    const rowRef = adminDb.collection("users").doc(userId).collection("data").doc("results").collection(companyId).doc("row");
    const customizationsRef = adminDb.collection("users").doc(userId).collection("data").doc("results").collection(companyId).doc("customizations");
    const emailsRef = adminDb.collection("users").doc(userId).collection("data").doc("emails");

    // --- Batch: tutte le operazioni Firestore in un'unica commit ---
    const batch = adminDb.batch();

    // setDoc(..., { merge: true })
    batch.set(customizationsRef, { queries: strategy }, { merge: true });

    // updateDoc results
    batch.update(resultsRef, {
        [`${companyId}.recruiter`]: FieldValue.delete(),
        [`${companyId}.email_sent`]: FieldValue.delete()
    });

    // updateDoc details
    batch.update(detailsRef, {
        recruiter_summary: FieldValue.delete(),
        query: FieldValue.delete(),
        email: FieldValue.delete(),
    });

    // updateDoc row
    batch.update(rowRef, {
        recruiter: FieldValue.delete(),
        query: FieldValue.delete(),
        email: FieldValue.delete(),
    });

    // updateDoc emails
    batch.update(emailsRef, {
        [companyId]: FieldValue.delete(),
    });

    // --- Esegui batch + deleteCreditsPaid in parallelo ---
    await Promise.all([
        batch.commit(),
        deleteCreditsPaid(userId, companyId, "find-recruiter"),
    ]);

    // --- Manteniamo comportamento originale ---
    await startServer(userId);

    redirect("/dashboard/" + companyId);
}

export async function regenerateEmail(companyId: string, instructions: string) {
    const userId = await checkAuth();

    // --- Riferimenti Admin Firestore ---
    const resultsRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("results");

    const detailsRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("results")
        .collection(companyId)
        .doc("details");

    const rowRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("results")
        .collection(companyId)
        .doc("row");

    const customizationsRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("results")
        .collection(companyId)
        .doc("customizations");

    const emailsRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("emails");

    // --- Batch Firestore: 5 operazioni in una sola commit ---
    const batch = adminDb.batch();

    // Equivalente di setDoc(..., { merge: true })
    batch.set(customizationsRef, { instructions }, { merge: true });

    // results: cancelliamo email_sent
    batch.update(resultsRef, {
        [`${companyId}.email_sent`]: FieldValue.delete()
    });

    // details: cancelliamo email
    batch.update(detailsRef, {
        email: FieldValue.delete()
    });

    // row: cancelliamo email
    batch.update(rowRef, {
        email: FieldValue.delete()
    });

    // emails: cancelliamo companyId
    batch.update(emailsRef, {
        [companyId]: FieldValue.delete()
    });

    // --- Esegui batch e deleteCreditsPaid in parallelo ---
    await Promise.all([
        batch.commit(),
        deleteCreditsPaid(userId, companyId, "generate-email")
    ]);

    // Manteniamo identico il comportamento originale
    await startServer(userId);

    redirect("/dashboard/" + companyId);
}

export async function confirmCompany(selections: any, strategies: any, instructions: any) {
    let userId = "";

    try {
        userId = await checkAuth();
    } catch {
        return { success: false, error: "User not authenticated" };
    }

    // --- Admin Firestore user reference ---
    const userRef = adminDb.collection("users").doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
        return { success: false, error: "User not found" };
    }

    const currentCredits = userSnap.data()?.credits || 0;

    const amount =
        (creditsInfo["change-company"]?.cost || 0) *
        Object.values(selections).filter((s: any) => s.action === "wrong").length;

    if (currentCredits < amount) {
        return { success: false, error: "Insufficient credits" };
    }

    // -------------------------------------------------------
    // 🔥 Admin batch: equivalente a writeBatch(db)
    // -------------------------------------------------------
    const batch = adminDb.batch();

    // Scala i crediti
    batch.update(userRef, { credits: currentCredits - amount });

    // -------------------------------------------------------
    // 🔄 Loop principale identico alla versione client
    // -------------------------------------------------------
    for (const [companyId, selection] of Object.entries(selections) as any) {
        // Pulisci newData come versione originale
        selection.newData = Object.fromEntries(
            Object.entries(selection.newData).filter(([_, v]) => v != null && v !== "")
        );

        const resultsRef = adminDb
            .collection("users")
            .doc(userId)
            .collection("data")
            .doc("results");

        const detailsRef = adminDb
            .collection("users")
            .doc(userId)
            .collection("data")
            .doc("results")
            .collection(companyId)
            .doc("details");

        const rowRef = adminDb
            .collection("users")
            .doc(userId)
            .collection("data")
            .doc("results")
            .collection(companyId)
            .doc("row");

        const customizationsRef = adminDb
            .collection("users")
            .doc(userId)
            .collection("data")
            .doc("results")
            .collection(companyId)
            .doc("customizations");

        const changedCompaniesRef = adminDb
            .collection("users")
            .doc(userId)
            .collection("data")
            .doc("changed_companies");

        if (selection.action === "confirm") {
            // Aggiorna il risultato principale
            batch.update(resultsRef, {
                [companyId]: { company: selection.newData }
            });

            // Rimuovi dalle companies_to_confirm
            batch.set(
                resultsRef,
                { companies_to_confirm: FieldValue.arrayRemove(companyId) },
                { merge: true }
            );

            // Aggiorna details
            batch.update(detailsRef, {
                company: selection.newData
            });

            // Se ci sono strategie → merge
            if (strategies[companyId] && strategies[companyId].length > 0) {
                batch.set(customizationsRef, { queries: strategies[companyId] }, { merge: true });
            }

            // Se ci sono instructions → merge
            if (instructions[companyId]) {
                batch.set(
                    customizationsRef,
                    { instructions: instructions[companyId] },
                    { merge: true }
                );
            }

        } else if (selection.action === "wrong") {
            // Cancella i documenti
            batch.delete(rowRef);
            batch.delete(detailsRef);

            // Cancella l'intero nodo per companyId
            batch.update(resultsRef, {
                [companyId]: FieldValue.delete()
            });

            // Rimuovi dalle companies_to_confirm
            batch.set(
                resultsRef,
                { companies_to_confirm: FieldValue.arrayRemove(companyId) },
                { merge: true }
            );

            // ⚠️ L'originale usa setDoc fuori dal batch → manteniamo esattamente così
            await changedCompaniesRef.set(
                { [companyId]: selection.newData },
                { merge: true }
            );
        }
    }

    // -------------------------------------------------------
    // 🔥 Commit batch
    // -------------------------------------------------------
    await batch.commit();

    await startServer(userId);

    redirect("/dashboard");
}

export async function getFileFromFirebase(publicUrl: string) {
    try {
        // 1️⃣ Estrai il percorso interno del file dal public URL
        // Esempio URL:
        // https://firebasestorage.googleapis.com/v0/b/tuo-bucket/o/offerte%2Fcliente123%2Fofferta.pdf?alt=media
        const match = publicUrl.match(/\/o\/([^?]+)/);
        if (!match) throw new Error("URL Firebase non valido");

        const encodedPath = match[1];
        const filePath = decodeURIComponent(encodedPath); // "offerte/cliente123/offerta.pdf"

        // 2️⃣ Recupera il file tramite Firebase Admin SDK
        const bucket = adminStorage.bucket();
        const file = bucket.file(filePath);

        // Download del contenuto
        const [data] = await file.download();

        // 3️⃣ Recupera i metadati del file
        const [metadata] = await file.getMetadata();

        // 4️⃣ Restituisci il contenuto codificato in Base64 e il MIME type
        return {
            base64: data.toString("base64"),
            mimeType: metadata.contentType || "application/octet-stream",
        };
    } catch (error) {
        console.error("❌ Errore nel recupero file da Firebase:", error);
        throw new Error("Impossibile scaricare il file da Firebase Storage");
    }
}

export async function submitEmailSent(companyId: string, sent: boolean) {
    // Ottieni l'utente autenticato
    const userId = await checkAuth();

    // Valore da salvare: false o timestamp server
    const value = sent ? FieldValue.serverTimestamp() : false;

    // --- Batch Firestore Admin ---
    const batch = adminDb.batch();

    // Riferimenti documenti
    const resultsRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("results");

    const emailsRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("emails");

    const detailsRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("results")
        .collection(companyId)
        .doc("details");

    // Aggiornamenti atomici
    batch.update(resultsRef, { [`${companyId}.email_sent`]: value });
    batch.update(emailsRef, { [`${companyId}.email_sent`]: value });
    batch.update(detailsRef, { "email.email_sent": value });

    // Esegui batch
    await batch.commit();

    // Revalida la pagina della dashboard
    revalidatePath(`/dashboard/${companyId}`);
}

export async function submitUpdateEmail(companyId: string, subject: string | null, body: string | null) {
    // Se non ci sono aggiornamenti, esci subito
    if (subject === null && body === null) return;

    // Ottieni l'utente autenticato
    const userId = await checkAuth();

    // --- Batch Firestore Admin ---
    const batch = adminDb.batch();

    // Riferimenti documenti
    const emailsRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("emails");

    const detailsRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("results")
        .collection(companyId)
        .doc("details");

    const rowRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("results")
        .collection(companyId)
        .doc("row");

    // Aggiornamenti atomici
    if (body !== null) {
        batch.update(emailsRef, { [`${companyId}.body`]: body });
        batch.update(detailsRef, { "email.body": body });
        batch.update(rowRef, { "email.body": body });
    }

    if (subject !== null) {
        batch.update(emailsRef, { [`${companyId}.subject`]: subject });
        batch.update(detailsRef, { "email.subject": subject });
        batch.update(rowRef, { "email.subject": subject });
    }

    // Esegui batch
    await batch.commit();

    // Revalida la pagina della dashboard
    revalidatePath(`/dashboard/${companyId}`);
}

export async function payCredits(companyId: string, contentKey: string) {
    try {
        // Ottieni l'utente autenticato
        const userId = await checkAuth();

        const userRef = adminDb.collection("users").doc(userId);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
            return { success: false, error: "User not found" };
        }

        const currentCredits = userSnap.data()?.credits || 0;
        const amount = creditsInfo[contentKey]?.cost || 0;

        if (currentCredits < amount) {
            return { success: false, error: "Insufficient credits" };
        }

        // --- Batch Firestore Admin ---
        const batch = adminDb.batch();

        // Aggiorna crediti
        batch.update(userRef, { credits: currentCredits - amount });

        // Sblocca contenuto
        const unlockedRef = adminDb
            .collection("users")
            .doc(userId)
            .collection("data")
            .doc("results")
            .collection(companyId)
            .doc("unlocked");

        batch.set(unlockedRef, { [contentKey]: true }, { merge: true });

        // Esegui batch
        await batch.commit();

        // Revalida la pagina della dashboard
        revalidatePath("/dashboard");

        return { success: true };
    } catch (err) {
        console.error("Server error in payCredits:", err);
        return { success: false, error: "Server error" };
    }
}

const deleteCreditsPaid = async (userId: string, companyId: string, contentKey: string) => {
    const unlockedRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("data")
        .doc("results")
        .collection(companyId)
        .doc("unlocked");

    await unlockedRef.update({
        [contentKey]: FieldValue.delete()
    });
};

const checkAuth = async (needVerified = true) => {
    const tokens = await getTokens(await cookies(), {
        apiKey: clientConfig.apiKey,
        cookieName: serverConfig.cookieName,
        cookieSignatureKeys: serverConfig.cookieSignatureKeys,
        serviceAccount: serverConfig.serviceAccount,
    });

    if (needVerified && !tokens?.decodedToken.email_verified)
        throw new Error("Email not verified")

    const userId = tokens?.decodedToken?.uid;
    if (!userId) throw new Error("Utente non autenticato");

    return userId;
}

export const resendEmailVerification = async () => {
    const userId = await checkAuth(false)
    fetch(`${process.env.NEXT_PUBLIC_DOMAIN}/api/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            userId,
            type: "welcome"
        })
    });
}