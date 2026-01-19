<template>
  <div class="production-management">
    <!-- Header -->
    <div class="page-header">
      <h1 class="page-title">Production Management</h1>
      <div class="header-actions">
        <button class="back-btn" @click="goBack">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs-container">
      <button 
        class="tab-btn"
        :class="{ active: activeTab === 'bom' }"
        @click="activeTab = 'bom'"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        BOM Management
      </button>
      <button 
        class="tab-btn"
        :class="{ active: activeTab === 'workorders' }"
        @click="activeTab = 'workorders'"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
          <rect x="8" y="2" width="8" height="4" rx="1"/>
        </svg>
        Work Orders
      </button>
    </div>

    <!-- BOM Tab Content -->
    <div v-if="activeTab === 'bom'" class="tab-content">
      <div class="content-section">
        <div class="section-header">
          <h2>Create New BOM</h2>
          <button class="btn-primary" @click="showCreateBOM = !showCreateBOM">
            {{ showCreateBOM ? 'Cancel' : '+ New BOM' }}
          </button>
        </div>

        <!-- BOM Creation Form -->
        <div v-if="showCreateBOM" class="form-card">
          <div class="form-row">
            <div class="form-field">
              <label>Finished Good SKU</label>
              <input v-model="newBOM.sku" type="text" placeholder="e.g., FG-001" />
            </div>
            <div class="form-field">
              <label>Version</label>
              <input v-model="newBOM.version" type="text" placeholder="e.g., v1.0" />
            </div>
          </div>

          <div class="form-field">
            <label>Notes</label>
            <textarea v-model="newBOM.notes" placeholder="Optional notes"></textarea>
          </div>

          <div class="form-field">
            <label>Components</label>
            <div v-for="(line, index) in newBOM.lines" :key="index" class="component-row">
              <input v-model="line.component_sku" type="text" placeholder="Component SKU" />
              <input v-model.number="line.qty_per" type="number" step="0.01" placeholder="Qty" />
              <input v-model="line.uom" type="text" placeholder="UOM (e.g., pcs, kg)" />
              <button class="btn-danger" @click="removeBOMLine(index)">×</button>
            </div>
            <button class="btn-secondary" @click="addBOMLine">+ Add Component</button>
          </div>

          <div class="form-actions">
            <button class="btn-primary" @click="createBOM">Create BOM</button>
          </div>
        </div>

        <!-- BOM List -->
        <div class="section-header">
          <h2>Existing BOMs</h2>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Version</th>
                <th>Status</th>
                <th>Components</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="bom in bomList" :key="bom.id">
                <td>{{ bom.sku }}</td>
                <td>{{ bom.version }}</td>
                <td><span class="status-badge" :class="bom.status.toLowerCase()">{{ bom.status }}</span></td>
                <td>{{ bom.lines ? bom.lines.length : 0 }}</td>
                <td>{{ formatDate(bom.createdAt) }}</td>
                <td>
                  <button class="btn-link" @click="viewBOM(bom)">View</button>
                </td>
              </tr>
              <tr v-if="bomList.length === 0">
                <td colspan="6" class="empty-state">No BOMs found. Create one above!</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Work Orders Tab Content -->
    <div v-if="activeTab === 'workorders'" class="tab-content">
      <div class="content-section">
        <div class="section-header">
          <h2>Create New Work Order</h2>
          <button class="btn-primary" @click="showCreateWO = !showCreateWO">
            {{ showCreateWO ? 'Cancel' : '+ New Work Order' }}
          </button>
        </div>

        <!-- WO Creation Form -->
        <div v-if="showCreateWO" class="form-card">
          <div class="form-row">
            <div class="form-field">
              <label>WO Number</label>
              <input v-model="newWO.wo_number" type="text" placeholder="e.g., WO-2024001" />
            </div>
            <div class="form-field">
              <label>Product SKU</label>
              <input v-model="newWO.sku" type="text" placeholder="e.g., FG-001" />
            </div>
            <div class="form-field">
              <label>Planned Quantity</label>
              <input v-model.number="newWO.qty_planned" type="number" placeholder="100" />
            </div>
          </div>

          <div class="form-field">
            <label>Notes</label>
            <textarea v-model="newWO.notes" placeholder="Optional notes"></textarea>
          </div>

          <div class="form-actions">
            <button class="btn-primary" @click="createWorkOrder">Create Work Order</button>
          </div>
        </div>

        <!-- Work Order List -->
        <div class="section-header">
          <h2>Work Orders</h2>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>WO Number</th>
                <th>SKU</th>
                <th>Planned Qty</th>
                <th>Completed Qty</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="wo in woList" :key="wo.id">
                <td>{{ wo.wo_number }}</td>
                <td>{{ wo.sku }}</td>
                <td>{{ wo.qty_planned }}</td>
                <td>{{ wo.qty_completed }}</td>
                <td><span class="status-badge" :class="wo.status.toLowerCase()">{{ wo.status }}</span></td>
                <td>
                  <button v-if="wo.status === 'DRAFT'" class="btn-link" @click="releaseWO(wo.id)">Release</button>
                  <button v-if="wo.status === 'RELEASED'" class="btn-link" @click="startWO(wo.id)">Start</button>
                  <button v-if="wo.status === 'IN_PROGRESS'" class="btn-link" @click="openConsumeModal(wo)">Consume</button>
                  <button v-if="wo.status === 'IN_PROGRESS'" class="btn-link" @click="openCompleteModal(wo)">Complete</button>
                </td>
              </tr>
              <tr v-if="woList.length === 0">
                <td colspan="6" class="empty-state">No Work Orders found. Create one above!</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Consume Material Modal -->
    <div v-if="showConsumeModal" class="modal-overlay" @click="closeConsumeModal">
      <div class="modal-content" @click.stop>
        <h3>Consume Material</h3>
        <div class="form-field">
          <label>Lot ID</label>
          <input v-model.number="consumeForm.lot_id" type="number" placeholder="Lot ID" />
        </div>
        <div class="form-field">
          <label>Component SKU</label>
          <input v-model="consumeForm.component_sku" type="text" placeholder="RM-001" />
        </div>
        <div class="form-field">
          <label>Quantity</label>
          <input v-model.number="consumeForm.qty_consumed" type="number" placeholder="10" />
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" @click="closeConsumeModal">Cancel</button>
          <button class="btn-primary" @click="consumeMaterial">Consume</button>
        </div>
      </div>
    </div>

    <!-- Complete Modal -->
    <div v-if="showCompleteModal" class="modal-overlay" @click="closeCompleteModal">
      <div class="modal-content" @click.stop>
        <h3>Complete Production</h3>
        <div class="form-field">
          <label>Quantity Produced</label>
          <input v-model.number="completeForm.qty_produced" type="number" placeholder="100" />
        </div>
        <div class="form-field">
          <label>Bin Code</label>
          <input v-model="completeForm.bin_code" type="text" placeholder="FG-BIN-01" />
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" @click="closeCompleteModal">Cancel</button>
          <button class="btn-primary" @click="completeWO">Complete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const activeTab = ref('bom')
