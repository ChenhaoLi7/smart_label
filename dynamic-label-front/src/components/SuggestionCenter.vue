<template>
  <div class="suggestion-center">
    <div class="ambient ambient-a"></div>
    <div class="ambient ambient-b"></div>

    <header class="page-header">
      <div class="header-left">
        <button @click="goBack" class="back-btn" aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <div>
          <p class="eyebrow">{{ isAdmin ? 'Admin Review' : 'User Suggestions' }}</p>
          <h1>{{ isAdmin ? 'Suggestion Inbox' : 'Request New Drinks' }}</h1>
        </div>
      </div>

      <div class="header-right">
        <button class="glass-btn" @click="loadSuggestions">Refresh</button>
      </div>
    </header>

    <section class="summary-grid">
      <article class="summary-card">
        <span class="summary-label">Total</span>
        <strong>{{ summary.total }}</strong>
      </article>
      <article class="summary-card">
        <span class="summary-label">New</span>
        <strong>{{ summary.NEW }}</strong>
      </article>
      <article class="summary-card">
        <span class="summary-label">Reviewing</span>
        <strong>{{ summary.UNDER_REVIEW }}</strong>
      </article>
      <article class="summary-card">
        <span class="summary-label">Planned</span>
        <strong>{{ summary.PLANNED }}</strong>
      </article>
    </section>

    <div class="content-grid" :class="{ admin: isAdmin }">
      <section v-if="!isAdmin" class="panel form-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Submit Idea</p>
            <h2>Tell us what you want to drink next</h2>
          </div>
        </div>

        <div class="form-grid">
          <label class="field">
            <span>Suggestion Title</span>
            <input v-model="form.title" type="text" placeholder="Example: Add more sparkling drinks">
          </label>

          <label class="field">
            <span>Wanted Item</span>
            <input v-model="form.desired_item" type="text" placeholder="Example: Coca-Cola Zero">
          </label>

          <label class="field">
            <span>Category</span>
            <select v-model="form.category">
              <option value="BEVERAGE">Beverage</option>
              <option value="SNACK">Snack</option>
              <option value="OTHER">Other</option>
            </select>
          </label>

          <label class="field">
            <span>Preferred Brand</span>
            <input v-model="form.preferred_brand" type="text" placeholder="Optional">
          </label>

          <label class="field full">
            <span>Why would this be useful?</span>
            <textarea v-model="form.details" rows="5" placeholder="Share flavor preference, team demand, or any extra note"></textarea>
          </label>
        </div>

        <div class="panel-actions">
          <button class="primary-btn" :disabled="submitting || !canSubmit" @click="submitSuggestion">
            {{ submitting ? 'Submitting...' : 'Send Suggestion' }}
          </button>
        </div>
      </section>

      <section class="panel list-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">{{ isAdmin ? 'Team Requests' : 'My Requests' }}</p>
            <h2>{{ isAdmin ? 'See what people are asking for' : 'Track your submitted ideas' }}</h2>
          </div>
        </div>

        <div class="toolbar">
          <div class="toolbar-filters">
            <select v-model="filters.status" @change="loadSuggestions">
              <option value="">All Status</option>
              <option value="NEW">New</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="PLANNED">Planned</option>
              <option value="DECLINED">Declined</option>
            </select>
            <select v-model="filters.category" @change="loadSuggestions">
              <option value="">All Categories</option>
              <option value="BEVERAGE">Beverage</option>
              <option value="SNACK">Snack</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="Search by title, item, brand or user"
          >
        </div>

        <div v-if="loading" class="empty-state">
          <p>Loading suggestions...</p>
        </div>

        <div v-else-if="filteredSuggestions.length === 0" class="empty-state">
          <p>{{ isAdmin ? 'No suggestions yet.' : 'You have not sent any suggestions yet.' }}</p>
        </div>

        <div v-else class="suggestion-list">
          <article v-for="item in filteredSuggestions" :key="item.id" class="suggestion-card">
            <div class="card-top">
              <div>
                <div class="card-heading">
                  <h3>{{ item.title }}</h3>
                  <span class="status-badge" :class="item.status">{{ statusLabel(item.status) }}</span>
                </div>
                <p class="desired-item">{{ item.desired_item }}</p>
              </div>
              <span class="category-pill">{{ categoryLabel(item.category) }}</span>
            </div>

            <div class="meta-grid">
              <div>
                <span class="meta-label">Brand</span>
                <span class="meta-value">{{ item.preferred_brand || 'No preference' }}</span>
              </div>
              <div>
                <span class="meta-label">Created</span>
                <span class="meta-value">{{ formatDate(item.createdAt) }}</span>
              </div>
              <div v-if="isAdmin">
                <span class="meta-label">From</span>
                <span class="meta-value">{{ item.author?.username || 'Unknown' }}</span>
              </div>
              <div v-if="item.resolved_by">
                <span class="meta-label">Handled By</span>
                <span class="meta-value">{{ item.resolved_by }}</span>
              </div>
            </div>

            <p class="details-text">{{ item.details || 'No extra explanation provided.' }}</p>

            <div v-if="item.admin_reply" class="reply-box">
              <span class="reply-label">Admin Reply</span>
              <p>{{ item.admin_reply }}</p>
            </div>

            <div v-if="isAdmin" class="card-actions">
              <button class="glass-btn" @click="openReview(item)">Reply / Update</button>
            </div>
          </article>
        </div>
      </section>
    </div>

    <div v-if="isAdmin && reviewTarget" class="dialog-overlay" @click="closeReview">
      <div class="dialog-card" @click.stop>
        <div class="dialog-header">
          <div>
            <p class="eyebrow">Review Suggestion</p>
            <h3>{{ reviewTarget.title }}</h3>
          </div>
          <button class="close-btn" @click="closeReview">×</button>
        </div>

        <div class="dialog-body">
          <label class="field">
            <span>Status</span>
            <select v-model="reviewForm.status">
              <option value="NEW">New</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="PLANNED">Planned</option>
              <option value="DECLINED">Declined</option>
            </select>
          </label>

          <label class="field">
            <span>Reply to User</span>
            <textarea v-model="reviewForm.admin_reply" rows="5" placeholder="Write your response or decision"></textarea>
          </label>
        </div>

        <div class="dialog-actions">
          <button class="glass-btn" @click="closeReview">Cancel</button>
          <button class="primary-btn" :disabled="savingReview" @click="saveReview">
            {{ savingReview ? 'Saving...' : 'Save Result' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const userRole = ref(localStorage.getItem('userRole') || 'operator')
const isAdmin = computed(() => userRole.value === 'admin')

const loading = ref(false)
const submitting = ref(false)
const savingReview = ref(false)
const suggestions = ref([])
const searchQuery = ref('')
const reviewTarget = ref(null)

const summary = reactive({
  total: 0,
  NEW: 0,
  UNDER_REVIEW: 0,
  PLANNED: 0,
  DECLINED: 0
})

const filters = reactive({
  status: '',
  category: ''
})

const form = reactive({
  title: '',
  desired_item: '',
  preferred_brand: '',
  category: 'BEVERAGE',
  details: ''
})

const reviewForm = reactive({
  status: 'NEW',
  admin_reply: ''
})

const canSubmit = computed(() => form.title.trim() && form.desired_item.trim())

const filteredSuggestions = computed(() => {
  if (!searchQuery.value.trim()) return suggestions.value
  const query = searchQuery.value.trim().toLowerCase()

  return suggestions.value.filter((item) => {
    const haystacks = [
      item.title,
      item.desired_item,
      item.preferred_brand,
      item.details,
      item.author?.username,
      item.author?.email
    ]

    return haystacks.some((entry) => String(entry || '').toLowerCase().includes(query))
  })
})

onMounted(() => {
  loadSuggestions()
})

function goBack() {
  router.push('/dashboard')
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token')}`
  }
}

async function loadSuggestions() {
  loading.value = true

  try {
    const params = new URLSearchParams()
    if (filters.status) params.set('status', filters.status)
    if (filters.category) params.set('category', filters.category)

    const response = await fetch(`/api/suggestions?${params.toString()}`, {
      headers: authHeaders()
    })
    const result = await response.json()

    if (result.success) {
      suggestions.value = result.data.suggestions || []
      Object.assign(summary, result.data.summary || {
        total: 0,
        NEW: 0,
        UNDER_REVIEW: 0,
        PLANNED: 0,
        DECLINED: 0
      })
    } else {
      alert(result.message || 'Failed to load suggestions')
    }
  } catch (error) {
    alert(`Failed to load suggestions: ${error.message}`)
  } finally {
    loading.value = false
  }
}

async function submitSuggestion() {
  if (!canSubmit.value || submitting.value) return

  submitting.value = true

  try {
    const response = await fetch('/api/suggestions', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(form)
    })
    const result = await response.json()

    if (result.success) {
      form.title = ''
      form.desired_item = ''
      form.preferred_brand = ''
      form.category = 'BEVERAGE'
      form.details = ''
      await loadSuggestions()
    } else {
      alert(result.message || 'Failed to submit suggestion')
    }
  } catch (error) {
    alert(`Failed to submit suggestion: ${error.message}`)
  } finally {
    submitting.value = false
  }
}

