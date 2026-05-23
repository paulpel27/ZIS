/**
 * MedCore ZIS - Application Controller & View Router
 */

// Application State
const state = {
  currentUser: null,
  activeView: 'dashboard',
  selectedPatientId: null,
  selectedDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
  recordsTab: 'pharmacy', // 'pharmacy' or 'labs'
  activeLabResultId: null,
  currentPatientSearch: '',
  currentPatientFilter: 'all',
  charts: {}
};

// RBAC Permissions Matrix
const ROLES = {
  SUPERUSER: 'Superuser',
  DOKTER: 'Dokter',
  APOTHEKER: 'Apotheker',
  VERPLEEGKUNDIGE: 'Verpleegkundige'
};

const PERMISSIONS = {
  // View access
  view_dashboard: [ROLES.SUPERUSER, ROLES.DOKTER, ROLES.APOTHEKER, ROLES.VERPLEEGKUNDIGE],
  view_patients: [ROLES.SUPERUSER, ROLES.DOKTER, ROLES.APOTHEKER, ROLES.VERPLEEGKUNDIGE],
  view_schedule: [ROLES.SUPERUSER, ROLES.DOKTER, ROLES.VERPLEEGKUNDIGE],
  view_records: [ROLES.SUPERUSER, ROLES.DOKTER, ROLES.APOTHEKER, ROLES.VERPLEEGKUNDIGE],
  
  // Actions
  edit_users: [ROLES.SUPERUSER],
  add_patient: [ROLES.SUPERUSER, ROLES.DOKTER],
  edit_dossier: [ROLES.SUPERUSER, ROLES.DOKTER], // Prescribing, Diagnoses
  add_visit: [ROLES.SUPERUSER, ROLES.DOKTER, ROLES.VERPLEEGKUNDIGE],
  schedule_appointment: [ROLES.SUPERUSER, ROLES.DOKTER, ROLES.VERPLEEGKUNDIGE],
  manage_inventory: [ROLES.SUPERUSER, ROLES.APOTHEKER],
  view_lab_details: [ROLES.SUPERUSER, ROLES.DOKTER, ROLES.VERPLEEGKUNDIGE],
  view_pharmacy_details: [ROLES.SUPERUSER, ROLES.DOKTER, ROLES.APOTHEKER, ROLES.VERPLEEGKUNDIGE]
};

// Check if current user has permission
function hasPermission(permissionKey) {
  if (!state.currentUser) return false;
  const permittedRoles = PERMISSIONS[permissionKey];
  return permittedRoles && permittedRoles.includes(state.currentUser.role);
}

// App Initialization
document.addEventListener("DOMContentLoaded", async () => {
  // Wait for database to initialize
  await db.open();
  
  // Initialize default user
  const adminUser = await db.users.where({ username: "admin" }).first();
  state.currentUser = adminUser || { username: "admin", role: "Superuser", name: "Administrator" };
  
  // Initialize Connection status (Online/Offline)
  updateConnectionStatus();
  window.addEventListener('online', updateConnectionStatus);
  window.addEventListener('offline', updateConnectionStatus);

  // Setup Event Listeners
  setupHeader();
  setupNavigation();
  setupGlobalEvents();
  
  // Route to initial view
  navigateTo(state.activeView);
});

// Update Online/Offline status
function updateConnectionStatus() {
  const badge = document.getElementById('connection-status');
  if (navigator.onLine) {
    badge.classList.remove('offline');
    badge.innerHTML = '<span class="dot"></span> Online';
  } else {
    badge.classList.add('offline');
    badge.innerHTML = '<span class="dot"></span> Offline-modus';
  }
}

// Setup Header Components (Switch User / Role display)
async function setupHeader() {
  const select = document.getElementById('active-role-select');
  const users = await db.users.toArray();
  
  select.innerHTML = users.map(u => 
    `<option value="${u.username}" ${state.currentUser.username === u.username ? 'selected' : ''}>${u.name} (${u.role})</option>`
  ).join('');

  select.addEventListener('change', async (e) => {
    const username = e.target.value;
    const selectedUser = await db.users.where({ username }).first();
    if (selectedUser) {
      state.currentUser = selectedUser;
      await logAction(state.currentUser.username, "USER_SWITCH", `Gebruiker gewisseld naar ${selectedUser.name}`);
      
      // Update UI components that depend on roles
      updateNavigationVisibility();
      
      // Re-route current view or go to dashboard if current view is restricted
      const currentTabBtn = document.querySelector(`.nav-item[data-view="${state.activeView}"]`);
      if (currentTabBtn && currentTabBtn.classList.contains('d-none')) {
        navigateTo('dashboard');
      } else {
        navigateTo(state.activeView);
      }
    }
  });

  updateNavigationVisibility();
}

// Hide or show bottom tabs based on permissions
function updateNavigationVisibility() {
  document.querySelectorAll('.nav-item').forEach(item => {
    const viewName = item.getAttribute('data-view');
    if (hasPermission(`view_${viewName}`)) {
      item.classList.remove('d-none');
    } else {
      item.classList.add('d-none');
    }
  });
}

// Setup SPA Navigation
function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.getAttribute('data-view');
      navigateTo(view);
    });
  });
}

// Router function
function navigateTo(viewName) {
  state.activeView = viewName;
  state.selectedPatientId = null; // Clear patient selection on tab switch
  
  // Update active state in bottom nav
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.getAttribute('data-view') === viewName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Toggle FAB visibility
  const fab = document.getElementById('global-fab');
  if (viewName === 'patients' && hasPermission('add_patient')) {
    fab.classList.remove('d-none');
    fab.innerHTML = '<i class="fas fa-user-plus"></i>';
    fab.title = "Nieuwe patiënt";
  } else if (viewName === 'schedule' && hasPermission('schedule_appointment')) {
    fab.classList.remove('d-none');
    fab.innerHTML = '<i class="fas fa-calendar-plus"></i>';
    fab.title = "Nieuwe afspraak";
  } else {
    fab.classList.add('d-none');
  }

  // Render view
  renderActiveView();
}

// Render Core routing controller
function renderActiveView() {
  const container = document.getElementById('main-content');
  container.innerHTML = ''; // Clear viewport

  // Check general view permission
  if (!hasPermission(`view_${state.activeView}`)) {
    renderUnauthorized(container);
    return;
  }

  switch(state.activeView) {
    case 'dashboard':
      renderDashboard(container);
      break;
    case 'patients':
      renderPatients(container);
      break;
    case 'schedule':
      renderSchedule(container);
      break;
    case 'records':
      renderRecords(container);
      break;
  }
}

// Render unauthorized component
function renderUnauthorized(container) {
  container.innerHTML = `
    <div class="nm-card unauthorized-card">
      <i class="fas fa-exclamation-triangle"></i>
      <h2>Geen toegang</h2>
      <p class="mt-4">Uw huidige rol (<strong>${state.currentUser.role}</strong>) heeft geen machtiging om dit scherm te bekijken.</p>
    </div>
  `;
}

