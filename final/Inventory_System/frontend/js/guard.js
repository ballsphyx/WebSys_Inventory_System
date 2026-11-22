const API_BASE = window.INVENTORY_API_BASE || "http://127.0.0.1:8000";
(async function protectPage() {
  try {
    const response = await fetch(API_BASE + "/api/auth/me", { credentials: "include" });
    if (!response.ok) throw new Error("Unauthenticated");
    const user = await response.json();
    document.documentElement.dataset.authenticated = "true";
    document.documentElement.dataset.userEmail = user.email;
  } catch (_) { window.location.replace("../index.html"); }
})();
document.addEventListener("DOMContentLoaded", function () {
  const logout = document.getElementById("logout");
  if (logout) logout.addEventListener("click", async function (event) {
    event.preventDefault();
    try { await fetch(API_BASE + "/api/auth/logout", { method: "POST", credentials: "include" }); }
    finally { window.location.href = "../index.html"; }
  });
});
