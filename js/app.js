/**
 * ==============================================================================
 * WEB DASHBOARD LIVE SCORING PERBAKIN
 * Sistem Live Klasemen Real-Time Kejuaraan Menembak (Air Pistol & Air Rifle)
 * ==============================================================================
 */

// ==============================================================================
// 1. CONFIGURATION (Dapat disesuaikan oleh admin)
// ==============================================================================
// Dynamic Sheet ID Setup: Ganti SPREADSHEET_ID dengan ID Google Sheets Anda
const SPREADSHEET_ID = '1vnby6effCDoFOzVA5PpZROz8MNY23o0_K7Skcbh8Li0';

// Daftar tab sheet default
const DEFAULT_SHEETS = ['Air Pistol', 'Air Rifle'];

// Waktu interval auto-refresh polling dalam detik (15 - 30 detik sesuai PRD)
const DEFAULT_POLL_INTERVAL_SEC = 20;

// Google Sheets API Key (Opsional - jika diisi akan membaca nama tab 100% dinamis)
const DEFAULT_API_KEY = '';

// Kunci penyimpanan LocalStorage
const STORAGE_KEYS = {
  SPREADSHEET_ID: 'perbakin_scoring_sheet_id',
  SHEET_NAMES: 'perbakin_scoring_sheet_names',
  POLL_INTERVAL: 'perbakin_scoring_poll_interval',
  API_KEY: 'perbakin_scoring_api_key',
  VIEW_MODE: 'perbakin_scoring_view_mode'
};

// ==============================================================================
// 2. MOCK / OFFLINE FALLBACK DATA TEMPLATE
// (Menjamin dashboard tetap dapat diuji & tampil interaktif saat offline)
// ==============================================================================
const MOCK_DATA = {
  'Air Pistol': [
    { id: 'PBK-001', waktuInput: '2025-05-18 09:30:00', kategori: 'Senior', gender: 'Putra', nama: 'Edy Santoso', kontingen: 'DKI Jakarta', skorTotal: 414, totalX: 3 },
    { id: 'PBK-004', waktuInput: '2025-05-18 11:20:00', kategori: 'Senior', gender: 'Putri', nama: 'Dewi Lestari', kontingen: 'Jawa Tengah', skorTotal: 558, totalX: 12 },
    { id: 'PBK-006', waktuInput: '2025-05-18 14:10:00', kategori: 'Junior', gender: 'Putra', nama: 'Bagus Setiawan', kontingen: 'Banten', skorTotal: 532, totalX: 8 },
    { id: 'PBK-007', waktuInput: '2025-05-18 14:45:00', kategori: 'Senior', gender: 'Putra', nama: 'Andrian', kontingen: 'Kalimantan Barat', skorTotal: 557, totalX: 11 },
    { id: 'PBK-008', waktuInput: '2025-05-18 15:10:00', kategori: 'Junior', gender: 'Putri', nama: 'Rara Maheswari', kontingen: 'Mempawah', skorTotal: 539, totalX: 5 },
    { id: 'PBK-009', waktuInput: '2025-05-18 15:30:00', kategori: 'Senior', gender: 'Putra', nama: 'Eka Adhi', kontingen: 'Kalimantan Timur', skorTotal: 532, totalX: 10 } // Tie test with Bagus
  ],
  'Air Rifle': [
    { id: 'PBK-002', waktuInput: '2025-05-18 10:15:00', kategori: 'Senior', gender: 'Putra', nama: 'Session 17', kontingen: 'Jawa Barat', skorTotal: 422, totalX: 1 },
    { id: 'PBK-003', waktuInput: '2025-05-18 10:45:00', kategori: 'Junior', gender: 'Putri', nama: 'Audrey Zahra', kontingen: 'Jawa Timur', skorTotal: 615, totalX: 24 },
    { id: 'PBK-005', waktuInput: '2025-05-18 13:00:00', kategori: 'Junior', gender: 'Putra', nama: 'Rifqi Pratama', kontingen: 'DKI Jakarta', skorTotal: 589, totalX: 18 },
    { id: 'PBK-010', waktuInput: '2025-05-18 13:30:00', kategori: 'Senior', gender: 'Putri', nama: 'Paula Ramadhani', kontingen: 'SSC Pontianak', skorTotal: 602, totalX: 20 },
    { id: 'PBK-011', waktuInput: '2025-05-18 14:00:00', kategori: 'Junior', gender: 'Putri', nama: 'Mufidah Dwi Nugroho', kontingen: 'AHC', skorTotal: 589, totalX: 14 } // Tie test with Rifqi
  ]
};

// ==============================================================================
// 3. APPLICATION STATE
// ==============================================================================
const state = {
  spreadsheetId: localStorage.getItem(STORAGE_KEYS.SPREADSHEET_ID) || SPREADSHEET_ID,
  sheets: loadConfiguredSheets(),
  apiKey: localStorage.getItem(STORAGE_KEYS.API_KEY) || DEFAULT_API_KEY,
  pollIntervalSec: parseInt(localStorage.getItem(STORAGE_KEYS.POLL_INTERVAL)) || DEFAULT_POLL_INTERVAL_SEC,
  
  currentSheet: '',
  dataCache: {},          // Cache raw data per sheet name
  filteredAthletes: [],   // Data setelah filter & tie-breaker sorting
  
  filters: {
    kategori: 'ALL',      // 'ALL' | 'Senior' | 'Junior'
    gender: 'ALL',        // 'ALL' | 'Putra' | 'Putri'
    search: ''            // Nama atau kontingen
  },
  
  viewMode: localStorage.getItem(STORAGE_KEYS.VIEW_MODE) || 'table', // 'table' | 'dense'
  countdown: DEFAULT_POLL_INTERVAL_SEC,
  timerInterval: null,
  isFetching: false,
  isOfflineMode: false,
  lastUpdated: null,
  isTvMode: false
};

