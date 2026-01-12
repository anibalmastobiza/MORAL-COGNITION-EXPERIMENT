// ====== Configure these two URLs ======
const GOOGLE_SCRIPT_WEBAPP_URL = "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEBAPP_URL_HERE";
const PROLIFIC_COMPLETION_URL = "PASTE_YOUR_PROLIFIC_COMPLETION_URL_HERE";

function postJSON(url, data){
  return fetch(url, {
    method: "POST",
    mode: "cors",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(data)
  });
}

window.__SUBMIT_STUDY__ = async function(){
  try{
    const payload = {
      study: "moral_explaining_away_v1",
      demographics: STATE.demographics,
      trials: STATE.responses,
      client_time_iso: new Date().toISOString(),
      user_agent: navigator.userAgent
    };

    if(GOOGLE_SCRIPT_WEBAPP_URL.includes("PASTE_")){
      document.getElementById("app").innerHTML = `
        <div class="card">
          <h2>Test mode (no Google Script URL set)</h2>
          <p class="help">Set GOOGLE_SCRIPT_WEBAPP_URL in <code>js/submit.js</code> to enable saving.</p>
          <pre style="white-space:pre-wrap; font-size:12px; border:1px solid #e9e9e9; padding:12px; border-radius:10px;">${escapeHtml(JSON.stringify(payload,null,2))}</pre>
        </div>`;
      return;
    }

    const res = await postJSON(GOOGLE_SCRIPT_WEBAPP_URL, payload);
    const txt = await res.text();

    if(!res.ok){
      throw new Error("Submission failed: " + txt);
    }

    if(PROLIFIC_COMPLETION_URL.includes("PASTE_")){
      document.getElementById("app").innerHTML = `
        <div class="card">
          <h2>Submission complete</h2>
          <p class="help">Set PROLIFIC_COMPLETION_URL in <code>js/submit.js</code> to redirect automatically.</p>
          <pre style="white-space:pre-wrap; font-size:12px; border:1px solid #e9e9e9; padding:12px; border-radius:10px;">${escapeHtml(txt)}</pre>
        </div>`;
      return;
    }

    window.location.href = PROLIFIC_COMPLETION_URL;

  }catch(e){
    document.getElementById("app").innerHTML = `
      <div class="card">
        <h2>Submission error</h2>
        <p class="help">Please copy this error and contact the researcher.</p>
        <pre style="white-space:pre-wrap; font-size:12px; border:1px solid #e9e9e9; padding:12px; border-radius:10px;">${escapeHtml(String(e))}</pre>
      </div>`;
  }
};

function escapeHtml(s){
  return s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}
