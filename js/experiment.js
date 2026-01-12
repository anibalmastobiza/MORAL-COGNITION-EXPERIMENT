// Moral Explaining Away — minimal, dependency-free
// All responses required to proceed.

// ====== Prolific params (no end-code prompt) ======
const urlParams = new URLSearchParams(window.location.search);
const PROLIFIC_PID = urlParams.get("PROLIFIC_PID") || "";
const STUDY_ID = urlParams.get("STUDY_ID") || "";
const SESSION_ID = urlParams.get("SESSION_ID") || "";

// ====== Study settings ======
const LIKERT_MIN = 1;
const LIKERT_MAX = 7;

// --- Prompts (centralized to avoid mismatched cache keys) ---
const PROMPTS = {
  causalClin: "How much did the clinician's decision cause the patient's death?",
  causalAI: "How much did the AI system cause the patient's death?",
  blameClin: "How blameworthy is the clinician?",
  blameOrg: "How blameworthy is the hospital/organization for deploying this AI system?",
  cfClin: "If the clinician had acted differently, the patient's death would have been avoided.",
  cfPolicy: "If the organizational policy had NOT been in place, the patient's death would have been avoided.",
  cfBroad: "If broader institutional constraints had been different, the patient's death would have been avoided."
};

// Conditional counterfactual prompt: avoid asking about a policy that is absent.
function cfAltPromptFor(v){
  return (v.alt === "AltPresent") ? PROMPTS.cfPolicy : PROMPTS.cfBroad;
}

// Keep short: 8 vignettes total (2 per condition)
const VIGNETTES = [
  // Negligent, Alt absent
  vignette("NA1","Negligent","AltAbsent",
    `A public hospital uses an AI triage tool to flag high-risk patients.
A clinician sees an alert: "High risk—urgent evaluation recommended."
The clinician decides to postpone evaluation to clear other tasks.
The patient's condition worsens, and the patient dies.`),

  vignette("NA2","Negligent","AltAbsent",
    `A clinic uses an AI system to prioritize follow-up calls.
The system ranks a patient as "needs same-day follow-up."
A staff member notices the ranking but chooses not to call, thinking it is "probably fine."
The patient later experiences a critical deterioration and dies.`),

  // Negligent, Alt present (SYSTEMIC INSTITUTIONAL FAILURE)
  vignette("NP1","Negligent","AltPresent",
    `A public hospital uses an AI triage tool to flag high-risk patients.
A clinician sees an alert: "High risk—urgent evaluation recommended."
The clinician decides to postpone evaluation to clear other tasks.
At the same time, the hospital is running an institutional cost-saving policy: staff were instructed to delay non-ICU evaluations during peak hours unless a supervisor approves.
The patient's condition worsens, and the patient dies.`),

  vignette("NP2","Negligent","AltPresent",
    `A clinic uses an AI system to prioritize follow-up calls.
The system ranks a patient as "needs same-day follow-up."
A staff member notices the ranking but chooses not to call, thinking it is "probably fine."
Also, the organization recently reduced call-center staffing and implemented an unrealistic call quota that routinely makes same-day follow-up impossible.
The patient later experiences a critical deterioration and dies.`),

  // Non-negligent, Alt absent
  vignette("GA1","GoodPractice","AltAbsent",
    `A public hospital uses an AI triage tool to flag high-risk patients.
A clinician follows protocol: when the AI flags "High risk," the clinician requests immediate evaluation.
Despite this, the patient's condition worsens, and the patient dies.`),

  vignette("GA2","GoodPractice","AltAbsent",
    `A clinic uses an AI system to prioritize follow-up calls.
A staff member follows protocol: when the system ranks "needs same-day follow-up," they call immediately.
Despite this, the patient experiences a critical deterioration and dies.`),

  // Non-negligent, Alt present (SYSTEMIC INSTITUTIONAL FAILURE)
  vignette("GP1","GoodPractice","AltPresent",
    `A public hospital uses an AI triage tool to flag high-risk patients.
A clinician follows protocol and requests immediate evaluation after an AI "High risk" flag.
However, the hospital is running an institutional cost-saving policy: staff were instructed to delay non-ICU evaluations during peak hours unless a supervisor approves.
The patient's condition worsens, and the patient dies.`),

  vignette("GP2","GoodPractice","AltPresent",
    `A clinic uses an AI system to prioritize follow-up calls.
A staff member follows protocol and calls immediately.
However, the organization recently reduced call-center staffing and implemented an unrealistic call quota that routinely makes same-day follow-up impossible.
The patient experiences a critical deterioration and dies.`),
];

function vignette(id, agent, alt, text){
  return { id, agent, alt, text };
}

