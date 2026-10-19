<template>
  <div class="pilot-dashboard">
    <div class="ambient ambient-one"></div>
    <div class="ambient ambient-two"></div>
    <div class="ambient ambient-three"></div>

    <header v-if="!isMobile" class="topbar">
      <div class="brand-lockup">
        <img src="/icon-192.png" alt="Pilot Inventory System" class="brand-icon">
        <div>
          <p class="eyebrow">Warehouse Console</p>
          <h1 class="brand-title">Pilot Inventory System</h1>
        </div>
      </div>

      <div class="topbar-actions">
        <button class="topbar-chip" @click="refreshDashboard">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M21 12a9 9 0 1 1-2.64-6.36"/>
            <polyline points="21 3 21 9 15 9"/>
          </svg>
          Refresh
        </button>
        <div class="user-pill">
          <AvatarUpload
            :username="username"
            :current-avatar="userAvatar"
            @avatar-updated="handleAvatarUpdated"
          />
          <div>
            <p class="user-label">Signed in</p>
            <p class="user-name">{{ username }}</p>
          </div>
        </div>
        <button @click="logout" class="logout-btn" aria-label="Logout">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </header>

    <div v-if="!isMobile" class="desktop-shell" :style="desktopShellStyle">
      <aside
        class="sidebar"
        :class="{ collapsed: isSidebarCollapsed }"
        @mouseenter="isHovered = true"
        @mouseleave="isHovered = false"
      >
        <div class="sidebar-panel">
          <div class="sidebar-section">
            <p class="sidebar-caption">Workspace</p>
            <nav class="sidebar-nav">
              <a href="#" class="nav-link active" @click.prevent="router.push('/dashboard')">
                <span class="nav-glyph">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                    <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5Z"/>
                  </svg>
                </span>
                <span class="nav-copy">
                  <strong>Dashboard</strong>
                  <small>Live operating overview</small>
                </span>
              </a>

              <a v-if="isAdmin" href="#" class="nav-link" @click.prevent="goToInventoryManagement">
                <span class="nav-glyph">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
                    <path d="m3.3 7 8.7 5 8.7-5"/>
                  </svg>
                </span>
                <span class="nav-copy">
                  <strong>Inventory</strong>
                  <small>Stock, lots and bins</small>
                </span>
              </a>

              <a v-if="isAdmin" href="#" class="nav-link" @click.prevent="goToInventoryAnalytics">
                <span class="nav-glyph">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                    <path d="M5 20v-7"/>
                    <path d="M12 20V4"/>
                    <path d="M19 20v-11"/>
                  </svg>
                </span>
                <span class="nav-copy">
                  <strong>Analytics</strong>
                  <small>SKU usage and user activity</small>
                </span>
              </a>

              <a href="#" class="nav-link" @click.prevent="router.push('/candidate-recommendation')"><span class="nav-glyph">◎</span><span class="nav-copy"><strong>Target recommendation</strong><small>Task, position and personal history</small></span></a>
              <a v-if="isAdmin" href="#" class="nav-link" @click.prevent="router.push('/sku-forecast')"><span class="nav-glyph">↗</span><span class="nav-copy"><strong>Sales forecast</strong><small>Seven-day SKU outlook</small></span></a>
              <a href="#" class="nav-link" @click.prevent="router.push('/shop')"><span class="nav-glyph">◍</span><span class="nav-copy"><strong>Office shop</strong><small>Browse and add to your tab</small></span></a>
              <a href="#" class="nav-link" @click.prevent="router.push('/shop-tabs')"><span class="nav-glyph">¥</span><span class="nav-copy"><strong>Shop admin</strong><small>{{ isAdmin ? 'Billing, sale stock, returns' : 'Return requests' }}</small></span></a>
              <a href="#" class="nav-link" @click.prevent="goToSuggestions">
                <span class="nav-glyph">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </span>
                <span class="nav-copy">
                  <span class="nav-copy-title">
                    <strong>Suggestions</strong>
                    <span v-if="suggestionBadgeCount > 0" class="nav-badge">{{ suggestionBadgeCount }}</span>
                  </span>
                  <small>{{ isAdmin ? 'Review user requests' : 'Request new drinks' }}</small>
                </span>
              </a>

              <a v-if="isAdmin" href="#" class="nav-link" @click.prevent="goToUserAccess">
                <span class="nav-glyph">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </span>
                <span class="nav-copy">
                  <strong>User Access</strong>
                  <small>Promote trusted team members</small>
                </span>
              </a>

              <a v-if="isAdmin" href="#" class="nav-link" @click.prevent="goToPrintCenter">
                <span class="nav-glyph">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                    <polyline points="6 9 6 2 18 2 18 9"/>
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                    <rect x="6" y="14" width="12" height="8"/>
                  </svg>
                </span>
                <span class="nav-copy">
                  <strong>Print Center</strong>
                  <small>Labels and job queue</small>
                </span>
              </a>

              <a v-if="isAdmin" href="#" class="nav-link" @click.prevent="goToScannerPerformance">
                <span class="nav-glyph">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                    <path d="M4 19V5"/>
                    <path d="M4 19h16"/>
                    <path d="m7 15 3-4 3 2 4-7"/>
                    <path d="M17 6h3v3"/>
                  </svg>
                </span>
                <span class="nav-copy">
                  <strong>Scan Metrics</strong>
                  <small>Decode speed and quality</small>
                </span>
              </a>

              <a v-if="isAdmin" href="#" class="nav-link" @click.prevent="goToRecoveryBenchmark">
                <span class="nav-glyph">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                    <path d="M9 3h6"/>
                    <path d="M10 3v5l-5 9a2 2 0 0 0 1.75 3h10.5A2 2 0 0 0 19 17l-5-9V3"/>
                    <path d="M8 14h8"/>
                  </svg>
                </span>
                <span class="nav-copy">
                  <strong>Recovery Lab</strong>
                  <small>Phase 1 labels and references</small>
                </span>
              </a>

              <a v-if="isAdmin" href="#" class="nav-link" @click.prevent="goToAiAssistant">
                <span class="nav-glyph">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 16v-4"/>
                    <path d="M12 8h.01"/>
                  </svg>
                </span>
                <span class="nav-copy">
                  <strong>AI Assistant</strong>
                  <small>Ask for operational help</small>
                </span>
              </a>
            </nav>
          </div>

          <button
            class="sidebar-toggle"
            @click="toggleSidebar"
            :aria-label="sidebarPinned ? 'Unpin sidebar' : 'Pin sidebar open'"
            :title="sidebarPinned ? 'Unpin sidebar' : 'Pin sidebar open'"
          >
            <svg v-if="sidebarPinned" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="13 17 18 12 13 7"/>
              <polyline points="6 17 11 12 6 7"/>
            </svg>
            <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="11 17 6 12 11 7"/>
              <polyline points="18 17 13 12 18 7"/>
            </svg>
          </button>
        </div>
      </aside>

      <main class="content">
        <template v-if="isAdmin">
          <section class="overview-heading">
            <div>
              <p class="eyebrow">Dashboard</p>
              <h2>Inventory overview</h2>
              <p>Current stock coverage and the few signals that need a decision.</p>
            </div>
            <div class="overview-status" :class="{ warning: systemStats.lowStockCount > 0 }">
              <span class="status-dot"></span>
              <div>
                <strong>{{ inventoryStatusLabel }}</strong>
                <small>{{ lastUpdatedLabel }}</small>
              </div>
            </div>
          </section>

          <section class="summary-grid">
            <article
              v-for="card in summaryCards"
              :key="card.label"
              class="summary-card"
              :class="{ warning: card.warning }"
            >
              <div class="summary-card-topline">
                <span>{{ card.label }}</span>
                <span class="summary-icon" v-html="card.icon"></span>
              </div>
              <strong class="summary-value">{{ card.value }}</strong>
              <p>{{ card.note }}</p>
            </article>
          </section>

          <section class="admin-workspace-grid">
            <article class="panel action-panel">
              <div class="panel-header">
                <div>
                  <p class="eyebrow">Needs attention</p>
                  <h3>Review queue</h3>
                </div>
                <span v-if="dashboardAlerts.length" class="panel-chip warning-chip">
                  {{ dashboardAlerts.length }} active
                </span>
              </div>

              <div v-if="dashboardAlerts.length" class="review-list">
                <button
                  v-for="item in dashboardAlerts"
                  :key="item.title"
                  class="review-row"
                  @click="item.run"
                >
                  <span class="review-count">{{ item.value }}</span>
                  <div>
                    <strong>{{ item.title }}</strong>
                    <p>{{ item.description }}</p>
                  </div>
                  <span class="review-link">Review</span>
                </button>
              </div>

              <div v-else class="dashboard-empty-state">
                <span class="empty-check">✓</span>
                <div>
                  <strong>Nothing needs attention</strong>
                  <p>Stock levels and team requests are currently clear.</p>
                </div>
              </div>
            </article>

            <article class="panel activity-panel">
              <div class="panel-header">
                <div>
                  <p class="eyebrow">Inventory history</p>
                  <h3>Recent activity</h3>
                </div>
                <button class="panel-text-button" @click="goToInventoryAnalytics">View analytics</button>
              </div>

              <div v-if="recentTransactions.length" class="activity-list">
                <div v-for="transaction in recentTransactions" :key="transaction.id" class="activity-row">
                  <span class="activity-type" :class="activityTone(transaction)">
                    {{ activityLabel(transaction) }}
                  </span>
                  <div class="activity-copy">
                    <strong>{{ transaction.itemName || transaction.itemCode }}</strong>
                    <p>{{ transaction.itemCode }} · {{ transaction.operator || 'System' }}</p>
                  </div>
                  <div class="activity-meta">
                    <strong>{{ activityQuantity(transaction) }}</strong>
                    <time>{{ formatActivityTime(transaction.transactionTime) }}</time>
                  </div>
                </div>
              </div>
              <div v-else class="dashboard-empty-state compact">
                <span class="empty-check neutral">—</span>
                <div>
                  <strong>No inventory activity yet</strong>
                  <p>Inbound, outbound, and cycle-count events will appear here.</p>
                </div>
              </div>
            </article>
          </section>
        </template>

        <template v-else>
          <section class="operator-desktop-hero hero-card">
            <div class="hero-copy">
              <p class="eyebrow">Operator Workspace</p>
              <h2 class="hero-title">Scanning stays on mobile. Inventory stays private.</h2>
              <p class="hero-subtitle">
                This desktop view is intentionally lightweight for operators. Use your phone for scanning, and use this workspace only for quick suggestion requests or review updates.
              </p>

              <div class="hero-meta">
                <div class="meta-pill">
                  <span class="meta-label">Best Device</span>
                  <strong>iPhone / iPad</strong>
                </div>
                <div class="meta-pill">
                  <span class="meta-label">Suggestion Updates</span>
                  <strong>{{ suggestionBadgeCount }}</strong>
                </div>
                <div class="meta-pill">
                  <span class="meta-label">Mobile Scan Link</span>
                  <strong>{{ mobileScannerUrlLabel }}</strong>
                </div>
              </div>
            </div>

            <div class="operator-desktop-side">
              <div class="operator-device-card">
                <span class="operator-device-eyebrow">Pilot Mobile</span>
                <strong>{{ mobileScannerUrlLabel }}</strong>
                <p>Open this address on your phone to scan drink labels, lot labels, and fridge codes.</p>
              </div>
            </div>
          </section>

          <section class="operator-desktop-grid">
            <article class="panel operator-desktop-panel">
              <div class="panel-header">
                <div>
                  <p class="eyebrow">Primary Action</p>
                  <h3>What operators should do here</h3>
                </div>
              </div>

              <div class="operator-desktop-actions">
                <button class="action-tile operator-action-tile" @click="goToSuggestions">
                  <span class="action-icon" v-html="tileIcon('M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z')"></span>
                  <strong>{{ suggestionBadgeCount > 0 ? 'Review Suggestion Updates' : 'Write a Suggestion' }}</strong>
                  <small>{{ operatorSuggestionText }}</small>
                </button>
              </div>
            </article>

            <article class="panel operator-desktop-panel">
              <div class="panel-header">
                <div>
                  <p class="eyebrow">Flow</p>
                  <h3>Simple by design</h3>
                </div>
              </div>

              <div class="operator-desktop-steps">
                <div v-for="step in operatorSteps" :key="step.label" class="operator-desktop-step">
                  <span class="operator-step-index">{{ step.index }}</span>
                  <div>
                    <strong>{{ step.label }}</strong>
                    <p>{{ step.note }}</p>
                  </div>
                </div>
              </div>
            </article>
          </section>
        </template>
      </main>
    </div>

    <div v-else class="mobile-shell" :class="{ 'operator-mobile-shell': !isAdmin }">
      <header class="mobile-topbar">
        <div class="mobile-user">
          <AvatarUpload
            :username="username"
            :current-avatar="userAvatar"
            @avatar-updated="handleAvatarUpdated"
            class="mobile-avatar"
          />
          <div>
            <p class="eyebrow">Pilot Mobile</p>
            <h2>{{ username }}</h2>
          </div>
        </div>
        <button @click="logout" class="mobile-logout" aria-label="Logout">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </header>

      <template v-if="isAdmin">
        <section class="mobile-hero">
          <p class="eyebrow">Today</p>
          <h2>{{ formattedToday }}</h2>
          <p>{{ inventoryStatusLabel }}.</p>
        </section>

        <section class="mobile-stats">
          <article v-for="card in mobileCards" :key="card.label" class="mobile-card">
            <span class="mobile-card-label">{{ card.label }}</span>
            <strong>{{ card.value }}</strong>
            <small>{{ card.note }}</small>
          </article>
        </section>

        <section class="mobile-actions">
          <button v-if="isAdmin" class="mobile-action primary" @click="goToInventoryManagement">Inventory</button>
          <button class="mobile-action secondary" @click="goToSuggestions">
            Suggestions
            <span v-if="suggestionBadgeCount > 0" class="mobile-badge">{{ suggestionBadgeCount }}</span>
          </button>
          <button class="mobile-action secondary" @click="goToAdvancedScan">Scan</button>
          <button class="mobile-action secondary" @click="router.push('/candidate-recommendation')">Target recommendation</button>
          <button class="mobile-action secondary" @click="router.push('/sku-forecast')">Sales forecast</button>
          <button class="mobile-action secondary" @click="router.push('/shop')">Office shop</button>
          <button class="mobile-action secondary" @click="router.push('/shop-tabs')">{{ isAdmin ? 'Shop admin' : 'Shop returns' }}</button>
          <button class="mobile-action lab" @click="goToRecoveryBenchmark">Recovery Lab</button>
        </section>

        <nav class="mobile-nav">
          <a href="#" class="mobile-nav-item active" @click.prevent="router.push('/dashboard')">Home</a>
          <a v-if="isAdmin" href="#" class="mobile-nav-item" @click.prevent="goToInventoryManagement">Inventory</a>
          <a v-if="isAdmin" href="#" class="mobile-nav-item" @click.prevent="goToPrintCenter">Print</a>
          <a v-if="isAdmin" href="#" class="mobile-nav-item lab" @click.prevent="goToRecoveryBenchmark">Lab</a>
          <a v-if="isAdmin" href="#" class="mobile-nav-item" @click.prevent="goToAiAssistant">AI</a>
        </nav>
      </template>

      <template v-else>
        <section class="operator-hero">
          <div class="operator-hero-copy">
            <p class="eyebrow">Scan Hub</p>
            <h2>Open the scanner and move on.</h2>
            <p>{{ operatorHeroText }}</p>
          </div>

          <button class="operator-scan-launch" @click="goToAdvancedScan">
            <span class="operator-scan-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
                <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
                <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                <path d="M8 12h8"/>
              </svg>
            </span>
            <span class="operator-scan-copy">
              <strong>Start Scanning</strong>
              <small>Drink labels, lot labels, and fridge codes</small>
            </span>
          </button>
        </section>

        <section class="operator-focus-grid">
          <button class="operator-focus-card" @click="router.push('/candidate-recommendation')">
            <span class="operator-focus-eyebrow">Target recommendation</span>
            <strong>Pick the right label</strong>
            <p>Upload or capture one frame; the list is ordered by task, position and your past choices. You confirm the target.</p>
          </button>

          <button class="operator-focus-card" @click="goToSuggestions">
            <span class="operator-focus-eyebrow">Suggestions</span>
            <strong>{{ operatorSuggestionTitle }}</strong>
            <p>{{ operatorSuggestionText }}</p>
            <span v-if="suggestionBadgeCount > 0" class="operator-focus-badge">{{ suggestionBadgeCount }}</span>
          </button>

          <article class="operator-focus-card operator-focus-static">
            <span class="operator-focus-eyebrow">Flow</span>
            <strong>Scan, tap, done.</strong>
            <p>No stock dashboard here. Just the two things you actually need on mobile.</p>
          </article>
        </section>

        <section class="operator-steps">
          <article v-for="step in operatorSteps" :key="step.label" class="operator-step-card">
            <span class="operator-step-index">{{ step.index }}</span>
            <div>
              <strong>{{ step.label }}</strong>
              <p>{{ step.note }}</p>
            </div>
          </article>
        </section>

        <nav class="operator-mobile-dock">
          <button class="operator-dock-btn primary" @click="goToAdvancedScan">Scan</button>
          <button class="operator-dock-btn secondary" @click="goToSuggestions">
            Suggestions
            <span v-if="suggestionBadgeCount > 0" class="mobile-badge">{{ suggestionBadgeCount }}</span>
          </button>
        </nav>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AvatarUpload from './AvatarUpload.vue'
