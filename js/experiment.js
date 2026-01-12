{
type: uploaded file
fileName: anibalmastobiza/moral-cognition-experiment/MORAL-COGNITION-EXPERIMENT-04dcee08f92eb155bc98f265b463dfe3ea3e4a6d/js/experiment.js
fullContent:
// Moral Explaining Away — minimal, dependency-free
// All responses required to proceed.

const APP = document.getElementById("app");
const META = document.getElementById("meta");

// ====== Prolific params (no end-code prompt) ======
const urlParams = new URLSearchParams(window.location.search);
const PROLIFIC_PID = urlParams.get("PROLIFIC_PID") || "";
const STUDY_ID = urlParams.get("STUDY_ID") || "";
const SESSION_ID = urlParams.get("SESSION_ID") || "";

// Show minimal meta (optional)
META.textContent = (PROLIFIC_PID || STUDY_ID || SESSION_ID)
  ? `Session detected.`
  : `Session parameters not detected (test mode).`;

// ====== Study settings ======
const LIKERT_MIN = 1;
const LIKERT_MAX = 7;

// --- Prompts (centralized to avoid mismatched cache keys) ---
const PROMPTS = {
  causalClin: "How much did the clinician’s decision cause the patient’s death?",
  causalAI: "How much did the AI system cause the patient’s death?",
  blameClin: "How blameworthy is the clinician?",
  blameOrg: "How blameworthy is the hospital/organization for deploying this AI system?",
  cfClin: "If the clinician had acted differently, the patient’s death would have been avoided.",
  cfPolicy: "If the organizational policy had NOT been in place, the patient’s death would have been avoided.",
  cfBroad: "If broader institutional constraints had been different, the patient’s death would have been avoided."
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
A clinician sees an alert: “High risk—urgent evaluation recommended.”
The clinician decides to postpone evaluation to clear other tasks.
The patient’s condition worsens, and the patient dies.`),

  vignette("NA2","Negligent","AltAbsent",
    `A clinic uses an AI system to prioritize follow-up calls.
The system ranks a patient as “needs same-day follow-up.”
A staff member notices the ranking but chooses not to call, thinking it is “probably fine.”
The patient later experiences a critical deterioration and dies.`),

  // Negligent, Alt present (SYSTEMIC INSTITUTIONAL FAILURE)
  vignette("NP1","Negligent","AltPresent",
    `A public hospital uses an AI triage tool to flag high-risk patients.
A clinician sees an alert: “High risk—urgent evaluation recommended.”
The clinician decides to postpone evaluation to clear other tasks.
At the same time, the hospital is running an institutional cost-saving policy: staff were instructed to delay non-ICU evaluations during peak hours unless a supervisor approves.
The patient’s condition worsens, and the patient dies.`),

  vignette("NP2","Negligent","AltPresent",
    `A clinic uses an AI system to prioritize follow-up calls.
The system ranks a patient as “needs same-day follow-up.”
A staff member notices the ranking but chooses not to call, thinking it is “probably fine.”
Also, the organization recently reduced call-center staffing and implemented an unrealistic call quota that routinely makes same-day follow-up impossible.
The patient later experiences a critical deterioration and dies.`),

  // Non-negligent, Alt absent
  vignette("GA1","GoodPractice","AltAbsent",
    `A public hospital uses an AI triage tool to flag high-risk patients.
A clinician follows protocol: when the AI flags “High risk,” the clinician requests immediate evaluation.
Despite this, the patient’s condition worsens, and the patient dies.`),

  vignette("GA2","GoodPractice","AltAbsent",
    `A clinic uses an AI system to prioritize follow-up calls.
A staff member follows protocol: when the system ranks “needs same-day follow-up,” they call immediately.
Despite this, the patient experiences a critical deterioration and dies.`),

  // Non-negligent, Alt present (SYSTEMIC INSTITUTIONAL FAILURE)
  vignette("GP1","GoodPractice","AltPresent",
    `A public hospital uses an AI triage tool to flag high-risk patients.
A clinician follows protocol and requests immediate evaluation after an AI “High risk” flag.
However, the hospital is running an institutional cost-saving policy: staff were instructed to delay non-ICU evaluations during peak hours unless a supervisor approves.
The patient’s condition worsens, and the patient dies.`),

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

// ====== Rendering helpers ======
function clear(){ APP.innerHTML = ""; }

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
    const c = el(
      "button",
      // Aquí se aplica la clase "selected" si coincide con el valor, 
      // lo cual ahora activará el estilo de fondo negro definido en CSS.
      {class:"choice" + (v===selectedValue ? " selected" : ""), type:"button"},
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
render();

function render(){
  clear();
  if(STATE.step === "consent") return renderConsent();
  if(STATE.step === "demographics") return renderDemographics();
  if(STATE.step === "trial") return renderTrial();
  if(STATE.step === "done") return renderDone();
}

function renderConsent(){
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

  const agreeBtn = el("button", {class:"btn", type:"button"}, [text("I agree and want to participate")]);
  agreeBtn.addEventListener("click", ()=>{
    STATE.step = "demographics";
    render();
  });

  APP.appendChild(c);
  APP.appendChild(card([agreeBtn]));
}

function renderDemographics(){
  const age = el("input", {type:"number", min:"18", max:"99", placeholder:"Age (18–99)", required:"true"});
  const gender = el("select", {required:"true"}, [
    el("option", {value:""}, [text("Gender (select)")]),
    el("option", {value:"woman"}, [text("Woman")]),
    el("option", {value:"man"}, [text("Man")]),
    el("option", {value:"nonbinary"}, [text("Non-binary")]),
    el("option", {value:"prefer_not"}, [text("Prefer not to say")]),
    el("option", {value:"other"}, [text("Other")]),
  ]);

  const aiFamiliar = el("select", {required:"true"}, [
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
    const a = Number(age.value);
    const g = gender.value;
    const f = aiFamiliar.value;

    if(!a || a<18 || a>99 || !g || !f){
      clear();
      APP.appendChild(content);
      APP.appendChild(requiredError("Please answer all background questions to continue."));
      APP.appendChild(card([button("Continue", ()=>renderDemographics(), true)]));
      return;
    }

    STATE.demographics = { age:a, gender:g, ai_familiarity:Number(f) };
    STATE.step = "trial";
    STATE.idx = 0;
    render();
  }, true);

  APP.appendChild(content);
  APP.appendChild(card([next]));
}

function renderTrial(){
  const v = STATE.vignettes[STATE.idx];

  // Initialize from cache, if present
  const cached = hydrateSelections(v.id, v);
  let causalClin = cached.causalClin;
  let causalAI = cached.causalAI;
  let blameClin = cached.blameClin;
  let blameOrg = cached.blameOrg;
  let cfClin = cached.cfClin;
  let cfAlt = cached.cfAlt;

  function canProceed(){
    return [causalClin, causalAI, blameClin, blameOrg, cfClin, cfAlt].every(x => x !== null);
  }

  function rerender(){
    renderTrial(); // re-render for selection highlighting
  }

  const vignetteCard = card([
    el("div", {class:"meta"}, [text(`Scenario ${STATE.idx+1} of ${STATE.vignettes.length}`)]),
    el("h2", {}, [text("Scenario")]),
    el("p", {}, [text(v.text)]),
  ]);

  const qCard = card([
    el("h2", {}, [text("Your judgments")]),
    qLikert(PROMPTS.causalClin, (val)=>{ causalClin=val; rerender(); }, causalClin, v.id),
    qLikert(PROMPTS.causalAI, (val)=>{ causalAI=val; rerender(); }, causalAI, v.id),
    qLikert(PROMPTS.blameClin, (val)=>{ blameClin=val; rerender(); }, blameClin, v.id),
    qLikert(PROMPTS.blameOrg, (val)=>{ blameOrg=val; rerender(); }, blameOrg, v.id),
    qLikert(PROMPTS.cfClin, (val)=>{ cfClin=val; rerender(); }, cfClin, v.id),
    qLikert(cfAltPromptFor(v), (qval)=>{ cfAlt=qval; rerender(); }, cfAlt, v.id),
  ]);

  const next = button(STATE.idx === STATE.vignettes.length-1 ? "Finish" : "Next", ()=>{
    if(!canProceed()){
      APP.appendChild(requiredError("Please answer every question to continue."));
      return;
    }

    STATE.responses.push({
      prolific_pid: PROLIFIC_PID,
      study_id: STUDY_ID,
      session_id: SESSION_ID,

      vignette_id: v.id,
      agent_condition: v.agent,     // Negligent vs GoodPractice
      alt_condition: v.alt,         // AltPresent vs AltAbsent

      causal_clinician: causalClin,
      causal_ai: causalAI,
      blame_clinician: blameClin,
      blame_org: blameOrg,
      counterfactual_clinician: cfClin,
      counterfactual_alt: cfAlt,

      t: Date.now()
    });

    STATE.idx += 1;
    if(STATE.idx >= STATE.vignettes.length){
      STATE.step = "done";
    }
    render();
  }, true);

  APP.appendChild(vignetteCard);
  APP.appendChild(qCard);
  APP.appendChild(card([next]));

  function qLikert(prompt, onSelect, selected, vid){
    const block = el("div", {}, [
      el("div", {class:"question"}, [text(prompt)]),
      el("div", {class:"help"}, [text("1 = Not at all, 7 = Very much")]),
      likertRow(selected, (val)=>{
        cacheSelection(vid, prompt, val);
        onSelect(val);
      })
    ]);
    return block;
  }
}

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

function renderDone(){
  const c = card([
    el("h2", {}, [text("Submitting…")]),
    el("p", {}, [text("Please do not close this tab until submission completes.")]),
    el("p", {class:"help"}, [text("If this is a test, you can still complete without Prolific redirect.")])
  ]);
  APP.appendChild(c);

  // Submission happens in submit.js
  window.__SUBMIT_STUDY__();
}
}
