const tokenDb = localStorage.getItem("token");
const roleDb = localStorage.getItem("role");

if (!tokenDb || roleDb !== "admin") {
  window.location.href = "landing.html";
}

function goBack() {
  window.location.href = "index.html";
}

document.getElementById("saveDbBtn").onclick = async () => {
  const body = {
    name: cfgName.value,
    connString: connStr.value || undefined,
    host: host.value || undefined,
    port: port.value ? Number(port.value) : undefined,
    user: dbUser.value || undefined,
    password: dbPass.value || undefined,
    database: dbName.value || undefined
  };

  const res = await fetch("http://localhost:5000/db/connect", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + tokenDb
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();

  if (!res.ok) {
    msg.innerText = "❌ " + data.error;
  } else {
    msg.innerText = "✅ Database saved!";
  }
};