function loadConfiguredSheets() {
  const saved = localStorage.getItem(STORAGE_KEYS.SHEET_NAMES);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {
      // fallback
    }
  }
  return [...DEFAULT_SHEETS];
}

// ==============================================================================
// 4. DOM ELEMENTS
// ==============================================================================
const DOM = {
  // Navigation & Tabs
  classTabsContainer: document.getElementById('classTabsContainer'),
  
  // Stats
  statCurrentClass: document.getElementById('statCurrentClass'),
  statDistance: document.getElementById('statDistance'),
  statTotalShooters: document.getElementById('statTotalShooters'),
  statFilteredShooters: document.getElementById('statFilteredShooters'),
  statLeaderName: document.getElementById('statLeaderName'),
  statLeaderScore: document.getElementById('statLeaderScore'),
  statLastUpdated: document.getElementById('statLastUpdated'),
  statConnectionStatus: document.getElementById('statConnectionStatus'),
  
  // Filters & Controls
  searchInput: document.getElementById('searchInput'),
  btnClearSearch: document.getElementById('btnClearSearch'),
  filterSummaryText: document.getElementById('filterSummaryText'),
  filterClassLabel: document.getElementById('filterClassLabel'),
  filterKategoriChips: document.querySelectorAll('.filter-chip-kat'),
  filterGenderChips: document.querySelectorAll('.filter-chip-gender'),
  btnViewTable: document.getElementById('btnViewTable'),
  btnViewDense: document.getElementById('btnViewDense'),
  
  // Display Containers
  podiumSection: document.getElementById('podiumSection'),
  podium1: document.getElementById('podium1'),
  podium2: document.getElementById('podium2'),
  podium3: document.getElementById('podium3'),
  tableViewWrapper: document.getElementById('tableViewWrapper'),
  denseViewWrapper: document.getElementById('denseViewWrapper'),
  leaderboardTableBody: document.getElementById('leaderboardTableBody'),
  rankBadgeCount: document.getElementById('rankBadgeCount'),
  
  // Status States
  loadingState: document.getElementById('loadingState'),
  emptyState: document.getElementById('emptyState'),
  errorState: document.getElementById('errorState'),
  errorMessage: document.getElementById('errorMessage'),
  btnRetryFetch: document.getElementById('btnRetryFetch'),
  btnOpenSettingsFromError: document.getElementById('btnOpenSettingsFromError'),
  
  // Header Actions
  countdownTimer: document.getElementById('countdownTimer'),
  refreshProgressBar: document.getElementById('refreshProgressBar'),
  btnManualRefresh: document.getElementById('btnManualRefresh'),
  refreshIcon: document.getElementById('refreshIcon'),
  btnToggleTv: document.getElementById('btnToggleTv'),
  btnOpenSettings: document.getElementById('btnOpenSettings'),
  
  // Settings Modal
  settingsModal: document.getElementById('settingsModal'),
  btnCloseSettings: document.getElementById('btnCloseSettings'),
  btnCancelSettings: document.getElementById('btnCancelSettings'),
  btnSaveSettings: document.getElementById('btnSaveSettings'),
  btnResetConfig: document.getElementById('btnResetConfig'),
  cfgSpreadsheetId: document.getElementById('cfgSpreadsheetId'),
  cfgSheetNames: document.getElementById('cfgSheetNames'),
  cfgRefreshInterval: document.getElementById('cfgRefreshInterval'),
  cfgIntervalDisplay: document.getElementById('cfgIntervalDisplay'),
  cfgApiKey: document.getElementById('cfgApiKey'),
  
  // Footer
  linkGoogleSheet: document.getElementById('linkGoogleSheet'),
  footerSpreadsheetId: document.getElementById('footerSpreadsheetId'),
  currentYear: document.getElementById('currentYear')
};

// ==============================================================================
// 5. INITIALIZATION
// ==============================================================================
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  // Update footer year and link
  if (DOM.currentYear) DOM.currentYear.textContent = new Date().getFullYear();
  updateFooterLinks();
  
  // Attach event listeners
  setupEventListeners();
  
  // Set initial active sheet
  state.currentSheet = state.sheets[0] || 'Air Pistol';
  
  // Apply saved view mode
  applyViewMode(state.viewMode);
  
  // Render tabs dynamically
  renderTabs();
  
  // Try dynamic sheet names discovery if API key is provided
  if (state.apiKey) {
    await discoverSheetsFromApi();
  }
  
  // Fetch initial data
  await loadCurrentSheetData(false);
  
  // Start soft-refresh countdown ticker
  startCountdownTicker();
}