const showCreateBOM = ref(false)
const showCreateWO = ref(false)
const showConsumeModal = ref(false)
const showCompleteModal = ref(false)
const selectedWO = ref(null)

const newBOM = ref({
  sku: '',
  version: 'v1.0',
  notes: '',
  lines: [{ component_sku: '', qty_per: 1, uom: 'pcs' }]
})

const newWO = ref({
  wo_number: '',
  sku: '',
  qty_planned: 0,
  notes: ''
})

const consumeForm = ref({
  lot_id: null,
  component_sku: '',
  qty_consumed: 0
})

const completeForm = ref({
  qty_produced: 0,
  bin_code: ''
})

const bomList = ref([])
const woList = ref([])

onMounted(() => {
  loadBOMs()
  loadWorkOrders()
})

const addBOMLine = () => {
  newBOM.value.lines.push({ component_sku: '', qty_per: 1, uom: 'pcs' })
}

const removeBOMLine = (index) => {
  newBOM.value.lines.splice(index, 1)
}

const createBOM = async () => {
  try {
    const token = localStorage.getItem('token')
    const response = await fetch('/api/production/boms', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newBOM.value)
    })

    const result = await response.json()
    if (result.success) {
      alert('BOM created successfully!')
      showCreateBOM.value = false
      newBOM.value = { sku: '', version: 'v1.0', notes: '', lines: [{ component_sku: '', qty_per: 1, uom: 'pcs' }] }
      loadBOMs()
    } else {
      alert('Error: ' + result.message)
    }
  } catch (error) {
    console.error('Create BOM error:', error)
    alert('Failed to create BOM')
  }
}

const loadBOMs = async () => {
  try {
    // TODO: Add GET /api/production/boms endpoint
    // In production, you'd have a GET /api/production/boms endpoint
    // For now, we'll leave it empty or create a mock
    bomList.value = []
  } catch (error) {
    console.error('Load BOMs error:', error)
  }
}

const viewBOM = (bom) => {
  alert(`BOM Details:\n${JSON.stringify(bom, null, 2)}`)
}

const createWorkOrder = async () => {
  try {
    const token = localStorage.getItem('token')
    const response = await fetch('/api/production/work-orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newWO.value)
    })

    const result = await response.json()
    if (result.success) {
      alert('Work Order created successfully!')
      showCreateWO.value = false
      newWO.value = { wo_number: '', sku: '', qty_planned: 0, notes: '' }
      loadWorkOrders()
    } else {
      alert('Error: ' + result.message)
    }
  } catch (error) {
    console.error('Create WO error:', error)
    alert('Failed to create Work Order')
  }
}

const loadWorkOrders = async () => {
  try {
    // TODO: Add GET /api/production/work-orders endpoint
    // In production, you'd have a GET /api/production/work-orders endpoint
    woList.value = []
  } catch (error) {
    console.error('Load WOs error:', error)
  }
}