import { isHandheldClient } from '@/utils/device'

const router = useRouter()
const username = ref('Admin')
const userAvatar = ref('')
const userRole = ref(localStorage.getItem('userRole') || 'operator')
const isAdmin = computed(() => userRole.value === 'admin')
const sidebarPinned = ref(false)
const isHovered = ref(false)
const isMobile = ref(false)
const lastUpdated = ref(null)
const recentTransactions = ref([])

const systemStats = ref({
  totalItems: 0,
  totalLots: 0,
  totalBins: 0,
  lowStockCount: 0
})
const suggestionSummary = ref({
  total: 0,
  NEW: 0,
  UNDER_REVIEW: 0,
  PLANNED: 0,
  DECLINED: 0
})

const checkDevice = () => {
  isMobile.value = isHandheldClient()
}

const isSidebarCollapsed = computed(() => {
  if (isMobile.value) return true
  return !sidebarPinned.value && !isHovered.value
})

const desktopShellStyle = computed(() => ({
  gridTemplateColumns: `${isSidebarCollapsed.value ? 96 : 300}px minmax(0, 1fr)`
}))

const formattedToday = computed(() => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date())
})

const suggestionBadgeCount = computed(() => {
  if (isAdmin.value) {
    return suggestionSummary.value.NEW || 0
  }

  return (suggestionSummary.value.PLANNED || 0) + (suggestionSummary.value.DECLINED || 0)
})

