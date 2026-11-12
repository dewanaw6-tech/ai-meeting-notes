/* AI Meeting Notes Generator - frontend logic.
   All AI calls go through the Flask backend; no API key is ever present here. */

const SAMPLE_TRANSCRIPT = `Weekly Product Sync - Thursday

Sarah (Product Manager): Thanks everyone for joining. We have three things to cover today: the launch date for the mobile app, the pricing page, and the customer feedback from last week.

Mark (Engineering Lead): On the launch, QA found two blocking bugs in the payment flow. My team can fix both by next Wednesday, but that pushes testing back a few days.

Sarah: Okay. Given that, let's move the launch from the 15th to the 22nd. Does everyone agree?

Priya (Design): That works for me. I'd like to finish the final onboarding screens before then. I can send them to engineering by Monday.

Mark: Agreed on the 22nd.

Sarah: Great, the launch is officially moved to the 22nd. Next, the pricing page. Daniel, where are we?

Daniel (Marketing): The copy is mostly drafted, but I am waiting on the final plan names. I think we should consider adding an annual discount, but we have not looked at the numbers yet, so I would not commit to it.

Sarah: Fair. Let's keep the three plans as they are for launch and revisit the annual discount after launch. Daniel, please send me the final pricing page copy by Tuesday.

Daniel: Will do.

Sarah: Last topic, customer feedback. Several users asked for dark mode and for CSV export.

Mark: Dark mode is a bigger piece of work. CSV export is small, but I can't say when we would fit it in.

Priya: Someone should also follow up with the five customers who reported the login problem.

Sarah: Good point. We still need to decide who does that. Let's put it on the agenda for next week. Thanks everyone.`;

const $ = (id) => document.getElementById(id);
const state = { notes: null, transcript: "" };

const VIEW_TITLES = {
  home: "Dashboard",
  transcript: "Meeting Transcript",
  summary: "Meeting Summary",
  decisions: "Key Decisions",
  actions: "Action Items",
  email: "Follow-up Email",
};

