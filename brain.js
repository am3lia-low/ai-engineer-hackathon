const fs = require("fs/promises");
const path = require("path");

const TEXT_MODEL = "gemini-2.5-flash";
const VISION_MODEL = "gemini-2.5-flash";

let genAI = null;
function client() {
  if (genAI) return genAI;
  if (!process.env.GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");
  const { GoogleGenerativeAI } = require("@google/generative-ai");
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI;
}

async function describeScreen(imageBuffer) {
  try {
    if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
      throw new Error("Invalid imageBuffer");
    }
    const model = client().getGenerativeModel({ model: VISION_MODEL });
    const prompt =
      "Describe what's on this screen in one short sentence. " +
      "Focus on the activity, not specific text content. " +
      "Don't mention specific names, emails, or sensitive information.";
    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType: "image/png",
          data: imageBuffer.toString("base64"),
        },
      },
    ]);
    return (result?.response?.text?.()?.trim() || "no observation");
  } catch (_e) {
    return "no observation";
  }
}

async function getCatResponse(description, memory) {
  const safe = memory && typeof memory === "object" ? memory : {};
  const obs = Array.isArray(safe.observations) ? safe.observations : [];
  const sessionCount = typeof safe.session_count === "number" ? safe.session_count : 0;
  const recent = obs.slice(-10);

  let systemPrompt = "";
  try {
    systemPrompt = await fs.readFile(
      path.join(__dirname, "cat_prompt.txt"),
      "utf8"
    );
  } catch {
    systemPrompt = "You are a cat. Return JSON only.";
  }

  const userContext = {
    screen_description: String(description || ""),
    session_count: sessionCount,
    recent_observations: recent,
    output_format: {
      response: "what the cat says, can be empty string",
      tag: "short-tag-describing-what-happened",
    },
    instruction: "Return ONLY valid JSON with keys: response, tag.",
  };

  try {
    const model = client().getGenerativeModel({
      model: TEXT_MODEL,
      systemInstruction: systemPrompt,
    });
    const result = await model.generateContent(JSON.stringify(userContext));
    const raw = result?.response?.text?.()?.trim() || "";
    const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, "");
    try {
      const parsed = JSON.parse(cleaned);
      return {
        response: typeof parsed?.response === "string" ? parsed.response : "",
        tag: typeof parsed?.tag === "string" ? parsed.tag : "",
      };
    } catch {
      return { response: raw, tag: "" };
    }
  } catch {
    return { response: "", tag: "" };
  }
}

const PDF_PROMPT = `You are a small attentive black cat reading over the user's shoulder.
The image shows a page they are looking at — usually a paper, doc, or PDF.

Speak as if you just leaned in to peek and want to share. Warm, plain, friendly — like a quick whisper to a friend. 2-4 short sentences total.

- Sometimes (not always) start with a tiny reaction word: oh / hm / ah / ooh / huh.
- Then the actual point of the page: what is being claimed, found, or shown, in plain words.
- Keep numbers and key terms intact when they matter.
- If the page is mostly figures or references, briefly say so.

Do NOT say "the page says", "this page", "this image", or "as a cat". Just talk about it.
Return only the words, no quotes.`;

const EMAIL_PROMPT = `You are a small black cat helping the user with an email they have currently selected.
You will be given subject, sender, and body. Return STRICT JSON with three keys:

{
  "summary": "1-2 conversational sentences in your warm cat voice — what the sender wants. Plain, brief.",
  "draftReply": "A reply the user could send: 3-5 sentences in the user's voice (not yours), polite and direct. Use placeholders like [your decision] or [name] for anything that isn't in the email.",
  "clarifyingQuestion": "One natural-language question the user might ask themselves before replying. Empty string if it reads clear."
}

JSON only. No markdown fences. No commentary.`;

async function summarizePdfImage(base64Image) {
  const model = client().getGenerativeModel({ model: VISION_MODEL });
  const res = await model.generateContent([
    { text: PDF_PROMPT },
    { inlineData: { data: base64Image, mimeType: "image/png" } },
  ]);
  return (res?.response?.text?.() || "").trim();
}

async function analyzeEmail({ subject, sender, body }) {
  const model = client().getGenerativeModel({
    model: TEXT_MODEL,
    generationConfig: { responseMimeType: "application/json" },
  });
  const userMsg = `Subject: ${subject}\nFrom: ${sender}\n\n${body}`;
  const res = await model.generateContent([
    { text: EMAIL_PROMPT },
    { text: userMsg },
  ]);
  let text = (res?.response?.text?.() || "").trim();
  text = text.replace(/^```(?:json)?\s*|\s*```$/g, "");
  try {
    const parsed = JSON.parse(text);
    return {
      summary: parsed.summary || "",
      draftReply: parsed.draftReply || "",
      clarifyingQuestion: parsed.clarifyingQuestion || "",
    };
  } catch {
    return { summary: text, draftReply: "", clarifyingQuestion: "" };
  }
}

const VOICE_LIBRARY = {
  soft: "21m00Tcm4TlvDq8ikWAM",
  curious: "AZnzlk1XvdvUeBnXmlld",
  bright: "MF3mGyEYCl7XYWbV9V6O",
  low: "EXAVITQu4vr4xnSDxMaL",
  whisper: "XB0fDUnXU5powFXDhCwa",
};

function pickVoiceProfile({ mode, hour, defaultProfile, autoByContext }) {
  const fallback = defaultProfile && VOICE_LIBRARY[defaultProfile] ? defaultProfile : "soft";
  if (!autoByContext) return fallback;
  if (typeof hour === "number" && (hour >= 22 || hour < 6)) return "whisper";
  if (mode === "pdf") return "low";
  if (mode === "email") return "soft";
  return fallback;
}

module.exports = {
  describeScreen,
  getCatResponse,
  summarizePdfImage,
  analyzeEmail,
  pickVoiceProfile,
  VOICE_LIBRARY,
};