function openReview(item) {
  reviewTarget.value = item
  reviewForm.status = item.status
  reviewForm.admin_reply = item.admin_reply || ''
}

function closeReview() {
  reviewTarget.value = null
  reviewForm.status = 'NEW'
  reviewForm.admin_reply = ''
}

async function saveReview() {
  if (!reviewTarget.value || savingReview.value) return

  savingReview.value = true

  try {
    const response = await fetch(`/api/suggestions/${reviewTarget.value.id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(reviewForm)
    })
    const result = await response.json()

    if (result.success) {
      closeReview()
      await loadSuggestions()
    } else {
      alert(result.message || 'Failed to update suggestion')
    }
  } catch (error) {
    alert(`Failed to update suggestion: ${error.message}`)
  } finally {
    savingReview.value = false
  }
}

function formatDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

function statusLabel(status) {
  return {
    NEW: 'New',
    UNDER_REVIEW: 'Under Review',
    PLANNED: 'Planned',
    DECLINED: 'Declined'
  }[status] || status
}

function categoryLabel(category) {
  return {
    BEVERAGE: 'Beverage',
    SNACK: 'Snack',
    OTHER: 'Other'
  }[category] || category
}
</script>

<style scoped>
.suggestion-center {
  min-height: 100vh;
  padding: 28px;
  background:
    radial-gradient(circle at top left, rgba(125, 211, 252, 0.22), transparent 24%),
    radial-gradient(circle at 80% 20%, rgba(187, 247, 208, 0.22), transparent 20%),
    linear-gradient(180deg, #f7f8fb 0%, #eef1f5 100%);
  color: #111827;
  position: relative;
  overflow: hidden;
  font-family: "SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif;
}

.ambient {
  position: absolute;
  border-radius: 999px;
  filter: blur(48px);
  opacity: 0.42;
  pointer-events: none;
}

.ambient-a {
  width: 20rem;
  height: 20rem;
  right: -4rem;
  top: -3rem;
  background: rgba(59, 130, 246, 0.16);
}

.ambient-b {
  width: 18rem;
  height: 18rem;
  left: -5rem;
  bottom: -4rem;
  background: rgba(16, 185, 129, 0.16);
}

.page-header,
.header-left,
.header-right,
.panel-header,
.toolbar,
.toolbar-filters,
.card-top,
.card-heading,
.meta-grid,
.card-actions,
.dialog-actions,
.header-right {
  display: flex;
}

.page-header {
  position: relative;
  z-index: 1;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.header-left {
  align-items: center;
  gap: 14px;
}

.back-btn,
.glass-btn,
.close-btn {
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.68);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  color: inherit;
}

.back-btn,
.close-btn {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  cursor: pointer;
}

.page-header h1,
.panel-header h2,
.dialog-header h3 {
  margin: 0;
}

.eyebrow {
  margin: 0 0 6px;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #6b7280;
}

.glass-btn,
.primary-btn {
  height: 44px;
  padding: 0 16px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.primary-btn {
  border: none;
  background: linear-gradient(135deg, #111827, #374151);
  color: #fff;
  box-shadow: 0 18px 30px rgba(17, 24, 39, 0.16);
}

.summary-grid {
  position: relative;
  z-index: 1;
  margin-top: 22px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.summary-card,
.panel,
.suggestion-card,
.dialog-card {
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.84);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.08);
}

.summary-card {
  border-radius: 24px;
  padding: 18px;
}

.summary-label {
  display: block;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #6b7280;
}

.summary-card strong {
  display: block;
  margin-top: 12px;
  font-size: 32px;
  letter-spacing: -0.04em;
}

.content-grid {
  position: relative;
  z-index: 1;
  margin-top: 18px;
  display: grid;
  grid-template-columns: 420px minmax(0, 1fr);
  gap: 18px;
}

.content-grid.admin {
  grid-template-columns: minmax(0, 1fr);
}

.panel {
  border-radius: 30px;
  padding: 24px;
}

.toolbar,
.meta-grid,
.card-actions,
.dialog-actions {
  align-items: center;
}

.toolbar {
  margin-top: 18px;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-filters {
  gap: 10px;
  flex-wrap: wrap;
}

.search-input,
.field input,
.field textarea,
.field select {
  width: 100%;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.76);
  padding: 13px 14px;
  font: inherit;
  color: inherit;
  box-sizing: border-box;
}

.toolbar select,
.search-input {
  height: 46px;
}

.form-grid {
  margin-top: 20px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.field {
  display: block;
}

.field span {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
}

.field.full {
  grid-column: 1 / -1;
}

.field textarea {
  resize: vertical;
}

.panel-actions {
  margin-top: 18px;
}

.suggestion-list {
  margin-top: 18px;
  display: grid;
  gap: 14px;
}

.suggestion-card {
  border-radius: 24px;
  padding: 18px;
}

.card-top {
  align-items: start;
  justify-content: space-between;
  gap: 14px;
}

.card-heading {
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.card-heading h3 {
  margin: 0;
  font-size: 20px;
}

.desired-item {
  margin: 8px 0 0;
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
}

.status-badge,
.category-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.status-badge.NEW {
  background: rgba(59, 130, 246, 0.12);
  color: #1d4ed8;
}

.status-badge.UNDER_REVIEW {
  background: rgba(245, 158, 11, 0.12);
  color: #b45309;
}

.status-badge.PLANNED {
  background: rgba(16, 185, 129, 0.12);
  color: #047857;
}

.status-badge.DECLINED {
  background: rgba(239, 68, 68, 0.12);
  color: #b91c1c;
}

.category-pill {
  background: rgba(17, 24, 39, 0.08);
  color: #374151;
}

.meta-grid {
  margin-top: 16px;
  gap: 20px;
  flex-wrap: wrap;
}

.meta-label {
  display: block;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #6b7280;
}

.meta-value {
  display: block;
  margin-top: 4px;
  font-size: 14px;
  font-weight: 600;
}

.details-text {
  margin: 16px 0 0;
  line-height: 1.65;
  color: #4b5563;
}

.reply-box {
  margin-top: 16px;
  padding: 14px;
  border-radius: 18px;
  background: rgba(17, 24, 39, 0.05);
}

.reply-label {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #6b7280;
}

.reply-box p {
  margin: 8px 0 0;
  line-height: 1.6;
}

.card-actions {
  margin-top: 16px;
  justify-content: flex-end;
}

.empty-state {
  margin-top: 20px;
  min-height: 180px;
  display: grid;
  place-items: center;
  text-align: center;
  color: #6b7280;
}

.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.18);
  display: grid;
  place-items: center;
  padding: 20px;
  z-index: 20;
}

.dialog-card {
  width: min(640px, 100%);
  border-radius: 28px;
  padding: 24px;
}

.dialog-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
}

.dialog-body {
  margin-top: 18px;
  display: grid;
  gap: 14px;
}

.dialog-actions {
  margin-top: 18px;
  justify-content: flex-end;
  gap: 10px;
}

@media (max-width: 1024px) {
  .summary-grid,
  .content-grid {
    grid-template-columns: 1fr;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .suggestion-center {
    padding: 18px;
  }

  .page-header {
    flex-direction: column;
    align-items: stretch;
  }

  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
