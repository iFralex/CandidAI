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
            <Skeleton className="w-10 h-10 rounded-lg" />
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

const RecruiterSummarySkeleton = () => {
    return (
        <Card className="p-6">
            <Skeleton className="h-7 w-48 mb-6" />
            <div className="grid grid-cols-4 gap-16 p-2">
                <div className="col-span-1 space-y-6">
                    <div className="flex items-center space-x-4">
                        <Skeleton className="w-24 h-24 rounded-full" />
                        <div className="space-y-2 flex-1">
                            <Skeleton className="h-6 w-full" />
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                        </div>
                    </div>
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                    </div>
                </div>
                <div className="col-span-3 space-y-6">
                    <div className="space-y-3">
                        <Skeleton className="h-4 w-24" />
                        <div className="grid grid-cols-3 gap-4">
                            <Skeleton className="h-32" />
                            <Skeleton className="h-32" />
                            <Skeleton className="h-32" />
                        </div>
                    </div>
                    <Separator />
                    <div className="space-y-3">
                        <Skeleton className="h-4 w-24" />
                        <div className="grid grid-cols-3 gap-4">
                            <Skeleton className="h-32" />
                            <Skeleton className="h-32" />
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
};

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
    const res = await fetch(`${process.env.NEXT_PUBLIC_DOMAIN}/api/protected/result/${params.id}`, {
        credentials: "include",
        cache: "no-cache",
        headers: {
            cookie: cookies().toString() // Utilizza la funzione cookies() di Next.js
        }
    });

    // Simulazione di attesa rimossa per chiarezza, puoi reinserirla se necessario
    // await new Promise(resolve => setTimeout(resolve, 10000));

    if (!res.ok) {
        // Gestione dell'errore più robusta
        throw new Error(`Failed to fetch data: ${res.status} ${res.statusText}`);
    }

    let dataResponse = await res.json();
    if (!dataResponse.success) {
        throw new Error(dataResponse.error || "API returned an error");
    }
    
    const data = dataResponse.data;

    // I dati recuperati vengono passati al componente client tramite props
    return <ResultClient data={data} />;
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