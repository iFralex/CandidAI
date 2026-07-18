import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import {
    EXPERIMENTS,
    isExperimentId,
    publicExperimentDefinitions,
    type ExperimentStatus,
} from "@/lib/experiments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRANSITIONS: Record<ExperimentStatus, ExperimentStatus[]> = {
    draft: ["running"],
    running: ["paused", "completed"],
    paused: ["running", "completed"],
    completed: [],
};

export async function GET() {
    const audit = await adminDb.collection("experiment_audit")
        .orderBy("timestamp", "desc")
        .limit(100)
        .get();
    return NextResponse.json({
        experiments: publicExperimentDefinitions(),
        audit: audit.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    });
}

/**
 * Records a reviewed lifecycle transition or decision. Runtime assignment is
 * intentionally code-controlled: the response includes pendingDeployment so
 * an administrative action can never silently alter production traffic without
 * the corresponding registry change being reviewed and deployed.
 */
export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const experimentId = typeof body?.experimentId === "string" ? body.experimentId : "";
    if (body?.action === "create_draft") {
        if (!/^[a-z0-9_]+_v\d+$/.test(experimentId) || isExperimentId(experimentId)) {
            return NextResponse.json({ error: "invalid_or_existing_experiment_id" }, { status: 400 });
        }
        const hypothesis = typeof body.hypothesis === "string" ? body.hypothesis.trim().slice(0, 1000) : "";
        const variants = Array.isArray(body.variants)
            ? body.variants.filter((value): value is string => typeof value === "string" && /^[a-z0-9_-]+$/.test(value)).slice(0, 5)
            : [];
        if (hypothesis.length < 20 || variants.length < 2) {
            return NextResponse.json({ error: "hypothesis_and_two_variants_required" }, { status: 400 });
        }
        const proposal = {
            experiment_id: experimentId,
            status: "draft",
            hypothesis,
            variants,
            primary_goal: typeof body.primaryGoal === "string" ? body.primaryGoal.slice(0, 100) : "signup_success",
            owner: typeof body.owner === "string" ? body.owner.slice(0, 100) : "analytics_admin",
            created_at: FieldValue.serverTimestamp(),
            pending_deployment: true,
        };
        await Promise.all([
            adminDb.collection("experiment_proposals").doc(experimentId).set(proposal),
            adminDb.collection("experiment_audit").add({
                ...proposal,
                action: "draft_created",
                actor: req.headers.get("x-forwarded-user") ?? "analytics_admin",
                timestamp: FieldValue.serverTimestamp(),
            }),
        ]);
        return NextResponse.json({ ok: true, pendingDeployment: true, proposal }, { status: 201 });
    }
    if (!isExperimentId(experimentId)) {
        return NextResponse.json({ error: "unknown_experiment" }, { status: 400 });
    }
    const current = EXPERIMENTS[experimentId];
    const targetStatus = typeof body?.targetStatus === "string" ? body.targetStatus as ExperimentStatus : null;
    const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 1000) : "";
    const winner = typeof body?.winner === "string" ? body.winner : null;
    if (!targetStatus || !TRANSITIONS[current.status].includes(targetStatus)) {
        return NextResponse.json({ error: "invalid_transition", from: current.status, to: targetStatus }, { status: 400 });
    }
    if (!reason) return NextResponse.json({ error: "reason_required" }, { status: 400 });
    if (winner && !Object.prototype.hasOwnProperty.call(current.variants, winner)) {
        return NextResponse.json({ error: "invalid_winner" }, { status: 400 });
    }
    const ref = await adminDb.collection("experiment_audit").add({
        experiment_id: experimentId,
        action: "lifecycle_transition_requested",
        from_status: current.status,
        to_status: targetStatus,
        winner,
        reason,
        actor: req.headers.get("x-forwarded-user") ?? "analytics_admin",
        timestamp: FieldValue.serverTimestamp(),
        pending_deployment: true,
    });
    return NextResponse.json({
        ok: true,
        auditId: ref.id,
        pendingDeployment: true,
        message: "Transition audited. Apply the matching registry change and deploy it to affect traffic.",
    }, { status: 202 });
}
