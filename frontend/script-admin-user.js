const backendURL = "http://localhost:5000";

const token = localStorage.getItem("token");
const role = localStorage.getItem("role");
if (!token || role !== "admin") {
  window.location.href = "landing.html";
}

function goBack() {
  window.location.href = "index.html";
}

const msg = document.getElementById("msg");
const dbAssignSection = document.getElementById("dbAssignSection");
const roleSelect = document.getElementById("newRole");

// TOGGLE DB ASSIGN SECTION
// Admin should NOT see DB dropdown
roleSelect.onchange = () => {
  if (roleSelect.value === "admin") {
    dbAssignSection.style.display = "none";
  } else {
    dbAssignSection.style.display = "block";
  }
};

// Initially hide DB assign for admin
if (roleSelect.value === "admin") {
  dbAssignSection.style.display = "none";
}

// LOAD DB LIST FOR ASSIGNMENT
async function loadDbListForAssign() {
  try {
    const res = await fetch(`${backendURL}/db`, {
      headers: { Authorization: "Bearer " + token }
    });

    const data = await res.json();
    const sel = document.getElementById("assignDbSelector");

    sel.innerHTML = ""; // clear default

    if (!data.configs || data.configs.length === 0) {
      sel.innerHTML = `<option disabled>No database configs found</option>`;
      return;
    }

    data.configs.forEach(cfg => {
      const opt = document.createElement("option");
      opt.value = cfg._id;
      opt.textContent = `${cfg.name} (${cfg.database})`;
      sel.appendChild(opt);
    });

  } catch (err) {
    console.error("Error loading DB list:", err);
    msg.innerText = "Failed to load DB list";
  }
}

loadDbListForAssign();

// CREATE USER
document.getElementById("createBtn").onclick = async () => {
  const email = newEmail.value;
  const password = newPass.value;
  const userRole = newRole.value;

  let body = { email, password, role: userRole };

  // Only NORMAL USERS get a DB assigned
  if (userRole === "user") {
    body.assignedDb = document.getElementById("assignDbSelector").value;
  }

  const res = await fetch(`${backendURL}/auth/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify(body)
  });

  const d = await res.json();
  msg.innerText = res.ok ? "User created!" : d.error;
};

// DEACTIVATE USER
document.getElementById("deactBtn").onclick = async () => {
  const email = deactEmail.value;

  const res = await fetch(`${backendURL}/auth/deactivate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ email })
  });

  const d = await res.json();
  msg.innerText = res.ok ? "User deactivated!" : d.error;
};
