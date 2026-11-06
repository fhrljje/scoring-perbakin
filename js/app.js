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
  VIEW_MODE: 'perbakin_scoring_view_mode',
  ACTIVE_DIVISION: 'perbakin_scoring_division'
};

// ==============================================================================
// 2. MOCK / OFFLINE FALLBACK DATA TEMPLATE
// (Hanya memuat 3 data asli template tanpa data fiktif buatan)
// ==============================================================================
const MOCK_DATA = {
  'Air Pistol': [
    { id: 'PBK-001', waktuInput: '2025-05-18 09:30:00', kategori: 'Senior', gender: 'Putra', nama: 'Edy Santoso', kontingen: 'DKI Jakarta', skorTotal: 414, totalX: 3 },
    { id: 'PBK-004', waktuInput: '2025-05-18 11:20:00', kategori: 'Senior', gender: 'Putri', nama: 'Dewi Lestari', kontingen: 'Jawa Tengah', skorTotal: 558, totalX: 12 },
    { id: 'PBK-006', waktuInput: '2025-05-18 14:10:00', kategori: 'Junior', gender: 'Putra', nama: 'Bagus Setiawan', kontingen: 'Banten', skorTotal: 532, totalX: 8 }
  ],
  'Air Rifle': [
    { id: 'PBK-002', waktuInput: '2025-05-18 10:15:00', kategori: 'Senior', gender: 'Putra', nama: 'Session 17', kontingen: 'Jawa Barat', skorTotal: 422, totalX: 1 },
    { id: 'PBK-003', waktuInput: '2025-05-18 10:45:00', kategori: 'Junior', gender: 'Putri', nama: 'Audrey Zahra', kontingen: 'Jawa Timur', skorTotal: 615, totalX: 24 },
    { id: 'PBK-005', waktuInput: '2025-05-18 13:00:00', kategori: 'Junior', gender: 'Putra', nama: 'Rifqi Pratama', kontingen: 'DKI Jakarta', skorTotal: 589, totalX: 18 }
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
  activeDivision: localStorage.getItem(STORAGE_KEYS.ACTIVE_DIVISION) || 'Putra', // 'Putra' | 'Putri' | 'SPLIT'
  dataCache: {},          // Cache raw data per sheet name
  
  filters: {
    kategori: 'ALL',      // 'ALL' | 'Senior' | 'Junior'
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
  btnDivisionPutra: document.getElementById('btnDivisionPutra'),
  btnDivisionPutri: document.getElementById('btnDivisionPutri'),
  btnDivisionSplit: document.getElementById('btnDivisionSplit'),
  badgeCountPutra: document.getElementById('badgeCountPutra'),
  badgeCountPutri: document.getElementById('badgeCountPutri'),
  
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
  btnViewTable: document.getElementById('btnViewTable'),
  btnViewDense: document.getElementById('btnViewDense'),
  
  // Single Division Containers (Putra or Putri)
  singleDivisionSection: document.getElementById('singleDivisionSection'),
  podiumSection: document.getElementById('podiumSection'),
  podium1: document.getElementById('podium1'),
  podium2: document.getElementById('podium2'),
  podium3: document.getElementById('podium3'),
  tableViewWrapper: document.getElementById('tableViewWrapper'),
  denseViewWrapper: document.getElementById('denseViewWrapper'),
  leaderboardTableBody: document.getElementById('leaderboardTableBody'),
  rankBadgeCount: document.getElementById('rankBadgeCount'),
  divisionHeaderTitle: document.getElementById('divisionHeaderTitle'),
  
  // Split View Containers (Putra and Putri side by side)
  splitViewSection: document.getElementById('splitViewSection'),
  splitPutraContainer: document.getElementById('splitPutraContainer'),
  splitPutriContainer: document.getElementById('splitPutriContainer'),
  
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
  btnPrintResults: document.getElementById('btnPrintResults'),
  printClassTitle: document.getElementById('printClassTitle'),
  printTimestamp: document.getElementById('printTimestamp'),
  btnToggleTv: document.getElementById('btnToggleTv'),
  btnOpenSettings: document.getElementById('btnOpenSettings'),
  
  // Athlete Detail Modal
  athleteDetailModal: document.getElementById('athleteDetailModal'),
  modalAthleteName: document.getElementById('modalAthleteName'),
  modalAthleteMeta: document.getElementById('modalAthleteMeta'),
  modalAthleteScore: document.getElementById('modalAthleteScore'),
  modalAthleteX: document.getElementById('modalAthleteX'),
  modalAthleteId: document.getElementById('modalAthleteId'),
  modalAthleteTeam: document.getElementById('modalAthleteTeam'),
  modalAthleteCatGen: document.getElementById('modalAthleteCatGen'),
  modalAthleteTime: document.getElementById('modalAthleteTime'),
  modalAthleteAvg: document.getElementById('modalAthleteAvg'),
  btnCloseAthleteModal: document.getElementById('btnCloseAthleteModal'),
  btnDismissAthleteModal: document.getElementById('btnDismissAthleteModal'),
  
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
  if (DOM.currentYear) DOM.currentYear.textContent = new Date().getFullYear();
  updateFooterLinks();
  
  setupEventListeners();
  
  state.currentSheet = state.sheets[0] || 'Air Pistol';
  
  applyViewMode(state.viewMode);
  applyDivision(state.activeDivision);
  
  renderTabs();
  
  if (state.apiKey) {
    await discoverSheetsFromApi();
  }
  
  await loadCurrentSheetData(false);
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

  // Division buttons (Putra / Putri / Split)
  if (DOM.btnDivisionPutra) {
    DOM.btnDivisionPutra.addEventListener('click', () => applyDivision('Putra'));
  }
  if (DOM.btnDivisionPutri) {
    DOM.btnDivisionPutri.addEventListener('click', () => applyDivision('Putri'));
  }
  if (DOM.btnDivisionSplit) {
    DOM.btnDivisionSplit.addEventListener('click', () => applyDivision('SPLIT'));
  }

  // View mode toggles
  DOM.btnViewTable.addEventListener('click', () => applyViewMode('table'));
  DOM.btnViewDense.addEventListener('click', () => applyViewMode('dense'));

  // TV / Presentation mode
  DOM.btnToggleTv.addEventListener('click', toggleTvMode);

  // Print Results Bulletin
  if (DOM.btnPrintResults) {
    DOM.btnPrintResults.addEventListener('click', () => {
      const now = new Date();
      if (DOM.printClassTitle) {
        const divLabel = state.activeDivision === 'Putri' ? 'Divisi Putri (Women)' : (state.activeDivision === 'Putra' ? 'Divisi Putra (Men)' : 'Seluruh Divisi');
        DOM.printClassTitle.textContent = `${state.currentSheet} ISSF 10M - ${divLabel}`;
      }
      if (DOM.printTimestamp) {
        DOM.printTimestamp.textContent = `${now.toLocaleDateString('id-ID', { dateStyle: 'full' })}, ${now.toLocaleTimeString('id-ID')} WIB`;
      }
      window.print();
    });
  }

  // Athlete detail modal close
  if (DOM.btnCloseAthleteModal) {
    DOM.btnCloseAthleteModal.addEventListener('click', closeAthleteModal);
  }
  if (DOM.btnDismissAthleteModal) {
    DOM.btnDismissAthleteModal.addEventListener('click', closeAthleteModal);
  }
  if (DOM.athleteDetailModal) {
    DOM.athleteDetailModal.addEventListener('click', (e) => {
      if (e.target === DOM.athleteDetailModal) closeAthleteModal();
    });
  }

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

  DOM.settingsModal.addEventListener('click', (e) => {
    if (e.target === DOM.settingsModal) closeSettingsModal();
  });
}

function applyDivision(division) {
  state.activeDivision = division;
  localStorage.setItem(STORAGE_KEYS.ACTIVE_DIVISION, division);

  // Reset styles
  const allBtns = [DOM.btnDivisionPutra, DOM.btnDivisionPutri, DOM.btnDivisionSplit].filter(Boolean);
  allBtns.forEach(btn => {
    btn.className = 'px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 text-slate-600 hover:text-slate-900';
  });

  if (division === 'Putra' && DOM.btnDivisionPutra) {
    DOM.btnDivisionPutra.className = 'px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 bg-blue-700 text-white shadow-sm';
  } else if (division === 'Putri' && DOM.btnDivisionPutri) {
    DOM.btnDivisionPutri.className = 'px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 bg-pink-700 text-white shadow-sm';
  } else if (division === 'SPLIT' && DOM.btnDivisionSplit) {
    DOM.btnDivisionSplit.className = 'px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 bg-perbakin-navy text-white shadow-sm';
  }

  processAndRenderLeaderboard();
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
    btn.className = `px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 active:scale-95 ${
      isActive 
        ? 'bg-perbakin-navy text-white shadow-md border border-perbakin-navy' 
        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
    }`;
    
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

  DOM.statCurrentClass.textContent = state.currentSheet;
  DOM.filterClassLabel.textContent = state.currentSheet;
  
  if (state.currentSheet.toLowerCase().includes('pistol')) {
    DOM.statDistance.textContent = 'ISSF 10M Air Pistol';
  } else if (state.currentSheet.toLowerCase().includes('rifle')) {
    DOM.statDistance.textContent = 'ISSF 10M Air Rifle';
  } else {
    DOM.statDistance.textContent = 'Nomor Tanding Resmi';
  }
}

// ==============================================================================
// 8. DATA FETCHING (Multi-Strategy: GViz JSON, GViz CSV, JSONP & Fallback)
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
    // Ambil data langsung dari Google Sheets dengan multi-strategi
    const rawAthletes = await fetchFromGoogleSheetsRobust(state.spreadsheetId, state.currentSheet);
    
    if (Array.isArray(rawAthletes) && rawAthletes.length > 0) {
      state.dataCache[state.currentSheet] = rawAthletes;
      state.isOfflineMode = false;
      state.lastUpdated = new Date();
      updateConnectionStatus(true);
    } else {
      throw new Error('Data sheet kosong atau format kolom belum sesuai.');
    }

  } catch (error) {
    console.warn('Fetch error:', error.message);
    
    // Jika ada cache sebelumnya, gunakan
    if (state.dataCache[state.currentSheet] && state.dataCache[state.currentSheet].length > 0) {
      updateConnectionStatus(false, 'Mode Cache Aktif');
    } else if (MOCK_DATA[state.currentSheet]) {
      // Gunakan fallback template asli (hanya 3 baris asli dari spreadsheet)
      state.dataCache[state.currentSheet] = MOCK_DATA[state.currentSheet];
      state.isOfflineMode = true;
      state.lastUpdated = new Date();
      updateConnectionStatus(false, 'Mode Cadangan Lokal');
    } else {
      DOM.errorState.classList.remove('hidden');
      DOM.errorMessage.textContent = `Tidak dapat terhubung ke Google Sheets: ${error.message || 'Koneksi gagal'}. Pastikan setelan berbagi diatur ke "Anyone with the link can view".`;
      updateConnectionStatus(false, 'Koneksi Terputus');
    }
  } finally {
    state.isFetching = false;
    DOM.refreshIcon.classList.remove('animate-spin');
    // JAMINAN MUTLAK: Loading spinner selalu ditutup dalam kondisi apapun
    DOM.loadingState.classList.add('hidden');
    try {
      processAndRenderLeaderboard();
    } catch (renderError) {
      console.error('Render error:', renderError);
    }
  }
}

