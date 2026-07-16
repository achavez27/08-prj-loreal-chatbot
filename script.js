/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const clearMemoryBtn = document.getElementById("clearMemoryBtn");

// This system prompt guides the AI to answer only about L'Oréal beauty products,
// beauty routines, skincare, makeup, haircare, fragrance, and product recommendations.
const systemPrompt = `You are a helpful L'Oréal product advisor. Answer only questions related to L'Oréal products, beauty routines, skincare, makeup, haircare, fragrances, or recommendations. If the user asks something unrelated to L'Oréal or general beauty advice, politely refuse and explain that you can only help with L'Oréal beauty products and routines.`;

// Replace this URL with your actual class-hosted Cloudflare Worker URL.
const workerUrl = "https://dawn-haze-f625.achavez27.workers.dev/";

// Conversation memory (persisted to localStorage)
const MEMORY_KEY = "loreal_chat_memory";
const MEMORY_LIMIT = 12; // keep last N messages (user+assistant pairs)

function loadMemory() {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to load memory", e);
    return [];
  }
}

function saveMemory(mem) {
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(mem));
  } catch (e) {
    console.error("Failed to save memory", e);
  }
}

let conversationMemory = loadMemory();

// Render existing memory or show a friendly greeting
chatWindow.innerHTML = "";
if (conversationMemory.length > 0) {
  conversationMemory.forEach((m) => appendMessage(m.role, m.content));
} else {
  appendMessage(
    "assistant",
    "👋 Hello! Ask me about L'Oréal products, routines, and recommendations.",
  );
}



function appendMessage(role, text) {
  const messageEl = document.createElement("div");
  messageEl.className = `chat-message chat-${role}`;
  messageEl.textContent = text;
  chatWindow.appendChild(messageEl);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function getChatbotReply(userMessage) {
  // include system prompt + recent conversation memory + the latest user message
  // ensure we don't exceed MEMORY_LIMIT when sending
  const recent = conversationMemory.slice(-MEMORY_LIMIT);
  const messages = [
    { role: "system", content: systemPrompt },
    ...recent,
  ];

  const response = await fetch(workerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages }),
  });

  let data;
  try {
    data = await response.json();
  } catch (parseError) {
    throw new Error("Received an unexpected response from the server.");
  }

  if (!response.ok) {
    const errorText =
      typeof data?.error === "string"
        ? data.error
        : data?.error
          ? JSON.stringify(data.error)
          : `Request failed with status ${response.status}`;
    throw new Error(errorText);
  }

  const assistantText = data.choices?.[0]?.message?.content;
  if (assistantText) return assistantText;

  if (data?.error) {
    return typeof data.error === "string"
      ? data.error
      : JSON.stringify(data.error);
  }

  return "Sorry, I could not get a response. Please try again.";
}

/* Handle form submit */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const userMessage = userInput.value.trim();
  if (!userMessage) return;

  // save the user's message into conversation memory before sending
  conversationMemory.push({ role: "user", content: userMessage });
  // keep memory bounded
  if (conversationMemory.length > MEMORY_LIMIT) {
    conversationMemory = conversationMemory.slice(-MEMORY_LIMIT);
  }
  saveMemory(conversationMemory);

  appendMessage("user", userMessage);
  userInput.value = "";

  const typingMessage = document.createElement("div");
  typingMessage.className = "chat-message chat-assistant chat-typing";
  typingMessage.textContent = "Typing...";
  chatWindow.appendChild(typingMessage);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  try {
    const assistantReply = await getChatbotReply(userMessage);
    typingMessage.remove();
    appendMessage("assistant", assistantReply);
    // save assistant reply into memory
    conversationMemory.push({ role: "assistant", content: assistantReply });
    if (conversationMemory.length > MEMORY_LIMIT) {
      conversationMemory = conversationMemory.slice(-MEMORY_LIMIT);
    }
    saveMemory(conversationMemory);
  } catch (error) {
    typingMessage.remove();
    appendMessage(
      "assistant",
      "Sorry, something went wrong while sending your question.",
    );
    console.error(error);
  }
});
