import { NextResponse } from "next/server";
import { ensureObjectId, requireAuthedUser, visibilityFilter } from "@/app/api/incidents/helpers";
import { Incident } from "@/lib/db/models/Incident";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_: Request, ctx: RouteCtx) {
  const auth = await requireAuthedUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const { id } = await ctx.params;
  const incidentId = ensureObjectId(id);
  if (!incidentId) return NextResponse.json({ error: "Invalid incident id" }, { status: 400 });

  const incident = await Incident.findOne({ _id: incidentId, ...visibilityFilter(user) })
    .populate("station", "code fullName")
    .populate("department", "code name")
    .lean();

  if (!incident) return NextResponse.json({ error: "Incident not found" }, { status: 404 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.startsWith("sk-ant-xxx")) {
    return NextResponse.json({
      insight:
        "AI insight unavailable: configure ANTHROPIC_API_KEY. Suggested baseline actions: reinforce SOP checks for this incident type, run targeted toolbox talks in the affected department, and audit controls at the reported location within 7 days.",
    });
  }

  const prompt = [
    "You are an aviation ground safety expert.",
    "Analyze this incident and provide concise preventive measures.",
    `GHR: ${incident.ghrNo}`,
    `Title: ${incident.incidentTitle}`,
    `Type: ${incident.incidentType}`,
    `Category: ${incident.incidentCategory}`,
    `Department: ${(incident as any).department?.code ?? "N/A"}`,
    `Station: ${(incident as any).station?.code ?? "N/A"}`,
    `Brief: ${incident.incidentBrief}`,
    "Return exactly:",
    "1) Primary risk drivers (3 bullets)",
    "2) Immediate preventive controls (5 bullets)",
    "3) 30-day corrective plan (5 bullets)",
  ].join("\n");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 700,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    return NextResponse.json({ error: `Anthropic request failed: ${err}` }, { status: 502 });
  }

  const data = await response.json();
  const insight =
    data?.content?.find((c: any) => c.type === "text")?.text ??
    "No insight returned.";

  return NextResponse.json({ insight });
}