const inventoryStatusLabel = computed(() => {
  const count = systemStats.value.lowStockCount
  return count > 0
    ? `${count} item${count === 1 ? '' : 's'} need attention`
    : 'Inventory is on target'
})

const lastUpdatedLabel = computed(() => {
  if (!lastUpdated.value) return 'Waiting for the first refresh'
  return `Updated ${new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  }).format(lastUpdated.value)}`
})

const summaryCards = computed(() => [
  {
    label: 'Tracked Items',
    value: systemStats.value.totalItems,
    note: 'SKUs registered in inventory',
    icon: summaryIcon('M3 7h18M7 3v18M17 3v18')
  },
  {
    label: 'Live Lots',
    value: systemStats.value.totalLots,
    note: 'Active batches with stock',
    icon: summaryIcon('M4 7l8-4 8 4-8 4-8-4Zm0 5 8 4 8-4M4 17l8 4 8-4')
  },
  {
    label: 'Storage Bins',
    value: systemStats.value.totalBins,
    note: 'Mapped warehouse locations',
    icon: summaryIcon('M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z')
  },
  {
    label: 'Low Stock',
    value: systemStats.value.lowStockCount,
    note: 'Items below replenishment target',
    warning: systemStats.value.lowStockCount > 0,
    icon: summaryIcon('M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z')
  }
])

