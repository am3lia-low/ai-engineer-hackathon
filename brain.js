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
The image shows a page they are looking at — usually a paper, doc, or PDF.

Speak as if you just leaned in to peek and want to share. Warm, plain, friendly — like a quick whisper to a friend. 2-4 short sentences total.

- Sometimes (not always) start with a tiny reaction word: oh / hm / ah / ooh / huh.
- Then the actual point of the page: what is being claimed, found, or shown, in plain words.
- Keep numbers and key terms intact when they matter.
- If the page is mostly figures or references, briefly say so.

Do NOT say "the page says", "this page", "this image", or "as a cat". Do not preface or apologize. Just talk about it.
Return only the words, no quotes.`;

const EMAIL_PROMPT = `You are a small black cat helping the user with an email they have currently selected.
You will be given the email's subject, sender, and body. Return STRICT JSON with three keys:

{
  "summary": "1-2 conversational sentences in your warm cat voice — what the sender is asking or saying. Plain, brief.",
  "draftReply": "A reply the user could actually send: 3-5 sentences in the user's voice (not yours), polite and direct. Use placeholders like [your decision] or [name] for anything that isn't in the email.",
  "clarifyingQuestion": "One natural-language question the user might ask themselves before replying. Empty string if nothing needs clarifying."
}

Return only the JSON. No markdown fences. No commentary.`;

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
  const key =
    "pdf:" + hashStr(base64Image.length + ":" + base64Image.slice(0, 4096));
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
    text = text
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();
    try {
      return JSON.parse(text);
    } catch {
      return { summary: text || "", draftReply: "", clarifyingQuestion: "" };
    }
  });
}

module.exports = { summarizePdfImage, analyzeEmail };
