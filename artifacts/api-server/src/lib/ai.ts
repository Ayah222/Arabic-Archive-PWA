// Small direct-fetch OpenAI helper for the HR module: document category
// suggestion and CV skills extraction. Uses OPENAI_API_KEY directly (already
// provisioned as an environment secret) rather than the heavier AI
// Integrations proxy scaffold — this app has no other AI infra to reuse and
// only needs two simple, non-streaming JSON completions.
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

const DOCUMENT_CATEGORIES = ["personal", "contract", "qualifications", "performance"] as const;
export type SuggestedDocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

// Suggests one of the 4 fixed employee-document categories from the filename
// and an optional short description. Falls back to "personal" (never blocks
// the upload) when the AI call is unavailable or fails.
export async function suggestDocumentCategory(filename: string, description?: string): Promise<SuggestedDocumentCategory> {
  const content = await callOpenAI(
    `صنّف مستندات الموظفين إلى واحدة من 4 فئات فقط: personal (ملف شخصي: هوية، جواز سفر، عنوان)، contract (عقود وقرارات إدارية)، qualifications (شهادات ومؤهلات)، performance (تقييم أداء). أجب بصيغة JSON فقط: {"category": "..."}.`,
    `اسم الملف: ${filename}${description ? `\nالوصف: ${description}` : ""}`,
  );
  if (!content) return "personal";
  try {
    const parsed = JSON.parse(content) as { category?: string };
    const category = parsed.category as SuggestedDocumentCategory | undefined;
    return category && DOCUMENT_CATEGORIES.includes(category) ? category : "personal";
  } catch {
    return "personal";
  }
}

// Extracts a short list of professional skills from CV text. Returns an empty
// array (never throws) when the AI call is unavailable or fails — callers
// should fall back to manual entry in that case.
export async function extractCvSkills(cvText: string): Promise<string[]> {
  const trimmed = cvText.slice(0, 12000); // keep prompt small & cheap
  const content = await callOpenAI(
    `استخرج قائمة قصيرة (10 كحد أقصى) بأهم المهارات المهنية والتقنية الواردة في نص السيرة الذاتية التالي. أجب بصيغة JSON فقط: {"skills": ["مهارة1", "مهارة2", ...]}.`,
    trimmed,
  );
  if (!content) return [];
  try {
    const parsed = JSON.parse(content) as { skills?: unknown };
    if (!Array.isArray(parsed.skills)) return [];
    return parsed.skills.filter((s): s is string => typeof s === "string").slice(0, 10);
  } catch {
    return [];
  }
}
