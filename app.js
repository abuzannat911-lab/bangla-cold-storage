// Sheba Cold Storage Management System
// app.js - Single Page Application State and Controller with SQL Backend API

// Standard business variables
const STORAGE_RENT_RATE = 250; // BDT per bag for the season
const DADAN_INTEREST_RATE = 12; // 12% per season (approx 6 months)
const CURRENT_DATE_STRING = "2026-06-21"; // Simulated local time matching environment

const INITIAL_SEED_DATA = {
  bookings: [],
  loans: [],
  chalans: [],
  chambers: []
};

class ColdStorageApp {
  constructor() {
    this.state = JSON.parse(JSON.stringify(INITIAL_SEED_DATA));
    this.charts = {};
    this.currentChamberId = null;
  }

  getApiUrl(endpoint) {
    const path = window.location.pathname;
    const base = path.endsWith('/') ? path : path.substring(0, path.lastIndexOf('/') + 1);
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    return base + cleanEndpoint;
  }

  async apiFetch(url, options = {}) {
    return fetch(this.getApiUrl(url), options);
  }

  async init() {
    // 1. Check user login session
    this.checkLogin();

    // 2. Load state from backend SQLite server
    await this.refreshState();

    // 3. Initialize UI Icons
    lucide.createIcons();

    // 4. Setup navigation tabs
    this.setupNavigation();

    // 5. Setup buttons and modals
    this.setupModals();

    // 6. Render components and dashboard
    this.renderDashboard();
    this.renderBookingsTable();
    this.renderLoansTable();
    this.renderGatepassTable();
    this.renderChambersPanel();
    this.renderReportsPanel();
    
    // Default Loan calculator values
    this.calculateMockLoan();

    // Dynamic sensors initialization
    this.updateHeaderSensors();

    // Start background fluctuations for IoT telemetry simulation
    this.startTelemetrySimulation();
  }

  async refreshState() {
    try {
      const res = await this.apiFetch('/api/state');
      if (res.ok) {
        this.state = await res.json();
      } else {
        console.error("Failed to load server state. Fallback to client empty structure.");
      }
    } catch (e) {
      console.error("Connection error to backend server.", e);
    }
  }

  saveState() {
    // Modifications are directly saved to SQLite via API endpoints.
  }

