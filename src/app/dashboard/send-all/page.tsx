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
console.log("emails", Object.entries(data.data).map(email => ({...email[1], companyId: email[0]})).length)
    return <Emails mails={Object.entries(data.data).map(email => ({...email[1], companyId: email[0]}))} userId={data.userId} />
}

export default Page