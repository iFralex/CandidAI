import { cookies } from "next/headers";
import { Emails } from "./client";

const Page = async () => {
    let res = await fetch(process.env.NEXT_PUBLIC_DOMAIN + "/api/protected/emails", {
        credentials: "include",
        cache: "no-cache",
        headers: {
            cookie: await cookies()
        }
    });

    if (!res.ok) {
        throw new Error(res.status);
    }
    let data = await res.json();

    if (!data.success)
        throw new Error(data.error)

    return <Emails mails={Object.values(data.data)} />
}

export default Page