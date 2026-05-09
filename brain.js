const { GoogleGenerativeAI } = require("@google/generative-ai");

const FLASH_MODEL = "gemini-2.0-flash";

let genai = null;
function client() {
  if (genai) return genai;
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  genai = new GoogleGenerativeAI(key);
  return genai;
}

const PDF_PROMPT = `You are a small attentive black cat reading over the user's shoulder.
The image shows whatever the user is currently looking at — usually a paper or PDF page.

In 2-4 short sentences:
- Capture the central claim, finding, or argument visible on this page.
- Keep technical terms intact, but make the prose plain.
- Do not preface with "the page says" or similar. Just summarize.
- If the page is mostly figures or references, briefly note what is being shown.

Return only the summary, no preamble.`;

const EMAIL_PROMPT = `You are a small black cat helping the user with an email.
You will be given the email's subject, sender, and body. Return STRICT JSON with three keys:
{
  "summary": "1-2 sentence summary of what the sender wants or says.",
  "draftReply": "A polite, concise reply in the user's voice (3-5 sentences). Do not invent facts; if anything is missing, leave a clear placeholder like [your decision].",
  "clarifyingQuestion": "One natural-language clarifying question the user might want to answer before replying. If nothing needs clarifying, return an empty string."
}
Return only the JSON, no markdown fences, no commentary.`;

const cache = new Map();
function memo(key, fn) {
  const hit = cache.get(key);
  if (hit) return hit;
  const p = Promise.resolve()
    .then(fn)
    .catch((err) => {
      cache.delete(key);
      throw err;
    });
  cache.set(key, p);
  return p;
}

function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

async function summarizePdfImage(base64Image) {
  const key = "pdf:" + hashStr(base64Image.length + ":" + base64Image.slice(0, 4096));
  return memo(key, async () => {
    const model = client().getGenerativeModel({ model: FLASH_MODEL });
    const res = await model.generateContent([
      { text: PDF_PROMPT },
      { inlineData: { data: base64Image, mimeType: "image/png" } },
    ]);
    return (res.response.text() || "").trim();
  });
}

async function analyzeEmail({ subject, sender, body }) {
  const key = "mail:" + hashStr(`${subject}|${sender}|${body}`);
  return memo(key, async () => {
    const model = client().getGenerativeModel({
      model: FLASH_MODEL,
      generationConfig: { responseMimeType: "application/json" },
    });
    const userMsg = `Subject: ${subject}\nFrom: ${sender}\n\n${body}`;
    const res = await model.generateContent([
      { text: EMAIL_PROMPT },
      { text: userMsg },
    ]);
    let text = (res.response.text() || "").trim();
    text = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    try {
      return JSON.parse(text);
    } catch {
      return { summary: text || "", draftReply: "", clarifyingQuestion: "" };
    }
  });
}

module.exports = { summarizePdfImage, analyzeEmail };
