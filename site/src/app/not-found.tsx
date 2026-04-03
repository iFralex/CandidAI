import Link from "next/link";
import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";

export default function NotFound() {
    return (
        <>
            <Navigation />
            <main className="min-h-screen bg-black flex items-center justify-center px-6">
                <div className="text-center">
                    <p className="text-8xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                        404
                    </p>
                    <h1 className="mt-4 text-3xl font-bold text-white">Page not found</h1>
                    <p className="mt-3 text-gray-400 max-w-sm mx-auto">
                        The page you&apos;re looking for doesn&apos;t exist or has been moved.
                    </p>
                    <div className="mt-8">
                        <Link href="/">
                            <Button variant="primary">Go back home</Button>
                        </Link>
                    </div>
                </div>
            </main>
        </>
    );
}
