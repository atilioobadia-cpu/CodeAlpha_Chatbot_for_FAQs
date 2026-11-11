const FAQS_URL = "/api/faqs";
const ASK_URL = "/api/ask";
const QUICK_QUESTIONS = ["Which languages does Lingua support?", "How much text can I translate?", "Where are saved translations stored?"];
const POPULAR_IDS = ["languages", "text-limit", "privacy", "save", "offline"];
const $ = selector => document.querySelector(selector);
const messages = $("#messages");
const input = $("#question-input");
const sendButton = $(".send-button");
const quickAsks = $("#quick-asks");
const popularQuestions = $("#popular-questions");
const faqList = $("#faq-list");
const faqSearch = $("#faq-search");
const categories = $("#categories");
const resultCount = $("#result-count");
const faqEmpty = $("#faq-empty");
let faqItems = [];
let activeCategory = "All";
let activeView = "chat";
let navigationTimer;
let isAnswering = false;

function refreshIcons(root = document) {
  window.lucide?.createIcons({ root });
}

function setView(view) {
  if ((view !== "chat" && view !== "faq") || view === activeView) return;
  window.clearTimeout(navigationTimer);
  const oldView = $(`#${activeView}-view`);
  const nextView = $(`#${view}-view`);
  const direction = view === "faq" ? "forward" : "backward";
  document.querySelectorAll(".view").forEach(section => {
    section.classList.remove("active", "flip-in-forward", "flip-in-backward", "flip-out-forward", "flip-out-backward");
    section.hidden = section !== oldView && section !== nextView;
  });
  oldView.hidden = false;
  nextView.hidden = false;
  oldView.classList.add(`flip-out-${direction}`);
  nextView.classList.add("active", `flip-in-${direction}`);
  activeView = view;
  document.querySelectorAll(".nav-link[data-view]").forEach(button => {
    const selected = button.dataset.view === view;
    button.classList.toggle("active", selected);
    if (selected) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  navigationTimer = window.setTimeout(() => {
    oldView.hidden = true;
    oldView.classList.remove(`flip-out-${direction}`);
    nextView.classList.remove(`flip-in-${direction}`);
    if (view === "faq") faqSearch.focus({ preventScroll: true });
    else input.focus({ preventScroll: true });
  }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 420);
  history.replaceState(null, "", view === "faq" ? "#faqs" : "#chat");
}

function appendMessage(text, role, source = "") {
  const row = document.createElement("article");
  row.className = `message-row ${role}-row`;
  const avatar = document.createElement("span");
  avatar.className = "message-avatar";
  avatar.setAttribute("aria-hidden", "true");
  const icon = document.createElement("i");
  icon.dataset.lucide = role === "assistant" ? "message-circle" : "user-round";
  avatar.append(icon);
  const content = document.createElement("div");
  content.className = "message-content";
  const sender = document.createElement("span");
  sender.className = "sender";
  sender.textContent = role === "assistant" ? "Lingua support" : "You";
  const bubble = document.createElement("div");
  bubble.className = `bubble ${role}-bubble`;
  bubble.textContent = text;
  content.append(sender, bubble);
  if (source) {
    const attribution = document.createElement("span");
    attribution.className = "message-source";
    attribution.textContent = `Help guide · ${source}`;
    content.append(attribution);
  }
  row.append(avatar, content);
  messages.append(row);
  row.scrollIntoView({ behavior: "smooth", block: "nearest" });
  refreshIcons(row);
}

function renderQuestionButtons(container, questions, className) {
  container.replaceChildren();
  questions.forEach(item => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = typeof item === "string" ? item : item.question;
    button.addEventListener("click", () => askQuestion(button.textContent));
    container.append(button);
  });
}

async function askQuestion(value) {
  const question = value.trim();
  if (!question || isAnswering) return;
  isAnswering = true;
  appendMessage(question, "user");
  input.value = "";
  sendButton.disabled = true;
  input.disabled = true;
  const loading = document.createElement("div");
  loading.className = "response-status";
  loading.setAttribute("role", "status");
  loading.textContent = "Searching the help guide...";
  messages.append(loading);
  loading.scrollIntoView({ behavior: "smooth", block: "nearest" });
  try {
    const response = await fetch(ASK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
    if (!response.ok) throw new Error("The help service could not process this question.");
    const result = await response.json();
    loading.remove();
    if (result.matched) appendMessage(result.answer, "assistant", `${result.category} · ${result.question}`);
    else appendMessage("I couldn't find a close answer in the guide. Try asking about languages, translation limits, saved phrases, privacy, or troubleshooting, or browse the FAQ library.", "assistant", "No close match");
  } catch (error) {
    loading.remove();
    appendMessage("I can't reach the help service right now. Please check that the local server is running, then try again.", "assistant", "Connection issue");
    console.error("FAQ request failed:", error);
  } finally {
    isAnswering = false;
    input.disabled = false;
    sendButton.disabled = !input.value.trim();
    input.focus({ preventScroll: true });
  }
}

function renderCategories() {
  categories.replaceChildren();
  ["All", ...new Set(faqItems.map(item => item.category))].forEach(category => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `category-chip${activeCategory === category ? " active" : ""}`;
    button.textContent = category;
    button.setAttribute("aria-pressed", String(activeCategory === category));
    button.addEventListener("click", () => { activeCategory = category; renderFaqList(); });
    categories.append(button);
  });
}

function renderFaqList() {
  renderCategories();
  const query = faqSearch.value.trim().toLocaleLowerCase();
  const matches = faqItems.filter(item => {
    const categoryMatch = activeCategory === "All" || item.category === activeCategory;
    const queryMatch = !query || `${item.question} ${item.answer} ${item.category} ${item.keywords}`.toLocaleLowerCase().includes(query);
    return categoryMatch && queryMatch;
  });
  faqList.replaceChildren();
  resultCount.textContent = `${matches.length} ${matches.length === 1 ? "article" : "articles"}`;
  faqEmpty.hidden = matches.length > 0;
  faqList.hidden = matches.length === 0;
  matches.forEach(item => {
    const article = document.createElement("article");
    article.className = "faq-item";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "faq-question";
    toggle.setAttribute("aria-expanded", "false");
    const title = document.createElement("span");
    title.textContent = item.question;
    const icon = document.createElement("i");
    icon.dataset.lucide = "plus";
    icon.setAttribute("aria-hidden", "true");
    toggle.append(title, icon);
    const answer = document.createElement("div");
    answer.className = "faq-answer";
    const copy = document.createElement("p");
    copy.textContent = item.answer;
    const ask = document.createElement("button");
    ask.type = "button";
    ask.className = "text-link";
    ask.textContent = "Ask a follow-up in chat";
    ask.addEventListener("click", () => {
      setView("chat");
      input.value = item.question;
      sendButton.disabled = false;
      input.focus();
    });
    answer.append(copy, ask);
    toggle.addEventListener("click", () => {
      const isOpen = article.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(isOpen));
      icon.dataset.lucide = isOpen ? "minus" : "plus";
      refreshIcons(toggle);
    });
    article.append(toggle, answer);
    faqList.append(article);
  });
  refreshIcons(faqList);
}