function updateFooterLinks() {
  const url = `https://docs.google.com/spreadsheets/d/${state.spreadsheetId}/edit`;
  if (DOM.linkGoogleSheet) DOM.linkGoogleSheet.href = url;
  if (DOM.footerSpreadsheetId) {
    const truncated = state.spreadsheetId.length > 16 
      ? state.spreadsheetId.substring(0, 14) + '...' 
      : state.spreadsheetId;
    DOM.footerSpreadsheetId.textContent = `ID: ${truncated}`;
  }
}

// ==============================================================================
// 6. EVENT LISTENERS
// ==============================================================================
function setupEventListeners() {
  // Manual refresh
  DOM.btnManualRefresh.addEventListener('click', () => {
    resetCountdown();
    loadCurrentSheetData(false);
  });

  // Retry from error state
  DOM.btnRetryFetch.addEventListener('click', () => {
    loadCurrentSheetData(false);
  });

  // Search input
  DOM.searchInput.addEventListener('input', (e) => {
    state.filters.search = e.target.value.trim().toLowerCase();
    DOM.btnClearSearch.classList.toggle('hidden', state.filters.search.length === 0);
    processAndRenderLeaderboard();
  });

  DOM.btnClearSearch.addEventListener('click', () => {
    DOM.searchInput.value = '';
    state.filters.search = '';
    DOM.btnClearSearch.classList.add('hidden');
    processAndRenderLeaderboard();
  });

  // Kategori filter chips
  DOM.filterKategoriChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const val = chip.getAttribute('data-filter-val');
      state.filters.kategori = val;
      
      DOM.filterKategoriChips.forEach(c => {
        c.classList.remove('active-filter-chip', 'bg-perbakin-blue', 'text-white');
        c.classList.add('text-slate-600');
      });
      chip.classList.add('active-filter-chip', 'bg-perbakin-blue', 'text-white');
      chip.classList.remove('text-slate-600');
      
      processAndRenderLeaderboard();
    });
  });

  // Gender filter chips
  DOM.filterGenderChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const val = chip.getAttribute('data-filter-val');
      state.filters.gender = val;
      
      DOM.filterGenderChips.forEach(c => {
        c.classList.remove('active-filter-chip', 'bg-perbakin-blue', 'text-white');
        c.classList.add('text-slate-600');
      });
      chip.classList.add('active-filter-chip', 'bg-perbakin-blue', 'text-white');
      chip.classList.remove('text-slate-600');
      
      processAndRenderLeaderboard();
    });
  });

  // View mode toggles
  DOM.btnViewTable.addEventListener('click', () => applyViewMode('table'));
  DOM.btnViewDense.addEventListener('click', () => applyViewMode('dense'));

  // TV / Presentation mode
  DOM.btnToggleTv.addEventListener('click', toggleTvMode);

  // Settings modal events
  DOM.btnOpenSettings.addEventListener('click', openSettingsModal);
  DOM.btnOpenSettingsFromError.addEventListener('click', openSettingsModal);
  DOM.btnCloseSettings.addEventListener('click', closeSettingsModal);
  DOM.btnCancelSettings.addEventListener('click', closeSettingsModal);
  DOM.btnSaveSettings.addEventListener('click', saveSettingsModal);
  DOM.btnResetConfig.addEventListener('click', resetSettingsToDefault);
  
  DOM.cfgRefreshInterval.addEventListener('input', (e) => {
    DOM.cfgIntervalDisplay.textContent = `${e.target.value} Detik`;
  });

  // Close modal when clicking backdrop
  DOM.settingsModal.addEventListener('click', (e) => {
    if (e.target === DOM.settingsModal) closeSettingsModal();
  });
}

function applyViewMode(mode) {
  state.viewMode = mode;
  localStorage.setItem(STORAGE_KEYS.VIEW_MODE, mode);

  if (mode === 'dense') {
    DOM.tableViewWrapper.classList.add('hidden');
    DOM.denseViewWrapper.classList.remove('hidden');
    DOM.btnViewDense.classList.add('bg-white', 'text-blue-700', 'shadow-sm');
    DOM.btnViewDense.classList.remove('text-slate-600');
    DOM.btnViewTable.classList.remove('bg-white', 'text-blue-700', 'shadow-sm');
    DOM.btnViewTable.classList.add('text-slate-600');
  } else {
    DOM.tableViewWrapper.classList.remove('hidden');
    DOM.denseViewWrapper.classList.add('hidden');
    DOM.btnViewTable.classList.add('bg-white', 'text-blue-700', 'shadow-sm');
    DOM.btnViewTable.classList.remove('text-slate-600');
    DOM.btnViewDense.classList.remove('bg-white', 'text-blue-700', 'shadow-sm');
    DOM.btnViewDense.classList.add('text-slate-600');
  }
}

function toggleTvMode() {
  state.isTvMode = !state.isTvMode;
  document.body.classList.toggle('tv-mode', state.isTvMode);

  if (state.isTvMode) {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  } else {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }
}

