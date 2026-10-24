// Put this in the <head> of every page EXCEPT the login page.
// Sends people back to the login page if they haven't signed in.
// (Front-end only: fine for learning, NOT real security.)
if (sessionStorage.getItem("loggedIn") !== "true") {
  window.location.replace("index.html");
}

document.addEventListener("DOMContentLoaded", function () {
  const logout = document.getElementById("logout");
  if (logout) {
    logout.addEventListener("click", function (e) {
      e.preventDefault();
      sessionStorage.removeItem("loggedIn");
      window.location.href = "index.html";
    });
  }
});