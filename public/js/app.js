// ============================================================================
// SCM KEDAI KOPI & PASTRY "MUGI BERKAH" — FRONTEND SPA LOGIC (Vanilla JS)
// ============================================================================

const state = {
  token: localStorage.getItem('mb_scm_token') || null,
  user: JSON.parse(localStorage.getItem('mb_scm_user') || 'null'),
  currentPage: 'dashboard',
  // Cached data
  dashboard: null,
  materials: [],
  suppliers: [],
  purchaseOrders: [],
  stockMovements: [],
  // Filters
  materialCategoryFilter: 'ALL',
  materialLowStockOnly: false,
  materialSearchQuery: '',
  poStatusFilter: 'ALL',
  movementTypeFilter: 'ALL',
  movementMaterialFilter: 'ALL',
};

// ============================================================================
// UTILITY HELPERS
// ============================================================================

function formatRupiah(amount) {
  const num = Number(amount || 0);
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function formatNumber(num) {
  const val = Number(num || 0);
  return Number.isInteger(val) ? String(val) : val.toFixed(2).replace(/\.00$/, '');
}

function formatDateTime(isoStr) {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const styles = {
    success: 'bg-emerald-900 text-white border-emerald-700',
    warning: 'bg-amber-800 text-white border-amber-600',
    error: 'bg-rose-900 text-white border-rose-700',
    info: 'bg-stone-900 text-white border-stone-700',
  };

  const icons = {
    success: 'check-circle-2',
    warning: 'alert-triangle',
    error: 'x-circle',
    info: 'info',
  };

  const toast = document.createElement('div');
  toast.className = `pointer-events-auto flex items-start gap-3 px-4 py-3.5 rounded-xl border shadow-lg transition-all duration-300 ${
    styles[type] || styles.info
  }`;
  toast.innerHTML = `
    <i data-lucide="${icons[type] || 'info'}" class="w-5 h-5 flex-shrink-0 mt-0.5"></i>
    <div class="flex-1 text-xs sm:text-sm font-medium leading-snug">${escapeHtml(message)}</div>
  `;

  container.appendChild(toast);
  refreshIcons();

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-x-4');
    setTimeout(() => toast.remove(), 300);
  }, 4200);
}

async function apiFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && state.token && !path.includes('/api/auth/login')) {
      handleLogout(false);
    }
    throw new Error(data.error || `Terjadi kesalahan (${response.status})`);
  }

  return data;
}

function getPoStatusBadge(status) {
  const map = {
    PENDING: {
      cls: 'bg-amber-100 text-amber-800 border-amber-300',
      label: 'PENDING',
      desc: 'Menunggu Pemasok',
    },
    PROCESSING: {
      cls: 'bg-blue-100 text-blue-800 border-blue-300',
      label: 'PROCESSING',
      desc: 'Disiapkan Pemasok',
    },
    SHIPPED: {
      cls: 'bg-purple-100 text-purple-800 border-purple-300',
      label: 'SHIPPED',
      desc: 'Dalam Pengiriman',
    },
    RECEIVED: {
      cls: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      label: 'RECEIVED',
      desc: 'Diterima Gudang',
    },
    CANCELLED: {
      cls: 'bg-rose-100 text-rose-800 border-rose-300',
      label: 'CANCELLED',
      desc: 'Dibatalkan',
    },
  };
  const st = map[status] || {
    cls: 'bg-stone-100 text-stone-800 border-stone-300',
    label: status,
    desc: '',
  };
  return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${st.cls}">${escapeHtml(
    st.label
  )}</span>`;
}

function getCategoryBadge(category) {
  const map = {
    Kopi: 'bg-amber-100/80 text-amber-900 border-amber-300',
    'Dairy & Sirup': 'bg-sky-100/80 text-sky-900 border-sky-300',
    'Bahan Pastry': 'bg-orange-100/80 text-orange-900 border-orange-300',
  };
  const cls = map[category] || 'bg-stone-100 text-stone-800 border-stone-300';
  return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${cls}">${escapeHtml(
    category
  )}</span>`;
}

// ============================================================================
// AUTHENTICATION & DEMO ACCOUNTS
// ============================================================================

async function checkHealthStatus() {
  const badge = document.getElementById('db-status-badge');
  if (!badge) return;

  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    if (data.supabase_configured) {
      badge.className =
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200';
      badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500"></span>Supabase Terhubung`;
    } else {
      badge.className =
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-300';
      badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500"></span>.env Belum Diisi`;
    }
  } catch {
    badge.className =
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200';
    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-500"></span>Server Offline`;
  }
}

async function loadDemoAccounts() {
  const grid = document.getElementById('demo-accounts-grid');
  if (!grid) return;

  try {
    const data = await apiFetch('/api/auth/demo-accounts');
    const accounts = data.accounts || [];

    grid.innerHTML = accounts
      .map((acc) => {
        const isAdmin = acc.role === 'admin';
        const badgeCls = isAdmin
          ? 'bg-espresso-800 text-amber-200'
          : 'bg-amber-100 text-amber-900 border border-amber-300';
        const roleLabel = isAdmin ? 'Admin Gudang (Internal)' : `Pemasok • ${acc.supplier_category}`;
        const iconName = isAdmin ? 'shield' : 'truck';

        return `
          <button
            type="button"
            data-quick-email="${escapeHtml(acc.email)}"
            class="quick-login-card text-left p-4 rounded-xl border border-stone-200 hover:border-amber-600 bg-stone-50/60 hover:bg-amber-50/50 transition group flex flex-col justify-between gap-3 shadow-2xs hover:shadow-md"
          >
            <div class="flex items-start justify-between gap-2">
              <span class="px-2.5 py-1 rounded-lg text-[11px] font-bold ${badgeCls}">
                ${escapeHtml(roleLabel)}
              </span>
              <div class="w-7 h-7 rounded-lg bg-white border border-stone-200 group-hover:border-amber-400 flex items-center justify-center text-stone-600 group-hover:text-amber-800">
                <i data-lucide="${iconName}" class="w-3.5 h-3.5"></i>
              </div>
            </div>
            <div>
              <div class="font-bold text-sm text-stone-900 group-hover:text-espresso-900">${escapeHtml(
                acc.name
              )}</div>
              <div class="text-xs text-stone-500 font-mono mt-0.5">${escapeHtml(acc.email)}</div>
            </div>
            <div class="text-[11px] font-semibold text-amber-800 flex items-center gap-1 pt-1 border-t border-stone-200/70">
              <span>Klik untuk Masuk Instan</span>
              <i data-lucide="arrow-right" class="w-3 h-3 group-hover:translate-x-0.5 transition-transform"></i>
            </div>
          </button>
        `;
      })
      .join('');

    grid.querySelectorAll('.quick-login-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        const email = btn.getAttribute('data-quick-email');
        if (email) {
          document.getElementById('login-email').value = email;
          document.getElementById('login-password').value = 'mugiberkah123';
          performLogin(email, 'mugiberkah123');
        }
      });
    });

    refreshIcons();
  } catch (err) {
    grid.innerHTML = `<div class="col-span-2 text-xs text-rose-600 p-3 rounded-xl bg-rose-50 border border-rose-200">${escapeHtml(
      err.message
    )}</div>`;
  }
}

