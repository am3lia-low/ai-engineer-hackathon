async function describeScreen(_imageBuffer) {
  // TODO: Call Gemini vision model and return one short sentence.
  return "The person is focused on a code editor.";
}

async function getCatResponse(_description, _memory) {
  // TODO: Call GPT-5.5 or Claude with cat system prompt + memory.
  // Should usually return empty string.
  return "";
}

module.exports = {
  describeScreen,
  getCatResponse,
};
