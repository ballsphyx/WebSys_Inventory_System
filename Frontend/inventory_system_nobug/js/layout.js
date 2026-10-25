// ONE copy of the top bar + sidebar for every page.
// Each page needs:  <body data-page="inventory">  <header id="topbar"></header>  <aside id="sidebar"></aside>

// Later this comes from the logged-in user (backend).
const USER = { firstName: "Zaheed", fullName: "Zaheed Abubakar", role: "PRODUCT DESIGNER" };

const S = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
const ICON = {
  search: `<svg viewBox="0 0 24 24" ${S} stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>`,
  user: `<svg viewBox="0 0 24 24" ${S} stroke-width="1.8"><circle cx="12" cy="8.5" r="3.6"/><path d="M4.5 21c0-4.2 3.3-6.8 7.5-6.8s7.5 2.6 7.5 6.8"/></svg>`,
  dashboard: `<svg viewBox="0 0 24 24" ${S} stroke-width="1.6"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/></svg>`,
  layers: `<svg viewBox="0 0 24 24" ${S} stroke-width="1.6"><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/></svg>`,
  wallet: `<svg viewBox="0 0 24 24" ${S} stroke-width="1.6"><path d="M3 7h16a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M3 7l12-4v4"/><circle cx="16.5" cy="13.5" r="1"/></svg>`,
  logout: `<svg viewBox="0 0 24 24" ${S} stroke-width="2"><rect x="3" y="3" width="11" height="18" rx="2" fill="currentColor"/><path d="M14 12h8M18.5 8l3.5 4-3.5 4"/></svg>`
};

const PAGES = [
  { id: "dashboard",    label: "Dashboard",    href: "dashboard.html",    icon: ICON.dashboard },
  { id: "inventory",    label: "Inventory",    href: "inventory.html",    icon: ICON.layers },
  { id: "transactions", label: "Transactions", href: "transactions.html", icon: ICON.wallet },
  { id: "reports",      label: "Reports",      href: "reports.html",      icon: ICON.layers }
];

(function renderLayout() {
  const active = document.body.dataset.page;

  document.getElementById("topbar").innerHTML = `
    <div class="brand">
      <img src="../images/logo_4k.png" alt="Inventory System logo" />
      <h1>Welcome <span id="welcomeName">${USER.firstName}</span>!</h1>
    </div>
    <label class="search">
      ${ICON.search}
      <input type="text" id="searchInput" placeholder="Search" />
    </label>`;

  document.getElementById("sidebar").innerHTML = `
    <div class="profile">
      <div class="avatar">${ICON.user}</div>
      <small id="profileRole">${USER.role}</small>
      <strong id="profileName">${USER.fullName}</strong>
    </div>
    <p class="nav-label">MAIN</p>
    <nav class="nav">
      ${PAGES.map(p => `<a href="${p.href}" class="${p.id === active ? "active" : ""}">${p.icon}${p.label}</a>`).join("")}
    </nav>
    <a href="../index.html" class="logout" id="logout">${ICON.logout}Logout</a>`;
})();