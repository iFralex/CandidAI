import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import HelpClient from './client';

export default async function HelpPage() {
    const res = await fetch(process.env.NEXT_PUBLIC_DOMAIN + "/api/protected/user", {
        credentials: "include",
        cache: "no-cache",
        headers: {
            cookie: (await cookies()).toString()
        }
    });

    if (!res.ok) return redirect('/login');
    const data = await res.json();
    if (!data.success || !data.user) return redirect('/login');

    const { uid, email } = data.user;

    return <HelpClient userId={uid} initialEmail={email ?? ""} />;
}