/**
 * Pengambilan data gviz dengan multi-strategi:
 * 1. GViz JSON via fetch (dengan timeout 5 detik)
 * 2. GViz CSV via fetch (format murni teks CSV, bebas wrapper)
 * 3. JSONP script injection (bypasses browser CORS secara total)
 */
async function fetchFromGoogleSheetsRobust(sheetId, sheetName) {
  // Metode 1: Fetch GViz JSON (Primary)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}&t=${Date.now()}`;
    const response = await fetch(gvizUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json, text/plain, */*' },
      cache: 'no-store',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const text = await response.text();
      const startIdx = text.indexOf('{');
      const endIdx = text.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        const json = JSON.parse(text.substring(startIdx, endIdx + 1));
        if (json && json.status === 'ok' && json.table) {
          const list = parseGvizTable(json.table);
          if (Array.isArray(list) && list.length > 0) return list;
        }
      }
    }
  } catch (fetchErr) {
    console.warn('Metode 1 (Fetch GViz JSON) dilewati:', fetchErr.message);
  }

  // Metode 2: Fetch GViz CSV (Secondary - super cepat & reliabel)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}&t=${Date.now()}`;
    const response = await fetch(csvUrl, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const csvText = await response.text();
      const list = parseCsvTable(csvText);
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch (csvErr) {
    console.warn('Metode 2 (Fetch CSV) dilewati:', csvErr.message);
  }

  // Metode 3: JSONP Callback (Bypass CORS sepenuhnya)
  try {
    const jsonpData = await fetchGoogleSheetsJsonp(sheetId, sheetName);
    if (jsonpData && jsonpData.table) {
      const list = parseGvizTable(jsonpData.table);
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch (jsonpErr) {
    console.warn('Metode 3 (JSONP) dilewati:', jsonpErr.message);
  }

  throw new Error('Gagal memuat data dari semua jalur koneksi Google Sheets.');
}

function fetchGoogleSheetsJsonp(sheetId, sheetName) {
  return new Promise((resolve, reject) => {
    const callbackName = 'perbakin_gviz_' + Math.floor(Math.random() * 10000000);
    const script = document.createElement('script');
    
    const timeoutTimer = setTimeout(() => {
      cleanup();
      reject(new Error('Koneksi Google Sheets timeout via JSONP.'));
    }, 8000);

    function cleanup() {
      clearTimeout(timeoutTimer);
      if (script.parentNode) script.parentNode.removeChild(script);
      delete window[callbackName];
    }

    window[callbackName] = function(json) {
      cleanup();
      if (json && json.status === 'ok') {
        resolve(json);
      } else {
        reject(new Error(json && json.errors ? json.errors[0].message : 'Format data Sheets tidak valid.'));
      }
    };

    script.src = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=responseHandler:${callbackName}&sheet=${encodeURIComponent(sheetName)}&t=${Date.now()}`;
    script.onerror = function() {
      cleanup();
      reject(new Error('Gagal memuat script JSONP Google Sheets.'));
    };

    document.body.appendChild(script);
  });
}

function parseCsvTable(csvText) {
  if (!csvText) return [];
  const lines = csvText.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) return [];

  const parseLine = (text) => {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (inQuotes && text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const colIndexMap = detectColumnMapping(headers.map(h => ({ label: h })));
  const athletes = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseLine(lines[i]);
    const getVal = (colKey) => {
      const idx = colIndexMap[colKey];
      return (idx !== undefined && idx < row.length) ? row[idx] : '';
    };

    const getNum = (colKey) => {
      const raw = getVal(colKey);
      if (!raw) return 0;
      const cleaned = String(raw).replace(/[^0-9.]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    };

    const nama = String(getVal('nama')).trim();
    if (!nama) continue;

    let skorTotal = getNum('skor');
    let totalX = getNum('x');

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
  }

  return athletes;
}

function parseGvizTable(table) {
  if (!table || !table.cols || !table.rows) return [];

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
      const cleaned = String(raw).replace(/[^0-9.]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    };

    const nama = String(getVal('nama')).trim();
    if (!nama) return; // Lewati baris kosong

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
  if (s === 'l' || s === 'men' || s === 'male' || s === 'pria') return 'Putra';
  if (s === 'p' || s === 'women' || s === 'female' || s === 'wanita') return 'Putri';
  return val.trim() || '-';
}

// ==============================================================================
// 9. LOGIKA PEMISAHAN KELAS PRIA (PUTRA) & WANITA (PUTRI) & TIE-BREAKER RESMI
// ==============================================================================
function processAndRenderLeaderboard() {
  const rawList = state.dataCache[state.currentSheet] || [];

  // Hitung jumlah atlet per gender untuk badge counter
  const totalPutra = rawList.filter(a => a.gender === 'Putra').length;
  const totalPutri = rawList.filter(a => a.gender === 'Putri').length;

  if (DOM.badgeCountPutra) DOM.badgeCountPutra.textContent = totalPutra;
  if (DOM.badgeCountPutri) DOM.badgeCountPutri.textContent = totalPutri;

  // Mode Split: Tampilkan dua tabel terpisah berdampingan
  if (state.activeDivision === 'SPLIT') {
    renderSplitView(rawList);
    return;
  }

  // Mode Divisi Tunggal (Putra ATAU Putri)
  if (DOM.splitViewSection) DOM.splitViewSection.classList.add('hidden');
  if (DOM.singleDivisionSection) DOM.singleDivisionSection.classList.remove('hidden');

  // Filter atlet berdasarkan Divisi Aktif (Putra atau Putri)
  let divisionAthletes = rawList.filter(item => {
    if (state.activeDivision === 'Putra' && item.gender !== 'Putra') return false;
    if (state.activeDivision === 'Putri' && item.gender !== 'Putri') return false;
    
    // Filter Kategori
    if (state.filters.kategori !== 'ALL') {
      if (item.kategori.toLowerCase() !== state.filters.kategori.toLowerCase()) return false;
    }
    
    // Filter Pencarian
    if (state.filters.search) {
      const q = state.filters.search;
      const matchNama = item.nama.toLowerCase().includes(q);
      const matchKontingen = item.kontingen.toLowerCase().includes(q);
      if (!matchNama && !matchKontingen) return false;
    }
    return true;
  });

  // Urutkan & Terapkan Tie-breaker
  const rankedAthletes = sortAndRankAthletes(divisionAthletes);

  // Update Judul Divisi
  const divName = state.activeDivision === 'Putri' ? 'Divisi Putri (Wanita)' : 'Divisi Putra (Pria)';
  if (DOM.divisionHeaderTitle) {
    DOM.divisionHeaderTitle.textContent = `Klasemen Resmi ${state.currentSheet} - ${divName}`;
  }

  // Render komponen antarmuka
  renderStats(rawList.length, rankedAthletes);
  renderPodium(rankedAthletes);
  renderTableView(rankedAthletes);
  renderDenseView(rankedAthletes);

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

  updateFilterSummary(rawList.length, rankedAthletes.length);
}

/**
 * Aturan Pengurutan & Tie-Breaker ISSF/Perbakin:
 * Prioritas 1: Skor Total (Tertinggi ke terendah)
 * Prioritas 2: Total X / Inner 10 (Jika skor sama, jumlah X terbanyak menempati peringkat lebih tinggi)
 */
function sortAndRankAthletes(athletes) {
  const sorted = [...athletes].sort((a, b) => {
    if (b.skorTotal !== a.skorTotal) {
      return b.skorTotal - a.skorTotal;
    }
    if (b.totalX !== a.totalX) {
      return b.totalX - a.totalX;
    }
    return a.nama.localeCompare(b.nama);
  });

  return sorted.map((athlete, index) => {
    let rank = index + 1;
    let isTied = false;
    let tieBrokenByX = false;

    if (index > 0) {
      const prev = sorted[index - 1];
      if (prev.skorTotal === athlete.skorTotal && prev.totalX > athlete.totalX) {
        tieBrokenByX = true;
      }
      if (prev.skorTotal === athlete.skorTotal && prev.totalX === athlete.totalX) {
        rank = sorted[index - 1].rank;
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
}

// ==============================================================================
// 10. SPLIT VIEW: KLASIFIKASI PUTRA & PUTRI BERDAMPINGAN SECARA MANDIRI
// ==============================================================================
function renderSplitView(rawList) {
  if (DOM.singleDivisionSection) DOM.singleDivisionSection.classList.add('hidden');
  if (DOM.splitViewSection) DOM.splitViewSection.classList.remove('hidden');

  const filterFn = (item) => {
    if (state.filters.kategori !== 'ALL') {
      if (item.kategori.toLowerCase() !== state.filters.kategori.toLowerCase()) return false;
    }
    if (state.filters.search) {
      const q = state.filters.search;
      if (!item.nama.toLowerCase().includes(q) && !item.kontingen.toLowerCase().includes(q)) return false;
    }
    return true;
  };

  const putraAthletes = sortAndRankAthletes(rawList.filter(a => a.gender === 'Putra' && filterFn(a)));
  const putriAthletes = sortAndRankAthletes(rawList.filter(a => a.gender === 'Putri' && filterFn(a)));

  renderStats(rawList.length, [...putraAthletes, ...putriAthletes]);

  if (DOM.splitPutraContainer) {
    DOM.splitPutraContainer.innerHTML = buildDivisionCardHtml('Divisi Putra (Pria)', 'blue', putraAthletes);
    attachRowClickListeners(DOM.splitPutraContainer, putraAthletes);
  }
  if (DOM.splitPutriContainer) {
    DOM.splitPutriContainer.innerHTML = buildDivisionCardHtml('Divisi Putri (Wanita)', 'pink', putriAthletes);
    attachRowClickListeners(DOM.splitPutriContainer, putriAthletes);
  }

  updateFilterSummary(rawList.length, putraAthletes.length + putriAthletes.length);
}

function buildDivisionCardHtml(title, colorTheme, rankedList) {
  const isBlue = colorTheme === 'blue';
  const borderCol = isBlue ? 'border-t-blue-600' : 'border-t-pink-600';
  const textCol = isBlue ? 'text-blue-900' : 'text-pink-900';
  const icon = isBlue ? 'ph-gender-male' : 'ph-gender-female';

  let podiumHtml = '';
  if (rankedList.length > 0) {
    const champ = rankedList[0];
    podiumHtml = `
      <div class="mb-4 p-3.5 rounded-xl bg-gradient-to-r ${isBlue ? 'from-amber-50 to-blue-50 border-amber-200' : 'from-amber-50 to-pink-50 border-amber-200'} border flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full rank-gold flex items-center justify-center font-black shadow-sm">
            <i class="ph-fill ph-crown text-lg text-amber-950"></i>
          </div>
          <div>
            <span class="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">Juara 1 &bull; Emas</span>
            <div class="font-black text-sm text-slate-900 truncate">${escapeHtml(champ.nama)}</div>
            <div class="text-[11px] text-slate-600">${escapeHtml(champ.kontingen)}</div>
          </div>
        </div>
        <div class="text-right">
          <div class="font-black font-mono-numbers text-xl text-slate-900">${champ.skorTotal}</div>
          <div class="text-xs font-bold text-amber-700">${champ.totalX} X</div>
        </div>
      </div>
    `;
  }

  let rowsHtml = '';
  if (rankedList.length === 0) {
    rowsHtml = `<tr><td colspan="4" class="p-6 text-center text-slate-400 text-xs">Belum ada peserta di divisi ini</td></tr>`;
  } else {
    rankedList.forEach(athlete => {
      rowsHtml += `
        <tr class="hover:bg-slate-50 cursor-pointer athlete-row transition" data-athlete-id="${athlete.id}">
          <td class="py-2.5 px-3 text-center">${getRankBadgeHtml(athlete.rank)}</td>
          <td class="py-2.5 px-3">
            <div class="font-bold text-slate-900 text-sm leading-tight">${escapeHtml(athlete.nama)}</div>
            <div class="text-[11px] text-slate-500">${escapeHtml(athlete.kontingen)} &bull; <span class="font-mono">${athlete.kategori}</span></div>
          </td>
          <td class="py-2.5 px-3 text-right font-mono-numbers text-xs font-bold text-slate-600">${athlete.totalX} X</td>
          <td class="py-2.5 px-3 text-right font-mono-numbers font-black text-base text-perbakin-navy">${athlete.skorTotal}</td>
        </tr>
      `;
    });
  }

  return `
    <div class="bg-white rounded-xl outdoor-card p-4 border-t-4 ${borderCol} flex flex-col justify-between">
      <div>
        <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
          <div class="flex items-center gap-2">
            <i class="ph-bold ${icon} text-lg ${isBlue ? 'text-blue-700' : 'text-pink-600'}"></i>
            <h3 class="font-extrabold text-base ${textCol}">${title}</h3>
          </div>
          <span class="text-xs px-2 py-0.5 rounded-full font-bold ${isBlue ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'} font-mono">${rankedList.length} Atlet</span>
        </div>
        ${podiumHtml}
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                <th class="py-2 px-3 text-center w-12">Pos</th>
                <th class="py-2 px-3">Atlet</th>
                <th class="py-2 px-3 text-right w-16">X</th>
                <th class="py-2 px-3 text-right w-20">Skor</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function attachRowClickListeners(container, list) {
  const rows = container.querySelectorAll('.athlete-row');
  rows.forEach(row => {
    row.addEventListener('click', () => {
      const id = row.getAttribute('data-athlete-id');
      const found = list.find(a => a.id === id);
      if (found) openAthleteModal(found);
    });
  });
}

// ==============================================================================
// 11. RENDERING ANTARMUKA UMUM
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
  const divLabel = state.activeDivision === 'Putri' 
    ? 'Divisi Putri' 
    : (state.activeDivision === 'Putra' ? 'Divisi Putra' : 'Dua Divisi Terpisah');

  let text = `Menampilkan <span class="font-bold text-slate-800">${totalFiltered} dari ${totalRaw}</span> atlet di <span class="font-bold text-blue-700">${divLabel}</span>`;
  if (state.filters.kategori !== 'ALL') {
    text += ` &bull; Kategori: <span class="font-bold text-blue-700">${state.filters.kategori}</span>`;
  }
  if (state.filters.search) {
    text += ` &bull; Pencarian: "<span class="font-bold text-slate-800">${escapeHtml(state.filters.search)}</span>"`;
  }
  DOM.filterSummaryText.innerHTML = text;
}

function renderPodium(rankedList) {
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
    el.querySelector('.podium-team').textContent = `${athlete.kontingen} &bull; ${athlete.kategori}`;
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
    tr.className = `transition-colors hover:bg-blue-50/50 cursor-pointer ${getRowHighlightClass(athlete.rank)}`;
    tr.addEventListener('click', () => openAthleteModal(athlete));

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
    card.className = `p-3 sm:p-4 transition-colors hover:bg-slate-50 cursor-pointer flex items-center justify-between gap-3 ${getRowHighlightClass(athlete.rank)}`;
    card.addEventListener('click', () => openAthleteModal(athlete));

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
// 12. ATHLETE DETAIL MODAL
// ==============================================================================
function openAthleteModal(athlete) {
  if (!DOM.athleteDetailModal || !athlete) return;

  if (DOM.modalAthleteName) DOM.modalAthleteName.textContent = athlete.nama;
  if (DOM.modalAthleteMeta) DOM.modalAthleteMeta.textContent = `${athlete.kontingen} • ${athlete.kategori} ${athlete.gender}`;
  if (DOM.modalAthleteScore) DOM.modalAthleteScore.textContent = athlete.skorTotal;
  if (DOM.modalAthleteX) DOM.modalAthleteX.textContent = `${athlete.totalX} X`;
  if (DOM.modalAthleteId) DOM.modalAthleteId.textContent = athlete.id || '-';
  if (DOM.modalAthleteTeam) DOM.modalAthleteTeam.textContent = athlete.kontingen || '-';
  if (DOM.modalAthleteCatGen) DOM.modalAthleteCatGen.textContent = `${athlete.kategori} (${athlete.gender})`;
  if (DOM.modalAthleteTime) DOM.modalAthleteTime.textContent = athlete.waktuInput || '-';

  if (DOM.modalAthleteAvg) {
    const avg = athlete.skorTotal > 0 ? (athlete.skorTotal / 60).toFixed(2) : '0.00';
    DOM.modalAthleteAvg.textContent = `${avg} / 10 Poin per Tembakan`;
  }

  DOM.athleteDetailModal.classList.remove('hidden');
}

function closeAthleteModal() {
  if (DOM.athleteDetailModal) {
    DOM.athleteDetailModal.classList.add('hidden');
  }
}

// ==============================================================================
// 13. SOFT-REFRESH POLLING ENGINE (PRD Item 5)
// ==============================================================================
function startCountdownTicker() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.countdown = state.pollIntervalSec;

  state.timerInterval = setInterval(() => {
    state.countdown--;
    
    const percent = Math.max(0, Math.min(100, (state.countdown / state.pollIntervalSec) * 100));
    DOM.refreshProgressBar.style.width = `${percent}%`;
    DOM.countdownTimer.textContent = `${state.countdown}s`;

    if (state.countdown <= 0) {
      resetCountdown();
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
// 14. SETTINGS MODAL MANAGEMENT
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

  localStorage.setItem(STORAGE_KEYS.SPREADSHEET_ID, newId);
  localStorage.setItem(STORAGE_KEYS.SHEET_NAMES, JSON.stringify(sheetList));
  localStorage.setItem(STORAGE_KEYS.POLL_INTERVAL, newInterval.toString());
  localStorage.setItem(STORAGE_KEYS.API_KEY, newApiKey);

  if (!state.sheets.includes(state.currentSheet)) {
    state.currentSheet = state.sheets[0];
  }

  updateFooterLinks();
  renderTabs();
  resetCountdown();
  startCountdownTicker();
  closeSettingsModal();

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
// 15. UTILITIES
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
  const parts = datetimeStr.split(' ');
  return parts.length > 1 ? parts[1] : datetimeStr;
}
