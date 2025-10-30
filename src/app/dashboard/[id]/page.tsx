// app/result/[id]/page.tsx

import { cookies } from "next/headers";
import { Suspense } from 'react';
import ResultClient from "./client"; // Importa il componente Client
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

// ============== SKELETON COMPONENTS ==============
// Questi componenti non hanno bisogno di interattività o animazioni,
// quindi possono rimanere tranquillamente nel file del server.

const CompanyHeaderSkeleton = () => {
    return (
        <div className="space-y-4 flex gap-6 w-full">
            <Skeleton className="w-48 h-48 rounded-lg" />
            <div className="w-full space-y-4">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-10 w-64" />
                    <div className="flex gap-2">
                        <Skeleton className="w-10 h-10 rounded-lg" />
                        <Skeleton className="w-10 h-10 rounded-lg" />
                    </div>
                </div>
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-2 flex-1" />
                        <Skeleton className="h-6 w-12" />
                    </div>
                    <div className="flex gap-4">
                        <Skeleton className="h-11 w-40" />
                        <Skeleton className="h-11 w-40" />
                        <Skeleton className="h-11 w-40" />
                    </div>
                </div>
            </div>
        </div>
    );
};

const EmailGeneratedSkeleton = () => {
    return (
        <Card className="p-6">
            <Skeleton className="h-7 w-48 mb-6" />
            <div className="grid grid-cols-5 gap-4">
                <div className="col-span-4">
                    <Skeleton className="h-64 w-full" />
                </div>
                <div className="col-span-1 space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <div className="space-y-3 pt-4">
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                    </div>
                </div>
            </div>
        </Card>
    );
};

export function RecruiterSummarySkeleton() {
    return (
        <Card className="p-6">
            {/* Header */}
            <div className="flex items-center mb-6">
                <Skeleton className="h-6 w-48 rounded" />
            </div>

            {/* Grid principale */}
            <div className="grid grid-cols-4 gap-16 p-2">
                {/* Colonna sinistra */}
                <div className="col-span-1 space-y-5">
                    {/* Profile card */}
                    <div className="flex items-center space-x-4">
                        <Skeleton className="w-24 h-24 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-5 w-32 rounded" />
                            <Skeleton className="h-4 w-24 rounded" />
                            <Skeleton className="h-4 w-20 rounded" />
                        </div>
                    </div>

                    <Separator className="my-5" />

                    {/* Skills */}
                    <div>
                        <Skeleton className="h-4 w-20 mb-3 rounded" />
                        <div className="flex flex-wrap gap-2">
                            {Array.from({ length: 10 }).map((_, i) => (
                                <Skeleton key={i} className="h-6 w-16 rounded" />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Colonna destra */}
                <div className="col-span-3 space-y-5">
                    {/* Experience */}
                    <div>
                        <Skeleton className="h-4 w-20 mb-3 rounded" />
                        <div className="grid grid-cols-3 gap-4">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Skeleton key={i} className="h-28 rounded" />
                            ))}
                        </div>
                    </div>

                    <Separator className="my-5" />

                    {/* Education */}
                    <div>
                        <Skeleton className="h-4 w-20 mb-3 rounded" />
                        <div className="grid grid-cols-3 gap-4">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <Skeleton key={i} className="h-28 rounded" />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="p-2">
                <Separator className="my-5" />
                <Skeleton className="h-4 w-72 mb-3 rounded" />
                <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 3 }).map((_, i, self) => (
                        <>
                            <Skeleton key={i} className="h-6 w-48 rounded" />
                            {i < self.length - 1 && <Skeleton key={i} className="h-6 w-10 rounded" />}
                        </>
                    ))}
                </div>
            </div>
        </Card>
    );
}

const BlogPostsSkeleton = () => {
    return (
        <Card className="p-6">
            <Skeleton className="h-7 w-48 mb-6" />
            <div className="grid grid-cols-3 gap-4 mb-5">
                <Skeleton className="h-48" />
                <Skeleton className="h-48" />
                <Skeleton className="h-48" />
            </div>
            <Separator className="my-5" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
            </div>
        </Card>
    );
};


// ============== DATA FETCHING COMPONENT ==============
// Questo componente esegue il fetch dei dati sul server.
const PageContent = async ({ params }: { params: { id: string } }) => {
    // Il fetch dei dati avviene qui, sul server
    const res = await fetch(`${process.env.NEXT_PUBLIC_DOMAIN}/api/protected/result/${(await params).id}`, {
        credentials: "include",
        cache: "no-cache",
        headers: {
            cookie: (await cookies()).toString() // Utilizza la funzione cookies() di Next.js
        }
    });

    if (!res.ok) {
        // Gestione dell'errore più robusta
        throw new Error(`Failed to fetch data: ${res.status} ${res.statusText}`);
    }

    let dataResponse = await res.json();
    if (!dataResponse.success) {
        throw new Error(dataResponse.error || "API returned an error");
    }

    const details = dataResponse.details;
    const customizations = dataResponse.customizations;

    // I dati recuperati vengono passati al componente client tramite props
    return <ResultClient data={details} customizations={customizations} emailSent={dataResponse.email_sent} />;
};


// ============== MAIN PAGE COMPONENT ==============
// Il componente principale della pagina che usa Suspense per il fallback.
const Page = ({ params }: { params: { id: string } }) => {
    return (
        <Suspense fallback={
            <div className="space-y-16">
                <CompanyHeaderSkeleton />
                <EmailGeneratedSkeleton />
                <RecruiterSummarySkeleton />
                <BlogPostsSkeleton />
            </div>
        }>
            <PageContent params={params} />
        </Suspense>
    );
};

export default Page;