// ==========================================
// 1. DASHBOARD VIEW RENDERER
// ==========================================
async function renderDashboard(container) {
  // Fetch statistics
  const patientCount = await db.patients.count();
  const criticalInventory = await db.inventory.filter(item => item.isCritical && item.stock < 100).toArray();
  
  // Find remaining appointments today
  const todayStr = new Date().toISOString().split('T')[0];
  const apptsToday = await db.appointments.where({ date: todayStr }).toArray();

  // Create template
  container.innerHTML = `
    <h1 class="mb-4">Dashboard</h1>
    
    <div class="dashboard-grid">
      <div class="nm-card stat-card hoverable" onclick="navigateTo('patients')">
        <div class="stat-icon primary"><i class="fas fa-users"></i></div>
        <div class="stat-info">
          <span class="stat-value">${patientCount}</span>
          <span class="stat-label">Patiënten</span>
        </div>
      </div>
      
      <div class="nm-card stat-card hoverable" onclick="navigateTo('schedule')">
        <div class="stat-icon success"><i class="fas fa-calendar-alt"></i></div>
        <div class="stat-info">
          <span class="stat-value">${apptsToday.length}</span>
          <span class="stat-label">Afspraken vandaag</span>
        </div>
      </div>

      <div class="nm-card stat-card hoverable" onclick="state.recordsTab = 'pharmacy'; navigateTo('records');">
        <div class="stat-icon danger"><i class="fas fa-exclamation-circle"></i></div>
        <div class="stat-info">
          <span class="stat-value">${criticalInventory.length}</span>
          <span class="stat-label">Kritieke medicijn-alerts</span>
        </div>
      </div>
    </div>

    <div class="dashboard-sections">
      <!-- Alerts Card -->
      <div class="nm-card">
        <div class="nm-card-header">
          <h3 class="nm-card-title"><i class="fas fa-bell"></i> Systeem Alerts</h3>
        </div>
        <div class="warning-list" id="warning-alerts-container">
          <!-- Critical warning messages -->
        </div>
      </div>

      <!-- Audit Logs Card -->
      <div class="nm-card">
        <div class="nm-card-header">
          <h3 class="nm-card-title"><i class="fas fa-history"></i> Recent Activiteiten Log</h3>
        </div>
        <div class="activity-list" id="activity-log-container">
          <p class="text-secondary text-center">Laden van logboeken...</p>
        </div>
      </div>
    </div>
  `;

  // Populate alerts
  const alertContainer = document.getElementById('warning-alerts-container');
  if (criticalInventory.length > 0) {
    alertContainer.innerHTML = criticalInventory.map(item => `
      <div class="warning-item">
        <i class="fas fa-exclamation-triangle"></i>
        <div>
          <strong>Lage Voorraad: ${item.medicationName}</strong><br>
          <span style="font-size:12px; color:var(--text-secondary);">Locatie: ${item.location} - Voorraad: ${item.stock} ${item.unit} (Dringend aanvullen!)</span>
        </div>
      </div>
    `).join('');
  } else {
    alertContainer.innerHTML = `
      <div class="warning-item" style="background-color:rgba(46,204,113,0.05); border-left:4px solid var(--accent-green);">
        <i class="fas fa-check-circle" style="color:var(--accent-green);"></i>
        <div>
          <strong>Geen kritieke issues</strong><br>
          <span style="font-size:12px; color:var(--text-secondary);">Alle kritieke voorraadniveaus zijn toereikend.</span>
        </div>
      </div>
    `;
  }

  // Populate activities
  const logContainer = document.getElementById('activity-log-container');
  const logs = await db.auditLogs.orderBy('timestamp').reverse().limit(10).toArray();
  if (logs.length > 0) {
    logContainer.innerHTML = logs.map(log => {
      const time = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `
        <div class="activity-item">
          <span class="activity-time">${time}</span>
          <div class="activity-detail">
            <span class="activity-user">${log.username}</span>: <strong>${log.action}</strong>
            <span class="text-secondary">${log.details}</span>
          </div>
        </div>
      `;
    }).join('');
  } else {
    logContainer.innerHTML = '<p class="text-secondary text-center">Geen activiteiten gevonden.</p>';
  }
}

