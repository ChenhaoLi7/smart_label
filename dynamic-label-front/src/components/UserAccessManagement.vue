<template>
  <div class="user-access">
    <div class="ambient ambient-one"></div>
    <div class="ambient ambient-two"></div>

    <header class="page-header">
      <div class="header-copy">
        <button class="back-btn" @click="goBack" aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>

        <div>
          <p class="eyebrow">Admin Console</p>
          <h1>User Access</h1>
          <p class="header-subtitle">
            Review every registered account and grant admin access to trusted team members.
          </p>
        </div>
      </div>

      <div class="header-actions">
        <button class="glass-btn" @click="loadUsers">
          Refresh
        </button>
      </div>
    </header>

    <section class="summary-grid">
      <article class="summary-card">
        <span class="summary-label">Total Users</span>
        <strong>{{ summary.total }}</strong>
      </article>
      <article class="summary-card">
        <span class="summary-label">Admins</span>
        <strong>{{ summary.admin }}</strong>
      </article>
      <article class="summary-card">
        <span class="summary-label">Operators</span>
        <strong>{{ summary.operator }}</strong>
      </article>
      <article class="summary-card">
        <span class="summary-label">Viewers</span>
        <strong>{{ summary.viewer }}</strong>
      </article>
    </section>

    <section class="info-panel">
      <div>
        <p class="eyebrow">Permission Rule</p>
        <h2>Admins stay protected</h2>
      </div>
      <p>
        You can promote non-admin users to admin here. Existing admins cannot be downgraded from this screen.
        New admin access takes effect after that user signs in again.
      </p>
    </section>

    <section class="workspace-panel">
      <div class="workspace-header">
        <div>
          <p class="eyebrow">Registered Team</p>
          <h2>All user accounts</h2>
        </div>

        <label class="search-shell">
          <span class="field-label">Search</span>
          <input
            v-model="searchQuery"
            class="search-input"
            type="text"
            placeholder="Search by username, email, role or status"
          >
        </label>
      </div>

      <div v-if="feedbackMessage" class="state-banner success">
        {{ feedbackMessage }}
      </div>
      <div v-if="errorMessage" class="state-banner error">
        {{ errorMessage }}
      </div>
      <div v-if="loading" class="state-banner info">
        Loading users...
      </div>

      <div v-if="!loading && filteredUsers.length === 0" class="empty-state">
        <strong>No users found</strong>
        <p>Try another keyword or wait until more teammates register.</p>
      </div>

      <div v-else class="user-grid">
        <article v-for="user in filteredUsers" :key="user.id" class="user-card">
          <div class="user-top">
            <div class="user-identity">
              <div class="avatar-bubble">
                {{ getInitials(user.username) }}
              </div>

              <div>
                <div class="user-name-row">
                  <strong>{{ user.username }}</strong>
                  <span v-if="user.username === currentUsername" class="self-pill">You</span>
                </div>
                <p>{{ user.email }}</p>
              </div>
            </div>

            <div class="badge-stack">
              <span class="role-badge" :class="user.role">{{ roleLabel(user.role) }}</span>
              <span class="status-badge" :class="user.status">{{ statusLabel(user.status) }}</span>
            </div>
          </div>

          <div class="meta-grid">
            <div>
              <span class="meta-label">Created</span>
              <strong>{{ formatDate(user.createdAt) }}</strong>
            </div>
            <div>
              <span class="meta-label">Updated</span>
              <strong>{{ formatDate(user.updatedAt) }}</strong>
            </div>
            <div>
              <span class="meta-label">Access</span>
              <strong>{{ user.role === 'admin' ? 'Locked Admin' : 'Can Be Promoted' }}</strong>
            </div>
          </div>

          <div class="card-actions">
            <button
              v-if="user.role !== 'admin'"
              class="primary-btn"
              :disabled="promotingUserId === user.id"
              @click="promoteUser(user)"
            >
              {{ promotingUserId === user.id ? 'Promoting...' : 'Promote to Admin' }}
            </button>
            <span v-else class="locked-label">Admin role is locked on this page</span>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const users = ref([])
const loading = ref(false)
const promotingUserId = ref(null)
const searchQuery = ref('')
const feedbackMessage = ref('')
const errorMessage = ref('')
const currentUsername = ref(localStorage.getItem('username') || '')