const dashboardAlerts = computed(() => {
  const items = []

  if (systemStats.value.lowStockCount > 0) {
    items.push({
      title: 'Low-stock items',
      description: 'Replenishment levels should be reviewed.',
      value: systemStats.value.lowStockCount,
      run: goToInventoryManagement
    })
  }

  if (suggestionSummary.value.NEW > 0) {
    items.push({
      title: 'New suggestions',
      description: 'Team requests are waiting for review.',
      value: suggestionSummary.value.NEW,
      run: goToSuggestions
    })
  }

  return items
})

const mobileCards = computed(() => [
  {
    label: 'Items',
    value: systemStats.value.totalItems,
    note: 'Tracked SKUs'
  },
  {
    label: 'Low Stock',
    value: systemStats.value.lowStockCount,
    note: 'Need review'
  },
  {
    label: 'Live Lots',
    value: systemStats.value.totalLots,
    note: 'With stock'
  }
])

const mobileScannerUrlLabel = computed(() => {
  if (typeof window === 'undefined') return '/advanced-scan'
  return `${window.location.origin}/advanced-scan`
})

const operatorHeroText = computed(() => (
  suggestionBadgeCount.value > 0
    ? `You have ${suggestionBadgeCount.value} suggestion update${suggestionBadgeCount.value === 1 ? '' : 's'} waiting. Otherwise, this screen stays focused on scanning.`
    : 'Use this page to open the scanner fast and request new drinks when something is missing.'
))

const operatorSuggestionTitle = computed(() => (
  suggestionBadgeCount.value > 0 ? 'You have suggestion updates' : 'Need a new drink?'
))

const operatorSuggestionText = computed(() => (
  suggestionBadgeCount.value > 0
    ? 'Open suggestions to review the latest replies and decisions.'
    : 'Tell the admin what you want stocked next without digging through extra pages.'
))

const operatorSteps = computed(() => ([
  {
    index: '01',
    label: 'Scan a label',
    note: 'Use the camera for drink labels, lot labels, or bin codes.'
  },
  {
    index: '02',
    label: 'Choose the action',
    note: 'Inbound, inquiry, or the next step tied to that code.'
  },
  {
    index: '03',
    label: 'Keep moving',
    note: 'No extra dashboards. Just finish the task and go.'
  }
]))

onMounted(() => {
  checkDevice()
  window.addEventListener('resize', checkDevice)
  refreshDashboard()
  restoreSidebarState()
})

onUnmounted(() => {
  window.removeEventListener('resize', checkDevice)
})

async function refreshDashboard() {
  await loadUserInfo()
  await Promise.all([
    loadSystemStats(),
    loadSuggestionSummary(),
    loadRecentTransactions()
  ])
  lastUpdated.value = new Date()
}

async function loadSystemStats() {
  if (!isAdmin.value) {
    systemStats.value = {
      totalItems: 0,
      totalLots: 0,
      totalBins: 0,
      lowStockCount: 0
    }
    return
  }

  try {
    const token = localStorage.getItem('token')
    if (!token) return

    const response = await fetch('/api/inventory-management/stats', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) return

    const result = await response.json()
    if (result.success) {
      systemStats.value = {
        totalItems: result.data.totalItems || 0,
        totalLots: result.data.totalLots || 0,
        totalBins: result.data.totalBins || 0,
        lowStockCount: result.data.lowStockCount || 0
      }
    }
  } catch (error) {
    console.error('加载系统统计失败:', error)
  }
}

async function loadUserInfo() {
  try {
    const token = localStorage.getItem('token')
    if (!token) return

    const response = await fetch('/api/auth/profile', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) return

    const result = await response.json()
    if (result.success) {
      username.value = result.data.user.username
      userAvatar.value = result.data.user.avatar || ''
      userRole.value = result.data.user.role || userRole.value
    }
  } catch (error) {
    console.error('加载用户信息失败:', error)
  }
}

async function loadSuggestionSummary() {
  try {
    const token = localStorage.getItem('token')
    if (!token) return

    const response = await fetch('/api/suggestions?limit=1', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) return

    const result = await response.json()
    if (result.success) {
      suggestionSummary.value = {
        total: result.data.summary?.total || 0,
        NEW: result.data.summary?.NEW || 0,
        UNDER_REVIEW: result.data.summary?.UNDER_REVIEW || 0,
        PLANNED: result.data.summary?.PLANNED || 0,
        DECLINED: result.data.summary?.DECLINED || 0
      }
    }
  } catch (error) {
    console.error('加载建议统计失败:', error)
  }
}