// ==============================================================================
// 7. DYNAMIC TAB FETCHING & RENDERING
// ==============================================================================
async function discoverSheetsFromApi() {
  if (!state.apiKey || !state.spreadsheetId) return;

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${state.spreadsheetId}?key=${state.apiKey}`;
    const resp = await fetch(url);
    if (resp.ok) {
      const data = await resp.json();
      if (data.sheets && Array.isArray(data.sheets)) {
        const sheetNames = data.sheets.map(s => s.properties.title);
        if (sheetNames.length > 0) {
          state.sheets = sheetNames;
          localStorage.setItem(STORAGE_KEYS.SHEET_NAMES, JSON.stringify(sheetNames));
          renderTabs();
        }
      }
    }
  } catch (err) {
    console.warn('API metadata discovery notice:', err);
  }
}

function renderTabs() {
  DOM.classTabsContainer.innerHTML = '';
  
  state.sheets.forEach(sheetName => {
    const isActive = sheetName === state.currentSheet;
    const btn = document.createElement('button');
    btn.className = `px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 active:scale-95 ${
      isActive 
        ? 'bg-perbakin-navy text-white shadow-md border border-perbakin-navy' 
        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
    }`;
    
    // Icon based on class name
    const iconClass = sheetName.toLowerCase().includes('pistol') 
      ? 'ph-crosshair-simple' 
      : 'ph-target';
      
    btn.innerHTML = `<i class="ph-bold ${iconClass}"></i><span>${escapeHtml(sheetName)}</span>`;
    
    btn.addEventListener('click', () => {
      if (state.currentSheet !== sheetName) {
        state.currentSheet = sheetName;
        renderTabs();
        resetCountdown();
        loadCurrentSheetData(false);
      }
    });
    
    DOM.classTabsContainer.appendChild(btn);
  });

  // Update current class title
  DOM.statCurrentClass.textContent = state.currentSheet;
  DOM.filterClassLabel.textContent = state.currentSheet;
  
  // Set distance badge
  if (state.currentSheet.toLowerCase().includes('pistol')) {
    DOM.statDistance.textContent = 'ISSF 10M Air Pistol';
  } else if (state.currentSheet.toLowerCase().includes('rifle')) {
    DOM.statDistance.textContent = 'ISSF 10M Air Rifle';
  } else {
    DOM.statDistance.textContent = 'Nomor Tanding Resmi';
  }
}

// ==============================================================================
// 8. DATA FETCHING (Google Visualization API / CSV / Fallback)
// ==============================================================================
async function loadCurrentSheetData(isSoftRefresh = false) {
  if (state.isFetching) return;
  state.isFetching = true;

  if (!isSoftRefresh) {
    DOM.loadingState.classList.remove('hidden');
    DOM.errorState.classList.add('hidden');
    DOM.podiumSection.classList.add('hidden');
  }

  DOM.refreshIcon.classList.add('animate-spin');

  try {
    const rawAthletes = await fetchFromGoogleSheets(state.spreadsheetId, state.currentSheet);
    
    // Cache data
    state.dataCache[state.currentSheet] = rawAthletes;
    state.isOfflineMode = false;
    state.lastUpdated = new Date();
    
    // Render
    DOM.loadingState.classList.add('hidden');
    DOM.errorState.classList.add('hidden');
    processAndRenderLeaderboard();
    updateConnectionStatus(true);

  } catch (error) {
    console.error('Fetch error:', error);
    
    // Check if we have cached data or can use mock data for demo
    if (state.dataCache[state.currentSheet] && state.dataCache[state.currentSheet].length > 0) {
      // Use existing cache softly
      processAndRenderLeaderboard();
      updateConnectionStatus(false, 'Mode Cache Aktif');
    } else if (MOCK_DATA[state.currentSheet]) {
      // Offline fallback mock data
      console.info('Mengaktifkan data demonstrasi untuk:', state.currentSheet);
      state.dataCache[state.currentSheet] = MOCK_DATA[state.currentSheet];
      state.isOfflineMode = true;
      state.lastUpdated = new Date();
      DOM.loadingState.classList.add('hidden');
      DOM.errorState.classList.add('hidden');
      processAndRenderLeaderboard();
      updateConnectionStatus(false, 'Mode Offline (Data Simulasi)');
    } else {
      DOM.loadingState.classList.add('hidden');
      DOM.errorState.classList.remove('hidden');
      DOM.errorMessage.textContent = `Tidak dapat terhubung ke Google Sheets: ${error.message || 'Koneksi gagal'}. Periksa Spreadsheet ID dan pastikan sheet berstatus publik.`;
      updateConnectionStatus(false, 'Koneksi Terputus');
    }
  } finally {
    state.isFetching = false;
    DOM.refreshIcon.classList.remove('animate-spin');
  }
}

/**
 * Fetch data via Google Visualization API endpoint:
 * https://docs.google.com/spreadsheets/d/{ID}/gviz/tq?tqx=out:json&sheet={SHEET}
 */
async function fetchFromGoogleSheets(sheetId, sheetName) {
  const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}&t=${Date.now()}`;
  
  const response = await fetch(gvizUrl, {
    method: 'GET',
    headers: { 'Accept': 'application/json, text/plain, */*' },
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} (${response.statusText})`);
  }

  const text = await response.text();
  
  // Parse response: google.visualization.Query.setResponse({...});
  const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?\s*$/);
  if (!match || !match[1]) {
    throw new Error('Format respon Google Sheets tidak valid atau sheet tidak publik.');
  }

  const json = JSON.parse(match[1]);
  if (json.status !== 'ok') {
    throw new Error(json.errors ? json.errors[0].message : 'Status respons tidak valid');
  }

  const table = json.table;
  if (!table || !table.cols || !table.rows) {
    return [];
  }

  // Map column index to standard field names
  // Standards: ID, Waktu Input, Kategori, Jenis Kelamin, Nama Peserta, Kontingen/Daerah, Skor Total, Total X
  const colIndexMap = detectColumnMapping(table.cols);

  const athletes = [];
  table.rows.forEach(row => {
    if (!row || !row.c) return;

    const getVal = (colKey) => {
      const idx = colIndexMap[colKey];
      if (idx === undefined || idx === null || !row.c[idx]) return '';
      const cell = row.c[idx];
      return cell.f !== undefined && cell.f !== null ? cell.f : (cell.v !== undefined && cell.v !== null ? cell.v : '');
    };

    const getNum = (colKey) => {
      const raw = getVal(colKey);
      if (typeof raw === 'number') return raw;
      if (!raw) return 0;
      // Handle format like "557-11x" or "557"
      const cleaned = String(raw).replace(/[^0-9.]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    };

    const nama = String(getVal('nama')).trim();
    // Skip empty rows
    if (!nama) return;

    // Check if score was input in "557-11x" format in a single column
    let skorTotal = getNum('skor');
    let totalX = getNum('x');
    const rawScoreStr = String(getVal('skor')).toLowerCase();

    if (rawScoreStr.includes('-') && rawScoreStr.includes('x') && totalX === 0) {
      const parts = rawScoreStr.split('-');
      skorTotal = parseFloat(parts[0]) || skorTotal;
      totalX = parseFloat(parts[1].replace('x', '')) || 0;
    }

    athletes.push({
      id: String(getVal('id')).trim() || `PBK-${athletes.length + 1}`,
      waktuInput: String(getVal('waktu')).trim() || '-',
      kategori: normalizeKategori(String(getVal('kategori'))),
      gender: normalizeGender(String(getVal('gender'))),
      nama: nama,
      kontingen: String(getVal('kontingen')).trim() || '-',
      skorTotal: skorTotal,
      totalX: totalX
    });
  });

  return athletes;
}

function detectColumnMapping(cols) {
  const map = {
    id: 0,
    waktu: 1,
    kategori: 2,
    gender: 3,
    nama: 4,
    kontingen: 5,
    skor: 6,
    x: 7
  };

  cols.forEach((col, idx) => {
    if (!col || !col.label) return;
    const lbl = col.label.toLowerCase();
    
    if (lbl.includes('id') || lbl === 'no') map.id = idx;
    else if (lbl.includes('waktu') || lbl.includes('time') || lbl.includes('date')) map.waktu = idx;
    else if (lbl.includes('kategori') || lbl.includes('category') || lbl.includes('kelas')) map.kategori = idx;
    else if (lbl.includes('kelamin') || lbl.includes('gender') || lbl.includes('l/p') || lbl.includes('sex')) map.gender = idx;
    else if (lbl.includes('nama') || lbl.includes('peserta') || lbl.includes('atlet') || lbl.includes('shooter')) map.nama = idx;
    else if (lbl.includes('kontingen') || lbl.includes('daerah') || lbl.includes('asal') || lbl.includes('team') || lbl.includes('club')) map.kontingen = idx;
    else if (lbl.includes('skor') || lbl.includes('score') || lbl.includes('total') || lbl === 'nilai') {
      if (lbl.includes('x') || lbl.includes('inner')) map.x = idx;
      else map.skor = idx;
    }
    else if (lbl.includes('x') || lbl.includes('inner 10') || lbl.includes('inner') || lbl.includes('tens')) map.x = idx;
  });

  return map;
}

function normalizeKategori(val) {
  const s = val.toLowerCase().trim();
  if (s.includes('sen')) return 'Senior';
  if (s.includes('jun')) return 'Junior';
  if (s.includes('youth')) return 'Youth';
  return val.trim() || 'Umum';
}

function normalizeGender(val) {
  const s = val.toLowerCase().trim();
  if (s.startsWith('p') && s.includes('tri')) return 'Putri';
  if (s.startsWith('p') && s.includes('tra')) return 'Putra';
  if (s === 'l' || s === 'men' || s === 'male') return 'Putra';
  if (s === 'p' || s === 'women' || s === 'female') return 'Putri';
  return val.trim() || '-';
}

// ==============================================================================
// 9. RANKING & TIE-BREAKER LOGIC (PRD Item 3)
// ==============================================================================
function processAndRenderLeaderboard() {
  const rawList = state.dataCache[state.currentSheet] || [];

  // 1. FILTERING
  const filtered = rawList.filter(item => {
    // Filter Kategori
    if (state.filters.kategori !== 'ALL') {
      if (item.kategori.toLowerCase() !== state.filters.kategori.toLowerCase()) return false;
    }
    // Filter Gender
    if (state.filters.gender !== 'ALL') {
      if (item.gender.toLowerCase() !== state.filters.gender.toLowerCase()) return false;
    }
    // Filter Search (Nama / Kontingen)
    if (state.filters.search) {
      const q = state.filters.search;
      const matchNama = item.nama.toLowerCase().includes(q);
      const matchKontingen = item.kontingen.toLowerCase().includes(q);
      if (!matchNama && !matchKontingen) return false;
    }
    return true;
  });

  // 2. SORTING DENGAN ATURAN TIE-BREAKER RESMI
  // Prioritas 1 (Skor Total): Diurutkan dari nilai tertinggi ke terendah.
  // Prioritas 2 (Total X / Inner 10): Jika Skor Total sama/seri, posisi lebih tinggi diberikan kepada atlet dengan jumlah Total X terbanyak.
  filtered.sort((a, b) => {
    if (b.skorTotal !== a.skorTotal) {
      return b.skorTotal - a.skorTotal;
    }
    if (b.totalX !== a.totalX) {
      return b.totalX - a.totalX;
    }
    // Jika skor dan X sama persis, urutkan alfabetis atau stabil
    return a.nama.localeCompare(b.nama);
  });

  // 3. ASSIGN RANK & DETECT TIES
  let currentRank = 1;
  const rankedAthletes = filtered.map((athlete, index) => {
    let rank = index + 1;
    let isTied = false;
    let tieBrokenByX = false;

    if (index > 0) {
      const prev = filtered[index - 1];
      // Cek apakah skor sama tapi X berbeda (Tie-breaker terjadi!)
      if (prev.skorTotal === athlete.skorTotal && prev.totalX > athlete.totalX) {
        tieBrokenByX = true;
      }
      
      // Jika skor DAN X sama persis, peringkat sama (Tied)
      if (prev.skorTotal === athlete.skorTotal && prev.totalX === athlete.totalX) {
        rank = filtered[index - 1].rank;
        isTied = true;
      } else {
        rank = index + 1;
      }
    }

    return {
      ...athlete,
      rank: rank,
      isTied: isTied,
      tieBrokenByX: tieBrokenByX
    };
  });

  state.filteredAthletes = rankedAthletes;

  // 4. RENDER UI COMPONENTS
  renderStats(rawList.length, rankedAthletes);
  renderPodium(rankedAthletes);
  renderTableView(rankedAthletes);
  renderDenseView(rankedAthletes);

  // Toggle empty state
  if (rankedAthletes.length === 0) {
    DOM.emptyState.classList.remove('hidden');
    DOM.podiumSection.classList.add('hidden');
    DOM.tableViewWrapper.classList.add('hidden');
    DOM.denseViewWrapper.classList.add('hidden');
  } else {
    DOM.emptyState.classList.add('hidden');
    if (state.viewMode === 'dense') {
      DOM.denseViewWrapper.classList.remove('hidden');
      DOM.tableViewWrapper.classList.add('hidden');
    } else {
      DOM.tableViewWrapper.classList.remove('hidden');
      DOM.denseViewWrapper.classList.add('hidden');
    }
  }

  // Update filter summary text
  updateFilterSummary(rawList.length, rankedAthletes.length);
}

// ==============================================================================
// 10. RENDERING UI
// ==============================================================================
function renderStats(totalRaw, rankedList) {
  DOM.statTotalShooters.textContent = totalRaw;
  DOM.statFilteredShooters.textContent = rankedList.length === totalRaw 
    ? 'Menampilkan semua atlet' 
    : `Filter aktif: ${rankedList.length} atlet`;
  
  DOM.rankBadgeCount.textContent = `${rankedList.length} Atlet`;

  if (rankedList.length > 0) {
    const leader = rankedList[0];
    DOM.statLeaderName.textContent = leader.nama;
    DOM.statLeaderScore.textContent = `${leader.skorTotal} (${leader.totalX}x)`;
  } else {
    DOM.statLeaderName.textContent = '-';
    DOM.statLeaderScore.textContent = '-';
  }

  if (state.lastUpdated) {
    const timeStr = state.lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    DOM.statLastUpdated.textContent = `${timeStr} WIB`;
  }
}

function updateFilterSummary(totalRaw, totalFiltered) {
  let text = `Menampilkan <span class="font-bold text-slate-800">${totalFiltered} dari ${totalRaw}</span> atlet`;
  if (state.filters.kategori !== 'ALL') {
    text += ` &bull; Kategori: <span class="font-bold text-blue-700">${state.filters.kategori}</span>`;
  }
  if (state.filters.gender !== 'ALL') {
    text += ` &bull; Gender: <span class="font-bold text-blue-700">${state.filters.gender}</span>`;
  }
  if (state.filters.search) {
    text += ` &bull; Pencarian: "<span class="font-bold text-slate-800">${escapeHtml(state.filters.search)}</span>"`;
  }
  DOM.filterSummaryText.innerHTML = text;
}

function renderPodium(rankedList) {
  // Hanya tampilkan jika tidak sedang pencarian spesifik dan ada minimal 1 atlet
  if (rankedList.length === 0 || state.filters.search) {
    DOM.podiumSection.classList.add('hidden');
    return;
  }

  DOM.podiumSection.classList.remove('hidden');

  const updatePodiumCard = (el, athlete) => {
    if (!athlete) {
      el.classList.add('opacity-40');
      el.querySelector('.podium-name').textContent = 'Belum Ada';
      el.querySelector('.podium-team').textContent = '-';
      el.querySelector('.podium-score').textContent = '-';
      el.querySelector('.podium-x').textContent = '-';
      return;
    }
    el.classList.remove('opacity-40');
    el.querySelector('.podium-name').textContent = athlete.nama;
    el.querySelector('.podium-team').textContent = `${athlete.kontingen} &bull; ${athlete.kategori} ${athlete.gender}`;
    el.querySelector('.podium-score').textContent = athlete.skorTotal;
    el.querySelector('.podium-x').textContent = `${athlete.totalX} X`;
  };

  updatePodiumCard(DOM.podium1, rankedList[0]);
  updatePodiumCard(DOM.podium2, rankedList[1]);
  updatePodiumCard(DOM.podium3, rankedList[2]);
}

function renderTableView(rankedList) {
  DOM.leaderboardTableBody.innerHTML = '';

  rankedList.forEach(athlete => {
    const tr = document.createElement('tr');
    tr.className = `transition-colors hover:bg-blue-50/50 ${getRowHighlightClass(athlete.rank)}`;

    const rankBadge = getRankBadgeHtml(athlete.rank);
    const genderBadge = athlete.gender === 'Putra' 
      ? '<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-200">Putra</span>'
      : '<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-pink-100 text-pink-800 border border-pink-200">Putri</span>';

    const katBadge = athlete.kategori === 'Senior'
      ? '<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">Senior</span>'
      : '<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">Junior</span>';

    tr.innerHTML = `
      <td class="py-3 px-3 sm:px-4 text-center">
        ${rankBadge}
      </td>
      <td class="py-3 px-3 sm:px-4">
        <div class="flex items-center gap-2">
          <span class="font-extrabold text-slate-900 sm:text-base leading-snug">${escapeHtml(athlete.nama)}</span>
          ${athlete.tieBrokenByX ? '<span title="Unggul posisi via Tie-Breaker Inner 10 (X)" class="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">X-Lead</span>' : ''}
        </div>
        <div class="text-xs font-semibold text-slate-500 mt-0.5 flex items-center gap-2">
          <span class="flex items-center gap-1 text-slate-700">
            <i class="ph-bold ph-map-pin text-blue-600"></i> ${escapeHtml(athlete.kontingen)}
          </span>
          <span class="text-slate-300">&bull;</span>
          <span class="font-mono text-slate-400 text-[11px]">ID: ${escapeHtml(athlete.id)}</span>
        </div>
      </td>
      <td class="py-3 px-3 sm:px-4 text-center">
        ${katBadge}
      </td>
      <td class="py-3 px-3 sm:px-4 text-center">
        ${genderBadge}
      </td>
      <td class="py-3 px-3 sm:px-4 text-right font-mono-numbers font-bold text-slate-700">
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200 text-xs">
          ${athlete.totalX} <span class="text-[10px] font-bold text-slate-400">X</span>
        </span>
      </td>
      <td class="py-3 px-3 sm:px-4 text-right">
        <span class="font-black font-mono-numbers text-lg sm:text-xl text-perbakin-navy">
          ${athlete.skorTotal}
        </span>
      </td>
      <td class="py-3 px-3 sm:px-4 text-center text-xs font-mono text-slate-500 hidden lg:table-cell">
        ${escapeHtml(formatTimeSnippet(athlete.waktuInput))}
      </td>
    `;

    DOM.leaderboardTableBody.appendChild(tr);
  });
}

function renderDenseView(rankedList) {
  DOM.denseViewWrapper.innerHTML = '';

  rankedList.forEach(athlete => {
    const card = document.createElement('div');
    card.className = `p-3 sm:p-4 transition-colors hover:bg-slate-50 flex items-center justify-between gap-3 ${getRowHighlightClass(athlete.rank)}`;

    const rankBadge = getRankBadgeHtml(athlete.rank);

    card.innerHTML = `
      <div class="flex items-center gap-3 min-w-0">
        <div class="flex-shrink-0">
          ${rankBadge}
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-1.5 flex-wrap">
            <h4 class="font-extrabold text-sm sm:text-base text-slate-900 truncate">${escapeHtml(athlete.nama)}</h4>
            ${athlete.tieBrokenByX ? '<span class="text-[9px] font-bold px-1 py-0.2 rounded bg-emerald-100 text-emerald-800">X-Lead</span>' : ''}
          </div>
          <div class="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5 truncate">
            <span class="font-semibold text-slate-700">${escapeHtml(athlete.kontingen)}</span>
            <span class="text-slate-300">&bull;</span>
            <span class="text-[11px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">${athlete.kategori} ${athlete.gender}</span>
          </div>
        </div>
      </div>

      <div class="text-right flex-shrink-0 pl-2">
        <div class="font-black font-mono-numbers text-lg sm:text-xl text-perbakin-navy leading-none">
          ${athlete.skorTotal}
        </div>
        <div class="text-xs font-bold font-mono-numbers text-amber-700 mt-1">
          ${athlete.totalX} X
        </div>
      </div>
    `;

    DOM.denseViewWrapper.appendChild(card);
  });
}

function getRankBadgeHtml(rank) {
  if (rank === 1) {
    return `<span class="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full rank-gold font-black text-xs sm:text-sm shadow-sm" title="Peringkat 1 (Emas)">1</span>`;
  }
  if (rank === 2) {
    return `<span class="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full rank-silver font-black text-xs sm:text-sm shadow-sm" title="Peringkat 2 (Perak)">2</span>`;
  }
  if (rank === 3) {
    return `<span class="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full rank-bronze font-black text-xs sm:text-sm shadow-sm" title="Peringkat 3 (Perunggu)">3</span>`;
  }
  return `<span class="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm border border-slate-300">${rank}</span>`;
}

function getRowHighlightClass(rank) {
  if (rank === 1) return 'bg-amber-50/50';
  if (rank === 2) return 'bg-slate-50/70';
  if (rank === 3) return 'bg-orange-50/30';
  return 'bg-white';
}

function updateConnectionStatus(isOnline, customLabel = null) {
  if (customLabel) {
    DOM.statConnectionStatus.textContent = customLabel;
    DOM.statConnectionStatus.className = isOnline ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold';
  } else if (isOnline) {
    DOM.statConnectionStatus.textContent = 'Tersambung ke Sheets';
    DOM.statConnectionStatus.className = 'text-emerald-700 font-semibold';
  } else {
    DOM.statConnectionStatus.textContent = 'Koneksi Terputus';
    DOM.statConnectionStatus.className = 'text-red-600 font-semibold';
  }
}

// ==============================================================================
// 11. SOFT-REFRESH POLLING ENGINE (PRD Item 5)
// ==============================================================================
function startCountdownTicker() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.countdown = state.pollIntervalSec;

  state.timerInterval = setInterval(() => {
    state.countdown--;
    
    // Update progress bar
    const percent = Math.max(0, Math.min(100, (state.countdown / state.pollIntervalSec) * 100));
    DOM.refreshProgressBar.style.width = `${percent}%`;
    DOM.countdownTimer.textContent = `${state.countdown}s`;

    if (state.countdown <= 0) {
      resetCountdown();
      // Lakukan pembaruan data secara transparan di background (soft-refresh)
      loadCurrentSheetData(true);
    }
  }, 1000);
}

function resetCountdown() {
  state.countdown = state.pollIntervalSec;
  DOM.countdownTimer.textContent = `${state.countdown}s`;
  DOM.refreshProgressBar.style.width = '100%';
}

// ==============================================================================
// 12. SETTINGS MODAL MANAGEMENT
// ==============================================================================
function openSettingsModal() {
  DOM.cfgSpreadsheetId.value = state.spreadsheetId;
  DOM.cfgSheetNames.value = state.sheets.join(', ');
  DOM.cfgRefreshInterval.value = state.pollIntervalSec;
  DOM.cfgIntervalDisplay.textContent = `${state.pollIntervalSec} Detik`;
  DOM.cfgApiKey.value = state.apiKey;
  
  DOM.settingsModal.classList.remove('hidden');
}

function closeSettingsModal() {
  DOM.settingsModal.classList.add('hidden');
}

function saveSettingsModal() {
  const newId = DOM.cfgSpreadsheetId.value.trim();
  const rawSheets = DOM.cfgSheetNames.value.trim();
  const newInterval = parseInt(DOM.cfgRefreshInterval.value) || DEFAULT_POLL_INTERVAL_SEC;
  const newApiKey = DOM.cfgApiKey.value.trim();

  if (!newId) {
    alert('Spreadsheet ID wajib diisi!');
    return;
  }

  const sheetList = rawSheets.split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  if (sheetList.length === 0) {
    alert('Minimal masukkan satu nama tab sheet!');
    return;
  }

  state.spreadsheetId = newId;
  state.sheets = sheetList;
  state.pollIntervalSec = newInterval;
  state.apiKey = newApiKey;

  // Persist to localStorage
  localStorage.setItem(STORAGE_KEYS.SPREADSHEET_ID, newId);
  localStorage.setItem(STORAGE_KEYS.SHEET_NAMES, JSON.stringify(sheetList));
  localStorage.setItem(STORAGE_KEYS.POLL_INTERVAL, newInterval.toString());
  localStorage.setItem(STORAGE_KEYS.API_KEY, newApiKey);

  // If current sheet is not in new list, pick the first
  if (!state.sheets.includes(state.currentSheet)) {
    state.currentSheet = state.sheets[0];
  }

  updateFooterLinks();
  renderTabs();
  resetCountdown();
  startCountdownTicker();
  closeSettingsModal();

  // Reload data
  loadCurrentSheetData(false);
}

function resetSettingsToDefault() {
  if (confirm('Kembalikan konfigurasi ke setelan default template PRD?')) {
    DOM.cfgSpreadsheetId.value = SPREADSHEET_ID;
    DOM.cfgSheetNames.value = DEFAULT_SHEETS.join(', ');
    DOM.cfgRefreshInterval.value = DEFAULT_POLL_INTERVAL_SEC;
    DOM.cfgIntervalDisplay.textContent = `${DEFAULT_POLL_INTERVAL_SEC} Detik`;
    DOM.cfgApiKey.value = '';
  }
}

// ==============================================================================
// 13. UTILITIES
// ==============================================================================
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatTimeSnippet(datetimeStr) {
  if (!datetimeStr || datetimeStr === '-') return '-';
  // If format "2025-05-18 09:30:00"
  const parts = datetimeStr.split(' ');
  return parts.length > 1 ? parts[1] : datetimeStr;
}