const summary = computed(() => {
  return users.value.reduce((acc, user) => {
    acc.total += 1
    acc[user.role] = (acc[user.role] || 0) + 1
    return acc
  }, {
    total: 0,
    admin: 0,
    operator: 0,
    viewer: 0
  })
})

const filteredUsers = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase()
  if (!keyword) return users.value

  return users.value.filter((user) => {
    return [
      user.username,
      user.email,
      user.role,
      user.status
    ].some((value) => String(value || '').toLowerCase().includes(keyword))
  })
})

const authHeaders = () => {
  const token = localStorage.getItem('token')
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
}

const formatDate = (value) => {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

const getInitials = (username) => {
  return String(username || '?').slice(0, 2).toUpperCase()
}

const roleLabel = (role) => {
  if (role === 'admin') return 'Admin'
  if (role === 'viewer') return 'Viewer'
  return 'Operator'
}

const statusLabel = (status) => {
  return status === 'inactive' ? 'Inactive' : 'Active'
}

const goBack = () => {
  router.push('/dashboard')
}

const handleUnauthorized = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('username')
  localStorage.removeItem('userRole')
  localStorage.removeItem('userId')
  localStorage.removeItem('userAvatar')
  router.push('/login')
}

const loadUsers = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await fetch('/api/auth/users', {
      method: 'GET',
      headers: authHeaders()
    })

    if (response.status === 401) {
      handleUnauthorized()
      return
    }

    const result = await response.json()
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to load users')
    }

    users.value = result.data.users || []
  } catch (error) {
    errorMessage.value = error.message || 'Failed to load users'
  } finally {
    loading.value = false
  }
}

const promoteUser = async (user) => {
  const confirmed = window.confirm(`Grant admin access to ${user.username}?`)
  if (!confirmed) return

  promotingUserId.value = user.id
  feedbackMessage.value = ''
  errorMessage.value = ''

  try {
    const response = await fetch(`/api/auth/users/${user.id}/promote`, {
      method: 'PATCH',
      headers: authHeaders()
    })

    if (response.status === 401) {
      handleUnauthorized()
      return
    }

    const result = await response.json()
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to update user role')
    }

    users.value = users.value.map((entry) => {
      if (entry.id !== user.id) return entry
      return {
        ...entry,
        role: 'admin',
        updatedAt: result.data.user.updatedAt
      }
    })
    feedbackMessage.value = result.message || 'Admin access granted successfully'
  } catch (error) {
    errorMessage.value = error.message || 'Failed to update user role'
  } finally {
    promotingUserId.value = null
  }
}

onMounted(() => {
  loadUsers()
})
</script>

<style scoped>
.user-access {
  --bg: #f4f6f8;
  --surface: rgba(255, 255, 255, 0.78);
  --surface-strong: rgba(255, 255, 255, 0.94);
  --border: rgba(15, 23, 42, 0.08);
  --text: #121826;
  --muted: #667085;
  --shadow: 0 24px 60px rgba(15, 23, 42, 0.08);
  --accent-blue: #0a84ff;
  --accent-green: #34c759;
  --accent-amber: #f59e0b;
  min-height: 100vh;
  padding: 28px;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at top left, rgba(120, 210, 255, 0.26), transparent 28%),
    radial-gradient(circle at 85% 15%, rgba(172, 240, 208, 0.22), transparent 20%),
    linear-gradient(180deg, #fbfbfd 0%, #edf2f7 100%);
}

.ambient {
  position: absolute;
  border-radius: 999px;
  filter: blur(40px);
  pointer-events: none;
}

.ambient-one {
  top: 60px;
  right: 120px;
  width: 220px;
  height: 220px;
  background: rgba(122, 162, 255, 0.18);
}

.ambient-two {
  left: 60px;
  bottom: 100px;
  width: 240px;
  height: 240px;
  background: rgba(49, 196, 141, 0.16);
}

.page-header,
.summary-card,
.info-panel,
.workspace-panel,
.user-card {
  position: relative;
  z-index: 1;
  background: var(--surface);
  border: 1px solid rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  box-shadow: var(--shadow);
}

.page-header {
  border-radius: 32px;
  padding: 28px 32px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}

.header-copy {
  display: flex;
  align-items: flex-start;
  gap: 18px;
}

.back-btn,
.glass-btn {
  height: 44px;
  padding: 0 16px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.76);
  color: var(--text);
  cursor: pointer;
}

