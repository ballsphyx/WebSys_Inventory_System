const form = document.getElementById("loginForm");
const errorMsg = document.getElementById("errorMsg");
const API_BASE = window.INVENTORY_API_BASE || "http://127.0.0.1:8000";
form.addEventListener("submit", async function (event) {
  event.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  if (!email || !password) return showError("Enter your email and password.");
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true; button.textContent = "Signing in...";
  try {
    const response = await fetch(API_BASE + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ email, password }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || "Unable to sign in.");
    window.location.href = "pages/dashboard.html";
  } catch (error) { showError(error.message || "Cannot connect to the backend. Make sure FastAPI is running."); }
  finally { button.disabled = false; button.textContent = "Sign in"; }
});
function showError(message) { errorMsg.textContent = message; errorMsg.hidden = false; }
