const state = { profile: null, questions: [], answers: [], current: 0, recognition: null, result: null };
const $ = (selector) => document.querySelector(selector);
const views = ["setup-view", "interview-view", "loading-view", "results-view"];

function showView(id) {
  views.forEach((view) => $(`#${view}`).classList.toggle("hidden", view !== id));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function loadDomains() {
  const response = await fetch("/api/domains");
  if (!response.ok) throw new Error("Could not load domains.");
  const { domains } = await response.json();
  $("#domain").innerHTML = domains.map(({ id, label }) => `<option value="${id}">${label}</option>`).join("");
}

function fillSample() {
  $("#name").value = "Maya Sharma";
  $("#branch").value = "Computer Science";
  $("#company").value = "Stripe";
  $("#role").value = "Frontend Engineer";
  $("#domain").value = "javascript";
  $("#question-count").value = "3";
}

function renderQuestion() {
  const question = state.questions[state.current];
  $("#domain-label").textContent = state.profile.domainLabel;
  $("#welcome-title").textContent = state.current === 0 ? `Let’s get started, ${state.profile.name.split(" ")[0]}.` : "Keep going.";
  $("#question-number").textContent = state.current + 1;
  $("#question-total").textContent = state.questions.length;
  $("#progress-bar").style.width = `${((state.current + 1) / state.questions.length) * 100}%`;
  $("#question-level").textContent = question.level;
  $("#question-text").textContent = question.prompt;
  $("#answer-input").value = state.answers[state.current]?.answer || "";
  updateWordCount();
}

function updateWordCount() {
  const value = $("#answer-input").value.trim();
  $("#word-count").textContent = `${value ? value.split(/\s+/).length : 0} words`;
}

async function startInterview(event) {
  event.preventDefault();
  const profile = {
    name: $("#name").value.trim(), branch: $("#branch").value.trim(),
    company: $("#company").value.trim(), role: $("#role").value.trim(), domain: $("#domain").value,
    question_count: Number($("#question-count").value),
  };
  const response = await fetch("/api/questions", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(profile) });
  if (!response.ok) { alert("We could not prepare the interview. Please check your details and try again."); return; }
  const data = await response.json();
  state.profile = {...profile, domainLabel: data.domain};
  state.questions = data.questions;
  state.answers = [];
  state.current = 0;
  state.result = null;
  showView("interview-view");
  renderQuestion();
}

async function saveAnswer() {
  const question = state.questions[state.current];
  state.answers[state.current] = { question_id: question.id, question: question.prompt, answer: $("#answer-input").value.trim(), domain: state.profile.domain };
  if (state.current < state.questions.length - 1) { state.current += 1; renderQuestion(); return; }
  showView("loading-view");
  const response = await fetch("/api/evaluate", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ profile: state.profile, answers: state.answers }) });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    alert(detail.detail || "The evaluation could not be completed.");
    showView("interview-view");
    return;
  }
  renderResults(await response.json());
}

function listItems(selector, items = []) {
  $(selector).innerHTML = items.map((item) => `<li>${item}</li>`).join("");
}

function renderResults(result) {
  state.result = result;
  showView("results-view");
  const score = Math.max(0, Math.min(10, Number(result.overall_score) || 0));
  $("#overall-score").textContent = score;
  $("#score-fill").style.width = `${score * 10}%`;
  $("#results-summary").textContent = result.summary || "A thoughtful first session. Use the notes below to make your next practice sharper.";
  $("#profile-name").textContent = state.profile.name;
  $("#profile-details").textContent = `${state.profile.role} · ${state.profile.company} · ${state.profile.domainLabel}`;
  listItems("#strengths", result.strengths);
  listItems("#weaknesses", result.weaknesses);
  listItems("#suggestions", result.suggestions);
  $("#breakdown").innerHTML = (result.question_feedback || []).map((item) => `<div class="breakdown-row"><div><p>${item.question}</p><small>${item.feedback}</small></div><div class="breakdown-score">${item.score}/10</div></div>`).join("");
}

function markdownList(items = []) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- None provided";
}

function downloadSessionNotes() {
  if (!state.result || !state.profile) return;
  const result = state.result;
  const transcript = state.answers.map((item, index) => {
    const feedback = (result.question_feedback || [])[index];
    return [
      `## Question ${index + 1}`,
      `**Question:** ${item.question}`,
      `**Your answer:** ${item.answer || "_No answer provided._"}`,
      feedback ? `**Score:** ${feedback.score}/10\n\n**Feedback:** ${feedback.feedback}` : "",
    ].filter(Boolean).join("\n\n");
  }).join("\n\n");
  const markdown = [
    "# Clearstep Interview Session",
    "",
    `- **Student:** ${state.profile.name}`,
    `- **Branch:** ${state.profile.branch}`,
    `- **Company:** ${state.profile.company}`,
    `- **Role:** ${state.profile.role}`,
    `- **Domain:** ${state.profile.domainLabel}`,
    `- **Questions:** ${state.questions.length}`,
    "",
    `## Overall score: ${result.overall_score}/10`,
    "",
    result.summary || "",
    "",
    "## Strengths",
    markdownList(result.strengths),
    "",
    "## Areas to improve",
    markdownList(result.weaknesses),
    "",
    "## Improvement plan",
    markdownList(result.suggestions),
    "",
    "## Questions and answers",
    transcript,
    "",
    "---",
    "Generated by Clearstep AI Interview Coach.",
  ].join("\n");
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `clearstep-${state.profile.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "session"}.md`;
  link.click();
  URL.revokeObjectURL(url);
}

function setupVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) { $("#voice-btn").disabled = true; $("#voice-label").textContent = "Voice unavailable"; return; }
  state.recognition = new SpeechRecognition();
  state.recognition.continuous = true;
  state.recognition.interimResults = true;
  state.recognition.onresult = (event) => {
    let transcript = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) transcript += event.results[index][0].transcript;
    $("#answer-input").value = `${$("#answer-input").value} ${transcript}`.trim();
    updateWordCount();
  };
  state.recognition.onend = () => { $("#voice-btn").classList.remove("recording"); $("#voice-label").textContent = "Answer by voice"; };
  $("#voice-btn").addEventListener("click", () => {
    if ($("#voice-btn").classList.contains("recording")) state.recognition.stop();
    else { state.recognition.start(); $("#voice-btn").classList.add("recording"); $("#voice-label").textContent = "Listening…"; }
  });
}

$("#setup-form").addEventListener("submit", startInterview);
$("#sample-btn").addEventListener("click", fillSample);
$("#answer-input").addEventListener("input", updateWordCount);
$("#next-btn").addEventListener("click", saveAnswer);
$("#download-btn").addEventListener("click", downloadSessionNotes);
$("#restart-btn").addEventListener("click", () => showView("setup-view"));
setupVoice();
loadDomains().catch(() => { $("#domain").innerHTML = '<option value="javascript">JavaScript</option>'; });
