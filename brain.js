const fs = require("fs/promises");
const path = require("path");

async function describeScreen(imageBuffer) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Missing GEMINI_API_KEY");
    }

    if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
      throw new Error("Invalid imageBuffer");
    }

    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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

    const description = result?.response?.text?.()?.trim();
    return description || "no observation";
  } catch (_error) {
    return "no observation";
  }
}

async function getCatResponse(description, memory) {
  const safeMemory = memory && typeof memory === "object" ? memory : {};
  const observations = Array.isArray(safeMemory.observations)
    ? safeMemory.observations
    : [];
  const sessionCount =
    typeof safeMemory.session_count === "number" ? safeMemory.session_count : 0;
  const recentObservations = observations.slice(-10);

  let systemPrompt = "";
  try {
    const promptPath = path.join(__dirname, "cat_prompt.txt");
    systemPrompt = await fs.readFile(promptPath, "utf8");
  } catch (_error) {
    systemPrompt = "You are a cat assistant. Return JSON only.";
  }

  const userContext = {
    screen_description: String(description || ""),
    session_count: sessionCount,
    recent_observations: recentObservations,
    output_format: {
      response: "what the cat says, can be empty string",
      tag: "short-tag-describing-what-happened",
    },
    instruction: "Return ONLY valid JSON with keys: response, tag.",
  };

  try {
    const rawText = await callTextModel(systemPrompt, userContext);
    return parseCatJson(rawText);
  } catch (_error) {
    return { response: "", tag: "" };
  }
}

async function callTextModel(systemPrompt, userContext) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const { GoogleGenerativeAI } = require("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: systemPrompt,
  });

  const result = await model.generateContent(JSON.stringify(userContext));
  return result?.response?.text?.()?.trim() || "";
}

function parseCatJson(rawText) {
  const cleaned = stripCodeFences(String(rawText || "").trim());

  try {
    const parsed = JSON.parse(cleaned);
    return {
      response: typeof parsed?.response === "string" ? parsed.response : "",
      tag: typeof parsed?.tag === "string" ? parsed.tag : "",
    };
  } catch (_error) {
    return { response: String(rawText || ""), tag: "" };
  }
}

function stripCodeFences(text) {
  return text.replace(/^```(?:json)?\s*|\s*```$/g, "");
}

module.exports = {
  describeScreen,
  getCatResponse,
};