async function performLogin(email, password) {
  const submitBtn = document.getElementById('login-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Memverifikasi...</span>`;
  }

  try {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    state.token = res.token;
    state.user = res.user;
    localStorage.setItem('mb_scm_token', res.token);
    localStorage.setItem('mb_scm_user', JSON.stringify(res.user));

    state.currentPage = 'dashboard';
    showToast(`Selamat datang, ${res.user.name}!`, 'success');
    await enterAppView();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i data-lucide="log-in" class="w-4 h-4"></i><span>Masuk Sekarang</span>`;
      refreshIcons();
    }
  }
}

// Idle Auto-Logout Timer (30 menit tanpa aktivitas -> otomatis keluar demi keamanan sesi)
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
let idleTimerId = null;

function resetIdleTimer() {
  if (idleTimerId) {
    clearTimeout(idleTimerId);
    idleTimerId = null;
  }
  if (!state.token) return;

  idleTimerId = setTimeout(() => {
    if (state.token) {
      handleLogout(false);
      showToast('Sesi login berakhir otomatis karena tidak ada aktivitas selama 30 menit. Silakan login kembali.', 'warning');
    }
  }, IDLE_TIMEOUT_MS);
}

function setupIdleTracking() {
  ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'].forEach((evt) => {
    window.addEventListener(evt, resetIdleTimer, { passive: true });
  });
}

function handleLogout(notify = true) {
  if (idleTimerId) {
    clearTimeout(idleTimerId);
    idleTimerId = null;
  }
  state.token = null;
  state.user = null;
  localStorage.removeItem('mb_scm_token');
  localStorage.removeItem('mb_scm_user');

  document.getElementById('app-view').classList.add('hidden');
  document.getElementById('login-view').classList.remove('hidden');
  if (notify) {
    showToast('Anda telah keluar dari sesi.', 'info');
  }
  checkHealthStatus();
  loadDemoAccounts();
}

// ============================================================================
// NAVIGATION & APP SHELL
// ============================================================================

function getMenuItemsForRole(role) {
  if (role === 'admin') {
    return [
      {
        id: 'dashboard',
        label: 'Dashboard & KPI',
        icon: 'layout-dashboard',
        title: 'Dashboard Pengadaan & Gudang',
        subtitle: 'Pemantauan KPI Rantai Pasok, Reorder Point Alert, dan Aktivitas Gudang',
      },
      {
        id: 'materials',
        label: 'Bahan Baku & Stok',
        icon: 'package',
        title: 'Inventaris Bahan Baku & Pemakaian (Stock Out)',
        subtitle: 'Kelola master bahan baku Kopi, Dairy/Sirup, Pastry dan catat pemakaian harian',
      },
      {
        id: 'suppliers',
        label: 'Master Pemasok',
        icon: 'building-2',
        title: 'Manajemen Master Pemasok (Suppliers)',
        subtitle: 'Daftar mitra pemasok bahan baku Mugi Berkah beserta waktu tunggu (Lead Time)',
      },
      {
        id: 'purchase-orders',
        label: 'Purchase Order',
        icon: 'shopping-cart',
        title: 'Siklus Purchase Order & Penerimaan Barang',
        subtitle: 'Buat pesanan pengadaan ke pemasok dan verifikasi penerimaan barang (Goods Receipt)',
      },
      {
        id: 'stock-movements',
        label: 'Riwayat Mutasi Stok',
        icon: 'history',
        title: 'Riwayat Mutasi Stok (Audit Log)',
        subtitle: 'Catatan lengkap keluar-masuk bahan baku (IN dari PO & OUT pemakaian bar/dapur)',
      },
    ];
  }

  return [
    {
      id: 'dashboard',
      label: 'Dashboard Pemasok',
      icon: 'layout-dashboard',
      title: 'Portal Mitra Pemasok — Ringkasan Pesanan',
      subtitle: `Pantau pesanan bahan baku yang masuk dari Kedai Kopi & Pastry Mugi Berkah`,
    },
    {
      id: 'purchase-orders',
      label: 'Purchase Order Masuk',
      icon: 'truck',
      title: 'Daftar Purchase Order Masuk',
      subtitle: 'Perbarui status pemenuhan pesanan (PENDING → PROCESSING → SHIPPED)',
    },
  ];
}

function renderSidebarAndTopbar() {
  if (!state.user) return;

  const isAdmin = state.user.role === 'admin';
  document.getElementById('topbar-user-name').textContent = state.user.name;
  document.getElementById('topbar-user-entity').textContent = isAdmin
    ? `${state.user.email} • Gudang Utama Mugi Berkah`
    : `${state.user.email} • ${state.user.supplier_name || 'Mitra Pemasok'}`;

  const roleBadge = document.getElementById('topbar-role-badge');
  if (isAdmin) {
    roleBadge.className =
      'px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300';
    roleBadge.textContent = 'Admin Gudang';
  } else {
    roleBadge.className =
      'px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-100 text-blue-900 border border-blue-300';
    roleBadge.textContent = 'Portal Pemasok';
  }

  const menuItems = getMenuItemsForRole(state.user.role);
  const currentItem = menuItems.find((m) => m.id === state.currentPage) || menuItems[0];

  document.getElementById('page-title').textContent = currentItem.title;
  document.getElementById('page-subtitle').textContent = currentItem.subtitle;

  const navEl = document.getElementById('sidebar-nav');
  navEl.innerHTML = menuItems
    .map((item) => {
      const isActive = item.id === state.currentPage;
      const cls = isActive
        ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30 font-bold shadow-xs'
        : 'text-stone-300 hover:bg-espresso-800 hover:text-white font-medium border border-transparent';

      return `
        <button
          type="button"
          data-nav-page="${item.id}"
          class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition ${cls}"
        >
          <i data-lucide="${item.icon}" class="w-4 h-4 flex-shrink-0"></i>
          <span>${escapeHtml(item.label)}</span>
        </button>
      `;
    })
    .join('');

  navEl.querySelectorAll('[data-nav-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetPage = btn.getAttribute('data-nav-page');
      navigateTo(targetPage);
    });
  });

  refreshIcons();
}

async function enterAppView() {
  document.getElementById('login-view').classList.add('hidden');
  document.getElementById('app-view').classList.remove('hidden');
  resetIdleTimer();
  renderSidebarAndTopbar();
  await loadAndRenderCurrentPage();
}

async function navigateTo(pageId) {
  state.currentPage = pageId;
  renderSidebarAndTopbar();
  await loadAndRenderCurrentPage();
}

async function loadAndRenderCurrentPage() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="bg-white rounded-2xl border border-stone-200 p-12 text-center text-stone-500 text-sm flex flex-col items-center gap-3">
      <div class="w-8 h-8 border-3 border-amber-700 border-t-transparent rounded-full animate-spin"></div>
      <span>Memuat data dari Supabase PostgreSQL...</span>
    </div>
  `;

  try {
    if (state.currentPage === 'dashboard') {
      await renderDashboardPage();
    } else if (state.currentPage === 'materials') {
      await renderMaterialsPage();
    } else if (state.currentPage === 'suppliers') {
      await renderSuppliersPage();
    } else if (state.currentPage === 'purchase-orders') {
      await renderPurchaseOrdersPage();
    } else if (state.currentPage === 'stock-movements') {
      await renderStockMovementsPage();
    }
    refreshIcons();
  } catch (err) {
    main.innerHTML = `
      <div class="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-900">
        <div class="flex items-center gap-2 font-bold text-base mb-1">
          <i data-lucide="alert-octagon" class="w-5 h-5 text-rose-700"></i>
          <span>Gagal Memuat Data</span>
        </div>
        <p class="text-sm text-rose-700 mb-4">${escapeHtml(err.message)}</p>
        <button id="retry-page-btn" class="px-4 py-2 rounded-xl bg-rose-800 text-white text-xs font-semibold hover:bg-rose-900">
          Coba Lagi
        </button>
      </div>
    `;
    refreshIcons();
    document.getElementById('retry-page-btn')?.addEventListener('click', loadAndRenderCurrentPage);
  }
}

// ============================================================================
// PAGE 1: DASHBOARD (ADMIN & SUPPLIER)
// ============================================================================

async function renderDashboardPage() {
  const main = document.getElementById('main-content');
  const summary = await apiFetch('/api/dashboard/summary');
  state.dashboard = summary;

  if (summary.role === 'admin') {
    // Preload suppliers & materials in background so "Pesan Ulang (Buat PO)" modal opens immediately
    const [matRes, supRes] = await Promise.all([
      apiFetch('/api/materials'),
      apiFetch('/api/suppliers'),
    ]);
    state.materials = matRes.materials || [];
    state.suppliers = supRes.suppliers || [];

    const lowStockItems = summary.low_stock_items || [];
    const recentMovements = summary.recent_movements || [];

    main.innerHTML = `
      <!-- 4 KPI CARDS -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-2xs flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-[11px] font-bold uppercase tracking-wider text-stone-500">Total Bahan Baku</p>
            <p class="text-2xl font-extrabold text-stone-900 mt-1.5 tracking-tight">${summary.total_materials} <span class="text-sm font-semibold text-stone-500">Item</span></p>
            <p class="text-xs text-stone-500 mt-1">Kopi, Dairy & Bahan Pastry</p>
          </div>
          <div class="p-2.5 rounded-xl bg-stone-100 text-stone-800 flex-shrink-0">
            <i data-lucide="package" class="w-5 h-5"></i>
          </div>
        </div>

        <div class="bg-white rounded-2xl p-5 border ${
          summary.low_stock_count > 0 ? 'border-rose-300 bg-rose-50/20' : 'border-stone-200/90'
        } shadow-2xs flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-[11px] font-bold uppercase tracking-wider text-rose-700">Bahan Menipis (Reorder)</p>
            <p class="text-2xl font-extrabold text-rose-700 mt-1.5 tracking-tight">${summary.low_stock_count} <span class="text-sm font-semibold">Item</span></p>
            <p class="text-xs text-rose-600/90 mt-1 font-medium">Stok &le; Batas Minimum (ROP)</p>
          </div>
          <div class="p-2.5 rounded-xl bg-rose-100 text-rose-700 flex-shrink-0">
            <i data-lucide="alert-triangle" class="w-5 h-5"></i>
          </div>
        </div>

        <div class="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-2xs flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-[11px] font-bold uppercase tracking-wider text-stone-500">Purchase Order Aktif</p>
            <p class="text-2xl font-extrabold text-amber-800 mt-1.5 tracking-tight">${summary.active_po_count} <span class="text-sm font-semibold">PO</span></p>
            <p class="text-xs text-stone-500 mt-1">Pending, Diproses & Dikirim</p>
          </div>
          <div class="p-2.5 rounded-xl bg-amber-100 text-amber-800 flex-shrink-0">
            <i data-lucide="shopping-cart" class="w-5 h-5"></i>
          </div>
        </div>

        <div class="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-2xs flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-[11px] font-bold uppercase tracking-wider text-stone-500">Total Nilai Pengadaan</p>
            <p class="text-2xl font-extrabold text-emerald-800 mt-1.5 tracking-tight">${formatRupiah(
              summary.total_procurement_value
            )}</p>
            <p class="text-xs text-stone-500 mt-1">Akumulasi PO Selesai (RECEIVED)</p>
          </div>
          <div class="p-2.5 rounded-xl bg-emerald-100 text-emerald-800 flex-shrink-0">
            <i data-lucide="wallet" class="w-5 h-5"></i>
          </div>
        </div>
      </div>

      <!-- LOW STOCK ALERT TABLE -->
      <div class="bg-white rounded-2xl border border-rose-200 shadow-2xs overflow-hidden">
        <div class="px-6 py-4 bg-gradient-to-r from-rose-50 via-amber-50/40 to-white border-b border-rose-200/80 flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
              <i data-lucide="bell-ring" class="w-4 h-4"></i>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-base font-extrabold text-stone-900">Peringatan Stok Menipis (Reorder Point Alert)</h2>
                <span class="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                  ${lowStockItems.length} Bahan Perlu Restock
                </span>
              </div>
              <p class="text-xs text-stone-600">Daftar bahan baku dengan <code class="font-mono text-rose-700 font-semibold">current_stock &le; min_stock</code> yang memerlukan penerbitan Purchase Order segera.</p>
            </div>
          </div>

          <button
            type="button"
            id="dash-create-po-btn"
            class="px-3.5 py-2 rounded-xl bg-espresso-800 hover:bg-espresso-900 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
          >
            <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>
            <span>Buat PO Baru</span>
          </button>
        </div>

        ${
          lowStockItems.length === 0
            ? `<div class="p-8 text-center text-stone-500 text-sm">Seluruh stok bahan baku berada di atas batas minimum (Aman).</div>`
            : `
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-stone-200 bg-stone-50/80 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  <th class="py-3 px-4">SKU & Nama Bahan</th>
                  <th class="py-3 px-4">Kategori</th>
                  <th class="py-3 px-4">Pemasok Utama</th>
                  <th class="py-3 px-4 text-right">Stok Saat Ini</th>
                  <th class="py-3 px-4 text-right">Batas Min (ROP)</th>
                  <th class="py-3 px-4 text-center">Status</th>
                  <th class="py-3 px-4 text-right">Aksi Pengadaan</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-stone-200 text-sm">
                ${lowStockItems
                  .map(
                    (item) => `
                  <tr class="hover:bg-rose-50/30 transition">
                    <td class="py-3.5 px-4">
                      <div class="font-bold text-stone-900">${escapeHtml(item.name)}</div>
                      <div class="text-xs font-mono text-stone-500">${escapeHtml(item.sku)} • ${formatRupiah(
                      item.unit_price
                    )}/${escapeHtml(item.unit)}</div>
                    </td>
                    <td class="py-3.5 px-4">${getCategoryBadge(item.category)}</td>
                    <td class="py-3.5 px-4">
                      <div class="font-semibold text-stone-800 text-xs">${escapeHtml(
                        item.supplier_name
                      )}</div>
                      <div class="text-[11px] text-stone-500">Lead time: ${
                        item.supplier_lead_time
                      } hari</div>
                    </td>
                    <td class="py-3.5 px-4 text-right font-extrabold text-rose-700">
                      ${formatNumber(item.current_stock)} ${escapeHtml(item.unit)}
                    </td>
                    <td class="py-3.5 px-4 text-right font-semibold text-stone-600">
                      ${formatNumber(item.min_stock)} ${escapeHtml(item.unit)}
                    </td>
                    <td class="py-3.5 px-4 text-center">
                      <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                        <i data-lucide="alert-circle" class="w-3 h-3"></i>
                        LOW STOCK
                      </span>
                    </td>
                    <td class="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        data-reorder-material="${item.id}"
                        data-reorder-supplier="${item.supplier_id}"
                        class="reorder-quick-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-2xs transition"
                      >
                        <i data-lucide="shopping-bag" class="w-3.5 h-3.5"></i>
                        <span>Pesan Ulang (Buat PO)</span>
                      </button>
                    </td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        `
        }
      </div>

      <!-- BOTTOM GRID: RECENT STOCK MOVEMENTS & PO STATUS BREAKDOWN -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- 5 Recent Stock Movements (8 cols) -->
        <div class="lg:col-span-8 bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
          <div class="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
            <div>
              <h3 class="text-base font-bold text-stone-900">5 Aktivitas Mutasi Stok Terbaru</h3>
              <p class="text-xs text-stone-500">Audit log keluar-masuk bahan baku gudang Mugi Berkah</p>
            </div>
            <button
              type="button"
              id="dash-view-all-movements"
              class="text-xs font-bold text-amber-800 hover:text-amber-900 flex items-center gap-1"
            >
              <span>Lihat Semua</span>
              <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-stone-200 bg-stone-50/70 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  <th class="py-3 px-4 whitespace-nowrap">Waktu</th>
                  <th class="py-3 px-4 min-w-[175px]">Bahan Baku</th>
                  <th class="py-3 px-4 whitespace-nowrap">Tipe</th>
                  <th class="py-3 px-4 text-right whitespace-nowrap">Kuantitas</th>
                  <th class="py-3 px-4">Referensi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-stone-200 text-xs sm:text-sm">
                ${recentMovements
                  .map((mv) => {
                    const isIn = mv.type === 'IN';
                    return `
                      <tr class="hover:bg-stone-50/80 transition">
                        <td class="py-3.5 px-4 text-xs text-stone-500 whitespace-nowrap">${formatDateTime(
                          mv.created_at
                        )}</td>
                        <td class="py-3.5 px-4 min-w-[175px]">
                          <div class="font-bold text-stone-900 text-xs leading-snug">${escapeHtml(
                            mv.material_name
                          )}</div>
                          <div class="text-[11px] font-mono text-stone-500 mt-0.5">${escapeHtml(
                            mv.material_sku
                          )}</div>
                        </td>
                        <td class="py-3.5 px-4 whitespace-nowrap">
                          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md whitespace-nowrap text-[11px] font-bold ${
                            isIn
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }">
                            <span>${isIn ? '+' : '−'}</span>
                            <span>${isIn ? 'MASUK (IN)' : 'KELUAR (OUT)'}</span>
                          </span>
                        </td>
                        <td class="py-3.5 px-4 text-right font-bold whitespace-nowrap ${
                          isIn ? 'text-emerald-700' : 'text-amber-800'
                        }">
                          ${isIn ? '+' : '−'}${formatNumber(mv.quantity)} ${escapeHtml(
                      mv.material_unit
                    )}
                        </td>
                        <td class="py-3.5 px-4 max-w-[240px]">
                          <div class="font-semibold text-stone-800 text-xs leading-snug">${escapeHtml(
                            mv.reference
                          )}</div>
                          <div class="text-[11px] text-stone-500 truncate mt-0.5" title="${escapeHtml(
                            mv.notes || '-'
                          )}">${escapeHtml(mv.notes || '-')}</div>
                        </td>
                      </tr>
                    `;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- PO Status Summary Card (4 cols) -->
        <div class="lg:col-span-4 bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-6 flex flex-col justify-between">
          <div>
            <h3 class="text-base font-bold text-stone-900">Ringkasan Siklus PO</h3>
            <p class="text-xs text-stone-500 mb-4">Distribusi status Purchase Order saat ini</p>

            <div class="space-y-3">
              ${[
                {
                  key: 'PENDING',
                  label: 'PENDING (Menunggu Pemasok)',
                  cls: 'bg-amber-50 border-amber-200 text-amber-900',
                },
                {
                  key: 'PROCESSING',
                  label: 'PROCESSING (Sedang Disiapkan)',
                  cls: 'bg-blue-50 border-blue-200 text-blue-900',
                },
                {
                  key: 'SHIPPED',
                  label: 'SHIPPED (Siap Diterima Gudang)',
                  cls: 'bg-purple-50 border-purple-200 text-purple-900',
                },
                {
                  key: 'RECEIVED',
                  label: 'RECEIVED (Selesai & Stok Masuk)',
                  cls: 'bg-emerald-50 border-emerald-200 text-emerald-900',
                },
                {
                  key: 'CANCELLED',
                  label: 'CANCELLED (Dibatalkan)',
                  cls: 'bg-stone-100 border-stone-200 text-stone-600',
                },
              ]
                .map((st) => {
                  const count = summary.po_status_breakdown?.[st.key] ?? 0;
                  return `
                    <div class="flex items-center justify-between px-3.5 py-2.5 rounded-xl border ${st.cls}">
                      <span class="text-xs font-semibold">${st.label}</span>
                      <span class="text-sm font-extrabold">${count} PO</span>
                    </div>
                  `;
                })
                .join('')}
            </div>
          </div>

          <button
            type="button"
            id="dash-go-po-btn"
            class="mt-5 w-full py-2.5 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold transition flex items-center justify-center gap-2"
          >
            <span>Kelola Seluruh Purchase Order</span>
            <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    `;

    // Bind quick reorder buttons
    main.querySelectorAll('.reorder-quick-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const materialId = Number(btn.getAttribute('data-reorder-material'));
        const supplierId = Number(btn.getAttribute('data-reorder-supplier'));
        openCreatePoModal({ supplierId, materialId });
      });
    });

    document
      .getElementById('dash-create-po-btn')
      ?.addEventListener('click', () => openCreatePoModal());
    document
      .getElementById('dash-view-all-movements')
      ?.addEventListener('click', () => navigateTo('stock-movements'));
    document
      .getElementById('dash-go-po-btn')
      ?.addEventListener('click', () => navigateTo('purchase-orders'));

    return;
  }

  // ==========================================================================
  // SUPPLIER DASHBOARD VIEW
  // ==========================================================================
  const poData = await apiFetch('/api/purchase-orders');
  state.purchaseOrders = poData.purchase_orders || [];

  main.innerHTML = `
    <!-- SUPPLIER BANNER -->
    <div class="bg-gradient-to-r from-espresso-900 via-espresso-800 to-amber-900 rounded-2xl p-6 text-white shadow-sm flex flex-wrap items-center justify-between gap-4">
      <div>
        <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/30 text-amber-200 text-xs font-semibold mb-2">
          <i data-lucide="Handshake" class="w-3.5 h-3.5"></i>
          <span>Portal Eksternal Mitra Pemasok (Data Terisolasi)</span>
        </div>
        <h2 class="text-xl font-extrabold">${escapeHtml(
          state.user.supplier_name || state.user.name
        )}</h2>
        <p class="text-xs text-stone-300 mt-0.5">Anda hanya melihat dan memproses Purchase Order yang ditujukan langsung ke perusahaan Anda.</p>
      </div>
      <button
        type="button"
        id="sup-dash-open-pos"
        class="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-espresso-950 font-bold text-xs transition flex items-center gap-2 shadow-xs"
      >
        <i data-lucide="truck" class="w-4 h-4"></i>
        <span>Buka Daftar PO Masuk</span>
      </button>
    </div>

    <!-- SUPPLIER 5 KPI CARDS -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      <div class="bg-white rounded-2xl p-5 border border-amber-200 shadow-2xs">
        <p class="text-xs font-bold uppercase text-amber-800">Pesanan Baru (PENDING)</p>
        <p class="text-2xl font-extrabold text-amber-800 mt-1">${summary.pending_po_count} PO</p>
        <p class="text-[11px] text-stone-500 mt-1">Perlu dikonfirmasi proses</p>
      </div>

      <div class="bg-white rounded-2xl p-5 border border-blue-200 shadow-2xs">
        <p class="text-xs font-bold uppercase text-blue-800">Sedang Disiapkan</p>
        <p class="text-2xl font-extrabold text-blue-800 mt-1">${summary.processing_po_count} PO</p>
        <p class="text-[11px] text-stone-500 mt-1">Status PROCESSING</p>
      </div>

      <div class="bg-white rounded-2xl p-5 border border-purple-200 shadow-2xs">
        <p class="text-xs font-bold uppercase text-purple-800">Dalam Pengiriman</p>
        <p class="text-2xl font-extrabold text-purple-800 mt-1">${summary.shipped_po_count} PO</p>
        <p class="text-[11px] text-stone-500 mt-1">Menunggu verifikasi gudang</p>
      </div>

      <div class="bg-white rounded-2xl p-5 border border-emerald-200 shadow-2xs">
        <p class="text-xs font-bold uppercase text-emerald-800">Selesai Diterima</p>
        <p class="text-2xl font-extrabold text-emerald-800 mt-1">${summary.completed_po_count} PO</p>
        <p class="text-[11px] text-stone-500 mt-1">Status RECEIVED</p>
      </div>

      <div class="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs">
        <p class="text-xs font-bold uppercase text-stone-500">Total Nilai Pesanan</p>
        <p class="text-lg font-extrabold text-stone-900 mt-1">${formatRupiah(
          summary.total_order_value
        )}</p>
        <p class="text-[11px] text-stone-500 mt-1">Seluruh PO aktif & selesai</p>
      </div>
    </div>

    <!-- SUPPLIER ACTIVE PURCHASE ORDERS TABLE -->
    <div class="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden">
      <div class="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
        <div>
          <h3 class="text-base font-bold text-stone-900">Daftar Purchase Order dari Mugi Berkah</h3>
          <p class="text-xs text-stone-500">Klik tombol aksi untuk mengubah status pemenuhan pesanan</p>
        </div>
      </div>
      ${renderPoTableHtml(state.purchaseOrders)}
    </div>
  `;

  document
    .getElementById('sup-dash-open-pos')
    ?.addEventListener('click', () => navigateTo('purchase-orders'));
  bindPoTableActions(main);
}

// ============================================================================
// PAGE 2: BAHAN BAKU & STOK (RAW MATERIALS & STOCK OUT)
// ============================================================================

async function renderMaterialsPage() {
  const main = document.getElementById('main-content');
  const [matRes, supRes] = await Promise.all([
    apiFetch('/api/materials'),
    apiFetch('/api/suppliers'),
  ]);

  state.materials = matRes.materials || [];
  state.suppliers = supRes.suppliers || [];

  drawMaterialsView(main);
}

function drawMaterialsView(container) {
  const filtered = state.materials.filter((m) => {
    if (
      state.materialCategoryFilter !== 'ALL' &&
      m.category !== state.materialCategoryFilter
    ) {
      return false;
    }
    if (state.materialLowStockOnly && !m.is_low_stock) {
      return false;
    }
    if (state.materialSearchQuery.trim()) {
      const q = state.materialSearchQuery.trim().toLowerCase();
      const match =
        m.name.toLowerCase().includes(q) ||
        m.sku.toLowerCase().includes(q) ||
        m.supplier_name.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const categories = ['ALL', 'Kopi', 'Dairy & Sirup', 'Bahan Pastry'];

  container.innerHTML = `
    <!-- TOOLBAR & FILTERS -->
    <div class="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
      <div class="flex flex-wrap items-center gap-2">
        ${categories
          .map((cat) => {
            const label = cat === 'ALL' ? 'Semua Kategori' : cat;
            const active = state.materialCategoryFilter === cat;
            return `
              <button
                type="button"
                data-mat-cat="${escapeHtml(cat)}"
                class="mat-cat-btn px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                  active
                    ? 'bg-espresso-800 text-white shadow-2xs'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }"
              >
                ${escapeHtml(label)}
              </button>
            `;
          })
          .join('')}

        <!-- Toggle Low Stock Only -->
        <label class="inline-flex items-center gap-2 ml-1 px-3 py-2 rounded-xl border ${
          state.materialLowStockOnly
            ? 'bg-rose-50 border-rose-300 text-rose-800'
            : 'bg-stone-50 border-stone-200 text-stone-700'
        } text-xs font-bold cursor-pointer select-none">
          <input
            type="checkbox"
            id="toggle-low-stock-only"
            ${state.materialLowStockOnly ? 'checked' : ''}
            class="rounded text-rose-600 focus:ring-rose-500"
          />
          <span>Hanya Stok Menipis</span>
        </label>
      </div>

      <div class="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
        <div class="relative flex-1 sm:w-56">
          <i data-lucide="search" class="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2"></i>
          <input
            type="text"
            id="mat-search-input"
            value="${escapeHtml(state.materialSearchQuery)}"
            placeholder="Cari SKU atau nama bahan..."
            class="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:border-amber-700"
          />
        </div>

        <button
          type="button"
          id="add-material-btn"
          class="px-4 py-2 rounded-xl bg-espresso-800 hover:bg-espresso-900 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
        >
          <i data-lucide="plus" class="w-4 h-4"></i>
          <span>+ Tambah Bahan</span>
        </button>
      </div>
    </div>

    <!-- MATERIALS TABLE -->
    <div class="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b border-stone-200 bg-stone-50/80 text-[11px] font-bold uppercase tracking-wider text-stone-500">
              <th class="py-3.5 px-4">SKU</th>
              <th class="py-3.5 px-4">Nama Bahan Baku</th>
              <th class="py-3.5 px-4">Kategori</th>
              <th class="py-3.5 px-4">Pemasok</th>
              <th class="py-3.5 px-4 text-right">Harga Beli</th>
              <th class="py-3.5 px-4 text-right">Stok Saat Ini</th>
              <th class="py-3.5 px-4 text-right">Min. Stok</th>
              <th class="py-3.5 px-4 text-center">Status Stok</th>
              <th class="py-3.5 px-4 text-right">Aksi Gudang</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-stone-200 text-sm">
            ${
              filtered.length === 0
                ? `<tr><td colspan="9" class="py-10 text-center text-stone-500 text-sm">Tidak ada bahan baku yang sesuai dengan filter.</td></tr>`
                : filtered
                    .map((m) => {
                      const isLow = m.is_low_stock;
                      return `
                        <tr class="${isLow ? 'bg-rose-50/25 hover:bg-rose-50/50' : 'hover:bg-stone-50/70'} transition">
                          <td class="py-3.5 px-4 font-mono text-xs font-bold text-stone-700">${escapeHtml(
                            m.sku
                          )}</td>
                          <td class="py-3.5 px-4 font-bold text-stone-900">${escapeHtml(m.name)}</td>
                          <td class="py-3.5 px-4">${getCategoryBadge(m.category)}</td>
                          <td class="py-3.5 px-4 text-xs text-stone-700 font-medium">${escapeHtml(
                            m.supplier_name
                          )}</td>
                          <td class="py-3.5 px-4 text-right text-xs font-semibold text-stone-700">
                            ${formatRupiah(m.unit_price)} / ${escapeHtml(m.unit)}
                          </td>
                          <td class="py-3.5 px-4 text-right font-extrabold ${
                            isLow ? 'text-rose-700' : 'text-stone-900'
                          }">
                            ${formatNumber(m.current_stock)} ${escapeHtml(m.unit)}
                          </td>
                          <td class="py-3.5 px-4 text-right text-xs font-semibold text-stone-500">
                            ${formatNumber(m.min_stock)} ${escapeHtml(m.unit)}
                          </td>
                          <td class="py-3.5 px-4 text-center">
                            ${
                              isLow
                                ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                    <i data-lucide="alert-triangle" class="w-3 h-3"></i> LOW STOCK
                                   </span>`
                                : `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    <i data-lucide="check" class="w-3 h-3"></i> AMAN
                                   </span>`
                            }
                          </td>
                          <td class="py-3.5 px-4 text-right whitespace-nowrap">
                            <div class="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                data-usage-id="${m.id}"
                                class="mat-usage-btn px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-bold transition inline-flex items-center gap-1"
                                title="Catat Pemakaian Harian Bar/Dapur (Stock Out)"
                              >
                                <i data-lucide="minus-circle" class="w-3.5 h-3.5"></i>
                                <span>Catat Pemakaian (Out)</span>
                              </button>
                              <button
                                type="button"
                                data-edit-mat="${m.id}"
                                class="mat-edit-btn p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                                title="Edit Master Bahan"
                              >
                                <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                              </button>
                              <button
                                type="button"
                                data-del-mat="${m.id}"
                                class="mat-del-btn p-1.5 rounded-lg border border-stone-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200"
                                title="Hapus Bahan"
                              >
                                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      `;
                    })
                    .join('')
            }
          </tbody>
        </table>
      </div>
    </div>
  `;

  refreshIcons();

  // Bind filter events
  container.querySelectorAll('.mat-cat-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.materialCategoryFilter = btn.getAttribute('data-mat-cat');
      drawMaterialsView(container);
    });
  });

  document.getElementById('toggle-low-stock-only')?.addEventListener('change', (e) => {
    state.materialLowStockOnly = e.target.checked;
    drawMaterialsView(container);
  });

  const searchInput = document.getElementById('mat-search-input');
  searchInput?.addEventListener('input', (e) => {
    state.materialSearchQuery = e.target.value;
    drawMaterialsView(container);
    const el = document.getElementById('mat-search-input');
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  });

  document
    .getElementById('add-material-btn')
    ?.addEventListener('click', () => openMaterialFormModal());

  container.querySelectorAll('.mat-usage-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.getAttribute('data-usage-id'));
      const mat = state.materials.find((x) => x.id === id);
      if (mat) openStockUsageModal(mat);
    });
  });

  container.querySelectorAll('.mat-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.getAttribute('data-edit-mat'));
      const mat = state.materials.find((x) => x.id === id);
      if (mat) openMaterialFormModal(mat);
    });
  });

  container.querySelectorAll('.mat-del-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-del-mat'));
      const mat = state.materials.find((x) => x.id === id);
      if (!mat) return;
      if (!confirm(`Hapus bahan baku "${mat.name}" (${mat.sku})?`)) return;

      try {
        const res = await apiFetch(`/api/materials/${id}`, { method: 'DELETE' });
        showToast(res.message, 'success');
        await renderMaterialsPage();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

// ============================================================================
// PAGE 3: MASTER PEMASOK (SUPPLIERS)
// ============================================================================

async function renderSuppliersPage() {
  const main = document.getElementById('main-content');
  const res = await apiFetch('/api/suppliers');
  state.suppliers = res.suppliers || [];

  main.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-4 bg-white rounded-2xl border border-stone-200 p-5 shadow-2xs">
      <div>
        <h2 class="text-base font-bold text-stone-900">Daftar Mitra Pemasok Bahan Baku</h2>
        <p class="text-xs text-stone-500">Total ${state.suppliers.length} pemasok terdaftar dalam rantai pasok hulu (Upstream SCM)</p>
      </div>
      <button
        type="button"
        id="add-supplier-btn"
        class="px-4 py-2 rounded-xl bg-espresso-800 hover:bg-espresso-900 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
      >
        <i data-lucide="plus" class="w-4 h-4"></i>
        <span>+ Tambah Pemasok</span>
      </button>
    </div>

    <div class="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b border-stone-200 bg-stone-50/80 text-[11px] font-bold uppercase tracking-wider text-stone-500">
              <th class="py-3.5 px-4">ID</th>
              <th class="py-3.5 px-4">Nama Perusahaan Pemasok</th>
              <th class="py-3.5 px-4">Kategori Pasokan</th>
              <th class="py-3.5 px-4">PIC / Kontak</th>
              <th class="py-3.5 px-4">No. Telepon</th>
              <th class="py-3.5 px-4">Alamat</th>
              <th class="py-3.5 px-4 text-center">Lead Time</th>
              <th class="py-3.5 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-stone-200 text-sm">
            ${state.suppliers
              .map(
                (s) => `
              <tr class="hover:bg-stone-50/80 transition">
                <td class="py-3.5 px-4 font-mono text-xs text-stone-500">#${s.id}</td>
                <td class="py-3.5 px-4 font-bold text-stone-900">${escapeHtml(s.name)}</td>
                <td class="py-3.5 px-4">${getCategoryBadge(s.category)}</td>
                <td class="py-3.5 px-4 text-stone-800 font-medium">${escapeHtml(
                  s.contact_name
                )}</td>
                <td class="py-3.5 px-4 font-mono text-xs text-stone-600">${escapeHtml(s.phone)}</td>
                <td class="py-3.5 px-4 text-xs text-stone-600 max-w-xs">${escapeHtml(
                  s.address || '-'
                )}</td>
                <td class="py-3.5 px-4 text-center">
                  <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-800 border border-stone-300">
                    ${s.lead_time_days} Hari
                  </span>
                </td>
                <td class="py-3.5 px-4 text-right whitespace-nowrap">
                  <div class="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      data-edit-sup="${s.id}"
                      class="sup-edit-btn p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                      title="Edit Pemasok"
                    >
                      <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                    </button>
                    <button
                      type="button"
                      data-del-sup="${s.id}"
                      class="sup-del-btn p-1.5 rounded-lg border border-stone-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200"
                      title="Hapus Pemasok"
                    >
                      <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                  </div>
                </td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document
    .getElementById('add-supplier-btn')
    ?.addEventListener('click', () => openSupplierFormModal());

  main.querySelectorAll('.sup-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.getAttribute('data-edit-sup'));
      const sup = state.suppliers.find((x) => x.id === id);
      if (sup) openSupplierFormModal(sup);
    });
  });

  main.querySelectorAll('.sup-del-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-del-sup'));
      const sup = state.suppliers.find((x) => x.id === id);
      if (!sup) return;
      if (!confirm(`Hapus pemasok "${sup.name}"?`)) return;

      try {
        const res = await apiFetch(`/api/suppliers/${id}`, { method: 'DELETE' });
        showToast(res.message, 'success');
        await renderSuppliersPage();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

// ============================================================================
// PAGE 4: PURCHASE ORDERS & ATOMIC GOODS RECEIPT
// ============================================================================

async function renderPurchaseOrdersPage() {
  const main = document.getElementById('main-content');
  const isAdmin = state.user?.role === 'admin';

  const promises = [apiFetch('/api/purchase-orders')];
  if (isAdmin) {
    promises.push(apiFetch('/api/materials'), apiFetch('/api/suppliers'));
  }

  const [poRes, matRes, supRes] = await Promise.all(promises);
  state.purchaseOrders = poRes.purchase_orders || [];
  if (matRes) state.materials = matRes.materials || [];
  if (supRes) state.suppliers = supRes.suppliers || [];

  drawPurchaseOrdersView(main);
}

function renderPoTableHtml(orders) {
  const isAdmin = state.user?.role === 'admin';

  if (orders.length === 0) {
    return `<div class="p-10 text-center text-stone-500 text-sm">Belum ada Purchase Order yang sesuai dengan filter.</div>`;
  }

  return `
    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="border-b border-stone-200 bg-stone-50/80 text-[11px] font-bold uppercase tracking-wider text-stone-500">
            <th class="py-3.5 px-4">No. PO & Tanggal</th>
            <th class="py-3.5 px-4">Pemasok</th>
            <th class="py-3.5 px-4">Rincian Item Bahan Baku</th>
            <th class="py-3.5 px-4 text-right">Total Nilai PO</th>
            <th class="py-3.5 px-4 text-center">Status PO</th>
            <th class="py-3.5 px-4 text-right">Aksi Kontekstual</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-stone-200 text-sm">
          ${orders
            .map((po) => {
              const itemsSummary = (po.items || [])
                .map(
                  (it) =>
                    `<div class="text-xs text-stone-700"><span class="font-bold text-stone-900">${escapeHtml(
                      it.material_name
                    )}</span> • ${formatNumber(it.quantity)} ${escapeHtml(
                      it.unit
                    )} <span class="text-stone-400">(${formatRupiah(it.subtotal)})</span></div>`
                )
                .join('');

              let actionButtons = `
                <button
                  type="button"
                  data-detail-po="${po.id}"
                  class="po-detail-btn px-2.5 py-1.5 rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-100 text-xs font-semibold transition"
                >
                  Detail
                </button>
              `;

              if (!isAdmin) {
                // Tombol Aksi untuk SUPPLIER
                if (po.status === 'PENDING') {
                  actionButtons = `
                    <button
                      type="button"
                      data-po-status-id="${po.id}"
                      data-po-next-status="PROCESSING"
                      class="po-status-btn px-3 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-2xs transition inline-flex items-center gap-1.5"
                    >
                      <i data-lucide="play" class="w-3.5 h-3.5"></i>
                      <span>Proses Pesanan</span>
                    </button>
                    ${actionButtons}
                  `;
                } else if (po.status === 'PROCESSING') {
                  actionButtons = `
                    <button
                      type="button"
                      data-po-status-id="${po.id}"
                      data-po-next-status="SHIPPED"
                      class="po-status-btn px-3 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold shadow-2xs transition inline-flex items-center gap-1.5"
                    >
                      <i data-lucide="truck" class="w-3.5 h-3.5"></i>
                      <span>Kirim Barang</span>
                    </button>
                    ${actionButtons}
                  `;
                }
              } else {
                // Tombol Aksi untuk ADMIN
                if (po.status === 'SHIPPED') {
                  actionButtons = `
                    <button
                      type="button"
                      data-receive-po="${po.id}"
                      class="po-receive-btn px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-2xs transition inline-flex items-center gap-1.5"
                    >
                      <i data-lucide="package-check" class="w-3.5 h-3.5"></i>
                      <span>Terima Barang & Update Stok</span>
                    </button>
                    ${actionButtons}
                  `;
                } else if (po.status === 'PENDING') {
                  actionButtons = `
                    <button
                      type="button"
                      data-po-status-id="${po.id}"
                      data-po-next-status="CANCELLED"
                      class="po-status-btn px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition"
                    >
                      Batalkan
                    </button>
                    ${actionButtons}
                  `;
                }
              }

              return `
                <tr class="hover:bg-stone-50/80 transition align-top">
                  <td class="py-4 px-4">
                    <div class="font-mono font-extrabold text-stone-900 text-xs sm:text-sm">${escapeHtml(
                      po.po_number
                    )}</div>
                    <div class="text-[11px] text-stone-500 mt-0.5">Dibuat: ${formatDateTime(
                      po.created_at
                    )}</div>
                    ${
                      po.received_at
                        ? `<div class="text-[11px] text-emerald-700 font-semibold mt-0.5">Diterima: ${formatDateTime(
                            po.received_at
                          )}</div>`
                        : ''
                    }
                  </td>
                  <td class="py-4 px-4">
                    <div class="font-bold text-stone-900 text-xs sm:text-sm">${escapeHtml(
                      po.supplier_name
                    )}</div>
                    <div class="mt-1">${getCategoryBadge(po.supplier_category)}</div>
                  </td>
                  <td class="py-4 px-4 space-y-1">
                    ${itemsSummary}
                    ${
                      po.notes
                        ? `<div class="text-[11px] text-stone-500 italic pt-1">Catatan: "${escapeHtml(
                            po.notes
                          )}"</div>`
                        : ''
                    }
                  </td>
                  <td class="py-4 px-4 text-right font-extrabold text-stone-900">
                    ${formatRupiah(po.total_cost)}
                  </td>
                  <td class="py-4 px-4 text-center">
                    ${getPoStatusBadge(po.status)}
                  </td>
                  <td class="py-4 px-4 text-right whitespace-nowrap">
                    <div class="inline-flex items-center gap-1.5 flex-wrap justify-end">
                      ${actionButtons}
                    </div>
                  </td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function bindPoTableActions(container) {
  container.querySelectorAll('.po-detail-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.getAttribute('data-detail-po'));
      const po = state.purchaseOrders.find((x) => x.id === id);
      if (po) openPoDetailModal(po);
    });
  });

  container.querySelectorAll('.po-status-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-po-status-id'));
      const nextStatus = btn.getAttribute('data-po-next-status');
      const po = state.purchaseOrders.find((x) => x.id === id);
      if (!po || !nextStatus) return;

      const actionLabels = {
        PROCESSING: `Konfirmasi mulai memproses pesanan ${po.po_number}?`,
        SHIPPED: `Konfirmasi pengiriman barang untuk ${po.po_number} ke Gudang Mugi Berkah?`,
        CANCELLED: `Batalkan Purchase Order ${po.po_number}?`,
      };

      if (!confirm(actionLabels[nextStatus] || `Ubah status PO menjadi ${nextStatus}?`)) return;

      btn.disabled = true;
      try {
        const res = await apiFetch(`/api/purchase-orders/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: nextStatus }),
        });
        showToast(res.message, 'success');
        await loadAndRenderCurrentPage();
      } catch (err) {
        showToast(err.message, 'error');
        btn.disabled = false;
      }
    });
  });

  container.querySelectorAll('.po-receive-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-receive-po'));
      const po = state.purchaseOrders.find((x) => x.id === id);
      if (!po) return;

      if (
        !confirm(
          `Konfirmasi Penerimaan Barang (Goods Receipt) untuk ${po.po_number}?\n\nStok bahan baku di gudang akan otomatis bertambah dan riwayat mutasi (IN) akan dicatat secara atomik.`
        )
      ) {
        return;
      }

      btn.disabled = true;
      try {
        const res = await apiFetch(`/api/purchase-orders/${id}/receive`, {
          method: 'POST',
        });
        showToast(res.message, 'success');
        await loadAndRenderCurrentPage();
      } catch (err) {
        showToast(err.message, 'error');
        btn.disabled = false;
      }
    });
  });
}

function drawPurchaseOrdersView(container) {
  const isAdmin = state.user?.role === 'admin';
  const statuses = ['ALL', 'PENDING', 'PROCESSING', 'SHIPPED', 'RECEIVED', 'CANCELLED'];

  const filtered = state.purchaseOrders.filter((po) => {
    if (state.poStatusFilter !== 'ALL' && po.status !== state.poStatusFilter) {
      return false;
    }
    return true;
  });

  container.innerHTML = `
    <div class="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
      <div class="flex flex-wrap items-center gap-1.5">
        ${statuses
          .map((st) => {
            const active = state.poStatusFilter === st;
            const label = st === 'ALL' ? 'Semua Status' : st;
            return `
              <button
                type="button"
                data-po-filter="${st}"
                class="po-filter-btn px-3 py-2 rounded-xl text-xs font-bold transition ${
                  active
                    ? 'bg-espresso-800 text-white shadow-2xs'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }"
              >
                ${label}
              </button>
            `;
          })
          .join('')}
      </div>

      ${
        isAdmin
          ? `
        <button
          type="button"
          id="open-create-po-btn"
          class="px-4 py-2 rounded-xl bg-espresso-800 hover:bg-espresso-900 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
        >
          <i data-lucide="plus-circle" class="w-4 h-4"></i>
          <span>+ Buat Purchase Order Baru</span>
        </button>
      `
          : ''
      }
    </div>

    <div class="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden">
      ${renderPoTableHtml(filtered)}
    </div>
  `;

  refreshIcons();

  container.querySelectorAll('.po-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.poStatusFilter = btn.getAttribute('data-po-filter');
      drawPurchaseOrdersView(container);
    });
  });

  document
    .getElementById('open-create-po-btn')
    ?.addEventListener('click', () => openCreatePoModal());

  bindPoTableActions(container);
}

// ============================================================================
// PAGE 5: RIWAYAT MUTASI STOK (STOCK MOVEMENTS AUDIT LOG & CSV EXPORT)
// ============================================================================

async function renderStockMovementsPage() {
  const main = document.getElementById('main-content');
  const [movRes, matRes] = await Promise.all([
    apiFetch('/api/stock-movements'),
    apiFetch('/api/materials'),
  ]);

  state.stockMovements = movRes.movements || [];
  state.materials = matRes.materials || [];

  drawStockMovementsView(main);
}

function drawStockMovementsView(container) {
  const filtered = state.stockMovements.filter((mv) => {
    if (state.movementTypeFilter !== 'ALL' && mv.type !== state.movementTypeFilter) {
      return false;
    }
    if (
      state.movementMaterialFilter !== 'ALL' &&
      Number(mv.material_id) !== Number(state.movementMaterialFilter)
    ) {
      return false;
    }
    return true;
  });

  const inCount = filtered.filter((m) => m.type === 'IN').length;
  const outCount = filtered.filter((m) => m.type === 'OUT').length;

  container.innerHTML = `
    <!-- FILTER & EXPORT BAR -->
    <div class="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
      <div class="flex flex-wrap items-center gap-2">
        ${[
          { id: 'ALL', label: 'Semua Mutasi' },
          { id: 'IN', label: 'Masuk / IN (Penerimaan PO)' },
          { id: 'OUT', label: 'Keluar / OUT (Pemakaian Harian)' },
        ]
          .map((t) => {
            const active = state.movementTypeFilter === t.id;
            return `
              <button
                type="button"
                data-mov-type="${t.id}"
                class="mov-type-btn px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                  active
                    ? 'bg-espresso-800 text-white shadow-2xs'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }"
              >
                ${escapeHtml(t.label)}
              </button>
            `;
          })
          .join('')}

        <select
          id="mov-material-select"
          class="px-3 py-2 rounded-xl border border-stone-300 text-xs font-semibold text-stone-700 bg-stone-50 focus:outline-none focus:border-amber-700"
        >
          <option value="ALL">Semua Bahan Baku</option>
          ${state.materials
            .map(
              (m) =>
                `<option value="${m.id}" ${
                  String(state.movementMaterialFilter) === String(m.id) ? 'selected' : ''
                }>${escapeHtml(m.sku)} — ${escapeHtml(m.name)}</option>`
            )
            .join('')}
        </select>
      </div>

      <div class="flex items-center gap-3">
        <div class="text-xs text-stone-500 hidden sm:block">
          <span class="font-bold text-emerald-700">${inCount} IN</span> •
          <span class="font-bold text-amber-800">${outCount} OUT</span>
        </div>
        <button
          type="button"
          id="export-csv-btn"
          class="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
        >
          <i data-lucide="download" class="w-4 h-4"></i>
          <span>Ekspor CSV</span>
        </button>
      </div>
    </div>

    <!-- MOVEMENTS TABLE -->
    <div class="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b border-stone-200 bg-stone-50/80 text-[11px] font-bold uppercase tracking-wider text-stone-500">
              <th class="py-3.5 px-4">Waktu Pencatatan</th>
              <th class="py-3.5 px-4">SKU & Bahan Baku</th>
              <th class="py-3.5 px-4">Kategori</th>
              <th class="py-3.5 px-4 text-center">Tipe Mutasi</th>
              <th class="py-3.5 px-4 text-right">Kuantitas</th>
              <th class="py-3.5 px-4">Referensi Transaksi</th>
              <th class="py-3.5 px-4">Catatan & Petugas</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-stone-200 text-sm">
            ${
              filtered.length === 0
                ? `<tr><td colspan="7" class="py-10 text-center text-stone-500 text-sm">Belum ada catatan mutasi stok.</td></tr>`
                : filtered
                    .map((mv) => {
                      const isIn = mv.type === 'IN';
                      return `
                        <tr class="hover:bg-stone-50/80 transition">
                          <td class="py-3.5 px-4 text-xs text-stone-500 whitespace-nowrap">${formatDateTime(
                            mv.created_at
                          )}</td>
                          <td class="py-3.5 px-4">
                            <div class="font-bold text-stone-900">${escapeHtml(
                              mv.material_name
                            )}</div>
                            <div class="text-xs font-mono text-stone-500">${escapeHtml(mv.sku)}</div>
                          </td>
                          <td class="py-3.5 px-4">${getCategoryBadge(mv.category)}</td>
                          <td class="py-3.5 px-4 text-center whitespace-nowrap">
                            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md whitespace-nowrap text-xs font-bold ${
                              isIn
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }">
                              <span>${isIn ? '+' : '−'}</span>
                              <span>${isIn ? 'MASUK (IN)' : 'KELUAR (OUT)'}</span>
                            </span>
                          </td>
                          <td class="py-3.5 px-4 text-right font-extrabold ${
                            isIn ? 'text-emerald-700' : 'text-amber-800'
                          }">
                            ${isIn ? '+' : '-'}${formatNumber(mv.quantity)} ${escapeHtml(mv.unit)}
                          </td>
                          <td class="py-3.5 px-4 font-mono text-xs font-bold text-stone-800">
                            ${escapeHtml(mv.reference)}
                          </td>
                          <td class="py-3.5 px-4">
                            <div class="text-xs text-stone-700">${escapeHtml(
                              mv.notes || '-'
                            )}</div>
                            <div class="text-[11px] text-stone-400">Oleh: ${escapeHtml(
                              mv.created_by_name
                            )}</div>
                          </td>
                        </tr>
                      `;
                    })
                    .join('')
            }
          </tbody>
        </table>
      </div>
    </div>
  `;

  refreshIcons();

  container.querySelectorAll('.mov-type-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.movementTypeFilter = btn.getAttribute('data-mov-type');
      drawStockMovementsView(container);
    });
  });

  document.getElementById('mov-material-select')?.addEventListener('change', (e) => {
    state.movementMaterialFilter = e.target.value;
    drawStockMovementsView(container);
  });

  document.getElementById('export-csv-btn')?.addEventListener('click', () => {
    exportMovementsToCsv(filtered);
  });
}

function exportMovementsToCsv(rows) {
  if (!rows || rows.length === 0) {
    showToast('Tidak ada data mutasi untuk diekspor.', 'warning');
    return;
  }

  const headers = [
    'ID',
    'Waktu',
    'SKU',
    'Bahan Baku',
    'Kategori',
    'Tipe',
    'Kuantitas',
    'Satuan',
    'Referensi',
    'Catatan',
    'Petugas',
  ];

  const csvLines = [
    headers.join(','),
    ...rows.map((r) =>
      [
        r.id,
        `"${formatDateTime(r.created_at)}"`,
        `"${r.sku}"`,
        `"${(r.material_name || '').replace(/"/g, '""')}"`,
        `"${r.category}"`,
        r.type,
        r.quantity,
        `"${r.unit}"`,
        `"${(r.reference || '').replace(/"/g, '""')}"`,
        `"${(r.notes || '').replace(/"/g, '""')}"`,
        `"${(r.created_by_name || '').replace(/"/g, '""')}"`,
      ].join(',')
    ),
  ];

  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mutasi-stok-mugi-berkah-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('Laporan Riwayat Mutasi Stok berhasil diunduh (.csv).', 'success');
}