/* ---------------- Navigation ---------------- */
function showView(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${name}`));
  document.querySelectorAll(".nav-item").forEach((n) => n.classList.toggle("active", n.dataset.target === name));
  $("pageTitle").textContent = VIEW_TITLES[name] || "Dashboard";
  closeMenu();
  window.scrollTo({ top: 0 });
}

function openMenu() { $("sidebar").classList.add("open"); $("scrim").classList.add("show"); }
function closeMenu() { $("sidebar").classList.remove("open"); $("scrim").classList.remove("show"); }

document.querySelectorAll(".nav-item").forEach((btn) => btn.addEventListener("click", () => showView(btn.dataset.target)));
document.querySelectorAll("[data-goto]").forEach((btn) => btn.addEventListener("click", () => showView(btn.dataset.goto)));
$("menuBtn").addEventListener("click", openMenu);
$("scrim").addEventListener("click", closeMenu);

/* ---------------- Notifications + loading ---------------- */
function toast(message, type = "success") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  $("toasts").appendChild(el);
  setTimeout(() => el.remove(), type === "error" ? 6500 : 3000);
}

function setLoading(on, title) {
  if (title) $("loadingTitle").textContent = title;
  $("loading").hidden = !on;
}

async function postJSON(url, payload) {
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    throw new Error("Could not reach the server. Check your connection and that the app is running.");
  }
  let data = null;
  try { data = await res.json(); } catch (e) { /* non-JSON response */ }
  if (!res.ok || !data || data.success === false) {
    throw new Error((data && data.error) || `Request failed (${res.status}).`);
  }
  return data;
}

/* ---------------- Transcript input ---------------- */
const transcriptEl = $("transcript");

function updateCounter() {
  const n = transcriptEl.value.length;
  $("counter").textContent = `${n.toLocaleString()} character${n === 1 ? "" : "s"}`;
}
transcriptEl.addEventListener("input", updateCounter);

$("sampleBtn").addEventListener("click", () => {
  transcriptEl.value = SAMPLE_TRANSCRIPT;
  updateCounter();
  toast("Sample transcript added.");
});

$("clearBtn").addEventListener("click", () => {
  transcriptEl.value = "";
  updateCounter();
  transcriptEl.focus();
});

$("generateBtn").addEventListener("click", async () => {
  const transcript = transcriptEl.value.trim();
  if (!transcript) {
    toast("Paste a meeting transcript before generating notes.", "error");
    transcriptEl.focus();
    return;
  }
  setLoading(true, "Reading your transcript");
  $("generateBtn").disabled = true;
  try {
    const data = await postJSON("/generate", { transcript });
    state.transcript = transcript;
    state.notes = data.notes;
    renderAll();
    toast("Meeting notes are ready.");
    showView("summary");
  } catch (err) {
    toast(err.message, "error");
  } finally {
    setLoading(false);
    $("generateBtn").disabled = false;
  }
});

/* ---------------- Rendering ---------------- */
function fillList(el, items, emptyText) {
  el.innerHTML = "";
  if (!items.length) {
    const li = document.createElement("li");
    li.className = "none";
    li.textContent = emptyText;
    el.appendChild(li);
    return;
  }
  items.forEach((text) => {
    const li = document.createElement("li");
    li.textContent = text;
    el.appendChild(li);
  });
}

function fillChips(el, items, emptyText) {
  el.innerHTML = "";
  if (!items.length) {
    const p = document.createElement("span");
    p.className = "none";
    p.textContent = emptyText;
    el.appendChild(p);
    return;
  }
  items.forEach((text) => {
    const s = document.createElement("span");
    s.className = "chip";
    s.textContent = text;
    el.appendChild(s);
  });
}

function td(text, cls) {
  const c = document.createElement("td");
  if (cls) c.className = cls;
  c.textContent = text;
  return c;
}

function renderAll() {
  const n = state.notes;
  document.querySelectorAll("[data-empty]").forEach((e) => (e.hidden = !!n));
  document.querySelectorAll("[data-filled]").forEach((e) => (e.hidden = !n));
  ["copyAllBtn", "txtBtn", "pdfBtn"].forEach((id) => ($(id).disabled = !n));
  if (!n) return;

  $("meetingTitle").textContent = n.title;
  $("summaryText").textContent = n.summary;
  fillList($("pointsList"), n.discussion_points, "No main discussion points were identified.");
  fillList($("decisionsList"), n.decisions, "No decisions were made in this meeting.");

  const body = $("actionsBody");
  body.innerHTML = "";
  if (!n.action_items.length) {
    const tr = document.createElement("tr");
    const c = td("No action items were identified.", "unspecified");
    c.colSpan = 4;
    tr.appendChild(c);
    body.appendChild(tr);
  }
  n.action_items.forEach((it) => {
    const tr = document.createElement("tr");
    tr.appendChild(td(it.task));
    tr.appendChild(td(it.responsible_person, it.responsible_person === "Not specified" ? "unspecified" : ""));
    tr.appendChild(td(it.deadline, it.deadline === "Not specified" ? "unspecified" : ""));
    const status = document.createElement("td");
    const pill = document.createElement("span");
    pill.className = `pill ${it.status === "Completed" ? "done" : "pending"}`;
    pill.textContent = it.status;
    status.appendChild(pill);
    tr.appendChild(status);
    body.appendChild(tr);
  });

  fillChips($("peopleChips"), n.responsible_persons, "No one was named for a task.");
  fillChips($("deadlineChips"), n.deadlines, "No deadlines were stated.");

  $("emailSubject").value = n.follow_up_email.subject;
  $("emailBody").value = n.follow_up_email.body;

  // Dashboard stats and sidebar badges
  $("stat-points").textContent = n.discussion_points.length;
  $("stat-decisions").textContent = n.decisions.length;
  $("stat-actions").textContent = n.action_items.length;
  $("stat-people").textContent = n.responsible_persons.length;
  setBadge("badge-decisions", n.decisions.length);
  setBadge("badge-actions", n.action_items.length);
  $("homeLatestText").textContent = `${n.title}: ${n.summary}`;
}

function setBadge(id, count) {
  const b = $(id);
  b.textContent = count;
  b.hidden = count === 0;
}

/* ---------------- Clipboard ---------------- */
async function copyText(text, okMessage) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    // Fallback for older browsers or non-secure contexts
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
    ta.remove();
    if (!ok) { toast("Copy failed. Select the text and copy it manually.", "error"); return; }
  }
  toast(okMessage);
}

function currentEmail() {
  return { subject: $("emailSubject").value.trim(), body: $("emailBody").value.trim() };
}

function bulletLines(items, empty) {
  return items.length ? items.map((i) => `- ${i}`).join("\n") : empty;
}

function buildFullText() {
  const n = state.notes;
  const email = currentEmail();
  const rule = "=".repeat(60);
  const actions = n.action_items.length
    ? n.action_items.map((a, i) =>
        `${i + 1}. ${a.task}\n   Responsible: ${a.responsible_person} | Deadline: ${a.deadline} | Status: ${a.status}`).join("\n")
    : "No action items were identified.";

  return [
    n.title.toUpperCase(),
    rule,
    "",
    "MEETING SUMMARY",
    n.summary,
    "",
    "MAIN DISCUSSION POINTS",
    bulletLines(n.discussion_points, "None recorded."),
    "",
    "KEY DECISIONS",
    bulletLines(n.decisions, "No decisions were made."),
    "",
    "ACTION ITEMS",
    actions,
    "",
    "RESPONSIBLE PERSONS",
    bulletLines(n.responsible_persons, "None named."),
    "",
    "DEADLINES",
    bulletLines(n.deadlines, "None stated."),
    "",
    "FOLLOW-UP EMAIL",
    `Subject: ${email.subject}`,
    "",
    email.body,
    "",
  ].join("\n");
}

$("copySummaryBtn").addEventListener("click", () => {
  if (!state.notes) return;
  copyText(`${state.notes.title}\n\n${state.notes.summary}`, "Summary copied.");
});
$("copyAllBtn").addEventListener("click", () => state.notes && copyText(buildFullText(), "All meeting notes copied."));
$("copyEmailBtn").addEventListener("click", () => {
  const e = currentEmail();
  if (!e.body) { toast("There is no email to copy yet.", "error"); return; }
  copyText(`Subject: ${e.subject}\n\n${e.body}`, "Email copied.");
});

/* ---------------- Downloads ---------------- */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$("txtBtn").addEventListener("click", () => {
  if (!state.notes) return;
  downloadBlob(new Blob([buildFullText()], { type: "text/plain;charset=utf-8" }), "meeting-notes.txt");
  toast("Notes downloaded as TXT.");
});

$("pdfBtn").addEventListener("click", async () => {
  if (!state.notes) return;
  setLoading(true, "Creating your PDF");
  try {
    const notes = { ...state.notes, follow_up_email: currentEmail() };
    const res = await fetch("/download-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    if (!res.ok) {
      let msg = "Could not create the PDF.";
      try { msg = (await res.json()).error || msg; } catch (e) { /* ignore */ }
      throw new Error(msg);
    }
    downloadBlob(await res.blob(), "meeting-notes.pdf");
    toast("Notes downloaded as PDF.");
  } catch (err) {
    toast(err.message || "Could not reach the server.", "error");
  } finally {
    setLoading(false);
  }
});

/* ---------------- Email regeneration ---------------- */
$("regenEmailBtn").addEventListener("click", async () => {
  if (!state.notes) return;
  setLoading(true, "Writing your email");
  try {
    const data = await postJSON("/generate-email", {
      notes: state.notes,
      tone: $("toneSelect").value,
    });
    state.notes.follow_up_email = data.email;
    $("emailSubject").value = data.email.subject;
    $("emailBody").value = data.email.body;
    toast("Follow-up email regenerated.");
  } catch (err) {
    toast(err.message, "error");
  } finally {
    setLoading(false);
  }
});

/* ---------------- Init ---------------- */
updateCounter();
renderAll();