// Fisher–Yates shuffle
function shuffle(arr){
  const a = [...arr];
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

const STATE = {
  step: "consent",
  idx: 0,
  vignettes: shuffle(VIGNETTES),
  responses: [],
  demographics: {}
};

// Cache: vignette_id -> {prompt -> value}
const SELECTION_CACHE = {};

function cacheSelection(vid, prompt, val){
  if(!SELECTION_CACHE[vid]) SELECTION_CACHE[vid] = {};
  SELECTION_CACHE[vid][prompt] = val;
}

function hydrateSelections(vid, v){
  const o = SELECTION_CACHE[vid] || {};
  return {
    causalClin: o[PROMPTS.causalClin] ?? null,
    causalAI: o[PROMPTS.causalAI] ?? null,
    blameClin: o[PROMPTS.blameClin] ?? null,
    blameOrg: o[PROMPTS.blameOrg] ?? null,
    cfClin: o[PROMPTS.cfClin] ?? null,
    cfAlt: o[cfAltPromptFor(v)] ?? null,
  };
}

// ====== Rendering helpers ======
function getApp(){ return document.getElementById("app"); }
function getMeta(){ return document.getElementById("meta"); }

function clear(){ 
  const app = getApp();
  if(app) app.innerHTML = ""; 
}

function el(tag, attrs={}, children=[]){
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=>{
    if(k === "class") node.className = v;
    else if(k === "html") node.innerHTML = v;
    else node.setAttribute(k, v);
  });
  children.forEach(c => node.appendChild(c));
  return node;
}

function text(t){ return document.createTextNode(t); }

function card(children=[]){
  return el("div", {class:"card"}, children);
}

function button(label, onClick, primary=false){
  const b = el("button", {class: primary ? "btn primary" : "btn", type:"button"}, [text(label)]);
  b.addEventListener("click", onClick);
  return b;
}

function likertRow(selectedValue, onSelect){
  const wrap = el("div", {class:"scale"});
  for(let v=LIKERT_MIN; v<=LIKERT_MAX; v++){
    const isSelected = (v === selectedValue);
    const c = el(
      "button",
      {class: isSelected ? "choice selected" : "choice", type:"button"},
      [text(String(v))]
    );
    c.addEventListener("click", ()=>onSelect(v));
    wrap.appendChild(c);
  }
  return wrap;
}

function requiredError(msg){
  return el("div", {class:"error"}, [text(msg)]);
}

// ====== Steps ======
function render(){
  clear();
  
  const meta = getMeta();
  if(meta){
    meta.textContent = (PROLIFIC_PID || STUDY_ID || SESSION_ID)
      ? `Session detected.`
      : `Session parameters not detected (test mode).`;
  }
  
  if(STATE.step === "consent") return renderConsent();
  if(STATE.step === "demographics") return renderDemographics();
  if(STATE.step === "trial") return renderTrial();
  if(STATE.step === "done") return renderDone();
}

function renderConsent(){
  const app = getApp();
  const c = card([
    el("h2", {}, [text("Consent")]),
    el("p", {}, [text("You are invited to take part in a short anonymous study about judgments of cause and responsibility in healthcare decisions involving AI.")]),
    el("ul", {}, [
      el("li", {}, [text("Participation is voluntary. You may stop at any time by closing the tab.")]),
      el("li", {}, [text("No identifying information is collected beyond Prolific session parameters (if provided).")]),
      el("li", {}, [text("You will read short scenarios and answer brief rating questions.")]),
      el("li", {}, [text("Estimated time: ~5–7 minutes.")]),
    ]),
  ]);

  const agreeBtn = button("I agree and want to participate", ()=>{
    STATE.step = "demographics";
    render();
  });

  app.appendChild(c);
  app.appendChild(card([agreeBtn]));
}

