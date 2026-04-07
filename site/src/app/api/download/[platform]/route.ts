import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

// electron-builder outputs to desktop/dist (old builds) or desktop/release (current config)
const SEARCH_DIRS = [
    path.resolve(process.cwd(), "../desktop/dist"),
    path.resolve(process.cwd(), "../desktop/release"),
];

// Glob-style: first match wins
const PLATFORM_PATTERNS: Record<string, { pattern: RegExp; mime: string; name: string }> = {
    mac: {
        pattern: /\.dmg$/,
        mime: "application/x-apple-diskimage",
        name: "CandidAI.dmg",
    },
    win: {
        pattern: /\.exe$/,
        mime: "application/octet-stream",
        name: "CandidAI-Setup.exe",
    },
};

function findFile(pattern: RegExp): string | null {
    for (const dir of SEARCH_DIRS) {
        if (!fs.existsSync(dir)) continue;
        const match = fs.readdirSync(dir).find((f) => pattern.test(f));
        if (match) return path.join(dir, match);
    }
    return null;
}

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ platform: string }> }
) {
    const { platform } = await params;
    const entry = PLATFORM_PATTERNS[platform];

    if (!entry) {
        return NextResponse.json({ error: "Unknown platform" }, { status: 400 });
    }

    const filePath = findFile(entry.pattern);

    if (!filePath) {
        return NextResponse.json(
            { error: `Build not available for ${platform} yet` },
            { status: 404 }
        );
    }

    const stat = fs.statSync(filePath);
    const stream = fs.createReadStream(filePath);

    const webStream = new ReadableStream({
        start(controller) {
            stream.on("data", (chunk) => controller.enqueue(chunk));
            stream.on("end", () => controller.close());
            stream.on("error", (err) => controller.error(err));
        },
        cancel() {
            stream.destroy();
        },
    });

    return new NextResponse(webStream, {
        headers: {
            "Content-Type": entry.mime,
            "Content-Disposition": `attachment; filename="${entry.name}"`,
            "Content-Length": String(stat.size),
        },
    });
}