// ==========================================
// 2. PATIENTS VIEW RENDERER
// ==========================================
async function renderPatients(container) {
  if (state.selectedPatientId) {
    renderPatientDetails(container, state.selectedPatientId);
    return;
  }

  // Render main index list structure
  container.innerHTML = `
    <h1 class="mb-4">Patiënten Overzicht</h1>
    
    <div class="search-filter-row">
      <div class="search-wrapper">
        <input type="text" id="patient-search-input" class="nm-input" placeholder="Zoek op naam of BSN..." value="${state.currentPatientSearch}">
      </div>
      <div class="filter-wrapper">
        <select id="patient-gender-filter" class="nm-select">
          <option value="all" ${state.currentPatientFilter === 'all' ? 'selected' : ''}>Alle geslachten</option>
          <option value="Man" ${state.currentPatientFilter === 'Man' ? 'selected' : ''}>Man</option>
          <option value="Vrouw" ${state.currentPatientFilter === 'Vrouw' ? 'selected' : ''}>Vrouw</option>
        </select>
      </div>
    </div>

    <div class="patient-grid" id="patients-list-container">
      <!-- Grid items dynamically rendered -->
    </div>
  `;

  // Load and render patient grid items
  const renderList = async () => {
    const listContainer = document.getElementById('patients-list-container');
    const query = state.currentPatientSearch.toLowerCase().trim();
    
    let patients = await db.patients.toArray();

    // Filter by search query
    if (query) {
      patients = patients.filter(p => 
        p.name.toLowerCase().includes(query) || 
        p.bsn.includes(query)
      );
    }

    // Filter by gender
    if (state.currentPatientFilter !== 'all') {
      patients = patients.filter(p => p.gender === state.currentPatientFilter);
    }

    if (patients.length === 0) {
      listContainer.innerHTML = `
        <div class="nm-card text-center" style="grid-column: 1 / -1;">
          <p class="text-secondary">Geen patiënten gevonden die voldoen aan de zoekcriteria.</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = patients.map(p => `
      <div class="nm-card hoverable" style="cursor:pointer;" onclick="selectPatient(${p.id})">
        <div class="nm-card-header">
          <span style="font-weight:800; font-size:15px; color:var(--primary-color);">${p.name}</span>
          <span class="nm-badge nm-badge-primary">BSN ${p.bsn}</span>
        </div>
        <div class="patient-card-body">
          <span class="patient-info-label">Geb. Datum:</span>
          <span class="patient-info-val">${formatDate(p.dob)}</span>
          <span class="patient-info-label">Geslacht:</span>
          <span class="patient-info-val">${p.gender}</span>
          <span class="patient-info-label">Telefoon:</span>
          <span class="patient-info-val">${p.phone}</span>
        </div>
      </div>
    `).join('');
  };

  await renderList();

  // Search/Filter Event Listeners
  document.getElementById('patient-search-input').addEventListener('input', (e) => {
    state.currentPatientSearch = e.target.value;
    renderList();
  });

  document.getElementById('patient-gender-filter').addEventListener('change', (e) => {
    state.currentPatientFilter = e.target.value;
    renderList();
  });
}

function selectPatient(id) {
  state.selectedPatientId = id;
  renderActiveView();
}

// Helper date formatting
function formatDate(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ==========================================
// 3. PATIENT DETAIL VIEW (EPD & TIMELINE)
// ==========================================
async function renderPatientDetails(container, patientId) {
  const patient = await db.patients.get(patientId);
  if (!patient) {
    container.innerHTML = `
      <div class="nm-card text-center">
        <p class="text-secondary">Patiënt niet gevonden.</p>
        <button class="nm-btn mt-4" onclick="selectPatient(null)">Terug naar lijst</button>
      </div>
    `;
    return;
  }

  // Load patient dossier, visits, and lab results
  const dossier = await db.dossiers.where({ patientId }).first() || { diagnoses: [], treatments: [], medications: [] };
  const visits = await db.visits.where({ patientId }).toArray();
  const labs = await db.labResults.where({ patientId }).toArray();

  container.innerHTML = `
    <div style="display:flex; align-items:center; gap:16px; margin-bottom: 20px;">
      <button class="nm-btn" onclick="selectPatient(null)" style="border-radius:50%; width:42px; height:42px; padding:0; display:flex; justify-content:center; align-items:center;">
        <i class="fas fa-arrow-left"></i>
      </button>
      <div>
        <h1 style="font-size:22px; font-weight:800; line-height:1.2;">${patient.name}</h1>
        <span class="text-secondary" style="font-size:13px; font-weight:600;">BSN: ${patient.bsn} | Geb. datum: ${formatDate(patient.dob)} (${patient.gender})</span>
      </div>
    </div>

    <!-- Sub Navigation inside Patient Detail -->
    <div class="sub-tabs">
      <button class="sub-tab-btn active" onclick="switchPatientTab(this, 'epd')">Medisch Dossier (EPD)</button>
      <button class="sub-tab-btn" onclick="switchPatientTab(this, 'visits')">Bezoekgeschiedenis (${visits.length})</button>
      <button class="sub-tab-btn" onclick="switchPatientTab(this, 'labs')">Lab Resultaten (${labs.length})</button>
    </div>

    <!-- Patient Tab Content Area -->
    <div id="patient-tab-content">
      <!-- Initialized to EPD -->
    </div>
  `;

  // Default display EPD tab
  showPatientEpdTab(patient, dossier);
}

// Switch between sub-tabs
function switchPatientTab(btnElement, tabName) {
  // Highlight active button
  btnElement.parentElement.querySelectorAll('.sub-tab-btn').forEach(btn => btn.classList.remove('active'));
  btnElement.classList.add('active');

  const contentDiv = document.getElementById('patient-tab-content');
  contentDiv.innerHTML = '';

  const patientId = state.selectedPatientId;

  // Retrieve data again (to ensure fresh state on switch)
  Promise.all([
    db.patients.get(patientId),
    db.dossiers.where({ patientId }).first(),
    db.visits.where({ patientId }).toArray(),
    db.labResults.where({ patientId }).toArray()
  ]).then(([patient, dossier, visits, labs]) => {
    const safeDossier = dossier || { diagnoses: [], treatments: [], medications: [] };
    
    if (tabName === 'epd') {
      showPatientEpdTab(patient, safeDossier);
    } else if (tabName === 'visits') {
      showPatientVisitsTab(patient, visits);
    } else if (tabName === 'labs') {
      showPatientLabsTab(patient, labs);
    }
  });
}

// Tab 1: EPD View
function showPatientEpdTab(patient, dossier) {
  const contentDiv = document.getElementById('patient-tab-content');
  
  // Demarcate edit buttons visibility based on Dokter/Admin privileges
  const canEdit = hasPermission('edit_dossier');

  contentDiv.innerHTML = `
    <div class="grid-2">
      <!-- Column 1: Patient demographics & Diagnoses -->
      <div>
        <div class="nm-card">
          <div class="nm-card-header">
            <h3 class="nm-card-title"><i class="fas fa-id-card"></i> Patiënt Info</h3>
          </div>
          <div class="patient-card-body" style="grid-template-columns: 100px 1fr; gap: 10px;">
            <span class="patient-info-label">Adres:</span>
            <span class="patient-info-val">${patient.address || '-'}</span>
            <span class="patient-info-label">Telefoon:</span>
            <span class="patient-info-val">${patient.phone || '-'}</span>
            <span class="patient-info-label">E-mail:</span>
            <span class="patient-info-val">${patient.email || '-'}</span>
          </div>
        </div>

        <div class="nm-card">
          <div class="nm-card-header">
            <h3 class="nm-card-title"><i class="fas fa-stethoscope"></i> Diagnoses</h3>
            ${canEdit ? `<button class="nm-btn" style="padding:6px 12px; font-size:11px;" onclick="openAddDiagnosisModal()"><i class="fas fa-plus"></i></button>` : ''}
          </div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${dossier.diagnoses && dossier.diagnoses.length > 0 ? dossier.diagnoses.map(d => `
              <div class="nm-card" style="box-shadow: var(--shadow-small-pressed); padding:12px; margin:0;">
                <div style="display:flex; justify-content:between; align-items:center;">
                  <strong>${d.name} (${d.code})</strong>
                  <span class="nm-badge ${d.status === 'Actief' ? 'nm-badge-danger' : 'nm-badge-success'}">${d.status}</span>
                </div>
                <div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">Geregistreerd op: ${formatDate(d.date)}</div>
              </div>
            `).join('') : '<p class="text-secondary text-center" style="padding:10px;">Geen actieve diagnoses geregistreerd.</p>'}
          </div>
        </div>
      </div>

      <!-- Column 2: Actuele Medicatie & Treatments -->
      <div>
        <div class="nm-card">
          <div class="nm-card-header">
            <h3 class="nm-card-title"><i class="fas fa-pills"></i> Actuele Medicatie</h3>
            ${canEdit ? `<button class="nm-btn" style="padding:6px 12px; font-size:11px;" onclick="openPrescribeModal()"><i class="fas fa-plus"></i> Voorschrijven</button>` : ''}
          </div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${dossier.medications && dossier.medications.length > 0 ? dossier.medications.map(m => `
              <div class="nm-card" style="box-shadow: var(--shadow-small-pressed); padding:12px; margin:0;">
                <div style="display:flex; justify-content:between; align-items:center;">
                  <strong>${m.name}</strong>
                  <span class="nm-badge ${m.status === 'Actief' ? 'nm-badge-primary' : 'nm-badge-warning'}">${m.status}</span>
                </div>
                <div style="font-size:13px; margin:4px 0;">Dosering: <strong>${m.dosage}</strong> | Schema: <strong>${m.frequency}</strong></div>
                <div style="font-size:11px; color:var(--text-secondary);">Voorgeschreven door: ${m.prescribedBy || 'Arts'}</div>
              </div>
            `).join('') : '<p class="text-secondary text-center" style="padding:10px;">Geen actieve medicatie geregistreerd.</p>'}
          </div>
        </div>

        <div class="nm-card">
          <div class="nm-card-header">
            <h3 class="nm-card-title"><i class="fas fa-procedures"></i> Behandeltrajecten</h3>
            ${canEdit ? `<button class="nm-btn" style="padding:6px 12px; font-size:11px;" onclick="openAddTreatmentModal()"><i class="fas fa-plus"></i></button>` : ''}
          </div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${dossier.treatments && dossier.treatments.length > 0 ? dossier.treatments.map(t => `
              <div class="nm-card" style="box-shadow: var(--shadow-small-pressed); padding:12px; margin:0;">
                <div style="display:flex; justify-content:between; align-items:center;">
                  <strong>${t.name}</strong>
                  <span class="nm-badge ${t.status === 'Lopend' ? 'nm-badge-primary' : 'nm-badge-success'}">${t.status}</span>
                </div>
                <p style="font-size:12px; margin:4px 0;">${t.desc}</p>
                <div style="font-size:11px; color:var(--text-secondary);">Startdatum: ${formatDate(t.startDate)} ${t.endDate ? `| Einddatum: ${formatDate(t.endDate)}` : ''}</div>
              </div>
            `).join('') : '<p class="text-secondary text-center" style="padding:10px;">Geen lopende behandeltrajecten.</p>'}
          </div>
        </div>
      </div>
    </div>
  `;
}

// Tab 2: Visit History & Vitals Notes
function showPatientVisitsTab(patient, visits) {
  const contentDiv = document.getElementById('patient-tab-content');
  const canAdd = hasPermission('add_visit');

  contentDiv.innerHTML = `
    <div class="nm-card">
      <div class="nm-card-header">
        <h3 class="nm-card-title"><i class="fas fa-notes-medical"></i> Consult & Bezoekverslagen</h3>
        ${canAdd ? `<button class="nm-btn nm-btn-primary" style="padding:8px 16px; font-size:12px;" onclick="openAddVisitModal()"><i class="fas fa-file-medical"></i> Consult registreren</button>` : ''}
      </div>
      
      <div class="timeline">
        ${visits.length > 0 ? visits.map(v => `
          <div class="timeline-event">
            <div class="timeline-card">
              <div class="timeline-header">
                <span>Verslag door: <strong>${v.doctorName}</strong></span>
                <span>${formatDate(v.date)}</span>
              </div>
              <div class="timeline-title">${v.diagnosis || 'Algemeen Consult'}</div>
              <div style="margin-top:6px; font-size:13px;">
                <div style="margin-bottom:4px;"><strong>Klacht/Reden:</strong> ${v.complaints}</div>
                <div style="margin-bottom:4px;"><strong>Bevindingen:</strong> ${v.findings}</div>
                ${v.notes ? `<div><strong>Behandelplan/Nota's:</strong> ${v.notes}</div>` : ''}
              </div>
            </div>
          </div>
        `).join('') : '<p class="text-secondary text-center" style="padding:20px;">Geen eerdere bezoeken geregistreerd.</p>'}
      </div>
    </div>
  `;
}

// Tab 3: Lab Results
function showPatientLabsTab(patient, labs) {
  const contentDiv = document.getElementById('patient-tab-content');
  const canViewDetail = hasPermission('view_lab_details');

  contentDiv.innerHTML = `
    <div class="nm-card">
      <div class="nm-card-header">
        <h3 class="nm-card-title"><i class="fas fa-vial"></i> Lab Resultaten (Rapporten)</h3>
      </div>
      
      <div style="display:flex; flex-direction:column; gap:12px;">
        ${labs.length > 0 ? labs.map(l => `
          <div class="nm-card" style="box-shadow: var(--shadow-small); margin:0; padding:16px; display:flex; justify-content:between; align-items:center;">
            <div>
              <strong style="font-size:15px; color:var(--text-color);">${l.testName}</strong>
              <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">
                Datum: ${formatDate(l.testDate)} | Uitgevoerd door: ${l.reportedBy}
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:12px;">
              <span class="nm-badge ${l.status === 'Definitief' ? 'nm-badge-success' : 'nm-badge-warning'}">${l.status}</span>
              ${canViewDetail ? `<button class="nm-btn" style="padding:6px 12px;" onclick="viewLabReport(${l.id})"><i class="fas fa-file-pdf"></i> Bekijken</button>` : ''}
            </div>
          </div>
        `).join('') : '<p class="text-secondary text-center" style="padding:20px;">Geen laboratorium-uitslagen bekend.</p>'}
      </div>
    </div>
  `;
}

// PDF Dialog viewer
async function viewLabReport(labId) {
  const report = await db.labResults.get(labId);
  const patient = await db.patients.get(report.patientId);
  
  if (!report || !patient) return;
  
  state.activeLabResultId = labId;

  // Generate rows
  const rows = Object.keys(report.resultData).map(key => {
    const item = report.resultData[key];
    const flagClass = item.status === 'Verhoogd' || item.status === 'Verlaagd' ? 'pdf-flag-verhoogd' : '';
    return `
      <tr>
        <td style="font-weight:bold;">${key}</td>
        <td class="${flagClass}">${item.value}</td>
        <td>${item.unit}</td>
        <td style="color:#666;">${item.reference}</td>
        <td class="${flagClass}">${item.status}</td>
      </tr>
    `;
  }).join('');

  const overlay = document.createElement('div');
  overlay.id = 'pdf-viewer-overlay';
  overlay.className = 'pdf-viewer-overlay';
  overlay.innerHTML = `
    <div class="pdf-window">
      <div class="pdf-toolbar">
        <span class="pdf-toolbar-title"><i class="fas fa-file-pdf"></i> MedCore PDF Viewer</span>
        <button class="nm-btn" style="padding:6px 12px; background:rgba(255,255,255,0.2); color:#fff; border-radius:6px; box-shadow:none;" onclick="closePdfViewer()">Sluiten</button>
      </div>
      <div class="pdf-body" id="print-area">
        <div class="pdf-header">
          <div class="pdf-hospital-info">
            <h1>MEDCORE MEDISCH LAB</h1>
            <p>Afdeling Klinische Chemie & Hematologie</p>
            <p>Locatie: Lab Centraal | Tel: 088-12345</p>
          </div>
          <div class="pdf-patient-info">
            <strong>PATIËNT dossier</strong><br>
            Naam: ${patient.name}<br>
            BSN: ${patient.bsn}<br>
            Geb. Datum: ${formatDate(patient.dob)} (${patient.gender})
          </div>
        </div>
        
        <h2 style="font-size:16px; margin-bottom:12px; font-family:sans-serif; text-transform:uppercase;">LABORATORIUM RESULTATEN: ${report.testName}</h2>
        <p style="margin-bottom:20px;">Rapportagedatum: ${formatDate(report.testDate)} | Status: <strong>${report.status}</strong> | Vrijgegeven door: ${report.reportedBy}</p>
        
        <table class="pdf-results-table">
          <thead>
            <tr>
              <th>Analyse</th>
              <th>Resultaat</th>
              <th>Eenheid</th>
              <th>Referentiewaarde</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        
        <div style="margin-top:30px; border-top:1px dashed #bbb; padding-top:15px; font-size:11px; text-align:center; color:#666;">
          Dit is een digitaal gevalideerd labrapport behorende bij het MedCore ZIS patiëntendossier.
        </div>
      </div>
      <div style="padding:16px; background:#f4f4f6; border-top:1px solid #ddd; display:flex; justify-content:flex-end; gap:12px;">
        <button class="nm-btn nm-btn-primary" onclick="window.print()"><i class="fas fa-print"></i> Afdrukken / Opslaan</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function closePdfViewer() {
  const overlay = document.getElementById('pdf-viewer-overlay');
  if (overlay) overlay.remove();
}

// ==========================================
// 4. SCHEDULE & APPOINTMENT VIEW RENDERER
// ==========================================
async function renderSchedule(container) {
  // Calendar select day grid
  container.innerHTML = `
    <h1 class="mb-4">Planning & Afspraken</h1>
    
    <div class="schedule-container">
      <!-- Calendar column -->
      <div>
        <div class="nm-card calendar-mini">
          <div style="display:flex; justify-content:between; align-items:center; margin-bottom:10px;">
            <strong id="calendar-month-label" style="font-size:14px; text-transform:uppercase;">Mei 2026</strong>
          </div>
          <div class="calendar-days" id="calendar-days-grid">
            <!-- Calendar days load dynamically -->
          </div>
        </div>
      </div>

      <!-- Schedule list column -->
      <div>
        <div class="nm-card">
          <div class="nm-card-header">
            <h3 class="nm-card-title"><i class="fas fa-calendar-check"></i> Afspraken op ${formatDate(state.selectedDate)}</h3>
          </div>
          <div class="appointment-list" id="appointments-list-container">
            <!-- Load appts -->
          </div>
        </div>
      </div>
    </div>
  `;

  // Draw calendar cells
  drawCalendar();

  // Load appointments list
  loadAppointmentsList();
}

// Render Calendar Days
function drawCalendar() {
  const daysGrid = document.getElementById('calendar-days-grid');
  
  // Headers (Mo, Tu, We, Th, Fr, Sa, Su)
  const headers = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
  let gridHtml = headers.map(h => `<div class="cal-header-cell">${h}</div>`).join('');
  
  // Let's generate days for May 2026. May 1st 2026 is a Friday.
  // We need 4 offset empty cells at the start (Mon=0, Tue=1, Wed=2, Thu=3)
  const offset = 4;
  for (let i = 0; i < offset; i++) {
    gridHtml += `<div></div>`;
  }
  
  // Let's put 31 days in May
  const selectedDay = parseInt(state.selectedDate.split('-')[2]);
  for (let day = 1; day <= 31; day++) {
    const dayStr = `2026-05-${day.toString().padStart(2, '0')}`;
    const isActive = state.selectedDate === dayStr ? 'active' : '';
    const isToday = day === 23 ? 'today' : '';
    
    gridHtml += `
      <button class="cal-cell ${isActive} ${isToday}" onclick="selectDate('${dayStr}')">
        ${day}
      </button>
    `;
  }
  daysGrid.innerHTML = gridHtml;
}

function selectDate(dateStr) {
  state.selectedDate = dateStr;
  drawCalendar();
  loadAppointmentsList();
}

// Load Appointments for selected date
async function loadAppointmentsList() {
  const listContainer = document.getElementById('appointments-list-container');
  const appts = await db.appointments.where({ date: state.selectedDate }).toArray();

  if (appts.length === 0) {
    listContainer.innerHTML = '<p class="text-secondary text-center" style="padding:20px;">Geen afspraken gepland voor deze dag.</p>';
    return;
  }

  // Sort appts by time
  appts.sort((a, b) => a.time.localeCompare(b.time));

  // We need patient details for each appt
  const listItems = [];
  for (const appt of appts) {
    const patient = await db.patients.get(appt.patientId);
    const timeSplit = appt.time.split(':');
    const dateMonth = new Date(state.selectedDate).toLocaleString('nl-NL', { month: 'short' });
    const dateDay = state.selectedDate.split('-')[2];

    const canDelete = hasPermission('schedule_appointment');

    listItems.push(`
      <div class="nm-card appointment-item" style="margin:0; background:var(--surface-color);">
        <div class="appt-time-box">
          <span class="appt-time">${appt.time}</span>
          <span class="appt-date-label">${dateDay} ${dateMonth}</span>
        </div>
        <div class="appt-info">
          <span class="appt-patient" style="cursor:pointer; color:var(--primary-color);" onclick="selectPatient(${appt.patientId})">${patient ? patient.name : 'Onbekende patiënt'}</span>
          <div class="appt-details">
            Arts: <strong>${appt.doctorName}</strong><br>
            Reden: <em>${appt.reason}</em>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="nm-badge ${appt.status === 'Gepland' ? 'nm-badge-primary' : 'nm-badge-success'}">${appt.status}</span>
          ${canDelete ? `<button class="nm-btn" style="padding:6px 10px; color:var(--accent-red); box-shadow:var(--shadow-small);" onclick="cancelAppointment(${appt.id})" title="Afspraak annuleren"><i class="fas fa-trash-alt"></i></button>` : ''}
        </div>
      </div>
    `);
  }
  listContainer.innerHTML = listItems.join('');
}

// Cancel Appointment
async function cancelAppointment(id) {
  if (confirm("Weet u zeker dat u deze afspraak wilt verwijderen?")) {
    const appt = await db.appointments.get(id);
    await db.appointments.delete(id);
    if (appt) {
      await logAction(state.currentUser.username, "CANCEL_APPOINTMENT", `Afspraak op ${appt.date} om ${appt.time} geannuleerd.`);
    }
    loadAppointmentsList();
  }
}

// ==========================================
// 5. RECORDS VIEW (PHARMACY & LABS INDEX)
// ==========================================
async function renderRecords(container) {
  container.innerHTML = `
    <h1 class="mb-4">Archieven & Beheer</h1>
    
    <div class="sub-tabs">
      <button class="sub-tab-btn ${state.recordsTab === 'pharmacy' ? 'active' : ''}" onclick="switchRecordsTab(this, 'pharmacy')">Apotheek & Voorraad</button>
      <button class="sub-tab-btn ${state.recordsTab === 'labs' ? 'active' : ''}" onclick="switchRecordsTab(this, 'labs')">Lab Rapportages</button>
    </div>

    <div id="records-tab-content">
      <!-- Pharmacy or Labs renders here -->
    </div>
  `;

  renderRecordsTabContent();
}

function switchRecordsTab(btn, tab) {
  btn.parentElement.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.recordsTab = tab;
  renderRecordsTabContent();
}

function renderRecordsTabContent() {
  const contentDiv = document.getElementById('records-tab-content');
  contentDiv.innerHTML = '';
  
  if (state.recordsTab === 'pharmacy') {
    showPharmacyInventory(contentDiv);
  } else if (state.recordsTab === 'labs') {
    showLabReportsIndex(contentDiv);
  }
}

// Tab 5.1: Pharmacy Inventory & Charts
async function showPharmacyInventory(contentDiv) {
  const inventory = await db.inventory.toArray();
  const criticalCount = inventory.filter(i => i.isCritical).length;

  contentDiv.innerHTML = `
    <div class="inventory-summary">
      <!-- Table inventory -->
      <div class="nm-card" style="flex: 2;">
        <div class="nm-card-header">
          <h3 class="nm-card-title"><i class="fas fa-boxes"></i> Medicatievoorraad</h3>
        </div>
        <table class="inventory-table">
          <thead>
            <tr>
              <th>Medicament</th>
              <th>Locatie</th>
              <th>Voorraad</th>
              <th>Batch / Expiratie</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody id="inventory-table-body">
            <!-- Stock lines loaded dynamically -->
          </tbody>
        </table>
      </div>

      <!-- Graph visual -->
      <div class="nm-card" style="flex: 1.2;">
        <div class="nm-card-header">
          <h3 class="nm-card-title"><i class="fas fa-chart-bar"></i> Morfine Monitoring</h3>
        </div>
        <p style="font-size:12px; color:var(--text-secondary); margin-bottom:10px;">Verbruiks- en voorraadtolerantie in klinische afdelingen.</p>
        <div class="chart-container">
          <canvas id="morfine-chart"></canvas>
        </div>
      </div>
    </div>
  `;

  // Draw Stock lines
  loadInventoryLines(inventory);

  // Render Chart.js Morfine
  setTimeout(renderMorfineChart, 100);
}

function loadInventoryLines(inventory) {
  const tbody = document.getElementById('inventory-table-body');
  
  const canManage = hasPermission('manage_inventory');

  tbody.innerHTML = inventory.map(item => {
    const isLow = item.stock < 100 && item.isCritical;
    const badgeClass = item.isCritical ? 'nm-badge-danger' : 'nm-badge-primary';
    const badgeText = item.isCritical ? 'Kritiek' : 'Standaard';
    const rowAlertStyle = isLow ? 'style="background-color:rgba(231,76,60,0.02);"' : '';

    return `
      <tr ${rowAlertStyle}>
        <td>
          <strong>${item.medicationName}</strong>
          ${isLow ? `<br><span style="color:var(--accent-red); font-size:11px; font-weight:700;"><i class="fas fa-exclamation-triangle"></i> Lage voorraad!</span>` : ''}
        </td>
        <td>${item.location}</td>
        <td>
          <div class="stock-control">
            ${canManage ? `<button class="nm-btn" style="padding:4px 8px; font-size:11px;" onclick="adjustStock(${item.id}, -10)">-10</button>` : ''}
            <span class="stock-num ${isLow ? 'text-accent-red' : ''}">${item.stock}</span>
            ${canManage ? `<button class="nm-btn" style="padding:4px 8px; font-size:11px;" onclick="adjustStock(${item.id}, 10)">+10</button>` : ''}
          </div>
        </td>
        <td>
          <span style="font-size:12px; font-family:monospace;">${item.batchNumber}</span><br>
          <span style="font-size:11px; color:var(--text-secondary);">${formatDate(item.expiryDate)}</span>
        </td>
        <td>
          <span class="nm-badge ${badgeClass}">${badgeText}</span>
        </td>
      </tr>
    `;
  }).join('');
}

async function adjustStock(itemId, amt) {
  const item = await db.inventory.get(itemId);
  if (!item) return;

  const newStock = Math.max(0, item.stock + amt);
  await db.inventory.update(itemId, { stock: newStock });
  
  await logAction(
    state.currentUser.username, 
    "STOCK_ADJUSTMENT", 
    `Voorraad van ${item.medicationName} (${item.location}) aangepast van ${item.stock} naar ${newStock}.`
  );

  // Refresh
  const freshInventory = await db.inventory.toArray();
  loadInventoryLines(freshInventory);
  
  // Refresh chart
  renderMorfineChart();
}

// Render chart using Chart.js library
async function renderMorfineChart() {
  const canvas = document.getElementById('morfine-chart');
  if (!canvas) return;

  // Retrieve morfine stock in different locations
  const morfineItems = await db.inventory.where({ medicationName: "Morfine 10mg (retard)" }).toArray();
  const labels = morfineItems.map(item => item.location);
  const dataStock = morfineItems.map(item => item.stock);

  // Clean old instance
  if (state.charts.morfine) {
    state.charts.morfine.destroy();
  }

  const ctx = canvas.getContext('2d');
  state.charts.morfine = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Aantal Tabletten',
        data: dataStock,
        backgroundColor: ['rgba(0, 122, 140, 0.7)', 'rgba(230, 126, 34, 0.7)'],
        borderColor: ['#007a8c', '#e67e22'],
        borderWidth: 2,
        borderRadius: 8,
        barThickness: 35
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(184, 191, 201, 0.2)'
          },
          ticks: {
            color: '#7f8c8d'
          }
        },
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: '#7f8c8d',
            font: {
              weight: 'bold'
            }
          }
        }
      }
    }
  });
}

// Tab 5.2: Lab Reports Index
async function showLabReportsIndex(contentDiv) {
  const labReports = await db.labResults.toArray();
  const canView = hasPermission('view_lab_details');

  contentDiv.innerHTML = `
    <div class="nm-card">
      <div class="nm-card-header">
        <h3 class="nm-card-title"><i class="fas fa-file-invoice"></i> Alle Laboratoriumrapporten</h3>
      </div>
      <div style="display:flex; flex-direction:column; gap:12px;">
        ${labReports.length > 0 ? '' : '<p class="text-secondary text-center">Geen labrapporten in database.</p>'}
      </div>
    </div>
  `;

  const innerDiv = contentDiv.querySelector('.nm-card > div');
  
  // We need to query client name for each lab report
  const elements = [];
  for (const report of labReports) {
    const patient = await db.patients.get(report.patientId);
    elements.push(`
      <div class="nm-card" style="box-shadow:var(--shadow-small); margin:0; padding:16px; display:flex; justify-content:between; align-items:center;">
        <div>
          <strong style="font-size:15px;">${report.testName}</strong><br>
          <span style="font-size:13px; color:var(--text-secondary);">
            Patiënt: <strong>${patient ? patient.name : 'Onbekend'}</strong> | Datum: ${formatDate(report.testDate)}
          </span>
        </div>
        <div style="display:flex; align-items:center; gap:12px;">
          <span class="nm-badge nm-badge-success">${report.status}</span>
          ${canView ? `<button class="nm-btn" style="padding:6px 12px;" onclick="viewLabReport(${report.id})"><i class="fas fa-file-pdf"></i> Bekijken</button>` : ''}
        </div>
      </div>
    `);
  }
  innerDiv.innerHTML = elements.join('');
}

// ==========================================
// GLOBALS & MODAL HANDLERS
// ==========================================

// Global FAB router trigger
function setupGlobalEvents() {
  document.getElementById('global-fab').addEventListener('click', () => {
    if (state.activeView === 'patients' && hasPermission('add_patient')) {
      openAddPatientModal();
    } else if (state.activeView === 'schedule' && hasPermission('schedule_appointment')) {
      openAddAppointmentModal();
    }
  });
}

// MODAL 1: ADD PATIENT
function openAddPatientModal() {
  const modal = document.createElement('div');
  modal.id = 'active-modal-overlay';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">Nieuwe Patiënt Registreren</h3>
        <button class="modal-close-btn" onclick="closeActiveModal()"><i class="fas fa-times"></i></button>
      </div>
      <form id="add-patient-form">
        <div class="form-group">
          <label class="form-label">BSN (Burgerservicenummer)</label>
          <input type="text" name="bsn" class="nm-input" required minlength="9" maxlength="9" placeholder="Bijv. 123456789">
        </div>
        <div class="form-group">
          <label class="form-label">Volledige Naam</label>
          <input type="text" name="name" class="nm-input" required placeholder="Bijv. Jan Jansen">
        </div>
        <div class="grid-2" style="margin-bottom:0;">
          <div class="form-group">
            <label class="form-label">Geboortedatum</label>
            <input type="date" name="dob" class="nm-input" required>
          </div>
          <div class="form-group">
            <label class="form-label">Geslacht</label>
            <select name="gender" class="nm-select" required>
              <option value="Man">Man</option>
              <option value="Vrouw">Vrouw</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Telefoonnummer</label>
          <input type="text" name="phone" class="nm-input" placeholder="Bijv. 0612345678">
        </div>
        <div class="form-group">
          <label class="form-label">E-mailadres</label>
          <input type="email" name="email" class="nm-input" placeholder="Bijv. j.jansen@example.com">
        </div>
        <div class="form-group">
          <label class="form-label">Adres</label>
          <input type="text" name="address" class="nm-input" placeholder="Straatnaam, huisnummer, woonplaats">
        </div>
        
        <div class="modal-actions">
          <button type="button" class="nm-btn" onclick="closeActiveModal()">Annuleren</button>
          <button type="submit" class="nm-btn nm-btn-primary">Registreren</button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);

  // Form submission
  document.getElementById('add-patient-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const bsn = formData.get('bsn');

    // Check unique BSN
    const existing = await db.patients.where({ bsn }).first();
    if (existing) {
      alert("Er is al een patiënt geregistreerd met dit BSN.");
      return;
    }

    const newPatient = {
      bsn: bsn,
      name: formData.get('name'),
      dob: formData.get('dob'),
      gender: formData.get('gender'),
      phone: formData.get('phone'),
      email: formData.get('email'),
      address: formData.get('address')
    };

    const patientId = await db.patients.add(newPatient);
    
    // Create empty medical dossier
    await db.dossiers.add({
      patientId: patientId,
      diagnoses: [],
      treatments: [],
      medications: []
    });

    await logAction(state.currentUser.username, "ADD_PATIENT", `Nieuwe patiënt geregistreerd: ${newPatient.name} (BSN: ${newPatient.bsn})`);
    
    closeActiveModal();
    navigateTo('patients');
  });
}

// MODAL 2: ADD APPOINTMENT
async function openAddAppointmentModal() {
  const patients = await db.patients.toArray();
  const doctors = await db.users.where('role').equals(ROLES.DOKTER).toArray();

  const modal = document.createElement('div');
  modal.id = 'active-modal-overlay';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">Nieuwe Afspraak Inplannen</h3>
        <button class="modal-close-btn" onclick="closeActiveModal()"><i class="fas fa-times"></i></button>
      </div>
      <form id="add-appt-form">
        <div class="form-group">
          <label class="form-label">Patiënt</label>
          <select name="patientId" class="nm-select" required>
            ${patients.map(p => `<option value="${p.id}">${p.name} (BSN ${p.bsn})</option>`).join('')}
          </select>
        </div>
        
        <div class="form-group">
          <label class="form-label">Arts / Specialist</label>
          <select name="doctorUsername" class="nm-select" required>
            ${doctors.map(d => `<option value="${d.username}">${d.name} (${d.specialty})</option>`).join('')}
          </select>
        </div>

        <div class="grid-2" style="margin-bottom:0;">
          <div class="form-group">
            <label class="form-label">Datum</label>
            <input type="date" name="date" class="nm-input" value="${state.selectedDate}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Tijdstip</label>
            <input type="time" name="time" class="nm-input" required value="09:00">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Reden voor consult</label>
          <input type="text" name="reason" class="nm-input" required placeholder="Bijv. Bloeddruk controle">
        </div>
        
        <div class="modal-actions">
          <button type="button" class="nm-btn" onclick="closeActiveModal()">Annuleren</button>
          <button type="submit" class="nm-btn nm-btn-primary">Afspraak opslaan</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('add-appt-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const doctorUsername = formData.get('doctorUsername');
    const doctorObj = doctors.find(d => d.username === doctorUsername);
    const patientId = parseInt(formData.get('patientId'));
    const patientObj = patients.find(p => p.id === patientId);

    const newAppt = {
      patientId: patientId,
      doctorId: doctorUsername,
      doctorName: doctorObj ? doctorObj.name : "Arts",
      date: formData.get('date'),
      time: formData.get('time'),
      reason: formData.get('reason'),
      status: "Gepland"
    };

    await db.appointments.add(newAppt);
    await logAction(state.currentUser.username, "SCHEDULE_APPOINTMENT", `Afspraak ingepland met ${patientObj ? patientObj.name : 'Patiënt'} op ${newAppt.date} om ${newAppt.time}.`);

    closeActiveModal();
    // Update selected date to show the new appointment
    state.selectedDate = newAppt.date;
    navigateTo('schedule');
  });
}

// MODAL 3: PRESCRIBE MEDICATION (EPD DETAIL)
async function openPrescribeModal() {
  const patientId = state.selectedPatientId;
  const inventoryItems = await db.inventory.toArray();
  // Filter unique drug names
  const medNames = [...new Set(inventoryItems.map(i => i.medicationName))];

  const modal = document.createElement('div');
  modal.id = 'active-modal-overlay';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">Medicatie Voorschrijven</h3>
        <button class="modal-close-btn" onclick="closeActiveModal()"><i class="fas fa-times"></i></button>
      </div>
      <form id="prescribe-form">
        <div class="form-group">
          <label class="form-label">Medicament</label>
          <select name="medName" class="nm-select" required>
            ${medNames.map(m => `<option value="${m}">${m}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Dosering</label>
          <input type="text" name="dosage" class="nm-input" required placeholder="Bijv. 1 tablet (40mg) of 2 inhalaties">
        </div>
        <div class="form-group">
          <label class="form-label">Frequentie / Schema</label>
          <input type="text" name="frequency" class="nm-input" required placeholder="Bijv. 1x per dag (avond) of Zo nodig">
        </div>

        <div class="modal-actions">
          <button type="button" class="nm-btn" onclick="closeActiveModal()">Annuleren</button>
          <button type="submit" class="nm-btn nm-btn-primary">Voorschrijven</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('prescribe-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const medName = formData.get('medName');
    
    // Read and update patient dossier
    const dossier = await db.dossiers.where({ patientId }).first();
    if (dossier) {
      const activeMeds = dossier.medications || [];
      activeMeds.push({
        name: medName,
        dosage: formData.get('dosage'),
        frequency: formData.get('frequency'),
        prescribedBy: state.currentUser.name,
        startDate: new Date().toISOString().split('T')[0],
        status: "Actief"
      });

      await db.dossiers.update(dossier.id, { medications: activeMeds });
      await logAction(state.currentUser.username, "PRESCRIBE_MEDICATION", `Medicatie voorgeschreven aan patiënt ID ${patientId}: ${medName}`);
    }

    closeActiveModal();
    renderActiveView(); // Refresh detail view
  });
}

// MODAL 4: ADD DIAGNOSIS
function openAddDiagnosisModal() {
  const patientId = state.selectedPatientId;

  const modal = document.createElement('div');
  modal.id = 'active-modal-overlay';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">Diagnosis Toevoegen</h3>
        <button class="modal-close-btn" onclick="closeActiveModal()"><i class="fas fa-times"></i></button>
      </div>
      <form id="add-diagnosis-form">
        <div class="form-group">
          <label class="form-label">ICD-10 Code</label>
          <input type="text" name="code" class="nm-input" required placeholder="Bijv. I10">
        </div>
        <div class="form-group">
          <label class="form-label">Omschrijving / Naam</label>
          <input type="text" name="name" class="nm-input" required placeholder="Bijv. Essentiële hypertensie">
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select name="status" class="nm-select">
            <option value="Actief">Actief</option>
            <option value="Inactief">Inactief</option>
          </select>
        </div>

        <div class="modal-actions">
          <button type="button" class="nm-btn" onclick="closeActiveModal()">Annuleren</button>
          <button type="submit" class="nm-btn nm-btn-primary">Opslaan</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('add-diagnosis-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const dossier = await db.dossiers.where({ patientId }).first();
    if (dossier) {
      const diagnoses = dossier.diagnoses || [];
      diagnoses.push({
        code: formData.get('code'),
        name: formData.get('name'),
        date: new Date().toISOString().split('T')[0],
        status: formData.get('status')
      });

      await db.dossiers.update(dossier.id, { diagnoses });
      await logAction(state.currentUser.username, "ADD_DIAGNOSIS", `Diagnosis toegevoegd aan patiënt ID ${patientId}: ${formData.get('name')} (${formData.get('code')})`);
    }

    closeActiveModal();
    renderActiveView();
  });
}

// MODAL 5: ADD TREATMENT
function openAddTreatmentModal() {
  const patientId = state.selectedPatientId;

  const modal = document.createElement('div');
  modal.id = 'active-modal-overlay';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">Behandeltraject Starten</h3>
        <button class="modal-close-btn" onclick="closeActiveModal()"><i class="fas fa-times"></i></button>
      </div>
      <form id="add-treatment-form">
        <div class="form-group">
          <label class="form-label">Behandeling Naam</label>
          <input type="text" name="name" class="nm-input" required placeholder="Bijv. Post-infarct revalidatie">
        </div>
        <div class="form-group">
          <label class="form-label">Omschrijving / Details</label>
          <textarea name="desc" class="nm-textarea" required placeholder="Beschrijf het behandeltraject en frequentie..."></textarea>
        </div>

        <div class="modal-actions">
          <button type="button" class="nm-btn" onclick="closeActiveModal()">Annuleren</button>
          <button type="submit" class="nm-btn nm-btn-primary">Traject opslaan</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('add-treatment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const dossier = await db.dossiers.where({ patientId }).first();
    if (dossier) {
      const treatments = dossier.treatments || [];
      treatments.push({
        name: formData.get('name'),
        desc: formData.get('desc'),
        startDate: new Date().toISOString().split('T')[0],
        endDate: "",
        status: "Lopend"
      });

      await db.dossiers.update(dossier.id, { treatments });
      await logAction(state.currentUser.username, "ADD_TREATMENT", `Behandeltraject gestart voor patiënt ID ${patientId}: ${formData.get('name')}`);
    }

    closeActiveModal();
    renderActiveView();
  });
}

// MODAL 6: ADD VISIT (CONSULT REGISTRATION)
function openAddVisitModal() {
  const patientId = state.selectedPatientId;

  const modal = document.createElement('div');
  modal.id = 'active-modal-overlay';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 600px;">
      <div class="modal-header">
        <h3 class="modal-title">Consult Registratie</h3>
        <button class="modal-close-btn" onclick="closeActiveModal()"><i class="fas fa-times"></i></button>
      </div>
      <form id="add-visit-form">
        <div class="form-group">
          <label class="form-label">Klachten van de patiënt</label>
          <textarea name="complaints" class="nm-textarea" required placeholder="Bijv. Hoofdpijn, vermoeidheid..."></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Onderzoeksbevindingen & Vitale Functies</label>
          <textarea name="findings" class="nm-textarea" required placeholder="Bijv. Bloeddruk 130/80, pols 68..."></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Werkdiagnose</label>
          <input type="text" name="diagnosis" class="nm-input" required placeholder="Bijv. Milde hypertensie">
        </div>
        <div class="form-group">
          <label class="form-label">Behandelplan / Advies (Nota's)</label>
          <textarea name="notes" class="nm-textarea" placeholder="Medicatie-aanpassing, rustadvies, vervolgafspraak..."></textarea>
        </div>

        <div class="modal-actions">
          <button type="button" class="nm-btn" onclick="closeActiveModal()">Annuleren</button>
          <button type="submit" class="nm-btn nm-btn-primary">Consult Voltooien</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('add-visit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    const newVisit = {
      patientId: patientId,
      date: new Date().toISOString().split('T')[0],
      doctorName: state.currentUser.name,
      complaints: formData.get('complaints'),
      findings: formData.get('findings'),
      diagnosis: formData.get('diagnosis'),
      notes: formData.get('notes')
    };

    await db.visits.add(newVisit);
    await logAction(state.currentUser.username, "ADD_VISIT", `Consult geregistreerd door ${state.currentUser.name} voor patiënt ID ${patientId}.`);

    closeActiveModal();
    
    // Switch to visits sub-tab inside patient detail
    const visitsTabBtn = document.querySelector('.sub-tab-btn[onclick*="visits"]');
    if (visitsTabBtn) {
      switchPatientTab(visitsTabBtn, 'visits');
    } else {
      renderActiveView();
    }
  });
}

// Modal helper close
function closeActiveModal() {
  const modal = document.getElementById('active-modal-overlay');
  if (modal) modal.remove();
}
window.closeActiveModal = closeActiveModal;
window.closePdfViewer = closePdfViewer;
window.switchPatientTab = switchPatientTab;
window.switchRecordsTab = switchRecordsTab;
window.adjustStock = adjustStock;
window.viewLabReport = viewLabReport;
window.selectPatient = selectPatient;
window.selectDate = selectDate;
window.cancelAppointment = cancelAppointment;