function renderDemographics(){
  const app = getApp();
  
  // Age as ranges instead of numeric input
  const age = el("select", {}, [
    el("option", {value:""}, [text("Age range (select)")]),
    el("option", {value:"18-24"}, [text("18–24")]),
    el("option", {value:"25-34"}, [text("25–34")]),
    el("option", {value:"35-44"}, [text("35–44")]),
    el("option", {value:"45-54"}, [text("45–54")]),
    el("option", {value:"55-64"}, [text("55–64")]),
    el("option", {value:"65+"}, [text("65+")]),
  ]);
  
  const gender = el("select", {}, [
    el("option", {value:""}, [text("Gender (select)")]),
    el("option", {value:"woman"}, [text("Woman")]),
    el("option", {value:"man"}, [text("Man")]),
    el("option", {value:"nonbinary"}, [text("Non-binary")]),
    el("option", {value:"prefer_not"}, [text("Prefer not to say")]),
    el("option", {value:"other"}, [text("Other")]),
  ]);

  const aiFamiliar = el("select", {}, [
    el("option", {value:""}, [text("Familiarity with AI in healthcare (select)")]),
    el("option", {value:"1"}, [text("1 — Not at all familiar")]),
    el("option", {value:"2"}, [text("2")]),
    el("option", {value:"3"}, [text("3")]),
    el("option", {value:"4"}, [text("4")]),
    el("option", {value:"5"}, [text("5")]),
    el("option", {value:"6"}, [text("6")]),
    el("option", {value:"7"}, [text("7 — Very familiar")]),
  ]);

  const content = card([
    el("h2", {}, [text("Background questions")]),
    el("p", {class:"help"}, [text("All questions are required to continue.")]),
    el("div", {class:"row"}, [
      el("div", {}, [el("div",{class:"question"},[text("Age")]), age]),
      el("div", {}, [el("div",{class:"question"},[text("Gender")]), gender]),
    ]),
    el("div", {class:"row"}, [
      el("div", {}, [el("div",{class:"question"},[text("Familiarity with AI in healthcare")]), aiFamiliar]),
    ])
  ]);

  const next = button("Continue", ()=>{
    const a = age.value;
    const g = gender.value;
    const f = aiFamiliar.value;

    if(!a || !g || !f){
      const existing = app.querySelector(".error");
      if(existing) existing.remove();
      app.appendChild(requiredError("Please answer all background questions to continue."));
      return;
    }

    STATE.demographics = { age_range: a, gender: g, ai_familiarity: Number(f) };
    STATE.step = "trial";
    STATE.idx = 0;
    render();
  }, true);

  app.appendChild(content);
  app.appendChild(card([next]));
}

function renderTrial(){
  const app = getApp();
  const v = STATE.vignettes[STATE.idx];

  const cached = hydrateSelections(v.id, v);

  const vignetteCard = card([
    el("div", {class:"meta"}, [text(`Scenario ${STATE.idx+1} of ${STATE.vignettes.length}`)]),
    el("h2", {}, [text("Scenario")]),
    el("p", {}, [text(v.text)]),
  ]);

  const qCard = card([
    el("h2", {}, [text("Your judgments")]),
    qLikert(PROMPTS.causalClin, cached.causalClin, v.id),
    qLikert(PROMPTS.causalAI, cached.causalAI, v.id),
    qLikert(PROMPTS.blameClin, cached.blameClin, v.id),
    qLikert(PROMPTS.blameOrg, cached.blameOrg, v.id),
    qLikert(PROMPTS.cfClin, cached.cfClin, v.id),
    qLikert(cfAltPromptFor(v), cached.cfAlt, v.id),
  ]);

  const next = button(STATE.idx === STATE.vignettes.length-1 ? "Finish" : "Next", ()=>{
    const current = hydrateSelections(v.id, v);
    const allAnswered = [
      current.causalClin, 
      current.causalAI, 
      current.blameClin, 
      current.blameOrg, 
      current.cfClin, 
      current.cfAlt
    ].every(x => x !== null);

    if(!allAnswered){
      const existing = app.querySelector(".error");
      if(existing) existing.remove();
      app.appendChild(requiredError("Please answer every question to continue."));
      return;
    }

    STATE.responses.push({
      prolific_pid: PROLIFIC_PID,
      study_id: STUDY_ID,
      session_id: SESSION_ID,
      vignette_id: v.id,
      agent_condition: v.agent,
      alt_condition: v.alt,
      causal_clinician: current.causalClin,
      causal_ai: current.causalAI,
      blame_clinician: current.blameClin,
      blame_org: current.blameOrg,
      counterfactual_clinician: current.cfClin,
      counterfactual_alt: current.cfAlt,
      t: Date.now()
    });

    STATE.idx += 1;
    if(STATE.idx >= STATE.vignettes.length){
      STATE.step = "done";
    }
    render();
  }, true);

  app.appendChild(vignetteCard);
  app.appendChild(qCard);
  app.appendChild(card([next]));

  function qLikert(prompt, selected, vid){
    const block = el("div", {}, [
      el("div", {class:"question"}, [text(prompt)]),
      el("div", {class:"help"}, [text("1 = Not at all, 7 = Very much")]),
      likertRow(selected, (val)=>{
        cacheSelection(vid, prompt, val);
        render();
      })
    ]);
    return block;
  }
}

function renderDone(){
  const app = getApp();
  const c = card([
    el("h2", {}, [text("Submitting…")]),
    el("p", {}, [text("Please do not close this tab until submission completes.")]),
    el("p", {class:"help"}, [text("If this is a test, you can still complete without Prolific redirect.")])
  ]);
  app.appendChild(c);

  window.__SUBMIT_STUDY__();
}

// ====== Initialize on DOM ready ======
document.addEventListener("DOMContentLoaded", render);
