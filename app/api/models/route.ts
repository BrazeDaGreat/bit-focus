export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { baseUrl, apiKey } = body as { baseUrl?: string; apiKey?: string };

    if (!baseUrl || !baseUrl.trim()) {
      return Response.json({ error: "Base URL is required" }, { status: 400 });
    }

    const rawUrl = baseUrl.trim().replace(/\/+$/, "");
    const modelsUrl = rawUrl.endsWith("/models") ? rawUrl : `${rawUrl}/models`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (apiKey && apiKey.trim()) {
      headers["Authorization"] = `Bearer ${apiKey.trim()}`;
    }

    const response = await fetch(modelsUrl, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const errText = await response.text();
      let message = `Failed to fetch models (HTTP ${response.status})`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error?.message) {
          message = parsed.error.message;
        } else if (parsed.message) {
          message = parsed.message;
        }
      } catch {
        if (errText) {
          message += `: ${errText.slice(0, 150)}`;
        }
      }
      return Response.json({ error: message }, { status: response.status });
    }

    const data = await response.json();
    let modelList: { id: string; name: string }[] = [];

    if (Array.isArray(data?.data)) {
      modelList = data.data
        .filter((m: unknown) => m && typeof m === "object" && ("id" in m || "name" in m))
        .map((m: { id?: string; name?: string }) => ({
          id: m.id || m.name || "",
          name: m.name || m.id || "",
        }))
        .filter((m: { id: string; name: string }) => Boolean(m.id));
    } else if (Array.isArray(data?.models)) {
      modelList = data.models
        .filter((m: unknown) => m && typeof m === "object")
        .map((m: { id?: string; name?: string; model?: string }) => ({
          id: m.id || m.model || m.name || "",
          name: m.name || m.model || m.id || "",
        }))
        .filter((m: { id: string; name: string }) => Boolean(m.id));
    } else if (Array.isArray(data)) {
      modelList = data
        .map((m: unknown) => {
          if (typeof m === "string") return { id: m, name: m };
          if (m && typeof m === "object" && ("id" in m || "name" in m)) {
            const obj = m as { id?: string; name?: string };
            return { id: obj.id || obj.name || "", name: obj.name || obj.id || "" };
          }
          return null;
        })
        .filter((m): m is { id: string; name: string } => Boolean(m && m.id));
    }

    // Deduplicate by ID
    const seen = new Set<string>();
    modelList = modelList.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });

    // Sort models alphabetically
    modelList.sort((a, b) => a.id.localeCompare(b.id));

    return Response.json({ models: modelList });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
