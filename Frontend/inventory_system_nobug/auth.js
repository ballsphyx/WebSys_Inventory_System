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
    window.location.href = "dashboard.html";
  } else {
    showError("Incorrect email or password.");
  }
});

function showError(message) {
  errorMsg.textContent = message;
  errorMsg.hidden = false;
}

// Show / hide password (eye icon)
const passwordInput = document.getElementById("password");
const togglePw = document.getElementById("togglePw");

togglePw.addEventListener("click", function () {
  const hidden = passwordInput.type === "password";
  passwordInput.type = hidden ? "text" : "password";
  togglePw.classList.toggle("visible", hidden);
  togglePw.setAttribute("aria-label", hidden ? "Hide password" : "Show password");
});