// ============================================================================
// MODALS (CREATE PO, STOCK OUT USAGE, MATERIAL CRUD, SUPPLIER CRUD, PO DETAIL)
// ============================================================================

function openModal(htmlContent) {
  const backdrop = document.getElementById('modal-backdrop');
  const container = document.getElementById('modal-container');
  container.innerHTML = htmlContent;
  backdrop.classList.remove('hidden');
  refreshIcons();

  container.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', closeModal);
  });
}

function closeModal() {
  const backdrop = document.getElementById('modal-backdrop');
  const container = document.getElementById('modal-container');
  backdrop.classList.add('hidden');
  container.innerHTML = '';
}

// 1. Modal Catat Pemakaian Bahan Harian (Stock Out)
function openStockUsageModal(material) {
  openModal(`
    <div class="px-6 py-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <div class="p-2 rounded-xl bg-amber-100 text-amber-800">
          <i data-lucide="minus-circle" class="w-5 h-5"></i>
        </div>
        <div>
          <h3 class="text-base font-extrabold text-stone-900">Catat Pemakaian Bahan (Stock Out)</h3>
          <p class="text-xs text-stone-500">Pengurangan stok harian oleh Bar Kopi atau Dapur Pastry</p>
        </div>
      </div>
      <button type="button" data-close-modal class="p-1.5 rounded-lg text-stone-400 hover:text-stone-700">
        <i data-lucide="x" class="w-5 h-5"></i>
      </button>
    </div>

    <form id="stock-usage-form" class="p-6 space-y-4">
      <div class="p-4 rounded-xl bg-amber-50/70 border border-amber-200 flex items-center justify-between">
        <div>
          <div class="text-xs font-mono text-stone-500">${escapeHtml(material.sku)} • ${escapeHtml(
    material.category
  )}</div>
          <div class="text-base font-extrabold text-stone-900">${escapeHtml(material.name)}</div>
        </div>
        <div class="text-right">
          <div class="text-xs text-stone-500">Stok Tersedia</div>
          <div class="text-lg font-extrabold text-stone-900">${formatNumber(
            material.current_stock
          )} ${escapeHtml(material.unit)}</div>
          <div class="text-[11px] text-stone-500">Min. Stok: ${formatNumber(
            material.min_stock
          )} ${escapeHtml(material.unit)}</div>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-bold text-stone-700 uppercase mb-1">Jumlah Pemakaian (${escapeHtml(
            material.unit
          )})</label>
          <input
            type="number"
            id="usage-qty"
            step="0.01"
            min="0.01"
            max="${material.current_stock}"
            required
            placeholder="Contoh: 2"
            class="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 focus:outline-none focus:border-amber-700"
          />
        </div>
        <div>
          <label class="block text-xs font-bold text-stone-700 uppercase mb-1">Unit / Referensi Pemakaian</label>
          <select
            id="usage-ref"
            class="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 focus:outline-none focus:border-amber-700 bg-white"
          >
            <option value="Pemakaian Bar Kopi Harian">Pemakaian Bar Kopi Harian</option>
            <option value="Produksi Croissant & Danish Pagi">Produksi Croissant & Danish Pagi</option>
            <option value="Kalibrasi Mesin Espresso & QC">Kalibrasi Mesin Espresso & QC</option>
            <option value="Pemakaian Dapur Pastry Sore">Pemakaian Dapur Pastry Sore</option>
          </select>
        </div>
      </div>

      <div>
        <label class="block text-xs font-bold text-stone-700 uppercase mb-1">Catatan Tambahan (Opsional)</label>
        <input
          type="text"
          id="usage-notes"
          placeholder="Contoh: Kebutuhan ekstraksi espresso & batch croissant shift pagi"
          class="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 focus:outline-none focus:border-amber-700"
        />
      </div>

      <div class="pt-3 border-t border-stone-200 flex items-center justify-end gap-2.5">
        <button type="button" data-close-modal class="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 text-xs font-bold hover:bg-stone-100">
          Batal
        </button>
        <button type="submit" class="px-5 py-2 rounded-xl bg-espresso-800 hover:bg-espresso-900 text-white text-xs font-bold shadow-xs">
          Simpan Pemakaian (Stock Out)
        </button>
      </div>
    </form>
  `);

  document.getElementById('stock-usage-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const quantity = Number(document.getElementById('usage-qty').value);
    const reference = document.getElementById('usage-ref').value;
    const notes = document.getElementById('usage-notes').value;

    try {
      const res = await apiFetch(`/api/materials/${material.id}/usage`, {
        method: 'POST',
        body: JSON.stringify({ quantity, reference, notes }),
      });
      closeModal();
      showToast(res.message, res.material?.is_low_stock ? 'warning' : 'success');
      await loadAndRenderCurrentPage();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// 2. Modal Buat Purchase Order Baru (mendukung pre-fill dari tombol Pesan Ulang)
function openCreatePoModal(prefill = {}) {
  if (!state.suppliers.length || !state.materials.length) {
    showToast('Data pemasok atau bahan baku belum dimuat.', 'warning');
    return;
  }

  const defaultSupplierId = prefill.supplierId || state.suppliers[0].id;
  let poItems = [];

  function initItemsForSupplier(supId, preferredMatId = null) {
    const supMaterials = state.materials.filter((m) => Number(m.supplier_id) === Number(supId));
    if (supMaterials.length === 0) {
      poItems = [];
      return;
    }
    const chosen =
      supMaterials.find((m) => Number(m.id) === Number(preferredMatId)) || supMaterials[0];
    const suggestedQty = chosen.is_low_stock
      ? Math.max(10, Number(chosen.min_stock) * 2 - Number(chosen.current_stock))
      : 10;

    poItems = [
      {
        material_id: chosen.id,
        quantity: suggestedQty,
      },
    ];
  }

  initItemsForSupplier(defaultSupplierId, prefill.materialId);

  openModal(`
    <div class="px-6 py-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <div class="p-2 rounded-xl bg-amber-100 text-amber-800">
          <i data-lucide="shopping-cart" class="w-5 h-5"></i>
        </div>
        <div>
          <h3 class="text-base font-extrabold text-stone-900">Buat Purchase Order (PO) Baru</h3>
          <p class="text-xs text-stone-500">Pengadaan bahan baku ke mitra pemasok Mugi Berkah</p>
        </div>
      </div>
      <button type="button" data-close-modal class="p-1.5 rounded-lg text-stone-400 hover:text-stone-700">
        <i data-lucide="x" class="w-5 h-5"></i>
      </button>
    </div>

    <form id="create-po-form" class="p-6 space-y-4">
      <div>
        <label class="block text-xs font-bold text-stone-700 uppercase mb-1">1. Pilih Mitra Pemasok</label>
        <select
          id="po-supplier-select"
          class="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 font-semibold text-stone-800 bg-white focus:outline-none focus:border-amber-700"
        >
          ${state.suppliers
            .map(
              (s) =>
                `<option value="${s.id}" ${
                  Number(s.id) === Number(defaultSupplierId) ? 'selected' : ''
                }>${escapeHtml(s.name)} — Kategori: ${escapeHtml(s.category)} (Lead Time: ${
                  s.lead_time_days
                } hari)</option>`
            )
            .join('')}
        </select>
      </div>

      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="block text-xs font-bold text-stone-700 uppercase">2. Daftar Item Bahan Baku</label>
          <button
            type="button"
            id="po-add-item-row"
            class="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold transition inline-flex items-center gap-1"
          >
            <i data-lucide="plus" class="w-3.5 h-3.5"></i>
            <span>Tambah Baris Item</span>
          </button>
        </div>

        <div id="po-items-container" class="space-y-2.5 max-h-64 overflow-y-auto pr-1"></div>
      </div>

      <div>
        <label class="block text-xs font-bold text-stone-700 uppercase mb-1">3. Catatan Pengadaan (Opsional)</label>
        <input
          type="text"
          id="po-notes-input"
          placeholder="Contoh: Pengiriman prioritas pagi sebelum pukul 09.00 WIB"
          class="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 focus:outline-none focus:border-amber-700"
        />
      </div>

      <div class="p-4 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-between">
        <div>
          <div class="text-xs font-bold uppercase text-stone-500">Estimasi Total Nilai PO</div>
          <div class="text-[11px] text-stone-500">Dihitung otomatis dari harga beli master bahan baku</div>
        </div>
        <div id="po-total-preview" class="text-xl font-extrabold text-espresso-900">Rp 0</div>
      </div>

      <div class="pt-3 border-t border-stone-200 flex items-center justify-end gap-2.5">
        <button type="button" data-close-modal class="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 text-xs font-bold hover:bg-stone-100">
          Batal
        </button>
        <button type="submit" class="px-5 py-2 rounded-xl bg-espresso-800 hover:bg-espresso-900 text-white text-xs font-bold shadow-xs">
          Terbitkan Purchase Order (PENDING)
        </button>
      </div>
    </form>
  `);

  const supplierSelect = document.getElementById('po-supplier-select');
  const itemsContainer = document.getElementById('po-items-container');
  const totalPreview = document.getElementById('po-total-preview');

  function renderPoItemRows() {
    const selectedSupplierId = Number(supplierSelect.value);
    const availableMaterials = state.materials.filter(
      (m) => Number(m.supplier_id) === selectedSupplierId
    );

    if (availableMaterials.length === 0) {
      itemsContainer.innerHTML = `<div class="p-4 rounded-xl bg-rose-50 text-rose-800 text-xs">Pemasok ini belum memiliki bahan baku terdaftar.</div>`;
      totalPreview.textContent = formatRupiah(0);
      return;
    }

    let grandTotal = 0;

    itemsContainer.innerHTML = poItems
      .map((item, idx) => {
        const mat =
          availableMaterials.find((m) => Number(m.id) === Number(item.material_id)) ||
          availableMaterials[0];
        item.material_id = mat.id;
        const subtotal = Math.round(Number(item.quantity || 0) * Number(mat.unit_price));
        grandTotal += subtotal;

        return `
          <div class="grid grid-cols-12 gap-2 items-center p-2.5 rounded-xl bg-stone-50 border border-stone-200">
            <div class="col-span-6">
              <select
                data-row-idx="${idx}"
                class="po-item-mat-select w-full px-2.5 py-2 text-xs rounded-lg border border-stone-300 bg-white font-semibold text-stone-800"
              >
                ${availableMaterials
                  .map(
                    (m) =>
                      `<option value="${m.id}" ${
                        Number(m.id) === Number(item.material_id) ? 'selected' : ''
                      }>${escapeHtml(m.sku)} — ${escapeHtml(m.name)} (${formatRupiah(
                        m.unit_price
                      )}/${escapeHtml(m.unit)}) ${m.is_low_stock ? '[LOW]' : ''}</option>`
                  )
                  .join('')}
              </select>
            </div>
            <div class="col-span-3">
              <div class="flex items-center">
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  data-row-idx="${idx}"
                  value="${item.quantity}"
                  class="po-item-qty-input w-full px-2.5 py-2 text-xs rounded-lg border border-stone-300 bg-white font-bold text-right"
                />
                <span class="ml-1.5 text-xs text-stone-500 font-medium">${escapeHtml(
                  mat.unit
                )}</span>
              </div>
            </div>
            <div data-row-subtotal="${idx}" class="col-span-2 text-right text-xs font-bold text-stone-800">
              ${formatRupiah(subtotal)}
            </div>
            <div class="col-span-1 text-right">
              ${
                poItems.length > 1
                  ? `<button type="button" data-remove-idx="${idx}" class="po-remove-row p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg">
                      <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                     </button>`
                  : ''
              }
            </div>
          </div>
        `;
      })
      .join('');

    totalPreview.textContent = formatRupiah(grandTotal);
    refreshIcons();

    function updatePoTotalsLive() {
      let liveTotal = 0;
      poItems.forEach((item, rowIdx) => {
        const mat = availableMaterials.find((m) => Number(m.id) === Number(item.material_id));
        const rowSubtotal = mat ? Math.round(Number(item.quantity || 0) * Number(mat.unit_price)) : 0;
        liveTotal += rowSubtotal;
        const subEl = itemsContainer.querySelector(`[data-row-subtotal="${rowIdx}"]`);
        if (subEl) {
          subEl.textContent = formatRupiah(rowSubtotal);
        }
      });
      totalPreview.textContent = formatRupiah(liveTotal);
    }

    itemsContainer.querySelectorAll('.po-item-mat-select').forEach((sel) => {
      sel.addEventListener('change', (e) => {
        const idx = Number(sel.getAttribute('data-row-idx'));
        poItems[idx].material_id = Number(e.target.value);
        renderPoItemRows();
      });
    });

    itemsContainer.querySelectorAll('.po-item-qty-input').forEach((inp) => {
      inp.addEventListener('input', (e) => {
        const idx = Number(inp.getAttribute('data-row-idx'));
        poItems[idx].quantity = Number(e.target.value || 0);
        updatePoTotalsLive();
      });
    });

    itemsContainer.querySelectorAll('.po-remove-row').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-remove-idx'));
        poItems.splice(idx, 1);
        renderPoItemRows();
      });
    });
  }

  supplierSelect.addEventListener('change', () => {
    initItemsForSupplier(Number(supplierSelect.value));
    renderPoItemRows();
  });

  document.getElementById('po-add-item-row')?.addEventListener('click', () => {
    const selectedSupplierId = Number(supplierSelect.value);
    const availableMaterials = state.materials.filter(
      (m) => Number(m.supplier_id) === selectedSupplierId
    );
    if (availableMaterials.length === 0) return;
    const nextMat = availableMaterials[poItems.length % availableMaterials.length];
    poItems.push({
      material_id: nextMat.id,
      quantity: 5,
    });
    renderPoItemRows();
  });

  renderPoItemRows();

  document.getElementById('create-po-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const supplier_id = Number(supplierSelect.value);
    const notes = document.getElementById('po-notes-input').value;

    try {
      const res = await apiFetch('/api/purchase-orders', {
        method: 'POST',
        body: JSON.stringify({
          supplier_id,
          notes,
          items: poItems,
        }),
      });
      closeModal();
      showToast(res.message, 'success');
      await loadAndRenderCurrentPage();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// 3. Modal Detail Purchase Order
function openPoDetailModal(po) {
  openModal(`
    <div class="px-6 py-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
      <div>
        <div class="flex items-center gap-2">
          <h3 class="text-base font-extrabold text-stone-900 font-mono">${escapeHtml(
            po.po_number
          )}</h3>
          ${getPoStatusBadge(po.status)}
        </div>
        <p class="text-xs text-stone-500 mt-0.5">Pemasok: ${escapeHtml(po.supplier_name)}</p>
      </div>
      <button type="button" data-close-modal class="p-1.5 rounded-lg text-stone-400 hover:text-stone-700">
        <i data-lucide="x" class="w-5 h-5"></i>
      </button>
    </div>

    <div class="p-6 space-y-4">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-stone-50 p-4 rounded-xl border border-stone-200">
        <div>
          <span class="text-stone-500 block">Mitra Pemasok</span>
          <span class="font-bold text-stone-900">${escapeHtml(po.supplier_name)}</span>
          <span class="block text-stone-500">${escapeHtml(po.supplier_phone || '')}</span>
        </div>
        <div>
          <span class="text-stone-500 block">Tanggal Penerbitan PO</span>
          <span class="font-bold text-stone-900">${formatDateTime(po.created_at)}</span>
          <span class="block text-stone-500">Oleh: ${escapeHtml(po.created_by_name)}</span>
        </div>
        <div>
          <span class="text-stone-500 block">Tanggal Diterima (RECEIVED)</span>
          <span class="font-bold text-emerald-800">${
            po.received_at ? formatDateTime(po.received_at) : 'Belum Diterima'
          }</span>
        </div>
      </div>

      <div class="border border-stone-200 rounded-xl overflow-hidden">
        <table class="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr class="bg-stone-100 border-b border-stone-200 text-[11px] font-bold uppercase text-stone-600">
              <th class="py-2.5 px-3">SKU & Bahan Baku</th>
              <th class="py-2.5 px-3 text-right">Kuantitas</th>
              <th class="py-2.5 px-3 text-right">Harga Satuan</th>
              <th class="py-2.5 px-3 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-stone-200">
            ${(po.items || [])
              .map(
                (it) => `
              <tr>
                <td class="py-2.5 px-3">
                  <div class="font-bold text-stone-900">${escapeHtml(it.material_name)}</div>
                  <div class="text-xs font-mono text-stone-500">${escapeHtml(it.sku)}</div>
                </td>
                <td class="py-2.5 px-3 text-right font-bold">${formatNumber(
                  it.quantity
                )} ${escapeHtml(it.unit)}</td>
                <td class="py-2.5 px-3 text-right text-stone-600">${formatRupiah(
                  it.unit_price
                )}</td>
                <td class="py-2.5 px-3 text-right font-bold text-stone-900">${formatRupiah(
                  it.subtotal
                )}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
          <tfoot>
            <tr class="bg-amber-50/60 border-t border-stone-200 font-extrabold text-stone-900">
              <td colspan="3" class="py-3 px-3 text-right">TOTAL BIAYA PENGADAAN</td>
              <td class="py-3 px-3 text-right text-base text-espresso-900">${formatRupiah(
                po.total_cost
              )}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      ${
        po.notes
          ? `<div class="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-700">
              <strong>Catatan PO:</strong> ${escapeHtml(po.notes)}
             </div>`
          : ''
      }

      <div class="pt-2 flex justify-end">
        <button type="button" data-close-modal class="px-4 py-2 rounded-xl bg-stone-800 text-white text-xs font-bold hover:bg-stone-900">
          Tutup
        </button>
      </div>
    </div>
  `);
}

// 4. Modal Tambah / Edit Bahan Baku
function openMaterialFormModal(material = null) {
  const isEdit = Boolean(material);

  openModal(`
    <div class="px-6 py-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
      <div>
        <h3 class="text-base font-extrabold text-stone-900">${
          isEdit ? 'Edit Master Bahan Baku' : 'Tambah Bahan Baku Baru'
        }</h3>
        <p class="text-xs text-stone-500">Atur SKU, kategori, batas Reorder Point (min_stock), dan pemasok</p>
      </div>
      <button type="button" data-close-modal class="p-1.5 rounded-lg text-stone-400 hover:text-stone-700">
        <i data-lucide="x" class="w-5 h-5"></i>
      </button>
    </div>

    <form id="material-form" class="p-6 space-y-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-bold text-stone-700 uppercase mb-1">Kode SKU</label>
          <input
            type="text"
            id="mat-sku"
            required
            value="${escapeHtml(material?.sku || '')}"
            placeholder="Contoh: KOP-004"
            class="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 font-mono"
          />
        </div>
        <div>
          <label class="block text-xs font-bold text-stone-700 uppercase mb-1">Kategori Bahan</label>
          <select id="mat-category" class="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 bg-white">
            ${['Kopi', 'Dairy & Sirup', 'Bahan Pastry']
              .map(
                (cat) =>
                  `<option value="${cat}" ${
                    material?.category === cat ? 'selected' : ''
                  }>${cat}</option>`
              )
              .join('')}
          </select>
        </div>
      </div>

      <div>
        <label class="block text-xs font-bold text-stone-700 uppercase mb-1">Nama Bahan Baku</label>
        <input
          type="text"
          id="mat-name"
          required
          value="${escapeHtml(material?.name || '')}"
          placeholder="Contoh: Biji Kopi Robusta Temanggung"
          class="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300"
        />
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label class="block text-xs font-bold text-stone-700 uppercase mb-1">Satuan Unit</label>
          <input
            type="text"
            id="mat-unit"
            required
            value="${escapeHtml(material?.unit || 'kg')}"
            placeholder="kg / liter / botol"
            class="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300"
          />
        </div>
        ${
          !isEdit
            ? `
          <div>
            <label class="block text-xs font-bold text-stone-700 uppercase mb-1">Stok Awal</label>
            <input
              type="number"
              step="0.01"
              min="0"
              id="mat-current-stock"
              required
              value="10"
              class="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300"
            />
          </div>
        `
            : ''
        }
        <div>
          <label class="block text-xs font-bold text-stone-700 uppercase mb-1">Min. Stok (ROP)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            id="mat-min-stock"
            required
            value="${material?.min_stock ?? 5}"
            class="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300"
          />
        </div>
        <div>
          <label class="block text-xs font-bold text-stone-700 uppercase mb-1">Harga Beli (Rp)</label>
          <input
            type="number"
            min="0"
            id="mat-price"
            required
            value="${material?.unit_price ?? 50000}"
            class="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300"
          />
        </div>
      </div>

      <div>
        <label class="block text-xs font-bold text-stone-700 uppercase mb-1">Pemasok Utama</label>
        <select id="mat-supplier" class="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 bg-white">
          ${state.suppliers
            .map(
              (s) =>
                `<option value="${s.id}" ${
                  Number(material?.supplier_id) === Number(s.id) ? 'selected' : ''
                }>${escapeHtml(s.name)} (${escapeHtml(s.category)})</option>`
            )
            .join('')}
        </select>
      </div>

      <div class="pt-3 border-t border-stone-200 flex items-center justify-end gap-2.5">
        <button type="button" data-close-modal class="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 text-xs font-bold hover:bg-stone-100">
          Batal
        </button>
        <button type="submit" class="px-5 py-2 rounded-xl bg-espresso-800 hover:bg-espresso-900 text-white text-xs font-bold">
          ${isEdit ? 'Simpan Perubahan' : 'Tambah Bahan Baku'}
        </button>
      </div>
    </form>
  `);

  document.getElementById('material-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      sku: document.getElementById('mat-sku').value,
      name: document.getElementById('mat-name').value,
      category: document.getElementById('mat-category').value,
      unit: document.getElementById('mat-unit').value,
      min_stock: Number(document.getElementById('mat-min-stock').value),
      unit_price: Number(document.getElementById('mat-price').value),
      supplier_id: Number(document.getElementById('mat-supplier').value),
    };

    if (!isEdit) {
      payload.current_stock = Number(document.getElementById('mat-current-stock').value);
    }

    try {
      const res = await apiFetch(isEdit ? `/api/materials/${material.id}` : '/api/materials', {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      closeModal();
      showToast(res.message, 'success');
      await renderMaterialsPage();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// 5. Modal Tambah / Edit Pemasok
function openSupplierFormModal(supplier = null) {
  const isEdit = Boolean(supplier);

  openModal(`
    <div class="px-6 py-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
      <div>
        <h3 class="text-base font-extrabold text-stone-900">${
          isEdit ? 'Edit Data Pemasok' : 'Tambah Mitra Pemasok Baru'
        }</h3>
        <p class="text-xs text-stone-500">Data master pemasok bahan baku Mugi Berkah</p>
      </div>
      <button type="button" data-close-modal class="p-1.5 rounded-lg text-stone-400 hover:text-stone-700">
        <i data-lucide="x" class="w-5 h-5"></i>
      </button>
    </div>

    <form id="supplier-form" class="p-6 space-y-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-bold text-stone-700 uppercase mb-1">Nama Perusahaan</label>
          <input
            type="text"
            id="sup-name"
            required
            value="${escapeHtml(supplier?.name || '')}"
            placeholder="PT / CV / UD ..."
            class="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300"
          />
        </div>
        <div>
          <label class="block text-xs font-bold text-stone-700 uppercase mb-1">Kategori Pasokan</label>
          <select id="sup-category" class="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 bg-white">
            ${['Kopi', 'Dairy & Sirup', 'Bahan Pastry']
              .map(
                (cat) =>
                  `<option value="${cat}" ${
                    supplier?.category === cat ? 'selected' : ''
                  }>${cat}</option>`
              )
              .join('')}
          </select>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label class="block text-xs font-bold text-stone-700 uppercase mb-1">Nama Kontak (PIC)</label>
          <input
            type="text"
            id="sup-contact"
            required
            value="${escapeHtml(supplier?.contact_name || '')}"
            class="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300"
          />
        </div>
        <div>
          <label class="block text-xs font-bold text-stone-700 uppercase mb-1">No. Telepon</label>
          <input
            type="text"
            id="sup-phone"
            required
            value="${escapeHtml(supplier?.phone || '')}"
            class="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300"
          />
        </div>
        <div>
          <label class="block text-xs font-bold text-stone-700 uppercase mb-1">Lead Time (Hari)</label>
          <input
            type="number"
            min="0"
            id="sup-lead"
            required
            value="${supplier?.lead_time_days ?? 2}"
            class="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300"
          />
        </div>
      </div>

      <div>
        <label class="block text-xs font-bold text-stone-700 uppercase mb-1">Alamat Lengkap</label>
        <input
          type="text"
          id="sup-address"
          value="${escapeHtml(supplier?.address || '')}"
          class="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300"
        />
      </div>

      <div class="pt-3 border-t border-stone-200 flex items-center justify-end gap-2.5">
        <button type="button" data-close-modal class="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 text-xs font-bold hover:bg-stone-100">
          Batal
        </button>
        <button type="submit" class="px-5 py-2 rounded-xl bg-espresso-800 hover:bg-espresso-900 text-white text-xs font-bold">
          ${isEdit ? 'Simpan Perubahan' : 'Tambah Pemasok'}
        </button>
      </div>
    </form>
  `);

  document.getElementById('supplier-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('sup-name').value,
      category: document.getElementById('sup-category').value,
      contact_name: document.getElementById('sup-contact').value,
      phone: document.getElementById('sup-phone').value,
      lead_time_days: Number(document.getElementById('sup-lead').value),
      address: document.getElementById('sup-address').value,
    };

    try {
      const res = await apiFetch(isEdit ? `/api/suppliers/${supplier.id}` : '/api/suppliers', {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      closeModal();
      showToast(res.message, 'success');
      await renderSuppliersPage();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  refreshIcons();
  setupIdleTracking();

  // Form Login Submit
  document.getElementById('login-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    performLogin(email, password);
  });

  // Quick Autofill Buttons (isi email & password langsung ke form tanpa auto-submit)
  document.querySelectorAll('.autofill-role-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const email = btn.getAttribute('data-autofill-email');
      const emailInput = document.getElementById('login-email');
      const passInput = document.getElementById('login-password');
      if (email && emailInput && passInput) {
        emailInput.value = email;
        passInput.value = 'mugiberkah123';
        emailInput.focus();
        showToast(`Form terisi untuk ${email}. Klik "Masuk Sekarang" untuk login.`, 'info');
      }
    });
  });

  // Topbar Logout & Refresh
  document.getElementById('logout-btn')?.addEventListener('click', () => handleLogout(true));
  document
    .getElementById('refresh-data-btn')
    ?.addEventListener('click', () => loadAndRenderCurrentPage());

  // Mobile Sidebar Toggle
  document.getElementById('mobile-nav-toggle')?.addEventListener('click', () => {
    const nav = document.getElementById('sidebar-nav');
    nav.classList.toggle('hidden');
  });

  // Close modal when clicking outside backdrop
  document.getElementById('modal-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-backdrop') {
      closeModal();
    }
  });

  // Check if user already has a valid session token
  if (state.token && state.user) {
    try {
      const me = await apiFetch('/api/auth/me');
      state.user = me.user;
      localStorage.setItem('mb_scm_user', JSON.stringify(me.user));
      await enterAppView();
      return;
    } catch {
      handleLogout(false);
    }
  }

  await checkHealthStatus();
  await loadDemoAccounts();
});
