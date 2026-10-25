// TEMPORARY demo login (front-end only, NOT secure).
// Replace with a real backend check later.
const DEMO_EMAIL = "admin@example.com";
const DEMO_PASSWORD = "admin123";

const form = document.getElementById("loginForm");
const errorMsg = document.getElementById("errorMsg");

form.addEventListener("submit", function (event) {
  event.preventDefault(); // stop the page from reloading

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    showError("Enter your email and password.");
    return;
  }

  if (email === DEMO_EMAIL && password === DEMO_PASSWORD) {
    sessionStorage.setItem("loggedIn", "true");
    window.location.href = "pages/dashboard.html";
  } else {
    showError("Incorrect email or password.");
  }
});

function showError(message) {
  errorMsg.textContent = message;
  errorMsg.hidden = false;
}