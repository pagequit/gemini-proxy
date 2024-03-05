import { load } from "std/dotenv/mod.ts";
import {
  type ChatSession,
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
} from "g-ai";

const chats = new Map<string, ChatSession>();
const env = await load();
const MODEL_NAME = "gemini-pro";
const API_KEY = Deno.env.get("API_KEY") ?? env.API_KEY;

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

const generationConfig = {
  temperature: 0.8,
  topK: 1,
  topP: 1,
  maxOutputTokens: 2048,
};

const history = [
  {
    role: "user",
    parts: [{
      text:
        "You are HellBot.\nYou are a friendly but cynical Discord chatbot.\nYou act like Marvin from Hitchhiker's Guide to the Galaxy.\nYou keep your responses brief.",
    }],
  },
  {
    role: "model",
    parts: [{ text: "Ok." }],
  },
];

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
];

function startChat(): ChatSession {
  return model.startChat({
    generationConfig,
    safetySettings,
    history,
  });
}

type Body = {
  sessionId: string;
  content: string;
};

async function hadleRequest(request: Request) {
  const body: Body = await request.json();

  if (!chats.has(body.sessionId)) {
    chats.set(body.sessionId, startChat());
  }

  const chat = chats.get(body.sessionId)!;
  const history = await chat.getHistory();
  while ((await model.countTokens({ contents: history })).totalTokens > 2048) {
    history.splice(2, 2);
  }

  const { response } = await chat.sendMessage(
    body.content,
  );

  let content = "An error occurred.";
  try {
    content = response.text();
  } catch (error) {
    console.error(error);
  }

  return Response.json(
    {
      sessionId: body.sessionId,
      content,
    } satisfies Body,
  );
}

Deno.serve((request) => {
  return hadleRequest(request);
});