.back-btn {
  width: 44px;
  display: grid;
  place-items: center;
  padding: 0;
}

.eyebrow {
  margin: 0 0 10px;
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
}

.page-header h1,
.workspace-header h2,
.info-panel h2 {
  margin: 0;
  color: var(--text);
  letter-spacing: -0.04em;
}

.page-header h1 {
  font-size: 44px;
}

.header-subtitle,
.info-panel p {
  margin: 12px 0 0;
  max-width: 720px;
  color: var(--muted);
  line-height: 1.7;
}

.summary-grid {
  position: relative;
  z-index: 1;
  margin-top: 22px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.summary-card {
  border-radius: 26px;
  padding: 22px 24px;
}

.summary-label {
  display: block;
  color: var(--muted);
  font-size: 13px;
}

.summary-card strong {
  display: block;
  margin-top: 12px;
  font-size: 34px;
  color: var(--text);
}

.info-panel,
.workspace-panel {
  position: relative;
  z-index: 1;
  margin-top: 22px;
  border-radius: 32px;
  padding: 28px 30px;
}

.workspace-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
}

.search-shell {
  min-width: 320px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.field-label,
.meta-label {
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
}

.search-input {
  height: 48px;
  padding: 0 16px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.8);
  color: var(--text);
  font-size: 14px;
}

.state-banner {
  margin-top: 18px;
  padding: 14px 16px;
  border-radius: 18px;
  font-size: 14px;
  font-weight: 600;
}

.state-banner.success {
  background: rgba(220, 252, 231, 0.9);
  color: #15803d;
}

.state-banner.error {
  background: rgba(254, 226, 226, 0.9);
  color: #dc2626;
}

.state-banner.info {
  background: rgba(219, 234, 254, 0.88);
  color: #1d4ed8;
}

.empty-state {
  padding: 56px 20px 24px;
  text-align: center;
}

.empty-state strong {
  display: block;
  font-size: 18px;
  color: var(--text);
}

.empty-state p {
  margin: 12px 0 0;
  color: var(--muted);
}

.user-grid {
  margin-top: 20px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.user-card {
  border-radius: 28px;
  padding: 22px;
}

.user-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.user-identity {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.avatar-bubble {
  width: 52px;
  height: 52px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, rgba(10, 132, 255, 0.16), rgba(52, 199, 89, 0.18));
  color: var(--text);
  font-size: 16px;
  font-weight: 700;
  flex-shrink: 0;
}

.user-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-name-row strong {
  font-size: 18px;
  color: var(--text);
}

.user-identity p {
  margin: 8px 0 0;
  color: var(--muted);
  word-break: break-word;
}

.self-pill,
.role-badge,
.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.self-pill {
  background: rgba(10, 132, 255, 0.12);
  color: var(--accent-blue);
}

.badge-stack {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.role-badge.admin {
  background: rgba(10, 132, 255, 0.12);
  color: var(--accent-blue);
}

.role-badge.operator {
  background: rgba(245, 158, 11, 0.14);
  color: #b45309;
}

.role-badge.viewer {
  background: rgba(148, 163, 184, 0.18);
  color: #475569;
}

.status-badge.active {
  background: rgba(220, 252, 231, 0.9);
  color: #15803d;
}

.status-badge.inactive {
  background: rgba(254, 226, 226, 0.9);
  color: #dc2626;
}

.meta-grid {
  margin-top: 20px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.meta-grid strong {
  display: block;
  margin-top: 6px;
  color: var(--text);
  font-size: 14px;
  line-height: 1.5;
}

.card-actions {
  margin-top: 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.primary-btn {
  min-height: 44px;
  padding: 0 18px;
  border: none;
  border-radius: 16px;
  background: linear-gradient(135deg, #111827, #2d3748);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 18px 30px rgba(17, 24, 39, 0.16);
}

.primary-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.locked-label {
  color: var(--muted);
  font-size: 13px;
  font-weight: 600;
}

@media (max-width: 1100px) {
  .summary-grid,
  .user-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 820px) {
  .user-access {
    padding: 18px;
  }

  .page-header,
  .workspace-header {
    flex-direction: column;
    align-items: stretch;
  }

  .search-shell {
    min-width: 0;
  }

  .user-grid,
  .summary-grid,
  .meta-grid {
    grid-template-columns: 1fr;
  }
}
</style>
