const backendURL = "http://localhost:5000";

// AUTH CHECK
const token = localStorage.getItem("token");
const role = localStorage.getItem("role");
if (!token) window.location.href = "signin.html";

// LOAD DB LIST FOR ADMIN (PRIVATE DB SWITCHER)
async function loadDbList() {
  if (role !== "admin") return;

  const select = document.getElementById("dbSelect");

  try {
    const res = await fetch(`${backendURL}/db`, {
      headers: { Authorization: "Bearer " + token }
    });

    if (!res.ok) {
      console.warn("Admin DB list forbidden:", await res.json());
      return;
    }

    const data = await res.json();
    if (!data.configs || !Array.isArray(data.configs)) {
      console.warn("No configs returned");
      return;
    }

    // Get admin's currently active DB from backend
    const activeRes = await fetch(`${backendURL}/db/active`, {
      headers: { Authorization: "Bearer " + token }
    });
    
    let activeDbId = null;
    if (activeRes.ok) {
      const activeData = await activeRes.json();
      activeDbId = activeData.activeDbId;
    }

    select.innerHTML = "";

    data.configs.forEach(cfg => {
      const opt = document.createElement("option");
      opt.value = cfg._id;
      opt.textContent = `${cfg.name} (${cfg.database})`;

      if (cfg._id === activeDbId) {
        opt.selected = true;
      }

      select.appendChild(opt);
    });

    select.classList.remove("hidden");

    // Handle DB switch
    select.onchange = async () => {
      const selected = select.value;
      const selectedName = select.options[select.selectedIndex].text;

      console.log("Switching to DB:", selectedName);

      const switchRes = await fetch(`${backendURL}/db/set-active/${selected}`, {
        method: "POST",
        headers: { Authorization: "Bearer " + token }
      });

      if (switchRes.ok) {
        const data = await switchRes.json();
        console.log("Backend confirmed switch:", data);
        
        alert(`Database switched to: ${data.dbName}\n\nReloading page...`);
        window.location.reload();
      } else {
        const err = await switchRes.json();
        alert("Failed to switch DB: " + err.error);
        console.error("Switch failed:", err);
      }
    };

  } catch (err) {
    console.error("loadDbList error:", err);
  }
}

loadDbList();

// SHOW CURRENT DATABASE INDICATOR
async function showCurrentDb() {
  try {
    const res = await fetch(`${backendURL}/db/active`, {
      headers: { Authorization: "Bearer " + token }
    });
    
    if (res.ok) {
      const data = await res.json();
      const dbName = data.activeDbConfig?.name || "None selected";
      const dbDatabase = data.activeDbConfig?.database || "";
      
      const indicator = document.getElementById("currentDbName");
      if (indicator) {
        indicator.textContent = `${dbName} (${dbDatabase})`;
      }
    }
  } catch (err) {
    console.error("Could not fetch current DB:", err);
  }
}

if (role === "admin") {
  showCurrentDb();
}

// SIGNOUT
document.getElementById("logoutBtn").onclick = async () => {
  await fetch(`${backendURL}/auth/logout`, {
    method: "POST",
    headers: { Authorization: "Bearer " + token }
  });

  localStorage.removeItem("token");
  localStorage.removeItem("role");

  window.location.href = "landing.html";
};

// ADMIN PANEL BUTTONS
if (role === "admin") {
  document.getElementById("createUserBtn").classList.remove("hidden");
  document.getElementById("dbBtn").classList.remove("hidden");

  document.getElementById("createUserBtn").onclick = () =>
    window.location.href = "admin.html";

  document.getElementById("dbBtn").onclick = () =>
    window.location.href = "admin-database.html";
}

// NL2SQL FUNCTIONALITY
const queryInput = document.getElementById("query");
const generateBtn = document.getElementById("generateBtn");
const sqlCard = document.getElementById("sqlCard");
const sqlBox = document.getElementById("sqlBox");
const validationBox = document.getElementById("validationBox");
const runBtn = document.getElementById("runBtn");
const resultCard = document.getElementById("resultCard");
const resultTable = document.getElementById("resultTable");
const summary = document.getElementById("summary");

// ---------------- GENERATE SQL ----------------
generateBtn.onclick = async () => {
  const userQuery = queryInput.value.trim();
  if (!userQuery) return alert("Enter a question!");

  sqlCard.classList.remove("hidden");
  validationBox.innerHTML = "⏳ Generating SQL...";
  sqlBox.textContent = "";
  runBtn.classList.add("hidden");
  resultCard.classList.add("hidden");

  try {
    const res = await fetch(`${backendURL}/api/query/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ userQuery })
    });

    const data = await res.json();
    
    if (!res.ok) {
      validationBox.innerHTML = `❌ Error: ${data.error}`;
      return;
    }

    // Store CLEAN SQL globally
    window.generatedSQL = data.sql;
    
    // Display SQL WITH database info (visual only)
    const dbInfo = data.usedDbName ? `\n\n-- 💾 Using: ${data.usedDbName} (${data.usedDatabase})` : "";
    sqlBox.textContent = data.sql + dbInfo;

    console.log("✅ SQL generated using:", data.usedDbName, `(${data.usedDatabase})`);

    validationBox.innerHTML = "🔍 Validating...";

    const valRes = await fetch(`${backendURL}/api/query/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ sql: data.sql })
    });

    const verdict = await valRes.json();
    if (verdict.safe) {
      validationBox.innerHTML = `✅ Safe: ${verdict.reason}`;
      runBtn.classList.remove("hidden");
    } else {
      validationBox.innerHTML = `❌ Unsafe: ${verdict.reason}`;
      runBtn.classList.add("hidden");
    }
  } catch (err) {
    validationBox.innerHTML = `❌ Error: ${err.message}`;
    console.error("Generate error:", err);
  }
};

// ---------------- EXECUTE SQL ----------------
runBtn.onclick = async () => {
  const sql = window.generatedSQL || sqlBox.textContent.split('\n\n--')[0];
  const userQuery = queryInput.value.trim();

  validationBox.innerHTML = "⚙️ Executing...";
  runBtn.disabled = true;

  try {
    const res = await fetch(`${backendURL}/api/query/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ userQuery, sql })
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      validationBox.innerHTML = `❌ Error: ${data.error}`;
      runBtn.disabled = false;
      return;
    }

    validationBox.innerHTML = `✅ Query Executed on: ${data.executedOn || 'database'}`;
    resultCard.classList.remove("hidden");

    const rows = data.result;
    if (!rows.length) {
      resultTable.innerHTML = "<tr><td>No data found</td></tr>";
    } else {
      const headers = Object.keys(rows[0]);
      let html = "<thead><tr>";
      headers.forEach(h => (html += `<th>${h}</th>`));
      html += "</tr></thead><tbody>";

      rows.forEach(r => {
        html += "<tr>";
        headers.forEach(h => (html += `<td>${r[h]}</td>`));
        html += "</tr>";
      });

      html += "</tbody>";
      resultTable.innerHTML = html;
    }

    summary.textContent = data.summary || "";
  } catch (err) {
    validationBox.innerHTML = `❌ Error: ${err.message}`;
    console.error("Execute error:", err);
  } finally {
    runBtn.disabled = false;
  }
};