  // Navigation Logic
  setupNavigation() {
    const navLinks = document.querySelectorAll(".nav-link");
    navLinks.forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const tab = link.getAttribute("data-tab");
        this.switchTab(tab);
      });
    });
  }

  switchTab(tabId) {
    // Hide all tabs
    document.querySelectorAll(".tab-pane").forEach(pane => pane.classList.remove("active"));
    document.querySelectorAll(".nav-link").forEach(link => link.classList.remove("active"));

    // Show active tab
    const activePane = document.getElementById(`tab-${tabId}`);
    const activeLink = document.querySelector(`.nav-link[data-tab="${tabId}"]`);
    if (activePane && activeLink) {
      activePane.classList.add("active");
      activeLink.classList.add("active");
    }

    // Update headers based on view
    const titleEl = document.getElementById("page-title");
    const subEl = document.getElementById("page-subtitle");
    
    switch (tabId) {
      case "dashboard":
        titleEl.textContent = "Dashboard Overview";
        subEl.textContent = "Welcome back, Abu! Here is what's happening today.";
        this.renderDashboard();
        break;
      case "bookings":
        titleEl.textContent = "Storage Bookings & Receipts";
        subEl.textContent = "Manage Storage Receipts (SR Book), incoming stock, and customer profiles.";
        this.renderBookingsTable();
        break;
      case "chambers":
        titleEl.textContent = "Chamber Inventory Map";
        subEl.textContent = "Live rack occupancy levels, cooling metrics, and chamber distribution logs.";
        this.renderChambersPanel();
        break;
      case "loans":
        titleEl.textContent = "Dadan Loans Ledger";
        subEl.textContent = "Review capital disbursed, calculate interest accrued, and settle crop-secured loans.";
        this.renderLoansTable();
        break;
      case "gatepass":
        titleEl.textContent = "Terminal Gate Passes";
        subEl.textContent = "Verify delivery and loading challans, porter labor tracking, and vehicle passes.";
        this.renderGatepassTable();
        break;
      case "reports":
        titleEl.textContent = "Financial Operations & Auditing";
        subEl.textContent = "Analyze collected rent revenue, pending assets, labor invoices, and chamber utility ratios.";
        this.renderReportsPanel();
        break;
    }
  }

  // Modal overlays controller
  setupModals() {
    const modalButtons = [
      { btnId: "quick-booking-btn", modalId: "modal-booking", callback: () => this.populateBookingChambers() },
      { btnId: "new-booking-btn", modalId: "modal-booking", callback: () => this.populateBookingChambers() },
      { btnId: "new-loan-btn", modalId: "modal-loan", callback: () => this.populateLoanFormSRs() },
      { btnId: "new-chalan-btn", modalId: "modal-chalan", callback: () => this.populateChalanFormSRs() },
      { btnId: "open-add-chamber-btn", modalId: "modal-add-chamber" }
    ];

    modalButtons.forEach(cfg => {
      const btn = document.getElementById(cfg.btnId);
      if (btn) {
        btn.addEventListener("click", () => {
          this.openModal(cfg.modalId);
          if (cfg.callback) cfg.callback();
        });
      }
    });

    // Close buttons binding
    document.querySelectorAll(".modal-close-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const modal = e.target.closest(".modal-overlay");
        if (modal) modal.classList.add("hidden");
      });
    });

    // Chamber dynamic change loader
    const chamberSelect = document.getElementById("book-chamber");
    if (chamberSelect) {
      chamberSelect.addEventListener("change", () => this.populateBookingRacks());
    }

    // Form handlers
    document.getElementById("form-new-booking").addEventListener("submit", (e) => this.handleNewBooking(e));
    document.getElementById("form-new-loan").addEventListener("submit", (e) => this.handleNewLoan(e));
    document.getElementById("form-new-chalan").addEventListener("submit", (e) => this.handleNewChalan(e));
    document.getElementById("form-settle-release").addEventListener("submit", (e) => this.handleSettleRelease(e));
    document.getElementById("form-add-chamber").addEventListener("submit", (e) => this.handleNewChamber(e));
    document.getElementById("print-financial-report-btn").addEventListener("click", () => this.printFinancialReport());
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove("hidden");
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add("hidden");
    }
  }

  // ================= DASHBOARD CONTROLS =================
  renderDashboard() {
    // 1. Calculate KPI Metrics
    const totalBagsStored = this.state.bookings.reduce((sum, b) => sum + b.storedBags, 0);
    const maxCapacity = this.state.chambers.reduce((sum, c) => sum + c.capacity, 0);
    const occupancyPercent = maxCapacity > 0 ? Math.round((totalBagsStored / maxCapacity) * 100) : 0;

    const totalLoansOutstanding = this.state.loans
      .filter(l => l.status === "Active")
      .reduce((sum, l) => sum + l.principal, 0);

    const activeFarmerCount = new Set(this.state.bookings.map(b => b.phone)).size;

    // Estimate total accrued rent revenue for stored goods
    const pendingRent = this.state.bookings.reduce((sum, b) => {
      if (b.status !== "Released") {
        return sum + (b.storedBags * b.rentRate);
      }
      return sum;
    }, 0);

    // Update KPI DOM
    document.getElementById("kpi-total-bags").textContent = totalBagsStored.toLocaleString();
    document.getElementById("kpi-occupancy").textContent = `${occupancyPercent}%`;
    document.getElementById("kpi-occupancy-bar").style.width = `${occupancyPercent}%`;
    const maxCapLabel = document.getElementById("kpi-max-capacity-label");
    if (maxCapLabel) {
      maxCapLabel.textContent = `${maxCapacity.toLocaleString()} Bags Max`;
    }
    document.getElementById("kpi-total-loans").textContent = `৳ ${totalLoansOutstanding.toLocaleString()}`;
    document.getElementById("kpi-total-revenue").textContent = `৳ ${pendingRent.toLocaleString()}`;

    // 2. Render Recent Chalans
    const recentChalansTbody = document.getElementById("recent-chalans-tbody");
    recentChalansTbody.innerHTML = "";
    
    // Grab last 5 chalans in descending order
    const recent = [...this.state.chalans].reverse().slice(0, 5);
    recent.forEach(c => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><span class="font-mono text-bold">${c.id}</span></td>
        <td><span class="badge ${c.type === 'IN' ? 'badge-in' : 'badge-out'}">${c.type}</span></td>
        <td>${c.date}</td>
        <td>${c.farmerName}</td>
        <td><a href="#" onclick="app.printSR('${c.srCode}'); return false;" class="text-blue font-mono">${c.srCode}</a></td>
        <td><strong>${c.bags} Bags</strong></td>
        <td>৳ ${c.laborCharge}</td>
        <td><span class="text-success text-small"><i data-lucide="check-circle-2" style="width:12px; height:12px; display:inline-block; vertical-align:middle;"></i> Complete</span></td>
      `;
      recentChalansTbody.appendChild(row);
    });

    // 3. Render Inflow/Outflow Line Chart (Chart.js)
    this.renderStockFlowChart();

    // 4. Render Variety Donut Chart
    this.renderVarietyChart();

    lucide.createIcons();
  }

  renderStockFlowChart() {
    const canvas = document.getElementById("stockFlowChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (this.charts.stockFlow) {
      this.charts.stockFlow.destroy();
    }

    // Dynamic aggregates per month (March to September)
    const months = ["March", "April", "May", "June", "July", "August", "September"];
    const inflowData = [12000, 18000, 10000, 2500, 0, 0, 0];
    const outflowData = [0, 0, 1200, 4800, 8000, 15000, 12000];

    this.charts.stockFlow = new Chart(ctx, {
      type: "line",
      data: {
        labels: months,
        datasets: [
          {
            label: "Inflow (Bags Received)",
            data: inflowData,
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            borderWidth: 2,
            tension: 0.3,
            fill: true
          },
          {
            label: "Outflow (Bags Released)",
            data: outflowData,
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            borderWidth: 2,
            tension: 0.3,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: "#94a3b8",
              font: { family: "Outfit" }
            }
          }
        },
        scales: {
          x: {
            grid: { color: "rgba(255, 255, 255, 0.05)" },
            ticks: { color: "#94a3b8" }
          },
          y: {
            grid: { color: "rgba(255, 255, 255, 0.05)" },
            ticks: { color: "#94a3b8" }
          }
        }
      }
    });
  }

  renderVarietyChart() {
    const canvas = document.getElementById("cropVarietyChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (this.charts.variety) {
      this.charts.variety.destroy();
    }

    // Dynamic calculations from bookings
    const varietyCounts = {};
    this.state.bookings.forEach(b => {
      if (b.storedBags > 0) {
        varietyCounts[b.crop] = (varietyCounts[b.crop] || 0) + b.storedBags;
      }
    });

    const labels = Object.keys(varietyCounts);
    const data = Object.values(varietyCounts);

    this.charts.variety = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: labels.length ? labels : ["No Stock"],
        datasets: [{
          data: data.length ? data : [1],
          backgroundColor: ["#10b981", "#3b82f6", "#f59e0b", "#a855f7", "#64748b"],
          borderColor: "#131a26",
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: "#94a3b8",
              font: { family: "Outfit" }
            }
          }
        }
      }
    });
  }

  // ================= BOOKINGS & SR CONTROLS =================
  renderBookingsTable(filtered = null) {
    const tbody = document.getElementById("bookings-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    
    const list = filtered || this.state.bookings;
    
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="11" class="text-center text-muted py-8">No matching Storage Receipts found.</td></tr>`;
      return;
    }

    list.forEach(b => {
      const row = document.createElement("tr");
      
      // Calculate active loan indicators
      const activeLoan = this.state.loans.find(l => l.srCode === b.srCode && l.status === "Active");
      const loanText = activeLoan ? `৳ ${activeLoan.principal.toLocaleString()}` : "—";
      const statusBadge = b.status === "Stored" 
        ? `<span class="badge badge-stored">Stored / মজুদ</span>` 
        : b.status === "Loan Pledged"
        ? `<span class="badge badge-loan">Pledged / ঋণ</span>`
        : `<span class="badge badge-released">Released / খালাস</span>`;
        
      row.innerHTML = `
        <td><span class="font-mono text-bold">${b.srCode}</span></td>
        <td>${b.farmerName}</td>
        <td>${b.phone}</td>
        <td>${b.crop}</td>
        <td><strong>${b.totalBags}</strong></td>
        <td><strong>${b.storedBags}</strong></td>
        <td><span class="badge badge-released">${b.chamber} / ${b.rack}</span></td>
        <td>${b.date}</td>
        <td class="text-amber"><strong>${loanText}</strong></td>
        <td>${statusBadge}</td>
        <td class="text-right">
          <div class="filter-group justify-end">
            <button class="btn btn-outline btn-small btn-icon" title="Print Receipt" onclick="app.printSR('${b.srCode}')">
              <i data-lucide="printer"></i>
            </button>
            ${b.storedBags > 0 ? `
              <button class="btn btn-outline btn-small btn-icon text-blue" title="Issue Gate Pass (IN/OUT)" onclick="app.openGatePassDirect('${b.srCode}')">
                <i data-lucide="truck"></i>
              </button>
              ${b.status === "Stored" ? `
                <button class="btn btn-outline btn-small btn-icon text-amber" title="Disburse Dadan Loan" onclick="app.openDisburseLoanDirect('${b.srCode}')">
                  <i data-lucide="hand-coins"></i>
                </button>
              ` : ''}
              <button class="btn btn-primary btn-small" onclick="app.openReleaseLedger('${b.srCode}')">
                <i data-lucide="check-square"></i> Settle & Release
              </button>
            ` : `<button class="btn btn-outline btn-small text-muted" disabled>Settled</button>`}
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });
    
    lucide.createIcons();
  }

  filterBookings() {
    const query = document.getElementById("booking-search").value.toLowerCase();
    const cropFilter = document.getElementById("booking-filter-crop").value;
    const statusFilter = document.getElementById("booking-filter-status").value;

    const filtered = this.state.bookings.filter(b => {
      const matchQuery = b.farmerName.toLowerCase().includes(query) || 
                          b.phone.includes(query) || 
                          b.srCode.toLowerCase().includes(query) ||
                          (b.nid && b.nid.includes(query));
                          
      const matchCrop = cropFilter === "" || b.crop === cropFilter;
      const matchStatus = statusFilter === "" || b.status === statusFilter;
      
      return matchQuery && matchCrop && matchStatus;
    });

    this.renderBookingsTable(filtered);
  }

  async handleNewBooking(e) {
    e.preventDefault();
    
    const count = this.state.bookings.length + 1;
    const srCode = `SR-2026-${String(count).padStart(3, "0")}`;
    
    const newBooking = {
      srCode: srCode,
      farmerName: document.getElementById("book-farmer-name").value,
      phone: document.getElementById("book-phone").value,
      nid: document.getElementById("book-nid").value || "N/A",
      address: document.getElementById("book-address").value || "N/A",
      crop: document.getElementById("book-crop").value,
      totalBags: parseInt(document.getElementById("book-bags").value),
      storedBags: parseInt(document.getElementById("book-bags").value),
      chamber: document.getElementById("book-chamber").value,
      rack: document.getElementById("book-rack").value,
      rentRate: parseInt(document.getElementById("book-rent-rate").value) || STORAGE_RENT_RATE,
      advance: parseInt(document.getElementById("book-advance").value) || 0,
      date: CURRENT_DATE_STRING,
      status: "Stored"
    };

    try {
      const res = await this.apiFetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBooking)
      });
      if (res.ok) {
        await this.refreshState();
        this.closeModal("modal-booking");
        this.renderBookingsTable();
        this.renderDashboard();
        
        document.getElementById("form-new-booking").reset();
        
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
      } else {
        const err = await res.json();
        alert("Server failed to create booking: " + (err.error || "Unknown Error"));
      }
    } catch (err) {
      alert("Network error: " + err.message);
    }
  }

  // ================= DADAN LOAN CONTROLS =================
  renderLoansTable(filtered = null) {
    const tbody = document.getElementById("loans-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const list = filtered || this.state.loans;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted py-8">No active Dadan Loans found.</td></tr>`;
      return;
    }

    list.forEach(l => {
      // Calculate real time accrued interest
      const interest = this.calculateAccruedInterest(l.principal, l.interestRate, l.disbursementDate);
      const totalDue = l.principal + interest;
      
      const statusBadge = l.status === "Active" 
        ? `<span class="badge badge-loan">Active / বকেয়া</span>` 
        : `<span class="badge badge-released">Cleared / পরিশোধিত</span>`;

      const row = document.createElement("tr");
      row.innerHTML = `
        <td><span class="font-mono text-bold">${l.srCode}</span></td>
        <td>${l.farmerName}</td>
        <td>${l.phone}</td>
        <td><strong>${l.pledgedBags} Bags</strong></td>
        <td><strong>৳ ${l.principal.toLocaleString()}</strong></td>
        <td>${l.disbursementDate}</td>
        <td class="text-warning"><strong>৳ ${interest.toLocaleString()}</strong></td>
        <td class="text-green"><strong>৳ ${totalDue.toLocaleString()}</strong></td>
        <td>${statusBadge}</td>
        <td class="text-right">
          ${l.status === "Active" ? `
            <button class="btn btn-primary btn-small" onclick="app.openReleaseLedger('${l.srCode}')">
              Settle Loan
            </button>
          ` : `<span class="text-muted text-small">Settled Ledger</span>`}
        </td>
      `;
      tbody.appendChild(row);
    });

    // Update global summaries on loan screen
    const activeLoans = this.state.loans.filter(l => l.status === "Active");
    const totalDisbursed = activeLoans.reduce((sum, l) => sum + l.principal, 0);
    const totalPledgedBags = activeLoans.reduce((sum, l) => sum + l.pledgedBags, 0);
    const totalAccruedInterest = activeLoans.reduce((sum, l) => {
      return sum + this.calculateAccruedInterest(l.principal, l.interestRate, l.disbursementDate);
    }, 0);

    document.getElementById("loan-stat-disbursed").textContent = `৳ ${totalDisbursed.toLocaleString()}`;
    document.getElementById("loan-stat-interest").textContent = `৳ ${totalAccruedInterest.toLocaleString()}`;
    document.getElementById("loan-stat-pledged").textContent = `${totalPledgedBags.toLocaleString()} Bags`;
  }

  filterLoans() {
    const query = document.getElementById("loan-search").value.toLowerCase();
    const filtered = this.state.loans.filter(l => {
      return l.farmerName.toLowerCase().includes(query) || 
             l.srCode.toLowerCase().includes(query) ||
             l.phone.includes(query);
    });
    this.renderLoansTable(filtered);
  }

  calculateAccruedInterest(principal, ratePercent, disburseDate) {
    const start = new Date(disburseDate);
    const end = new Date(CURRENT_DATE_STRING);
    
    // Difference in months
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const months = Math.max(1, Math.round(diffDays / 30.4));
    
    // Rate pro-rated over 6 months season
    const calculated = principal * (ratePercent / 100) * (months / 6);
    return Math.round(calculated);
  }

  populateLoanFormSRs() {
    const dropdown = document.getElementById("loan-sr-code");
    dropdown.innerHTML = `<option value="">-- Choose Eligible SR --</option>`;
    
    // Filter bookings that have Stored status and do NOT have an active loan
    const eligible = this.state.bookings.filter(b => {
      const hasActiveLoan = this.state.loans.some(l => l.srCode === b.srCode && l.status === "Active");
      return b.status === "Stored" && b.storedBags > 0 && !hasActiveLoan;
    });

    if (eligible.length === 0) {
      dropdown.innerHTML = `<option value="">No eligible SR without active loans</option>`;
      return;
    }

    eligible.forEach(b => {
      const opt = document.createElement("option");
      opt.value = b.srCode;
      opt.textContent = `${b.srCode} - ${b.farmerName} (${b.storedBags} Bags)`;
      dropdown.appendChild(opt);
    });
  }

  onLoanSRSelect() {
    const srCode = document.getElementById("loan-sr-code").value;
    const booking = this.state.bookings.find(b => b.srCode === srCode);
    
    if (booking) {
      document.getElementById("loan-farmer-name").value = booking.farmerName;
      document.getElementById("loan-pledged-bags").value = booking.storedBags;
      
      const maxLoan = booking.storedBags * 300;
      document.getElementById("loan-principal").value = maxLoan;
      document.getElementById("loan-limit-warning").textContent = `Recommended limits: ৳${maxLoan.toLocaleString()} (৳300/bag)`;
    } else {
      document.getElementById("loan-farmer-name").value = "";
      document.getElementById("loan-pledged-bags").value = "";
      document.getElementById("loan-principal").value = "";
    }
  }

  async handleNewLoan(e) {
    e.preventDefault();
    
    const srCode = document.getElementById("loan-sr-code").value;
    const booking = this.state.bookings.find(b => b.srCode === srCode);
    
    if (!booking) return;

    const newLoan = {
      srCode: srCode,
      farmerName: booking.farmerName,
      phone: booking.phone,
      pledgedBags: booking.storedBags,
      principal: parseInt(document.getElementById("loan-principal").value),
      interestRate: parseInt(document.getElementById("loan-interest-rate").value) || DADAN_INTEREST_RATE,
      disbursementDate: CURRENT_DATE_STRING,
      status: "Active"
    };

    try {
      const res = await this.apiFetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLoan)
      });
      if (res.ok) {
        await this.refreshState();
        this.closeModal("modal-loan");
        this.renderLoansTable();
        this.renderBookingsTable();
        this.renderDashboard();
        
        document.getElementById("form-new-loan").reset();
        
        confetti({
          particleCount: 100,
          colors: ["#f59e0b", "#10b981"]
        });
      } else {
        const err = await res.json();
        alert("Server failed to disburse loan: " + (err.error || "Unknown Error"));
      }
    } catch (err) {
      alert("Network error: " + err.message);
    }
  }

  calculateMockLoan() {
    const bags = parseInt(document.getElementById("calc-bags").value) || 0;
    const loanPerBag = parseInt(document.getElementById("calc-loan-per-bag").value) || 0;
    const rentPerBag = parseInt(document.getElementById("calc-rent-per-bag").value) || 0;
    const months = parseInt(document.getElementById("calc-months").value) || 0;
    const rate = parseInt(document.getElementById("calc-interest-rate").value) || 0;

    const principal = bags * loanPerBag;
    const rent = bags * rentPerBag;
    const interest = Math.round(principal * (rate / 100) * (months / 6));
    const total = principal + rent + interest;

    const elPr = document.getElementById("calc-result-principal");
    const elRt = document.getElementById("calc-result-rent");
    const elIt = document.getElementById("calc-result-interest");
    const elTl = document.getElementById("calc-result-total");
    if (elPr) elPr.textContent = `৳ ${principal.toLocaleString()}`;
    if (elRt) elRt.textContent = `৳ ${rent.toLocaleString()}`;
    if (elIt) elIt.textContent = `৳ ${interest.toLocaleString()}`;
    if (elTl) elTl.textContent = `৳ ${total.toLocaleString()}`;
  }

  // ================= CHAMBER RACKS VISUALIZER =================
  renderChambersPanel() {
    const listContainer = document.getElementById("chamber-list");
    if (!listContainer) return;
    listContainer.innerHTML = "";
    
    this.state.chambers.forEach(c => {
      const occupied = c.racks.reduce((sum, r) => sum + r.stored, 0);
      const occupancy = c.capacity > 0 ? Math.round((occupied / c.capacity) * 100) : 0;
      
      const item = document.createElement("div");
      item.className = `chamber-btn ${this.currentChamberId === c.id ? 'active' : ''}`;
      item.onclick = () => this.selectChamber(c.id);
      
      item.innerHTML = `
        <div class="chamber-info">
          <div style="display: flex; align-items: center; gap: 8px;">
            <h4>${c.name}</h4>
            <button class="btn-delete-chamber" title="Delete Chamber" onclick="event.stopPropagation(); app.deleteChamber('${c.id}')">
              <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
            </button>
          </div>
          <p>${occupied.toLocaleString()} / ${c.capacity.toLocaleString()} Bags (${occupancy}%)</p>
        </div>
        <div class="chamber-status-indicator">
          <span class="temp">${c.temp} °C</span>
          <span class="badge ${c.temp > 4 ? 'badge-loan' : 'badge-stored'}" style="font-size:0.6rem; padding: 2px 6px;">
            ${c.temp > 4 ? 'Warm Alert' : 'Cold OK'}
          </span>
        </div>
      `;
      listContainer.appendChild(item);
    });

    // Re-bind Lucide icons for dynamic items
    lucide.createIcons();

    this.renderRackGrid();
  }

  selectChamber(chamberId) {
    this.currentChamberId = chamberId;
    this.renderChambersPanel();
  }

  renderRackGrid() {
    const prompt = document.getElementById("chamber-prompt");
    const panel = document.getElementById("chamber-detail-panel");
    const grid = document.getElementById("chamber-rack-grid");

    if (!prompt || !panel || !grid) return;

    if (!this.currentChamberId) {
      prompt.classList.remove("hidden");
      panel.classList.add("hidden");
      return;
    }

    prompt.classList.add("hidden");
    panel.classList.remove("hidden");

    const chamber = this.state.chambers.find(c => c.id === this.currentChamberId);
    if (!chamber) return;
    
    document.getElementById("selected-chamber-title").textContent = chamber.name;
    const occupied = chamber.racks.reduce((sum, r) => sum + r.stored, 0);
    document.getElementById("selected-chamber-sub").textContent = `Total Capacity: ${chamber.capacity.toLocaleString()} Bags | Active Stock: ${occupied.toLocaleString()} Bags`;
    document.getElementById("selected-chamber-temp").textContent = `${chamber.temp} °C`;
    document.getElementById("selected-chamber-humidity").textContent = `${chamber.humidity}%`;

    grid.innerHTML = "";
    
    // Loop through Racks and levels
    chamber.racks.forEach(r => {
      const node = document.createElement("div");
      const usage = r.capacity > 0 ? Math.round((r.stored / r.capacity) * 100) : 0;
      
      let occupancyClass = "empty";
      if (usage > 70) {
        occupancyClass = "full";
      } else if (usage > 20) {
        occupancyClass = "medium";
      }
      
      node.className = `rack-node ${occupancyClass}`;
      node.innerHTML = `
        <span class="rack-name">${r.name}</span>
        <span class="rack-usage">${r.stored.toLocaleString()} / ${r.capacity.toLocaleString()} Bags (${usage}%)</span>
        <div class="rack-fill-bar" style="height: ${usage}%"></div>
      `;
      
      grid.appendChild(node);
    });
  }

  // ================= GATE PASS CHALAN CONTROLS =================
  renderGatepassTable(filtered = null) {
    const tbody = document.getElementById("gatepass-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const list = filtered || this.state.chalans;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted py-8">No terminal Gate Passes found.</td></tr>`;
      return;
    }

    list.forEach(c => {
      const typeBadge = c.type === "IN" 
        ? `<span class="badge badge-in">IN (জমা)</span>` 
        : `<span class="badge badge-out">OUT (খালাস)</span>`;

      const row = document.createElement("tr");
      row.innerHTML = `
        <td><span class="font-mono text-bold">${c.id}</span></td>
        <td>${typeBadge}</td>
        <td>${c.date}</td>
        <td><a href="#" onclick="app.printSR('${c.srCode}'); return false;" class="text-blue font-mono">${c.srCode}</a></td>
        <td>${c.farmerName}</td>
        <td><strong>${c.bags} Bags</strong></td>
        <td>${c.truckNo || '—'}</td>
        <td>৳ ${c.laborCharge}</td>
        <td>${c.operator}</td>
        <td class="text-right">
          <button class="btn btn-outline btn-small" title="Print Chalan Receipt" onclick="app.printChalan('${c.id}')">
            <i data-lucide="printer"></i>
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });

    lucide.createIcons();
  }

  filterGatepass() {
    const query = document.getElementById("gatepass-search").value.toLowerCase();
    const typeFilter = document.getElementById("gatepass-filter-type").value;

    const filtered = this.state.chalans.filter(c => {
      const matchQuery = c.farmerName.toLowerCase().includes(query) || 
                          c.id.toLowerCase().includes(query) || 
                          c.srCode.toLowerCase().includes(query) ||
                          (c.truckNo && c.truckNo.toLowerCase().includes(query));
      const matchType = typeFilter === "" || c.type === typeFilter;
      return matchQuery && matchType;
    });

    this.renderGatepassTable(filtered);
  }

  populateChalanFormSRs() {
    const dropdown = document.getElementById("chalan-sr-code");
    dropdown.innerHTML = `<option value="">-- Choose SR Book --</option>`;
    
    const type = document.getElementById("chalan-type").value;
    
    const eligible = this.state.bookings.filter(b => {
      if (type === "OUT") {
        return b.storedBags > 0;
      }
      return true;
    });

    eligible.forEach(b => {
      const opt = document.createElement("option");
      opt.value = b.srCode;
      opt.textContent = `${b.srCode} - ${b.farmerName} (${b.storedBags} Bags Stored)`;
      dropdown.appendChild(opt);
    });
  }

  onChalanTypeSelect() {
    this.populateChalanFormSRs();
    document.getElementById("chalan-farmer-name").value = "";
    document.getElementById("chalan-available-bags").value = "";
  }

  onChalanSRSelect() {
    const srCode = document.getElementById("chalan-sr-code").value;
    const booking = this.state.bookings.find(b => b.srCode === srCode);
    
    if (booking) {
      document.getElementById("chalan-farmer-name").value = booking.farmerName;
      document.getElementById("chalan-available-bags").value = booking.storedBags;
      document.getElementById("chalan-bags").max = booking.storedBags;
      if (document.getElementById("chalan-type").value === "OUT") {
        document.getElementById("chalan-bags").value = booking.storedBags;
      } else {
        document.getElementById("chalan-bags").value = 100;
      }
    } else {
      document.getElementById("chalan-farmer-name").value = "";
      document.getElementById("chalan-available-bags").value = "";
    }
  }

  async handleNewChalan(e) {
    e.preventDefault();

    const srCode = document.getElementById("chalan-sr-code").value;
    const booking = this.state.bookings.find(b => b.srCode === srCode);
    if (!booking) return;

    const bags = parseInt(document.getElementById("chalan-bags").value);
    const type = document.getElementById("chalan-type").value;

    if (type === "OUT") {
      if (bags > booking.storedBags) {
        alert("Error: Quantity exceeds remaining stored inventory!");
        return;
      }
      
      // Validation: Block release of bags if there is an active Dadan loan
      const activeLoan = this.state.loans.find(l => l.srCode === srCode && l.status === "Active");
      if (activeLoan) {
        alert("Blocked: This Storage Receipt is pledged as collateral for an outstanding Dadan Loan. Please settle the loan balance first.");
        return;
      }
    }

    const laborRate = parseInt(document.getElementById("chalan-labor-charge").value) || 8;
    const newChalan = {
      type: type,
      date: `${CURRENT_DATE_STRING} 11:30 AM`,
      srCode: srCode,
      farmerName: booking.farmerName,
      bags: bags,
      truckNo: document.getElementById("chalan-truck").value || "N/A",
      laborCharge: bags * laborRate,
      operator: document.getElementById("chalan-operator").value || "Abu Zannat"
    };

    try {
      const res = await this.apiFetch('/api/chalans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newChalan)
      });
      if (res.ok) {
        await this.refreshState();
        this.closeModal("modal-chalan");
        
        this.renderGatepassTable();
        this.renderBookingsTable();
        this.renderDashboard();
        
        document.getElementById("form-new-chalan").reset();
        
        confetti({
          particleCount: 80,
          colors: ["#3b82f6", "#10b981"]
        });
      } else {
        const err = await res.json();
        alert("Server failed to create chalan: " + (err.error || "Unknown Error"));
      }
    } catch (err) {
      alert("Network error: " + err.message);
    }
  }

  // ================= SETTLE LEDGER & RELEASE BILLS =================
  openReleaseLedger(srCode) {
    const booking = this.state.bookings.find(b => b.srCode === srCode);
    if (!booking) return;

    // Calculate rent
    const rentAmount = booking.storedBags * booking.rentRate;
    
    // Check if there is an active Dadan loan
    const loan = this.state.loans.find(l => l.srCode === srCode && l.status === "Active");
    const loanPrincipal = loan ? loan.principal : 0;
    const loanInterest = loan ? this.calculateAccruedInterest(loan.principal, loan.interestRate, l.disbursementDate) : 0;
    
    const advancePaid = booking.advance || 0;
    const totalDue = rentAmount + loanPrincipal + loanInterest - advancePaid;

    // Set form fields
    document.getElementById("release-sr-code").value = srCode;
    document.getElementById("release-lbl-farmer").textContent = booking.farmerName;
    document.getElementById("release-lbl-sr").textContent = booking.srCode;
    document.getElementById("release-lbl-bags").textContent = `${booking.storedBags} Bags`;
    
    document.getElementById("release-val-rent").textContent = `৳ ${rentAmount.toLocaleString()}`;
    document.getElementById("release-val-loan").textContent = `৳ ${loanPrincipal.toLocaleString()}`;
    document.getElementById("release-val-interest").textContent = `৳ ${loanInterest.toLocaleString()}`;
    document.getElementById("release-val-advance").textContent = `- ৳ ${advancePaid.toLocaleString()}`;
    
    document.getElementById("release-val-total").textContent = `৳ ${totalDue.toLocaleString()}`;
    document.getElementById("release-amount-paid").value = totalDue;

    this.openModal("modal-release");
  }

  async handleSettleRelease(e) {
    e.preventDefault();

    const srCode = document.getElementById("release-sr-code").value;
    const booking = this.state.bookings.find(b => b.srCode === srCode);
    if (!booking) return;

    const amountPaid = parseInt(document.getElementById("release-amount-paid").value);
    const remainingBags = booking.storedBags;

    try {
      const res = await this.apiFetch('/api/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ srCode, amountPaid })
      });
      if (res.ok) {
        // Optimistic print model
        const printBooking = JSON.parse(JSON.stringify(booking));

        await this.refreshState();
        this.closeModal("modal-release");
        
        this.renderBookingsTable();
        this.renderLoansTable();
        this.renderGatepassTable();
        this.renderDashboard();

        // Trigger Print Receipt Modal after settlement
        this.printSettlementReceipt(printBooking, remainingBags, amountPaid);

        confetti({
          particleCount: 200,
          spread: 100,
          origin: { y: 0.4 }
        });
      } else {
        const err = await res.json();
        alert("Server failed to settle: " + (err.error || "Unknown Error"));
      }
    } catch (err) {
      alert("Network error: " + err.message);
    }
  }

  // ================= PRINT DOCUMENT TEMPLATES =================
  printSR(srCode) {
    const booking = this.state.bookings.find(b => b.srCode === srCode);
    if (!booking) return;

    const activeLoan = this.state.loans.find(l => l.srCode === srCode && l.status === "Active");
    const loanText = activeLoan ? `৳ ${activeLoan.principal.toLocaleString()}` : "N/A (No Loan)";

    const printArea = document.getElementById("print-content");
    printArea.innerHTML = `
      <div class="print-receipt">
        <div class="receipt-header">
          <h1>SHEBA COLD STORAGE LTD.</h1>
          <h3>সেবা কোল্ড স্টোরেজ লিমিটেড</h3>
          <p>Joypurhat Road, Sadar, Joypurhat, Bangladesh | Phone: +880 1712-345678</p>
          <p><strong>OFFICIAL STORAGE RECEIPT (এস. আর. কপি)</strong></p>
        </div>
        
        <div class="receipt-meta">
          <div>
            <p><strong>Receipt (SR) Number:</strong> <span class="font-mono">${booking.srCode}</span></p>
            <p><strong>Farmer/Trader Name:</strong> ${booking.farmerName}</p>
            <p><strong>Phone Number:</strong> ${booking.phone}</p>
            <p><strong>NID Card ID:</strong> ${booking.nid}</p>
            <p><strong>Village Address:</strong> ${booking.address}</p>
          </div>
          <div style="text-align: right;">
            <p><strong>Booking Date:</strong> ${booking.date}</p>
            <p><strong>Chamber / Location:</strong> ${booking.chamber} / ${booking.rack}</p>
            <p><strong>Receipt Status:</strong> ${booking.status}</p>
            <p><strong>Pledged Loan Value:</strong> ${loanText}</p>
          </div>
        </div>

        <table class="receipt-table">
          <thead>
            <tr>
              <th>Description (বিবরণ)</th>
              <th>Variety (জাত)</th>
              <th>Rent Rate / Bag</th>
              <th>Booked Bags (বস্তা)</th>
              <th>Storage Location</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Agricultural Cold Storage Goods</td>
              <td>${booking.crop}</td>
              <td>৳ ${booking.rentRate} / Season</td>
              <td><strong>${booking.totalBags} Bags</strong></td>
              <td>${booking.chamber} (Rack ${booking.rack})</td>
            </tr>
          </tbody>
        </table>

        <div class="receipt-summary">
          <div class="receipt-summary-row">
            <span>Standard Est. Rent:</span>
            <strong>৳ ${(booking.totalBags * booking.rentRate).toLocaleString()}</strong>
          </div>
          <div class="receipt-summary-row">
            <span>Advance Deposited:</span>
            <strong style="color: #111;">- ৳ ${booking.advance.toLocaleString()}</strong>
          </div>
          <div class="receipt-summary-row total">
            <span>Balance Rent Due:</span>
            <strong>৳ ${(booking.totalBags * booking.rentRate - booking.advance).toLocaleString()}</strong>
          </div>
        </div>

        <div style="border: 1px dashed #444; padding: 12px; font-size: 0.75rem; line-height: 1.5; margin-bottom: 30px;">
          <strong>শর্তাবলী (Terms & Conditions):</strong><br>
          ১. বস্তা জমা দেওয়ার শেষ তারিখ হতে সর্বোচ্চ ৬ মাসের মধ্যে মালামাল খালাস করতে হবে।<br>
          ২. প্রাকৃতিক বিপর্যয় বা অতিবৃষ্টির কারণে কোনো ক্ষতি হলে কর্তৃপক্ষ দায়ী থাকিবে না।<br>
          ৩. ঋণ ও ভাড়ার টাকা সম্পূর্ণ পরিশোধ সাপেক্ষে আলু ডেলিভারি প্রদান করা হবে।
        </div>

        <div class="receipt-signatures">
          <div>Customer / Depositor Signature</div>
          <div>Authorized Officer Signature</div>
        </div>
      </div>
    `;

    this.openModal("modal-print-preview");
  }

  printChalan(chalanId) {
    const chalan = this.state.chalans.find(c => c.id === chalanId);
    if (!chalan) return;

    const printArea = document.getElementById("print-content");
    printArea.innerHTML = `
      <div class="print-receipt">
        <div class="receipt-header">
          <h1>SHEBA COLD STORAGE LTD.</h1>
          <h3>গেট পাস ও ডেলিভারি চালান</h3>
          <p>Joypurhat Road, Sadar, Joypurhat, Bangladesh | Phone: +880 1712-345678</p>
        </div>

        <div class="receipt-meta">
          <div>
            <p><strong>Chalan Serial Code:</strong> <span class="font-mono">${chalan.id}</span></p>
            <p><strong>Operation Category:</strong> ${chalan.type === 'IN' ? 'RECEIVE ENTRY (আলু জমা)' : 'RELEASE DELIVERY (আলু খালাস)'}</p>
            <p><strong>Associated SR ID:</strong> ${chalan.srCode}</p>
            <p><strong>Farmer / Merchant:</strong> ${chalan.farmerName}</p>
          </div>
          <div style="text-align: right;">
            <p><strong>Issue Date/Time:</strong> ${chalan.date}</p>
            <p><strong>Truck/Vehicle No:</strong> ${chalan.truckNo || 'N/A'}</p>
            <p><strong>Recorded By:</strong> ${chalan.operator}</p>
          </div>
        </div>

        <table class="receipt-table">
          <thead>
            <tr>
              <th>Item Details</th>
              <th>Operation</th>
              <th style="text-align: right;">Porter Labor Cost</th>
              <th style="text-align: right;">Quantity (বস্তা)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Cold Storage Agricultural Sacks</td>
              <td>${chalan.type === 'IN' ? 'Stock Intake' : 'Release Gate Pass'}</td>
              <td style="text-align: right;">৳ ${chalan.laborCharge}</td>
              <td style="text-align: right;"><strong>${chalan.bags} Bags</strong></td>
            </tr>
          </tbody>
        </table>

        <div class="receipt-signatures" style="margin-top: 100px;">
          <div>Driver/Carrier Signature</div>
          <div>Gate In-Charge / Operator</div>
        </div>
      </div>
    `;

    this.openModal("modal-print-preview");
  }

  printSettlementReceipt(booking, bagsReleased, amountPaid) {
    // Calculate final stats for printing
    const rentAmount = bagsReleased * booking.rentRate;
    const loan = this.state.loans.find(l => l.srCode === booking.srCode);
    const loanPrincipal = loan ? loan.principal : 0;
    const loanInterest = loan ? this.calculateAccruedInterest(loan.principal, loan.interestRate, loan.disbursementDate) : 0;
    const totalDue = rentAmount + loanPrincipal + loanInterest - booking.advance;

    const printArea = document.getElementById("print-content");
    printArea.innerHTML = `
      <div class="print-receipt">
        <div class="receipt-header">
          <h1>SHEBA COLD STORAGE LTD.</h1>
          <h3>ফাইনাল পেমেন্ট ও রিলিজ ভাউচার</h3>
          <p>Joypurhat Road, Sadar, Joypurhat, Bangladesh | Phone: +880 1712-345678</p>
        </div>

        <div class="receipt-meta">
          <div>
            <p><strong>Voucher Serial Code:</strong> <span class="font-mono">REC-${CURRENT_DATE_STRING}-${booking.srCode}</span></p>
            <p><strong>Farmer Name:</strong> ${booking.farmerName}</p>
            <p><strong>Phone Number:</strong> ${booking.phone}</p>
          </div>
          <div style="text-align: right;">
            <p><strong>Settlement Date:</strong> ${CURRENT_DATE_STRING}</p>
            <p><strong>Receipt SR ID:</strong> ${booking.srCode}</p>
            <p><strong>Settled Stock Quantity:</strong> ${bagsReleased} Bags</p>
          </div>
        </div>

        <table class="receipt-table">
          <thead>
            <tr>
              <th>Ledger Item (খাত)</th>
              <th style="text-align: right;">Rate / Principal</th>
              <th style="text-align: right;">Interest/Discount</th>
              <th style="text-align: right;">Total Amount (টাকা)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Cold Storage Rent (${bagsReleased} Bags)</td>
              <td style="text-align: right;">৳ ${booking.rentRate}/Bag</td>
              <td style="text-align: right;">—</td>
              <td style="text-align: right;">৳ ${rentAmount.toLocaleString()}</td>
            </tr>
            ${loanPrincipal > 0 ? `
              <tr>
                <td>Dadan Loan Principal Recovery</td>
                <td style="text-align: right;">৳ ${loanPrincipal.toLocaleString()}</td>
                <td style="text-align: right;">—</td>
                <td style="text-align: right;">৳ ${loanPrincipal.toLocaleString()}</td>
              </tr>
              <tr>
                <td>Dadan Interest Accrued (Simple Interest)</td>
                <td style="text-align: right;">${loan.interestRate}%</td>
                <td style="text-align: right;">—</td>
                <td style="text-align: right;">৳ ${loanInterest.toLocaleString()}</td>
              </tr>
            ` : ''}
            <tr>
              <td>Advance Deductions</td>
              <td style="text-align: right;">—</td>
              <td style="text-align: right; color: green;">- ৳ ${booking.advance.toLocaleString()}</td>
              <td style="text-align: right; color: green;">- ৳ ${booking.advance.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        <div class="receipt-summary">
          <div class="receipt-summary-row">
            <span>Net Payable Calculated:</span>
            <strong>৳ ${totalDue.toLocaleString()}</strong>
          </div>
          <div class="receipt-summary-row total">
            <span>Amount Received (আদায়কৃত):</span>
            <strong style="color: green;">৳ ${amountPaid.toLocaleString()}</strong>
          </div>
          <div class="receipt-summary-row" style="border-top:1px dashed #1a1a1a;">
            <span>Outstanding Balance:</span>
            <strong>৳ ${(totalDue - amountPaid).toLocaleString()}</strong>
          </div>
        </div>

        <p style="font-size: 0.8rem; text-align: center; font-style: italic; margin-top: 40px;">
          Thank you for storing with us. All goods under ${booking.srCode} have been successfully verified, settled, and released.
        </p>

        <div class="receipt-signatures" style="margin-top: 60px;">
          <div>Customer Signature</div>
          <div>Terminal Manager / Cashier</div>
        </div>
      </div>
    `;

    this.openModal("modal-print-preview");
  }

  // ================= FINANCIAL AUDITING PANEL =================
  renderReportsPanel() {
    // Rent aggregates
    const collectedRent = this.state.chalans
      .filter(c => c.type === "OUT")
      .reduce((sum, c) => {
        const booking = this.state.bookings.find(b => b.srCode === c.srCode);
        return sum + (c.bags * (booking ? booking.rentRate : STORAGE_RENT_RATE));
      }, 0);

    const accruedRent = this.state.bookings.reduce((sum, b) => {
      return sum + (b.storedBags * b.rentRate);
    }, 0);

    // Interest recovered
    const activeLoans = this.state.loans.filter(l => l.status === "Active");
    const activeInterest = activeLoans.reduce((sum, l) => {
      return sum + this.calculateAccruedInterest(l.principal, l.interestRate, l.disbursementDate);
    }, 0);
    
    const clearedLoans = this.state.loans.filter(l => l.status === "Settle Cleared");
    const recoveredPrincipal = clearedLoans.reduce((sum, l) => sum + l.principal, 0);
    const recoveredInterest = clearedLoans.reduce((sum, l) => {
      return sum + this.calculateAccruedInterest(l.principal, l.interestRate, l.disbursementDate);
    }, 0);

    // Porter/Labor Costs
    const laborCosts = this.state.chalans.reduce((sum, c) => sum + c.laborCharge, 0);

    const recoveredTotal = recoveredPrincipal + recoveredInterest;

    // Update Report panel items
    document.getElementById("report-collected-rent").textContent = `৳ ${collectedRent.toLocaleString()}`;
    document.getElementById("report-accrued-rent").textContent = `৳ ${accruedRent.toLocaleString()}`;
    document.getElementById("report-recovered-interest").textContent = `৳ ${recoveredTotal.toLocaleString()} (Principal: ৳${recoveredPrincipal.toLocaleString()}, Interest: ৳${recoveredInterest.toLocaleString()})`;
    document.getElementById("report-labor-expenses").textContent = `৳ ${laborCosts.toLocaleString()}`;

    // Render Chamber Utilization & Safety Analysis
    const healthContainer = document.getElementById("chamber-utilization-bars");
    if (healthContainer) {
      healthContainer.innerHTML = "";
      this.state.chambers.forEach(c => {
        const occupied = c.racks.reduce((sum, r) => sum + r.stored, 0);
        const occupancy = c.capacity > 0 ? Math.round((occupied / c.capacity) * 100) : 0;
        
        const healthItem = document.createElement("div");
        healthItem.className = "health-item";
        healthItem.innerHTML = `
          <div class="lbl-row">
            <span>${c.name} Capacity</span>
            <span>${occupied.toLocaleString()} / ${c.capacity.toLocaleString()} Bags</span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar ${occupancy > 90 ? 'bg-red' : occupancy > 70 ? 'bg-blue' : 'bg-green'}" style="width: ${occupancy}%"></div>
          </div>
        `;
        healthContainer.appendChild(healthItem);
      });
    }
  }

  // ================= DYNAMIC HELPERS & PRINTING =================
  updateHeaderSensors() {
    const container = document.getElementById("header-sensors");
    if (!container) return;
    container.innerHTML = "";
    
    this.state.chambers.forEach(c => {
      const isDanger = c.temp > 4.0;
      const badge = document.createElement("div");
      badge.className = `sensor-badge ${isDanger ? 'danger' : 'success'}`;
      badge.title = `${c.name} Sensor`;
      badge.innerHTML = `
        <span class="sensor-dot ${isDanger ? 'pulsing' : ''}"></span>
        <span class="sensor-label">${c.id.replace("Chamber-", "Ch-")} Temp:</span>
        <span class="sensor-value">${c.temp} °C</span>
      `;
      container.appendChild(badge);
    });
  }

  startTelemetrySimulation() {
    setInterval(() => {
      this.state.chambers.forEach(c => {
        // Randomly fluctuate temp by +/- 0.1°C within 2.0 to 4.5°C
        const change = (Math.random() - 0.5) * 0.2;
        c.temp = Math.max(2.0, Math.min(4.5, Math.round((c.temp + change) * 10) / 10));
      });
      this.saveState();
      this.updateHeaderSensors();
      if (this.currentChamberId) {
        this.renderRackGrid();
      }
    }, 10000);
  }

  async runVentilation() {
    const chamber = this.state.chambers.find(c => c.id === this.currentChamberId);
    if (!chamber) return;
    
    const btn = document.getElementById("run-ventilation-btn");
    const statusText = document.getElementById("ventilation-status");
    const fanIcon = btn.querySelector("i") || btn.querySelector("svg");
    
    btn.disabled = true;
    statusText.textContent = "Running ventilation fans...";
    statusText.classList.add("text-warning");
    
    if (fanIcon) {
      fanIcon.classList.add("spin-animation");
    }
    
    setTimeout(async () => {
      // Cool the chamber temp down towards safe levels
      const newTemp = Math.max(2.0, Math.round((chamber.temp - 1.2) * 10) / 10);
      const newHumidity = Math.max(85, chamber.humidity - 2);
      
      try {
        const res = await this.apiFetch('/api/ventilation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chamberId: chamber.id,
            temp: newTemp,
            humidity: newHumidity
          })
        });
        if (res.ok) {
          await this.refreshState();
          this.renderChambersPanel();
          
          btn.disabled = false;
          statusText.textContent = "Ventilation complete. Temperature stabilized.";
          statusText.classList.remove("text-warning");
          statusText.classList.add("text-success");
          
          if (fanIcon) {
            fanIcon.classList.remove("spin-animation");
          }
          
          // Update header real-time sensors
          this.updateHeaderSensors();
          
          // Visual feedback particles
          confetti({
            particleCount: 50,
            spread: 40,
            colors: ["#10b981", "#3b82f6"]
          });
        } else {
          alert("Error sending ventilation controls to SQL server.");
          btn.disabled = false;
        }
      } catch (err) {
        alert("Network error: " + err.message);
        btn.disabled = false;
      }
    }, 2000);
  }

  openDisburseLoanDirect(srCode) {
    this.openModal("modal-loan");
    this.populateLoanFormSRs();
    document.getElementById("loan-sr-code").value = srCode;
    this.onLoanSRSelect();
  }

  openGatePassDirect(srCode) {
    this.openModal("modal-chalan");
    this.populateChalanFormSRs();
    document.getElementById("chalan-sr-code").value = srCode;
    this.onChalanSRSelect();
  }

  printFinancialReport() {
    const totalBagsStored = this.state.bookings.reduce((sum, b) => sum + b.storedBags, 0);
    const activeLoans = this.state.loans.filter(l => l.status === "Active");
    const totalLoansOutstanding = activeLoans.reduce((sum, l) => sum + l.principal, 0);
    
    const collectedRent = this.state.chalans
      .filter(c => c.type === "OUT")
      .reduce((sum, c) => {
        const booking = this.state.bookings.find(b => b.srCode === c.srCode);
        return sum + (c.bags * (booking ? booking.rentRate : STORAGE_RENT_RATE));
      }, 0);

    const accruedRent = this.state.bookings.reduce((sum, b) => {
      return sum + (b.storedBags * b.rentRate);
    }, 0);

    const activeInterest = activeLoans.reduce((sum, l) => {
      return sum + this.calculateAccruedInterest(l.principal, l.interestRate, l.disbursementDate);
    }, 0);
    
    const clearedLoans = this.state.loans.filter(l => l.status === "Settle Cleared");
    const recoveredPrincipal = clearedLoans.reduce((sum, l) => sum + l.principal, 0);
    const recoveredInterest = clearedLoans.reduce((sum, l) => {
      return sum + this.calculateAccruedInterest(l.principal, l.interestRate, l.disbursementDate);
    }, 0);

    const laborCosts = this.state.chalans.reduce((sum, c) => sum + c.laborCharge, 0);
    
    const totalNetCapitalOut = this.state.loans.reduce((sum, l) => sum + l.principal, 0);
    const totalCapitalRecovered = recoveredPrincipal;

    const printArea = document.getElementById("print-content");
    printArea.innerHTML = `
      <div class="print-receipt">
        <div class="receipt-header">
          <h1>SHEBA COLD STORAGE LTD.</h1>
          <h3>ঋতুভিত্তিক হিসাব বিবরণী ও নিরীক্ষা রিপোর্ট</h3>
          <p>Joypurhat Road, Sadar, Joypurhat, Bangladesh | Phone: +880 1712-345678</p>
          <p><strong>SEASONAL FINANCIAL AUDIT REPORT</strong></p>
        </div>

        <div class="receipt-meta">
          <div>
            <p><strong>Report Type:</strong> Seasonal Financial Performance Summary</p>
            <p><strong>Generated On:</strong> ${CURRENT_DATE_STRING}</p>
            <p><strong>Active Season:</strong> Season 2026</p>
          </div>
          <div style="text-align: right;">
            <p><strong>Active Stored Sacks:</strong> ${totalBagsStored.toLocaleString()} Bags</p>
            <p><strong>Active Dadan Farmers:</strong> ${activeLoans.length} Farmers</p>
            <p><strong>Total Outstanding Loans:</strong> ৳ ${totalLoansOutstanding.toLocaleString()}</p>
          </div>
        </div>

        <table class="receipt-table">
          <thead>
            <tr>
              <th>Revenue & Asset Ledger (আয় ও বন্ধক বিবরণী)</th>
              <th style="text-align: right;">Realized Cash (আদায়কৃত)</th>
              <th style="text-align: right;">Accrued/Expected (সম্ভাব্য)</th>
              <th style="text-align: right;">Total / Summary</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Cold Storage Rent Revenue</td>
              <td style="text-align: right;">৳ ${collectedRent.toLocaleString()}</td>
              <td style="text-align: right;">৳ ${accruedRent.toLocaleString()}</td>
              <td style="text-align: right;"><strong>৳ ${(collectedRent + accruedRent).toLocaleString()}</strong></td>
            </tr>
            <tr>
              <td>Dadan Loan Capital Disbursed</td>
              <td style="text-align: right;">—</td>
              <td style="text-align: right;">—</td>
              <td style="text-align: right; color: #ef4444;">- ৳ ${totalNetCapitalOut.toLocaleString()}</td>
            </tr>
            <tr>
              <td>Dadan Loan Capital Recovered</td>
              <td style="text-align: right; color: green;">৳ ${recoveredPrincipal.toLocaleString()}</td>
              <td style="text-align: right;">৳ ${totalLoansOutstanding.toLocaleString()} (Active)</td>
              <td style="text-align: right;"><strong>৳ ${totalNetCapitalOut.toLocaleString()}</strong></td>
            </tr>
            <tr>
              <td>Dadan Simple Interest Earned</td>
              <td style="text-align: right;">৳ ${recoveredInterest.toLocaleString()}</td>
              <td style="text-align: right;">৳ ${activeInterest.toLocaleString()}</td>
              <td style="text-align: right;"><strong>৳ ${(recoveredInterest + activeInterest).toLocaleString()}</strong></td>
            </tr>
            <tr>
              <td>Labor & Porter Costs (Kuli)</td>
              <td style="text-align: right; color: #ef4444;">- ৳ ${laborCosts.toLocaleString()}</td>
              <td style="text-align: right;">—</td>
              <td style="text-align: right; color: #ef4444;">- ৳ ${laborCosts.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        <div class="receipt-summary" style="margin-top: 20px;">
          <div class="receipt-summary-row">
            <span>Total Realized Income (Less Labor Costs):</span>
            <strong style="color: green;">৳ ${(collectedRent + recoveredInterest - laborCosts).toLocaleString()}</strong>
          </div>
          <div class="receipt-summary-row">
            <span>Total Accrued Income (Expected Rent & Interest):</span>
            <strong style="color: #3b82f6;">৳ ${(accruedRent + activeInterest).toLocaleString()}</strong>
          </div>
          <div class="receipt-summary-row total" style="border-top: 2px solid #1a1a1a;">
            <span>Projected Seasonal Revenue:</span>
            <strong>৳ ${(collectedRent + accruedRent + recoveredInterest + activeInterest - laborCosts).toLocaleString()}</strong>
          </div>
        </div>

        <div style="margin-top: 50px; font-size: 0.8rem; line-height: 1.6;">
          <strong>Chamber Environmental Health:</strong><br>
          Chamber 01: Temp 2.4°C | Humidity 88% (OK)<br>
          Chamber 02: Temp 3.1°C | Humidity 87% (OK)<br>
          Chamber 03: Temp 4.2°C | Humidity 90% (Warm Alert)<br>
        </div>

        <div class="receipt-signatures" style="margin-top: 80px;">
          <div>Prepared By: Abu Zannat</div>
          <div>Managing Director Signature</div>
        </div>
      </div>
    `;

    this.openModal("modal-print-preview");
  }

  // ================= DATABASE AND SESSION UTILITIES =================
  checkLogin() {
    const session = sessionStorage.getItem("sheba_session");
    const overlay = document.getElementById("login-overlay");
    if (!overlay) return;
    if (!session) {
      overlay.classList.remove("hidden");
    } else {
      overlay.classList.add("hidden");
    }
  }

  async handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById("login-username").value;
    const password = document.getElementById("login-password").value;
    const errMsg = document.getElementById("login-error-msg");
    const card = document.querySelector(".login-card");

    try {
      const res = await this.apiFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (res.ok) {
        const data = await res.json();
        sessionStorage.setItem("sheba_session", data.token);
        this.checkLogin();
        
        // Refresh state from database
        await this.refreshState();
        
        // Re-render UI views
        this.renderDashboard();
        this.renderBookingsTable();
        this.renderLoansTable();
        this.renderGatepassTable();
        this.renderChambersPanel();
        this.renderReportsPanel();
        
        confetti({
          particleCount: 100,
          spread: 60
        });
      } else {
        errMsg.classList.remove("hidden");
        card.classList.add("shake-animation");
        setTimeout(() => card.classList.remove("shake-animation"), 400);
      }
    } catch (err) {
      alert("Network Connection Error: " + err.message);
    }
  }

  handleLogout() {
    if (confirm("Are you sure you want to log out of your session?")) {
      sessionStorage.removeItem("sheba_session");
      this.checkLogin();
    }
  }

  downloadBackup() {
    window.location.href = this.getApiUrl('/api/backup');
  }

  async uploadRestore(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (confirm("Overwrite Database? This will replace the active SQLite database with '" + file.name + "' and reload the page.")) {
      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const buffer = e.target.result;
          const res = await this.apiFetch('/api/restore', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/octet-stream'
            },
            body: buffer
          });
          if (res.ok) {
            alert("Database restored successfully! Reloading page...");
            window.location.reload();
          } else {
            alert("Restore failed. Invalid database file structure.");
          }
        };
        reader.readAsArrayBuffer(file);
      } catch (err) {
        alert("Restore error: " + err.message);
      }
    }
    // Clear input element
    event.target.value = "";
  }

  populateBookingChambers() {
    const chamberSelect = document.getElementById("book-chamber");
    if (!chamberSelect) return;
    
    const selectedChamber = chamberSelect.value;
    chamberSelect.innerHTML = "";
    
    this.state.chambers.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      chamberSelect.appendChild(opt);
    });
    
    if (selectedChamber && this.state.chambers.some(c => c.id === selectedChamber)) {
      chamberSelect.value = selectedChamber;
    } else if (this.state.chambers.length > 0) {
      chamberSelect.value = this.state.chambers[0].id;
    }
    
    this.populateBookingRacks();
  }

  populateBookingRacks() {
    const chamberSelect = document.getElementById("book-chamber");
    const rackSelect = document.getElementById("book-rack");
    if (!chamberSelect || !rackSelect) return;
    
    const chamberId = chamberSelect.value;
    const chamber = this.state.chambers.find(c => c.id === chamberId);
    
    rackSelect.innerHTML = "";
    if (chamber && chamber.racks) {
      chamber.racks.forEach(r => {
        const opt = document.createElement("option");
        opt.value = r.id;
        opt.textContent = `${r.name} (${r.stored}/${r.capacity} Bags)`;
        rackSelect.appendChild(opt);
      });
    }
  }

  async handleNewChamber(e) {
    e.preventDefault();
    const id = document.getElementById("chamber-new-id").value;
    const name = document.getElementById("chamber-new-name").value;
    const capacity = parseInt(document.getElementById("chamber-new-capacity").value);
    const racksCount = parseInt(document.getElementById("chamber-new-racks").value);
    const temp = parseFloat(document.getElementById("chamber-new-temp").value);
    const humidity = parseFloat(document.getElementById("chamber-new-humidity").value);

    try {
      const res = await this.apiFetch('/api/chambers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, capacity, racksCount, temp, humidity })
      });
      if (res.ok) {
        await this.refreshState();
        this.closeModal("modal-add-chamber");
        this.renderChambersPanel();
        this.renderDashboard();
        document.getElementById("form-add-chamber").reset();
        
        confetti({
          particleCount: 50,
          colors: ["#10b981", "#3b82f6"]
        });
      } else {
        const err = await res.json();
        alert("Failed to create chamber: " + (err.error || "Unknown error"));
      }
    } catch (err) {
      alert("Network error: " + err.message);
    }
  }

  async deleteChamber(chamberId) {
    if (confirm(`Are you sure you want to delete chamber '${chamberId}'? This action cannot be undone.`)) {
      try {
        const res = await this.apiFetch('/api/chambers/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chamberId })
        });
        if (res.ok) {
          await this.refreshState();
          if (this.currentChamberId === chamberId) {
            this.currentChamberId = null;
          }
          this.renderChambersPanel();
          this.renderDashboard();
          
          alert("Chamber deleted successfully!");
        } else {
          const err = await res.json();
          alert("Failed to delete chamber: " + (err.error || "Unknown error"));
        }
      } catch (err) {
        alert("Network error: " + err.message);
      }
    }
  }

  async resetDatabase() {
    if (confirm("Reset Database? This will erase all custom entries and restore the default database seeds.")) {
      try {
        const res = await this.apiFetch('/api/reset', { method: 'POST' });
        if (res.ok) {
          alert("Database factory reset completed!");
          await this.refreshState();
          window.location.reload();
        } else {
          alert("Error resetting backend SQL database.");
        }
      } catch (err) {
        alert("Network error: " + err.message);
      }
    }
  }
}

// Instantiate and initialize the app controller on window load
window.addEventListener("DOMContentLoaded", () => {
  window.app = new ColdStorageApp();
  window.app.init();
});