async function loadRecentTransactions() {
  if (!isAdmin.value) {
    recentTransactions.value = []
    return
  }

  try {
    const token = localStorage.getItem('token')
    if (!token) return

    const params = new URLSearchParams({
      limit: '5',
      sortBy: 'transactionTime',
      sortOrder: 'DESC'
    })
    const response = await fetch(`/api/inventory-management/transactions?${params}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) return

    const result = await response.json()
    if (result.success) {
      recentTransactions.value = result.data.transactions || []
    }
  } catch (error) {
    console.error('加载最近库存记录失败:', error)
  }
}

function handleAvatarUpdated(avatarUrl) {
  userAvatar.value = avatarUrl
}

function goToAdvancedScan() {
  router.push('/advanced-scan')
}

function goToPrintCenter() {
  router.push('/print-center')
}

function goToInventoryManagement() {
  router.push('/inventory-management')
}

function goToInventoryAnalytics() {
  router.push('/inventory-analytics')
}

function goToSuggestions() {
  router.push('/suggestions')
}

function goToUserAccess() {
  router.push('/user-access')
}

function goToScannerPerformance() {
  router.push('/scanner-performance')
}

function goToRecoveryBenchmark() {
  router.push('/recovery-benchmark')
}

function goToAiAssistant() {
  router.push('/ai-assistant')
}

function toggleSidebar() {
  sidebarPinned.value = !sidebarPinned.value
  localStorage.setItem('sidebarPinned', String(sidebarPinned.value))
}

function restoreSidebarState() {
  const savedPinned = localStorage.getItem('sidebarPinned')
  if (savedPinned !== null) {
    sidebarPinned.value = savedPinned === 'true'
  } else {
    sidebarPinned.value = false
  }
}

function logout() {
  localStorage.removeItem('token')
  localStorage.removeItem('username')
  localStorage.removeItem('userRole')
  localStorage.removeItem('userAvatar')
  router.push('/login')
}

function activityLabel(transaction) {
  const notes = typeof transaction.notes === 'string' ? transaction.notes : ''
  if (notes.startsWith('Cycle Count Adjustment:')) return 'Count'
  if (notes.startsWith('BIN_TRANSFER:')) return 'Move'
  return transaction.transactionType === 'in' ? 'Inbound' : 'Outbound'
}

function activityTone(transaction) {
  const label = activityLabel(transaction)
  if (label === 'Inbound') return 'inbound'
  if (label === 'Outbound') return 'outbound'
  return 'neutral'
}

function activityQuantity(transaction) {
  const quantity = Math.abs(Number(transaction.quantity || 0))
  if (activityLabel(transaction) === 'Inbound') return `+${quantity}`
  if (activityLabel(transaction) === 'Outbound') return `−${quantity}`
  return `${transaction.beforeQuantity ?? '—'} → ${transaction.afterQuantity ?? '—'}`
}

function formatActivityTime(value) {
  if (!value) return 'Unknown time'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown time'

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)
}

function summaryIcon(path) {
  return `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="${path}" />
    </svg>
  `
}

function tileIcon(path) {
  return `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="${path}" />
    </svg>
  `
}
</script>

<style scoped>
.pilot-dashboard {
  --bg: #f4f5f7;
  --surface: rgba(255, 255, 255, 0.72);
  --surface-strong: rgba(255, 255, 255, 0.92);
  --surface-dark: rgba(18, 18, 20, 0.84);
  --border: rgba(15, 23, 42, 0.08);
  --border-strong: rgba(15, 23, 42, 0.14);
  --text: #101218;
  --muted: #6b7280;
  --muted-strong: #4b5563;
  --shadow-soft: 0 20px 60px rgba(15, 23, 42, 0.08);
  --shadow-card: 0 24px 48px rgba(15, 23, 42, 0.08);
  --accent-blue: #0071e3;
  --accent-mint: #31c48d;
  --accent-amber: #f59e0b;
  --accent-rose: #ef4444;
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(123, 211, 255, 0.22), transparent 28%),
    radial-gradient(circle at 80% 20%, rgba(166, 240, 208, 0.22), transparent 24%),
    linear-gradient(180deg, #fbfbfd 0%, #eff2f6 100%);
  color: var(--text);
  font-family: "SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif;
  position: relative;
  overflow: hidden;
}

.ambient {
  position: absolute;
  border-radius: 999px;
  filter: blur(48px);
  opacity: 0.45;
  pointer-events: none;
}

.ambient-one {
  width: 28rem;
  height: 28rem;
  top: -8rem;
  right: -6rem;
  background: rgba(120, 190, 255, 0.22);
}

.ambient-two {
  width: 22rem;
  height: 22rem;
  left: -6rem;
  top: 24rem;
  background: rgba(104, 211, 145, 0.18);
}

.ambient-three {
  width: 20rem;
  height: 20rem;
  right: 18rem;
  bottom: -6rem;
  background: rgba(255, 209, 102, 0.15);
}

.topbar {
  height: 78px;
  padding: 0 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  z-index: 2;
}

.brand-lockup,
.topbar-actions,
.user-pill {
  display: flex;
  align-items: center;
}

.brand-lockup {
  gap: 14px;
}

.brand-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  box-shadow: 0 10px 24px rgba(0, 113, 227, 0.18);
}

.eyebrow {
  margin: 0;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
}

.brand-title,
.hero-title,
.panel-header h3,
.mobile-hero h2 {
  margin: 0;
}

.brand-title {
  font-size: 22px;
  font-weight: 600;
}

.topbar-actions {
  gap: 12px;
}

.topbar-chip,
.logout-btn,
.mobile-logout {
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.68);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  color: var(--text);
}

.topbar-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.user-pill {
  gap: 12px;
  padding: 8px 12px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-soft);
}

.user-label,
.user-name {
  margin: 0;
}

.user-label {
  font-size: 11px;
  color: var(--muted);
}

.user-name {
  font-size: 14px;
  font-weight: 600;
}

.logout-btn,
.mobile-logout {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.desktop-shell {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 28px;
  padding: 0 24px 24px;
  transition: grid-template-columns 0.28s ease;
}

.sidebar {
  width: 100%;
}

.sidebar-panel {
  display: flex;
  flex-direction: column;
  padding: 28px 20px 20px;
  border-radius: 30px;
  background: rgba(255, 255, 255, 0.58);
  border: 1px solid rgba(255, 255, 255, 0.78);
  box-shadow: var(--shadow-card);
  backdrop-filter: blur(28px);
  -webkit-backdrop-filter: blur(28px);
  overflow: hidden;
  transition: padding 0.28s ease, background 0.28s ease, box-shadow 0.28s ease;
}

.sidebar.collapsed .sidebar-panel {
  padding: 20px 10px 14px;
}

.sidebar.collapsed .nav-copy,
.sidebar.collapsed .sidebar-caption {
  opacity: 0;
  pointer-events: none;
  transform: translateX(-8px);
}

.sidebar.collapsed .sidebar-caption {
  display: none;
}

.sidebar.collapsed .sidebar-section:not(:first-child) {
  display: none;
}

.sidebar-caption {
  margin: 0 0 14px;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}

.sidebar-section + .sidebar-section {
  margin-top: 28px;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sidebar.collapsed .sidebar-nav {
  align-items: center;
  gap: 12px;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 20px;
  color: inherit;
  text-decoration: none;
  transition: all 0.22s ease;
}

.sidebar.collapsed .nav-link {
  width: 64px;
  height: 64px;
  justify-content: center;
  gap: 0;
  padding: 0;
  margin: 0 auto;
  border-radius: 24px;
  border: 1px solid transparent;
}

.nav-link:hover {
  background: rgba(255, 255, 255, 0.7);
  transform: translateX(2px);
}

.sidebar.collapsed .nav-link:hover {
  transform: none;
}

.nav-link.active {
  background: linear-gradient(135deg, rgba(0, 113, 227, 0.14), rgba(0, 113, 227, 0.04));
  border: 1px solid rgba(0, 113, 227, 0.14);
}

.sidebar.collapsed .nav-link {
  background: transparent;
}

.sidebar.collapsed .nav-link:hover {
  background: rgba(255, 255, 255, 0.78);
}

.sidebar.collapsed .nav-link.active {
  background: linear-gradient(180deg, rgba(0, 113, 227, 0.14), rgba(0, 113, 227, 0.05));
  border-color: rgba(0, 113, 227, 0.12);
  box-shadow: 0 14px 30px rgba(0, 113, 227, 0.08);
}

.nav-glyph {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.74);
  color: var(--muted-strong);
  flex-shrink: 0;
}

.sidebar.collapsed .nav-glyph {
  width: 46px;
  height: 46px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(15, 23, 42, 0.06);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.82);
}

.sidebar.collapsed .nav-link.active .nav-glyph {
  background: linear-gradient(180deg, rgba(238, 245, 255, 0.98), rgba(214, 230, 255, 0.9));
  color: var(--accent-blue);
  box-shadow: 0 12px 24px rgba(0, 113, 227, 0.16);
}

.nav-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  transition: opacity 0.24s ease, transform 0.24s ease;
}

.sidebar.collapsed .nav-copy {
  width: 0;
  min-width: 0;
  overflow: hidden;
}

.nav-copy-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.nav-copy strong {
  font-size: 14px;
  font-weight: 600;
}

.nav-copy small {
  font-size: 12px;
  color: var(--muted);
}

.nav-badge,
.mobile-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  border-radius: 999px;
  background: rgba(0, 113, 227, 0.12);
  color: var(--accent-blue);
  font-size: 11px;
  font-weight: 700;
}

.mobile-badge {
  margin-left: 8px;
}

.mobile-action.primary {
  background: linear-gradient(135deg, #111827, #2d3748);
  color: #fff;
  box-shadow: 0 18px 30px rgba(17, 24, 39, 0.18);
}

.mobile-action.secondary {
  background: rgba(255, 255, 255, 0.7);
  color: var(--text);
  border-color: var(--border);
}

.mobile-action.lab {
  background: rgba(37, 99, 235, 0.1);
  color: #1d4ed8;
  border: 1px solid rgba(37, 99, 235, 0.18);
}

.sidebar-toggle {
  width: 100%;
  margin-top: 28px;
  flex-shrink: 0;
  height: 44px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.78);
  color: var(--muted-strong);
  cursor: pointer;
  transition: background 0.22s ease, transform 0.22s ease;
}

.sidebar.collapsed .sidebar-toggle {
  height: 48px;
  border-radius: 18px;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
  padding-bottom: 24px;
}

.hero-card,
.panel,
.overview-heading,
.summary-card,
.mobile-hero,
.mobile-card {
  background: var(--surface);
  border: 1px solid rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(26px);
  -webkit-backdrop-filter: blur(26px);
  box-shadow: var(--shadow-card);
}

.hero-card {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) 320px;
  gap: 28px;
  padding: 34px;
  border-radius: 34px;
}

.operator-desktop-hero {
  background:
    radial-gradient(circle at top right, rgba(0, 113, 227, 0.14), transparent 32%),
    rgba(255, 255, 255, 0.76);
}

.operator-desktop-side {
  display: flex;
  align-items: center;
}

.operator-device-card {
  width: 100%;
  padding: 24px;
  border-radius: 28px;
  background: linear-gradient(135deg, #0f172a 0%, #334155 100%);
  color: #fff;
  box-shadow: 0 28px 50px rgba(15, 23, 42, 0.18);
}

.operator-device-eyebrow {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: rgba(255, 255, 255, 0.64);
}

.operator-device-card strong {
  display: block;
  margin-top: 14px;
  font-size: 20px;
  line-height: 1.4;
  word-break: break-word;
}

.operator-device-card p {
  margin: 12px 0 0;
  color: rgba(255, 255, 255, 0.72);
  font-size: 14px;
  line-height: 1.7;
}

.operator-desktop-grid {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 18px;
}

.operator-desktop-panel {
  min-height: 100%;
}

.operator-desktop-actions {
  margin-top: 24px;
}

.operator-action-tile {
  width: 100%;
}

.operator-desktop-steps {
  margin-top: 24px;
  display: grid;
  gap: 14px;
}

.operator-desktop-step {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 14px;
  align-items: start;
  padding: 18px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.88);
}

.operator-desktop-step strong {
  display: block;
  font-size: 15px;
}

.operator-desktop-step p {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.55;
}

.hero-title {
  margin-top: 10px;
  font-size: clamp(2rem, 3.6vw, 3.5rem);
  line-height: 1.02;
  letter-spacing: -0.04em;
  max-width: 11ch;
}

.hero-subtitle {
  max-width: 58ch;
  margin: 16px 0 0;
  font-size: 15px;
  line-height: 1.7;
  color: var(--muted-strong);
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
}

.meta-pill {
  min-width: 150px;
  padding: 14px 16px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.82);
}

.meta-label {
  display: block;
  margin-bottom: 4px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--muted);
}

.meta-pill strong {
  font-size: 15px;
}

.mobile-actions {
  display: flex;
  gap: 10px;
}

.mobile-action {
  border: none;
  border-radius: 999px;
  padding: 12px 18px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.overview-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 28px;
  padding: 28px 30px;
  border-radius: 28px;
}

.overview-heading h2 {
  margin: 7px 0 0;
  font-size: 34px;
  line-height: 1.1;
  letter-spacing: -0.04em;
}

.overview-heading p:last-child {
  margin: 9px 0 0;
  color: var(--muted-strong);
  font-size: 14px;
}

.overview-status {
  min-width: 250px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(49, 196, 141, 0.08);
  border: 1px solid rgba(49, 196, 141, 0.16);
}

.overview-status.warning {
  background: rgba(245, 158, 11, 0.08);
  border-color: rgba(245, 158, 11, 0.2);
}

.status-dot {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border-radius: 999px;
  background: var(--accent-mint);
  box-shadow: 0 0 0 6px rgba(49, 196, 141, 0.12);
}

.overview-status.warning .status-dot {
  background: var(--accent-amber);
  box-shadow: 0 0 0 6px rgba(245, 158, 11, 0.12);
}

.overview-status strong,
.overview-status small {
  display: block;
}

.overview-status strong {
  font-size: 14px;
}

.overview-status small {
  margin-top: 3px;
  color: var(--muted);
  font-size: 12px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.summary-card {
  padding: 20px;
  border-radius: 24px;
}

.summary-card.warning {
  border-color: rgba(245, 158, 11, 0.22);
  background: linear-gradient(145deg, rgba(255, 251, 235, 0.9), rgba(255, 255, 255, 0.76));
}

.summary-card-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--muted-strong);
  font-size: 13px;
  font-weight: 600;
}

.summary-icon {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 13px;
  background: rgba(15, 23, 42, 0.05);
  color: var(--muted-strong);
}

.summary-card.warning .summary-icon {
  background: rgba(245, 158, 11, 0.12);
  color: #b45309;
}

.summary-value {
  display: block;
  margin-top: 22px;
  font-size: 38px;
  font-weight: 700;
  letter-spacing: -0.05em;
}

.summary-card p {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 12px;
}

.admin-workspace-grid {
  display: grid;
  grid-template-columns: minmax(320px, 0.85fr) minmax(520px, 1.35fr);
  gap: 14px;
  align-items: start;
}

.panel {
  padding: 24px;
  border-radius: 24px;
}

.panel-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
}

.panel-header h3 {
  margin-top: 8px;
  font-size: 24px;
  letter-spacing: -0.03em;
}

.panel-chip {
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  padding: 8px 12px;
  background: rgba(17, 24, 39, 0.08);
  color: var(--muted-strong);
}

.warning-chip {
  background: rgba(245, 158, 11, 0.1);
  color: #9a4f08;
}

.review-list,
.activity-list {
  margin-top: 24px;
  display: grid;
}

.review-list {
  gap: 10px;
}

.review-row {
  width: 100%;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 16px;
  border: 1px solid rgba(245, 158, 11, 0.14);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.78);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.2s ease;
}

.review-row:hover {
  transform: translateY(-1px);
  border-color: rgba(245, 158, 11, 0.32);
}

.review-count {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 13px;
  background: rgba(245, 158, 11, 0.12);
  color: #9a4f08;
  font-size: 15px;
  font-weight: 700;
}

.review-row strong,
.activity-copy strong,
.dashboard-empty-state strong {
  display: block;
  font-size: 14px;
}

.review-row p,
.activity-copy p,
.dashboard-empty-state p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.45;
}

.review-link,
.panel-text-button {
  color: var(--accent-blue);
  font-size: 12px;
  font-weight: 600;
}

.panel-text-button {
  padding: 8px 0;
  border: none;
  background: transparent;
  cursor: pointer;
}

.dashboard-empty-state {
  min-height: 126px;
  margin-top: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 22px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.62);
  border: 1px dashed rgba(15, 23, 42, 0.1);
}

.dashboard-empty-state.compact {
  min-height: 166px;
}

.empty-check {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: 13px;
  background: rgba(49, 196, 141, 0.12);
  color: #17865f;
  font-weight: 800;
}

.empty-check.neutral {
  background: rgba(15, 23, 42, 0.06);
  color: var(--muted);
}

.activity-list {
  gap: 0;
}

.activity-row {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid rgba(15, 23, 42, 0.07);
}

.activity-row:last-child {
  border-bottom: none;
}

.activity-type {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 8px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.06);
  color: var(--muted-strong);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.activity-type.inbound {
  background: rgba(49, 196, 141, 0.1);
  color: #17865f;
}

.activity-type.outbound {
  background: rgba(0, 113, 227, 0.09);
  color: #075ea8;
}

.activity-meta {
  text-align: right;
}

.activity-meta strong,
.activity-meta time {
  display: block;
}

.activity-meta strong {
  font-size: 13px;
}

.activity-meta time {
  margin-top: 4px;
  color: var(--muted);
  font-size: 11px;
}

.action-tile {
  text-align: left;
  padding: 18px;
  border: 1px solid rgba(255, 255, 255, 0.84);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.76);
  cursor: pointer;
  transition: transform 0.22s ease, box-shadow 0.22s ease;
}

.action-tile:hover,
.topbar-chip:hover,
.mobile-action:hover,
.logout-btn:hover,
.mobile-logout:hover {
  transform: translateY(-1px);
}

.action-icon {
  display: inline-grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 14px;
  background: rgba(17, 24, 39, 0.08);
  margin-bottom: 14px;
}

.action-tile strong {
  display: block;
  font-size: 15px;
  margin-bottom: 6px;
}

.action-tile small {
  color: var(--muted);
  line-height: 1.5;
}

.mobile-shell {
  position: relative;
  z-index: 1;
  padding: 18px 18px 110px;
}

.operator-mobile-shell {
  padding-bottom: 132px;
}

.mobile-topbar,
.mobile-user {
  display: flex;
  align-items: center;
}

.mobile-topbar {
  justify-content: space-between;
  gap: 12px;
}

.mobile-user {
  gap: 12px;
}

.mobile-hero {
  margin-top: 18px;
  padding: 22px;
  border-radius: 28px;
}

.mobile-hero p {
  margin: 12px 0 0;
  color: var(--muted-strong);
  line-height: 1.6;
}

.mobile-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.mobile-card {
  padding: 16px;
  border-radius: 22px;
}

.mobile-card-label {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--muted);
}

.mobile-card strong {
  display: block;
  margin-top: 10px;
  font-size: 26px;
  letter-spacing: -0.04em;
}

.mobile-card small {
  display: block;
  margin-top: 4px;
  color: var(--muted);
}

.mobile-actions {
  margin-top: 16px;
  flex-wrap: wrap;
}

.operator-hero {
  margin-top: 18px;
  padding: 26px 22px 22px;
  border-radius: 32px;
  background:
    radial-gradient(circle at top right, rgba(0, 113, 227, 0.16), transparent 34%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.74));
  border: 1px solid rgba(255, 255, 255, 0.92);
  box-shadow: 0 28px 60px rgba(15, 23, 42, 0.1);
  backdrop-filter: blur(26px);
  -webkit-backdrop-filter: blur(26px);
}

.operator-hero-copy h2 {
  margin: 10px 0 0;
  font-size: 42px;
  line-height: 0.96;
  letter-spacing: -0.06em;
  max-width: 8ch;
}

.operator-hero-copy p:last-child {
  margin: 14px 0 0;
  color: var(--muted-strong);
  font-size: 15px;
  line-height: 1.7;
}

.operator-scan-launch {
  width: 100%;
  margin-top: 22px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px;
  border: none;
  border-radius: 26px;
  background: linear-gradient(135deg, #0f172a 0%, #334155 100%);
  color: #fff;
  box-shadow: 0 24px 44px rgba(15, 23, 42, 0.22);
  cursor: pointer;
}

.operator-scan-icon {
  width: 54px;
  height: 54px;
  display: grid;
  place-items: center;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.14);
  flex-shrink: 0;
}

.operator-scan-copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.operator-scan-copy strong {
  font-size: 19px;
  letter-spacing: -0.03em;
}

.operator-scan-copy small {
  margin-top: 5px;
  color: rgba(255, 255, 255, 0.74);
  font-size: 13px;
  line-height: 1.5;
}

.operator-focus-grid {
  margin-top: 14px;
  display: grid;
  gap: 12px;
}

.operator-focus-card {
  position: relative;
  text-align: left;
  padding: 20px;
  border-radius: 26px;
  border: 1px solid rgba(255, 255, 255, 0.82);
  background: rgba(255, 255, 255, 0.76);
  box-shadow: var(--shadow-soft);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  cursor: pointer;
}

.operator-focus-static {
  cursor: default;
}

.operator-focus-eyebrow {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--muted);
}

.operator-focus-card strong {
  display: block;
  margin-top: 10px;
  font-size: 22px;
  letter-spacing: -0.04em;
}

.operator-focus-card p {
  margin: 10px 0 0;
  color: var(--muted-strong);
  font-size: 14px;
  line-height: 1.65;
  max-width: 28ch;
}

.operator-focus-badge {
  position: absolute;
  top: 18px;
  right: 18px;
  min-width: 30px;
  height: 30px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(0, 113, 227, 0.12);
  color: var(--accent-blue);
  font-size: 12px;
  font-weight: 700;
}

.operator-steps {
  margin-top: 14px;
  display: grid;
  gap: 10px;
}

.operator-step-card {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 14px;
  align-items: start;
  padding: 18px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.84);
  box-shadow: var(--shadow-soft);
}

.operator-step-index {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(228, 237, 255, 0.95), rgba(210, 226, 255, 0.9));
  color: var(--accent-blue);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.operator-step-card strong {
  display: block;
  font-size: 15px;
}

.operator-step-card p {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.55;
}

.operator-mobile-dock {
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: 16px;
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 10px;
  padding: 10px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.76);
  border: 1px solid rgba(255, 255, 255, 0.88);
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.14);
  backdrop-filter: blur(26px);
  -webkit-backdrop-filter: blur(26px);
}

.operator-dock-btn {
  min-height: 54px;
  border: none;
  border-radius: 20px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

.operator-dock-btn.primary {
  background: linear-gradient(135deg, #0f172a 0%, #334155 100%);
  color: #fff;
}

.operator-dock-btn.secondary {
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid var(--border);
  color: var(--text);
}

.mobile-nav {
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: 16px;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  padding: 10px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.84);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  box-shadow: var(--shadow-soft);
}

.mobile-nav-item {
  text-decoration: none;
  color: var(--muted-strong);
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  padding: 10px 6px;
  border-radius: 16px;
}

.mobile-nav-item.active {
  background: rgba(17, 24, 39, 0.08);
  color: var(--text);
}

.mobile-nav-item.lab {
  background: rgba(37, 99, 235, 0.1);
  color: #1d4ed8;
}

@media (max-width: 1280px) {
  .hero-card {
    grid-template-columns: 1fr;
  }

  .admin-workspace-grid {
    grid-template-columns: 1fr;
  }

  .operator-desktop-grid {
    grid-template-columns: 1fr;
  }

  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .overview-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .overview-status {
    width: 100%;
    min-width: 0;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }

  .mobile-stats {
    grid-template-columns: 1fr;
  }

  .operator-hero-copy h2 {
    font-size: 36px;
  }

  .operator-mobile-dock {
    grid-template-columns: 1fr;
  }
}
</style>