const releaseWO = async (id) => {
  try {
    const token = localStorage.getItem('token')
    const response = await fetch(`/api/production/work-orders/${id}/release`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    const result = await response.json()
    if (result.success) {
      alert('Work Order released!')
      loadWorkOrders()
    } else {
      alert('Error: ' + result.message)
    }
  } catch (error) {
    console.error('Release WO error:', error)
    alert('Failed to release Work Order')
  }
}

const startWO = async (id) => {
  try {
    const token = localStorage.getItem('token')
    const response = await fetch(`/api/production/work-orders/${id}/start`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    const result = await response.json()
    if (result.success) {
      alert('Work Order started!')
      loadWorkOrders()
    } else {
      alert('Error: ' + result.message)
    }
  } catch (error) {
    console.error('Start WO error:', error)
    alert('Failed to start Work Order')
  }
}

const openConsumeModal = (wo) => {
  selectedWO.value = wo
  showConsumeModal.value = true
}

const closeConsumeModal = () => {
  showConsumeModal.value = false
  consumeForm.value = { lot_id: null, component_sku: '', qty_consumed: 0 }
}

const consumeMaterial = async () => {
  try {
    const token = localStorage.getItem('token')
    const response = await fetch(`/api/production/work-orders/${selectedWO.value.id}/consume`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(consumeForm.value)
    })

    const result = await response.json()
    if (result.success) {
      alert('Material consumed!')
      closeConsumeModal()
      loadWorkOrders()
    } else {
      alert('Error: ' + result.message)
    }
  } catch (error) {
    console.error('Consume error:', error)
    alert('Failed to consume material')
  }
}

const openCompleteModal = (wo) => {
  selectedWO.value = wo
  completeForm.value.qty_produced = wo.qty_planned - wo.qty_completed
  showCompleteModal.value = true
}

const closeCompleteModal = () => {
  showCompleteModal.value = false
  completeForm.value = { qty_produced: 0, bin_code: '' }
}

const completeWO = async () => {
  try {
    const token = localStorage.getItem('token')
    const response = await fetch(`/api/production/work-orders/${selectedWO.value.id}/complete`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(completeForm.value)
    })

    const result = await response.json()
    if (result.success) {
      alert('Production completed!')
      closeCompleteModal()
      loadWorkOrders()
    } else {
      alert('Error: ' + result.message)
    }
  } catch (error) {
    console.error('Complete error:', error)
    alert('Failed to complete production')
  }
}

const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString()
}

const goBack = () => {
  router.push('/dashboard')
}
</script>

<style scoped>
.production-management {
  min-height: 100vh;
  background: var(--bg-primary);
  padding: 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-title {
  font-size: 32px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.back-btn {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  padding: 10px 20px;
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
}

.back-btn:hover {
  background: var(--input-focus-bg);
}

.tabs-container {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--glass-border);
}

.tab-btn {
  background: none;
  border: none;
  padding: 12px 24px;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab-btn.active {
  color: var(--accent-blue);
  border-bottom-color: var(--accent-blue);
}

.tab-content {
  animation: fadeIn 0.3s;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.content-section {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  padding: 24px;
  backdrop-filter: blur(20px);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-header h2 {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.form-card {
  background: var(--input-bg);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.form-field label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.form-field input,
.form-field textarea {
  background: var(--input-bg);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  padding: 10px 12px;
  color: var(--text-primary);
  font-size: 14px;
}

.form-field input:focus,
.form-field textarea:focus {
  outline: none;
  border-color: var(--accent-blue);
  background: var(--input-focus-bg);
}

.component-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr auto;
  gap: 8px;
  margin-bottom: 8px;
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 20px;
}

.btn-primary, .btn-secondary, .btn-danger, .btn-link {
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--accent-blue);
  color: white;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-secondary {
  background: var(--input-bg);
  color: var(--text-primary);
  border: 1px solid var(--glass-border);
}

.btn-secondary:hover {
  background: var(--input-focus-bg);
}

.btn-danger {
  background: #FF453A;
  color: white;
  padding: 6px 12px;
}

.btn-link {
  background: none;
  color: var(--accent-blue);
  padding: 4px 8px;
  text-decoration: underline;
}

.table-container {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
  text-align: left;
  padding: 12px;
  background: var(--input-bg);
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 13px;
  text-transform: uppercase;
  border-bottom: 1px solid var(--glass-border);
}

.data-table td {
  padding: 12px;
  color: var(--text-primary);
  border-bottom: 1px solid var(--glass-border);
}

.data-table tr:hover {
  background: var(--input-bg);
}

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.draft {
  background: rgba(255, 149, 0, 0.2);
  color: #FF9500;
}

.status-badge.active,
.status-badge.released {
  background: rgba(52, 199, 89, 0.2);
  color: #34C759;
}

.status-badge.in_progress {
  background: rgba(10, 132, 255, 0.2);
  color: #0A84FF;
}

.status-badge.completed {
  background: rgba(175, 82, 222, 0.2);
  color: #AF52DE;
}

.empty-state {
  text-align: center;
  color: var(--text-secondary);
  padding: 40px !important;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-content);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  padding: 24px;
  max-width: 500px;
  width: 90%;
}

.modal-content h3 {
  margin: 0 0 20px 0;
  color: var(--text-primary);
  font-size: 20px;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 20px;
}
</style>