async function loadFaqs() {
  try {
    const response = await fetch(FAQS_URL);
    if (!response.ok) throw new Error("FAQ guide could not be loaded.");
    faqItems = await response.json();
    $("#faq-count").textContent = String(faqItems.length);
    $("#article-total").textContent = `${faqItems.length} articles`;
    renderQuestionButtons(quickAsks, QUICK_QUESTIONS, "quick-ask-chip");
    const popular = POPULAR_IDS.map(id => faqItems.find(item => item.id === id)).filter(Boolean);
    renderQuestionButtons(popularQuestions, popular, "popular-question");
    renderFaqList();
    refreshIcons();
  } catch (error) {
    console.error("FAQ guide failed to load:", error);
    resultCount.textContent = "The FAQ guide could not be loaded.";
    appendMessage("I couldn't load the help guide. Please refresh the page or check the local server.", "assistant", "Guide unavailable");
  }
}

document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));
$("#chat-form").addEventListener("submit", event => { event.preventDefault(); askQuestion(input.value); });
input.addEventListener("input", () => { sendButton.disabled = !input.value.trim() || isAnswering; });
faqSearch.addEventListener("input", renderFaqList);
document.addEventListener("keydown", event => {
  if (event.key === "/" && activeView === "faq" && document.activeElement !== faqSearch) { event.preventDefault(); faqSearch.focus(); }
  if (event.key === "Escape" && document.activeElement === faqSearch) { faqSearch.value = ""; renderFaqList(); faqSearch.blur(); }
});
$(".brand").addEventListener("click", event => { event.preventDefault(); if (activeView !== "chat") setView("chat"); });
if (location.hash === "#faqs") {
  $("#chat-view").hidden = true;
  $("#faq-view").hidden = false;
  $("#faq-view").classList.add("active");
  $(".nav-link[data-view='chat']").classList.remove("active");
  $(".nav-link[data-view='chat']").removeAttribute("aria-current");
  $(".nav-link[data-view='faq']").classList.add("active");
  $(".nav-link[data-view='faq']").setAttribute("aria-current", "page");
  activeView = "faq";
}
refreshIcons();
loadFaqs();
