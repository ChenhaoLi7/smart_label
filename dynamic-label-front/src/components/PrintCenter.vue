<template>
  <div class="print-center">
    <section class="hero-card">
      <div class="hero-copy">
        <p class="eyebrow">Label Operations</p>
        <h1>Print Center</h1>
        <p class="hero-text">
          Choose a format, select the right records, and generate clean warehouse labels that feel ready for real operations.
        </p>
        <div class="hero-metrics">
          <div class="hero-metric">
            <span>Templates</span>
            <strong>{{ templates.length }}</strong>
          </div>
          <div class="hero-metric">
            <span>Live Lots</span>
            <strong>{{ lots.length }}</strong>
          </div>
          <div class="hero-metric">
            <span>Bins</span>
            <strong>{{ bins.length }}</strong>
          </div>
        </div>
      </div>

      <div class="hero-actions">
        <button class="ghost-btn" @click="goBack">
          Back
        </button>
        <button class="ghost-btn" @click="refreshWorkspace" :disabled="workspaceBusy">
          {{ workspaceBusy ? 'Refreshing...' : 'Refresh Data' }}
        </button>
        <button class="primary-btn" @click="viewPrintHistory" :disabled="loadingJobs">
          {{ loadingJobs ? 'Loading History...' : 'Print History' }}
        </button>
      </div>
    </section>

    <div v-if="workspaceBusy" class="inline-banner info">
      <strong>Syncing workspace</strong>
      <span>Refreshing templates, inventory sources, and print job snapshots.</span>
    </div>

    <div v-else-if="hasLoadErrors" class="inline-banner error">
      <strong>Some data could not be loaded</strong>
      <span>{{ loadErrorSummary }}</span>
    </div>

    <div v-if="notice.visible" class="inline-banner" :class="notice.type">
      <div class="notice-copy">
        <strong>{{ notice.title }}</strong>
        <span>{{ notice.message }}</span>
      </div>
      <button class="notice-close" @click="notice.visible = false">Dismiss</button>
    </div>

    <div class="print-layout">
      <aside class="workspace-panel template-panel">
        <div class="panel-topline">
          <div>
            <p class="panel-eyebrow">Step 1</p>
            <h2>Choose A Label Format</h2>
          </div>
          <span class="panel-meta">{{ templates.length }} available</span>
        </div>

        <div v-if="loadingTemplates" class="empty-state">
          <strong>Loading templates...</strong>
          <span>Pulling the latest formats from the print library.</span>
        </div>

        <div v-else-if="templates.length === 0" class="empty-state">
          <strong>No templates found</strong>
          <span>{{ loadErrors.templates || 'Create or restore templates before printing.' }}</span>
        </div>

        <div v-else class="template-grid">
          <button
            v-for="template in templates"
            :key="template.id"
            type="button"
            class="template-card"
            :class="{ active: selectedTemplate?.id === template.id }"
            @click="selectTemplate(template)"
          >
            <div class="template-card-top">
              <div class="template-badge">{{ templateIcon(template) }}</div>
              <div class="template-size-pill">
                {{ template.size.width }}×{{ template.size.height }}{{ template.size.unit }}
              </div>
            </div>

            <div class="template-card-copy">
              <strong>{{ templateDisplayName(template) }}</strong>
              <p>{{ templateDisplayDescription(template) }}</p>
            </div>

            <div class="template-support">
              <span
                v-for="type in template.printTypes"
                :key="`${template.id}-${type}`"
                class="support-pill"
              >
                {{ printTypeLabel(type) }}
              </span>
            </div>
          </button>
        </div>

        <div class="template-detail-card" v-if="selectedTemplate">
          <div class="panel-topline compact">
            <div>
              <p class="panel-eyebrow">Template Snapshot</p>
              <h3>{{ templateDisplayName(selectedTemplate) }}</h3>
            </div>
            <span class="detail-size">
              {{ selectedTemplate.size.width }}×{{ selectedTemplate.size.height }}{{ selectedTemplate.size.unit }}
            </span>
          </div>

          <p class="template-detail-copy">{{ templateDisplayDescription(selectedTemplate) }}</p>

          <div class="detail-row">
            <span>Supported Prints</span>
            <div class="detail-pills">
              <span
                v-for="type in selectedTemplate.printTypes"
                :key="`supported-${type}`"
                class="support-pill"
              >
                {{ printTypeLabel(type) }}
              </span>
            </div>
          </div>

          <div class="detail-row">
            <span>Dynamic Fields</span>
            <div class="detail-pills">
              <span
                v-for="placeholder in selectedTemplate.placeholders"
                :key="placeholder"
                class="field-pill"
              >
                {{ placeholder }}
              </span>
            </div>
          </div>
        </div>
      </aside>

      <section class="workspace-panel source-panel">
        <div class="panel-topline">
          <div>
            <p class="panel-eyebrow">Step 2</p>
            <h2>Select What To Print</h2>
          </div>
          <span class="panel-meta">{{ currentSourceItems.length }} shown</span>
        </div>

        <div v-if="!selectedTemplate" class="empty-state large">
          <strong>Choose a template first</strong>
          <span>Once a format is selected, the source list and print actions will unlock automatically.</span>
        </div>

        <template v-else>
          <div class="type-switcher">
            <button
              v-for="type in availablePrintTypes"
              :key="type"
              type="button"
              class="type-chip"
              :class="{ active: printType === type }"
              @click="printType = type"
            >
              <span>{{ printTypeIcon(type) }}</span>
              {{ printTypeLabel(type) }}
            </button>
          </div>

          <div class="source-tabs" v-if="visibleSourceTabs.length > 1">
            <button
              v-for="tab in visibleSourceTabs"
              :key="tab.key"
              type="button"
              class="source-tab"
              :class="{ active: activeDataSourceTab === tab.key }"
              @click="activeDataSourceTab = tab.key"
            >
              <strong>{{ tab.label }}</strong>
              <span>{{ tab.subtitle }}</span>
            </button>
          </div>

          <div class="source-toolbar" v-if="activeDataSourceTab">
            <div class="search-shell">
              <input
                v-model="currentSearchQuery"
                :placeholder="currentSearchPlaceholder"
                class="search-input"
              >
            </div>

            <div class="toolbar-actions">
              <button class="ghost-btn small" @click="toggleSelectAllCurrentSource" :disabled="currentSourceItems.length === 0">
                {{ allCurrentSourceSelected ? 'Clear Visible' : 'Select Visible' }}
              </button>
              <span class="selection-note">{{ selectedItemCount }} selected</span>
            </div>
          </div>

          <div v-if="currentSourceItems.length === 0" class="empty-state">
            <strong>{{ currentSourceEmptyTitle }}</strong>
            <span>{{ currentSourceEmptyCopy }}</span>
          </div>

          <div v-else class="source-list">
            <article
              v-for="record in currentSourceItems"
              :key="`${activeDataSourceTab}-${record.id}`"
              class="source-card"
              :class="{ selected: isRecordSelected(activeDataSourceTab, record.id) }"
              @click="toggleRecordSelection(activeDataSourceTab, record.id)"
            >
              <label class="record-check" @click.stop>
                <input
                  type="checkbox"
                  :checked="isRecordSelected(activeDataSourceTab, record.id)"
                  @change="toggleRecordSelection(activeDataSourceTab, record.id)"
                >
                <span></span>
              </label>

              <div class="record-content" v-if="activeDataSourceTab === 'po'">
                <div class="record-title-row">
                  <div>
                    <strong>{{ record.item_name || record.sku }}</strong>
                    <p>{{ record.sku }}</p>
                  </div>
                  <span class="status-pill neutral">{{ formatPOStatus(record.status) }}</span>
                </div>

                <div class="record-meta-grid">
                  <div class="meta-cell">
                    <span>PO Number</span>
                    <strong>{{ record.po_number }}</strong>
                  </div>
                  <div class="meta-cell">
                    <span>Quantity</span>
                    <strong>{{ record.qty }} {{ record.uom || 'pcs' }}</strong>
                  </div>
                </div>
              </div>

              <div class="record-content" v-else-if="activeDataSourceTab === 'items'">
                <div class="record-title-row">
                  <div>
                    <strong>{{ record.name || record.sku }}</strong>
                    <p>{{ record.sku }}</p>
                  </div>
                  <span class="status-pill" :class="record.status === 'ACTIVE' ? 'good' : 'neutral'">
                    {{ record.status || 'ACTIVE' }}
                  </span>
                </div>

                <div class="record-meta-grid">
                  <div class="meta-cell">
                    <span>Category</span>
                    <strong>{{ record.category || 'Uncategorized' }}</strong>
                  </div>
                  <div class="meta-cell">
                    <span>Available</span>
                    <strong>{{ record.availableQty || 0 }} {{ record.uom || 'pcs' }}</strong>
                  </div>
                  <div class="meta-cell">
                    <span>Bins</span>
                    <strong>{{ record.binCount || 0 }}</strong>
                  </div>
                </div>
              </div>

              <div class="record-content" v-else-if="activeDataSourceTab === 'lots'">
                <div class="record-title-row">
                  <div>
                    <strong>{{ record.lot_number }}</strong>
                    <p>{{ record.sku }}</p>
                  </div>
                  <span class="status-pill good">{{ record.qty }} {{ record.uom || 'pcs' }}</span>
                </div>

                <div class="record-meta-grid">
                  <div class="meta-cell">
                    <span>Bin</span>
                    <strong>{{ record.bin?.bin_code || 'Unassigned' }}</strong>
                  </div>
                  <div class="meta-cell">
                    <span>Expiry</span>
                    <strong>{{ formatDate(record.expiry_date) }}</strong>
                  </div>
                </div>
              </div>

              <div class="record-content" v-else-if="activeDataSourceTab === 'bins'">
                <div class="record-title-row">
                  <div>
                    <strong>{{ record.bin_code }}</strong>
                    <p>{{ formatZone(record.zone) }}</p>
                  </div>
                  <span class="status-pill neutral">{{ record.utilization || 0 }}%</span>
                </div>

                <div class="record-meta-grid bin-grid">
                  <div class="meta-cell">
                    <span>Capacity</span>
                    <strong>{{ record.capacity || 0 }}</strong>
                  </div>
                  <div class="meta-cell">
                    <span>Used</span>
                    <strong>{{ record.used || 0 }}</strong>
                  </div>
                </div>

                <div class="utilization-track">
                  <div
                    class="utilization-fill"
                    :class="utilizationTone(record.utilization || 0)"
                    :style="{ width: `${Math.min(record.utilization || 0, 100)}%` }"
                  ></div>
                </div>
              </div>
            </article>
          </div>
        </template>
      </section>

      <aside class="workspace-panel action-panel">
        <div class="action-card">
          <div class="panel-topline compact">
            <div>
              <p class="panel-eyebrow">Step 3</p>
              <h2>Output Settings</h2>
            </div>
          </div>

          <div class="option-grid">
            <label class="option-field">
              <span>Copies</span>
              <input v-model="printOptions.copies" type="number" min="1" max="20" class="option-input">
            </label>

            <label class="option-field">
              <span>Resolution</span>
              <select v-model="printOptions.dpi" class="option-input">
                <option value="150">150 DPI</option>
                <option value="300">300 DPI</option>
                <option value="600">600 DPI</option>
              </select>
            </label>
          </div>

          <div class="output-note">
            <span>Output Format</span>
            <strong>PDF Package</strong>
          </div>
        </div>

        <div class="summary-card">
          <div class="panel-topline compact">
            <div>
              <p class="panel-eyebrow">Summary</p>
              <h2>Print Snapshot</h2>
            </div>
          </div>

          <div class="summary-list">
            <div class="summary-row">
              <span>Template</span>
              <strong>{{ selectedTemplate ? templateDisplayName(selectedTemplate) : 'Not selected' }}</strong>
            </div>
            <div class="summary-row">
              <span>Print Type</span>
              <strong>{{ printType ? printTypeLabel(printType) : 'Not selected' }}</strong>
            </div>
            <div class="summary-row">
              <span>Source</span>
              <strong>{{ currentSourceLabel }}</strong>
            </div>
            <div class="summary-row">
              <span>Selected Records</span>
              <strong>{{ selectedItemCount }}</strong>
            </div>
            <div class="summary-row">
              <span>Total Labels</span>
              <strong>{{ totalPrintCount }}</strong>
            </div>
          </div>
        </div>

        <div class="primary-actions-card">
          <button
            class="ghost-btn wide"
            @click="previewLabels"
            :disabled="!canPrint || submittingAction === 'preview' || submittingAction === 'print'"
          >
            {{ submittingAction === 'preview' ? 'Building Preview...' : 'Preview Labels' }}
          </button>
          <button
            class="primary-btn wide"
            @click="printLabels"
            :disabled="!canPrint || submittingAction === 'preview' || submittingAction === 'print'"
          >
            {{ submittingAction === 'print' ? 'Preparing Download...' : 'Generate Print Package' }}
          </button>
        </div>

        <div class="guide-card">
          <div class="panel-topline compact">
            <div>
              <p class="panel-eyebrow">Lot Guidance</p>
              <h2>How Lot Labels Work</h2>
            </div>
          </div>

          <div class="guide-item">
            <strong>When it is created</strong>
            <p>A lot code is created during inbound. The current default pattern is <code>LOT-YYYYMMDD-XXXX</code>.</p>
          </div>

          <div class="guide-item">
            <strong>Where to place it</strong>
            <p>Attach the lot label to the case, tray, carton, or inner box that moves together. Do not label every bottle unless you truly need bottle-level tracking.</p>
          </div>

          <div class="guide-item">
            <strong>How precise to keep it</strong>
            <p>For admin inventory, keep lot-level accuracy. For normal users, item labels are usually enough. That gives us traceability without making daily use too heavy.</p>
          </div>
        </div>

        <div class="recent-card">
          <div class="panel-topline compact">
            <div>
              <p class="panel-eyebrow">Recent Jobs</p>
              <h2>Last Output</h2>
            </div>
            <button class="text-btn" @click="viewPrintHistory">View All</button>
          </div>

          <div v-if="recentJobs.length === 0" class="empty-state compact">
            <strong>No print jobs yet</strong>
            <span>Your recent print history will show up here.</span>
          </div>

          <div v-else class="recent-list">
            <article v-for="job in recentJobs" :key="job.id" class="recent-job">
              <div>
                <strong>{{ job.job_number }}</strong>
                <p>{{ templateDisplayName({ id: job.template_name, name: job.template_name }) }}</p>
              </div>
              <span class="status-pill" :class="jobStatusTone(job.status)">
                {{ formatJobStatus(job.status) }}
              </span>
            </article>
          </div>
        </div>
      </aside>
    </div>

    <div v-if="showPrintHistory" class="modal-overlay" @click="closePrintHistory">
      <div class="history-modal" @click.stop>
        <div class="history-header">
          <div>
            <p class="panel-eyebrow">Archive</p>
            <h2>Print History</h2>
          </div>
          <button class="icon-btn" @click="closePrintHistory">×</button>
        </div>

        <div v-if="loadingJobs" class="empty-state">
          <strong>Loading history...</strong>
          <span>Pulling completed and in-progress print jobs.</span>
        </div>

        <div v-else-if="printJobs.length === 0" class="empty-state">
          <strong>No print jobs yet</strong>
          <span>Create the first print package to start building history.</span>
        </div>

        <div v-else class="history-list">
          <article v-for="job in printJobs" :key="job.id" class="history-card">
            <div class="history-top">
              <div>
                <strong>{{ job.job_number }}</strong>
                <p>{{ job.template_name }}</p>
              </div>
              <span class="status-pill" :class="jobStatusTone(job.status)">
                {{ formatJobStatus(job.status) }}
              </span>
            </div>

            <div class="history-meta">
              <span>{{ printTypeLabel(job.print_type) }}</span>
              <span>{{ job.total_count }} labels</span>
              <span>{{ formatDateTime(job.createdAt) }}</span>
            </div>

            <div class="history-actions">
              <button class="ghost-btn small" @click="downloadJob(job)" :disabled="!job.output_file">
                Download
              </button>
              <button
                class="primary-btn small"
                @click="reprintJob(job)"
                :disabled="submittingAction === `reprint:${job.id}`"
              >
                {{ submittingAction === `reprint:${job.id}` ? 'Rebuilding...' : 'Reprint' }}
              </button>
            </div>
          </article>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()
const templates = ref([])
const selectedTemplate = ref(null)
const printType = ref('')
const activeDataSourceTab = ref('')
const loadingTemplates = ref(false)
const loadingSources = ref(false)
const loadingJobs = ref(false)
const submittingAction = ref('')
const showPrintHistory = ref(false)

const loadErrors = reactive({
  templates: '',
  po: '',
  items: '',
  lots: '',
  bins: '',
  jobs: ''
})

const notice = reactive({
  visible: false,
  type: 'info',
  title: '',
  message: ''
})

const poSearchQuery = ref('')
const itemSearchQuery = ref('')
const lotSearchQuery = ref('')
const binSearchQuery = ref('')

const poLines = ref([])
const inventoryItems = ref([])
const lots = ref([])
const bins = ref([])
const printJobs = ref([])

const selectedPOLines = ref([])
const selectedItems = ref([])
const selectedLots = ref([])
const selectedBins = ref([])

const printOptions = ref({
  copies: 1,
  format: 'PDF',
  dpi: 300
})

const sourceTabRegistry = {
  po: {
    key: 'po',
    label: 'Incoming PO Lines',
    subtitle: 'Generate fresh lot labels from inbound purchase lines.'
  },
  items: {
    key: 'items',
    label: 'Item Master',
    subtitle: 'Print clean item labels from your current SKU catalog.'
  },
  lots: {
    key: 'lots',
    label: 'Live Lots',
    subtitle: 'Reprint or refresh labels for active tracked batches.'
  },
  bins: {
    key: 'bins',
    label: 'Bin Locations',
    subtitle: 'Print location labels for shelves, refrigerators, and storage zones.'
  }
}

const templateDisplayMap = {
  'LOT-50x50': {
    name: 'Lot Label 50×50',
    description: 'Batch label with SKU, lot, quantity, bin, and expiry.'
  },
  '批次标签 50x50mm': {
    name: 'Lot Label 50×50',
    description: 'Batch label with SKU, lot, quantity, bin, and expiry.'
  },
  'BIN-80x40': {
    name: 'Bin Label 80×40',
    description: 'Location label for shelves, refrigerators, and storage bins.'
  },
  '库位标签 80x40mm': {
    name: 'Bin Label 80×40',
    description: 'Location label for shelves, refrigerators, and storage bins.'
  },
  'ITEM-60x40': {
    name: 'Item Label 60×40',
    description: 'Product label with SKU, item name, spec, and unit.'
  },
  '物料标签 60x40mm': {
    name: 'Item Label 60×40',
    description: 'Product label with SKU, item name, spec, and unit.'
  }
}

const authConfig = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem('token')}`
  }
})

const goBack = () => {
  router.push('/dashboard')
}

const getBackendOrigin = () => {
  const hostname = window.location.hostname || 'localhost'
  return `http://${hostname}:3000`
}

const resolveDownloadUrl = (downloadPath) => {
  if (!downloadPath) return ''
  if (downloadPath.startsWith('http://') || downloadPath.startsWith('https://')) {
    return downloadPath
  }

  return `${getBackendOrigin()}${downloadPath}`
}

const extractErrorMessage = (error, fallback) => {
  return error.response?.data?.message || error.message || fallback
}

const safeLower = (value) => String(value || '').toLowerCase()

const showNotice = (type, title, message) => {
  notice.visible = true
  notice.type = type
  notice.title = title
  notice.message = message
}

const syncSelections = (items, selectedItemsRef) => {
  const validIds = new Set(items.map((item) => String(item.id)))
  selectedItemsRef.value = selectedItemsRef.value.filter((id) => validIds.has(String(id)))
}

const availablePrintTypes = computed(() => selectedTemplate.value?.printTypes || [])

const visibleSourceTabs = computed(() => {
  switch (printType.value) {
    case 'LOT':
      return [sourceTabRegistry.lots, sourceTabRegistry.po]
    case 'ITEM':
      return [sourceTabRegistry.items]
    case 'BIN':
      return [sourceTabRegistry.bins]
    default:
      return []
  }
})

const filteredPOLines = computed(() => {
  if (!poSearchQuery.value) return poLines.value

  return poLines.value.filter((line) => (
    safeLower(line.po_number).includes(safeLower(poSearchQuery.value)) ||
    safeLower(line.sku).includes(safeLower(poSearchQuery.value)) ||
    safeLower(line.item_name).includes(safeLower(poSearchQuery.value))
  ))
})

const filteredItems = computed(() => {
  if (!itemSearchQuery.value) return inventoryItems.value

  return inventoryItems.value.filter((item) => (
    safeLower(item.sku).includes(safeLower(itemSearchQuery.value)) ||
    safeLower(item.name).includes(safeLower(itemSearchQuery.value)) ||
    safeLower(item.category).includes(safeLower(itemSearchQuery.value))
  ))
})

const filteredLots = computed(() => {
  if (!lotSearchQuery.value) return lots.value

  return lots.value.filter((lot) => (
    safeLower(lot.lot_number).includes(safeLower(lotSearchQuery.value)) ||
    safeLower(lot.sku).includes(safeLower(lotSearchQuery.value)) ||
    safeLower(lot.bin?.bin_code).includes(safeLower(lotSearchQuery.value))
  ))
})

const filteredBins = computed(() => {
  if (!binSearchQuery.value) return bins.value

  return bins.value.filter((bin) => (
    safeLower(bin.bin_code).includes(safeLower(binSearchQuery.value)) ||
    safeLower(bin.zone).includes(safeLower(binSearchQuery.value)) ||
    safeLower(bin.temperature_zone).includes(safeLower(binSearchQuery.value))
  ))
})

const currentSourceItems = computed(() => {
  switch (activeDataSourceTab.value) {
    case 'po':
      return filteredPOLines.value
    case 'items':
      return filteredItems.value
    case 'lots':
      return filteredLots.value
    case 'bins':
      return filteredBins.value
    default:
      return []
  }
})

const currentSearchQuery = computed({
  get() {
    switch (activeDataSourceTab.value) {
      case 'po':
        return poSearchQuery.value
      case 'items':
        return itemSearchQuery.value
      case 'lots':
        return lotSearchQuery.value
      case 'bins':
        return binSearchQuery.value
      default:
        return ''
    }
  },
  set(value) {
    switch (activeDataSourceTab.value) {
      case 'po':
        poSearchQuery.value = value
        break
      case 'items':
        itemSearchQuery.value = value
        break
      case 'lots':
        lotSearchQuery.value = value
        break
      case 'bins':
        binSearchQuery.value = value
        break
      default:
        break
    }
  }
})

const currentSearchPlaceholder = computed(() => {
  switch (activeDataSourceTab.value) {
    case 'po':
      return 'Search PO number, SKU, or item name...'
    case 'items':
      return 'Search SKU, item name, or category...'
    case 'lots':
      return 'Search lot number, SKU, or bin...'
    case 'bins':
      return 'Search bin code, zone, or temperature...'
    default:
      return 'Search records...'
  }
})

const currentSourceLabel = computed(() => {
  return sourceTabRegistry[activeDataSourceTab.value]?.label || 'No source selected'
})

const currentSourceEmptyTitle = computed(() => {
  switch (activeDataSourceTab.value) {
    case 'po':
      return 'No purchase lines found'
    case 'items':
      return 'No items matched'
    case 'lots':
      return 'No active lots found'
    case 'bins':
      return 'No bins matched'
    default:
      return 'No records to show'
  }
})

const currentSourceEmptyCopy = computed(() => {
  switch (activeDataSourceTab.value) {
    case 'po':
      return loadErrors.po || 'Try a wider search or refresh purchase data.'
    case 'items':
      return loadErrors.items || 'Try a wider search or create a few item records first.'
    case 'lots':
      return loadErrors.lots || 'Create or receive stock first so live lots exist to print.'
    case 'bins':
      return loadErrors.bins || 'Create at least one storage location before printing bin labels.'
    default:
      return 'Refresh the workspace and try again.'
  }
})

const hasLoadErrors = computed(() => Object.values(loadErrors).some(Boolean))
const loadErrorSummary = computed(() => Object.values(loadErrors).filter(Boolean).join(' · '))
const workspaceBusy = computed(() => loadingTemplates.value || loadingSources.value)
const recentJobs = computed(() => printJobs.value.slice(0, 4))

const getSelectionArray = (sourceKey) => {
  switch (sourceKey) {
    case 'po':
      return selectedPOLines.value
    case 'items':
      return selectedItems.value
    case 'lots':
      return selectedLots.value
    case 'bins':
      return selectedBins.value
    default:
      return []
  }
}

const setSelectionArray = (sourceKey, nextValue) => {
  switch (sourceKey) {
    case 'po':
      selectedPOLines.value = nextValue
      break
    case 'items':
      selectedItems.value = nextValue
      break
    case 'lots':
      selectedLots.value = nextValue
      break
    case 'bins':
      selectedBins.value = nextValue
      break
    default:
      break
  }
}

const selectedItemCount = computed(() => getSelectionArray(activeDataSourceTab.value).length)
const totalPrintCount = computed(() => selectedItemCount.value * Math.max(1, Number(printOptions.value.copies || 1)))
const canPrint = computed(() => Boolean(selectedTemplate.value && printType.value && selectedItemCount.value > 0))

const allCurrentSourceSelected = computed(() => {
  const visibleIds = currentSourceItems.value.map((item) => String(item.id))
  if (visibleIds.length === 0) return false

  const selectedIds = new Set(getSelectionArray(activeDataSourceTab.value).map((id) => String(id)))
  return visibleIds.every((id) => selectedIds.has(id))
})

watch(selectedTemplate, (template) => {
  if (!template) {
    printType.value = ''
    activeDataSourceTab.value = ''
    return
  }

  if (!template.printTypes?.includes(printType.value)) {
    printType.value = template.printTypes?.[0] || ''
  }
})

watch(printType, () => {
  if (!visibleSourceTabs.value.some((tab) => tab.key === activeDataSourceTab.value)) {
    activeDataSourceTab.value = visibleSourceTabs.value[0]?.key || ''
  }
})

onMounted(() => {
  void refreshWorkspace()
})

const loadTemplates = async () => {
  loadingTemplates.value = true
  loadErrors.templates = ''

  try {
    const response = await axios.get('/api/print-center/templates', authConfig())

    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to load templates.')
    }

    templates.value = response.data.data || []

    if (!templates.value.length) {
      selectedTemplate.value = null
      return
    }

    const stillExists = selectedTemplate.value && templates.value.find((template) => template.id === selectedTemplate.value.id)
    if (stillExists) {
      selectedTemplate.value = stillExists
    } else {
      selectedTemplate.value = templates.value[0]
    }
  } catch (error) {
    console.error('Failed to load templates:', error)
    templates.value = []
    selectedTemplate.value = null
    loadErrors.templates = extractErrorMessage(error, 'Templates could not be loaded.')
  } finally {
    loadingTemplates.value = false
  }
}

const loadPurchaseOrderLines = async () => {
  loadErrors.po = ''

  try {
    const response = await axios.get('/api/purchase/orders', {
      ...authConfig(),
      params: { limit: 100 }
    })

    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to load purchase orders.')
    }

    const orders = response.data.data.purchaseOrders || []
    poLines.value = orders.flatMap((order) => (order.lines || []).map((line) => ({
      ...line,
      po_number: order.po_number
    })))
    syncSelections(poLines.value, selectedPOLines)
  } catch (error) {
    console.error('Failed to load purchase order lines:', error)
    poLines.value = []
    selectedPOLines.value = []
    loadErrors.po = extractErrorMessage(error, 'Purchase data could not be loaded.')
  }
}

const loadInventoryItems = async () => {
  loadErrors.items = ''

  try {
    const response = await axios.get('/api/inventory-management/items', {
      ...authConfig(),
      params: { limit: 200, sortBy: 'sku' }
    })

    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to load items.')
    }

    inventoryItems.value = response.data.data.items || []
    syncSelections(inventoryItems.value, selectedItems)
  } catch (error) {
    console.error('Failed to load inventory items:', error)
    inventoryItems.value = []
    selectedItems.value = []
    loadErrors.items = extractErrorMessage(error, 'Item records could not be loaded.')
  }
}

const loadLots = async () => {
  loadErrors.lots = ''

  try {
    const response = await axios.get('/api/inventory-management/lots', authConfig())

    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to load lots.')
    }

    lots.value = response.data.data.lots || []
    syncSelections(lots.value, selectedLots)
  } catch (error) {
    console.error('Failed to load lots:', error)
    lots.value = []
    selectedLots.value = []
    loadErrors.lots = extractErrorMessage(error, 'Lot data could not be loaded.')
  }
}

const loadBins = async () => {
  loadErrors.bins = ''

  try {
    const response = await axios.get('/api/inventory-management/bins', authConfig())

    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to load bins.')
    }

    bins.value = response.data.data.bins || []
    syncSelections(bins.value, selectedBins)
  } catch (error) {
    console.error('Failed to load bins:', error)
    bins.value = []
    selectedBins.value = []
    loadErrors.bins = extractErrorMessage(error, 'Bin data could not be loaded.')
  }
}

const loadPrintJobsSnapshot = async (limit = 6) => {
  loadErrors.jobs = ''
  loadingJobs.value = true

  try {
    const response = await axios.get('/api/print-center/jobs', {
      ...authConfig(),
      params: { limit }
    })

    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to load print jobs.')
    }

    printJobs.value = response.data.data.jobs || []
  } catch (error) {
    console.error('Failed to load print jobs:', error)
    printJobs.value = []
    loadErrors.jobs = extractErrorMessage(error, 'Print history could not be loaded.')
  } finally {
    loadingJobs.value = false
  }
}

const loadPrintData = async () => {
  loadingSources.value = true
  await Promise.all([
    loadPurchaseOrderLines(),
    loadInventoryItems(),
    loadLots(),
    loadBins()
  ])
  loadingSources.value = false
}

const refreshWorkspace = async () => {
  await Promise.all([
    loadTemplates(),
    loadPrintData(),
    loadPrintJobsSnapshot()
  ])
}

const selectTemplate = (template) => {
  selectedTemplate.value = template
}

const isRecordSelected = (sourceKey, recordId) => {
  return getSelectionArray(sourceKey).includes(recordId)
}

const toggleRecordSelection = (sourceKey, recordId) => {
  const current = [...getSelectionArray(sourceKey)]
  const recordIndex = current.findIndex((id) => String(id) === String(recordId))

  if (recordIndex >= 0) {
    current.splice(recordIndex, 1)
  } else {
    current.push(recordId)
  }

  setSelectionArray(sourceKey, current)
}

const toggleSelectAllCurrentSource = () => {
  const sourceKey = activeDataSourceTab.value
  if (!sourceKey) return

  if (allCurrentSourceSelected.value) {
    setSelectionArray(sourceKey, [])
    return
  }

  setSelectionArray(sourceKey, currentSourceItems.value.map((item) => item.id))
}

const getSelectedItems = () => {
  switch (printType.value) {
    case 'LOT':
      if (activeDataSourceTab.value === 'po') {
        return selectedPOLines.value.map((id) => ({ po_line_id: id }))
      }
      return selectedLots.value.map((id) => ({ lot_id: id }))
    case 'BIN':
      return selectedBins.value.map((id) => ({ bin_id: id }))
    case 'ITEM':
      return selectedItems.value
        .map((id) => inventoryItems.value.find((item) => String(item.id) === String(id)))
        .filter(Boolean)
        .map((item) => ({
          item_id: item.id,
          sku: item.sku
        }))
    default:
      return []
  }
}

const clearSelections = () => {
  selectedPOLines.value = []
  selectedItems.value = []
  selectedLots.value = []
  selectedBins.value = []
}

const submitPrintJob = async () => {
  const items = getSelectedItems()

  if (!items.length || !selectedTemplate.value || !printType.value) {
    throw new Error('Select a template and at least one record before printing.')
  }

  const response = await axios.post('/api/print-center/print', {
    templateId: selectedTemplate.value.id,
    printType: printType.value,
    items,
    options: printOptions.value
  }, authConfig())

  if (!response.data.success) {
    throw new Error(response.data.message || 'Failed to build the print package.')
  }

  return response.data.data
}

const previewLabels = async () => {
  submittingAction.value = 'preview'

  try {
    const data = await submitPrintJob()
    window.open(resolveDownloadUrl(data.download_url), '_blank', 'noopener')
    showNotice('success', 'Preview Ready', `${data.total_count} labels were opened in a new browser tab.`)
    await loadPrintJobsSnapshot()
  } catch (error) {
    console.error('Preview failed:', error)
    showNotice('error', 'Preview Failed', extractErrorMessage(error, 'Please try again in a moment.'))
  } finally {
    submittingAction.value = ''
  }
}

const printLabels = async () => {
  submittingAction.value = 'print'

  try {
    const data = await submitPrintJob()
    const downloadUrl = resolveDownloadUrl(data.download_url)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = `${data.job_number}.pdf`
    link.click()

    clearSelections()
    showNotice('success', 'Print Package Ready', `${data.job_number} was generated and downloaded successfully.`)
    await loadPrintJobsSnapshot()
  } catch (error) {
    console.error('Print failed:', error)
    showNotice('error', 'Print Failed', extractErrorMessage(error, 'Please try again in a moment.'))
  } finally {
    submittingAction.value = ''
  }
}

const viewPrintHistory = async () => {
  showPrintHistory.value = true
  await loadPrintJobsSnapshot(20)
}

const closePrintHistory = () => {
  showPrintHistory.value = false
}

const downloadJob = (job) => {
  const downloadUrl = resolveDownloadUrl(job.output_file)
  if (!downloadUrl) {
    showNotice('error', 'Download Unavailable', 'This job does not have a downloadable file yet.')
    return
  }

  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = `${job.job_number}.pdf`
  link.click()
}

const reprintJob = async (job) => {
  submittingAction.value = `reprint:${job.id}`

  try {
    const response = await axios.post(`/api/print-center/jobs/${job.id}/reprint`, {}, authConfig())

    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to rebuild this print job.')
    }

    const downloadUrl = resolveDownloadUrl(response.data.data.download_url)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = `${response.data.data.job_number}.pdf`
    link.click()

    showNotice('success', 'Reprint Ready', `${response.data.data.job_number} has been generated again.`)
    await loadPrintJobsSnapshot(20)
  } catch (error) {
    console.error('Reprint failed:', error)
    showNotice('error', 'Reprint Failed', extractErrorMessage(error, 'Please try again in a moment.'))
  } finally {
    submittingAction.value = ''
  }
}

const templateDisplayName = (template) => {
  if (!template) return ''
  return templateDisplayMap[template.id]?.name || templateDisplayMap[template.name]?.name || template.name || template.id
}

const templateDisplayDescription = (template) => {
  if (!template) return ''
  return templateDisplayMap[template.id]?.description || templateDisplayMap[template.name]?.description || template.description || 'Reusable label format'
}

const templateIcon = (template) => {
  const firstType = template?.printTypes?.[0]
  if (firstType === 'LOT') return 'LOT'
  if (firstType === 'BIN') return 'BIN'
  if (firstType === 'ITEM') return 'SKU'
  return 'LBL'
}

const printTypeLabel = (type) => {
  const labelMap = {
    LOT: 'Lot Labels',
    BIN: 'Bin Labels',
    ITEM: 'Item Labels'
  }
  return labelMap[type] || type
}

const printTypeIcon = (type) => {
  const iconMap = {
    LOT: '◫',
    BIN: '⌂',
    ITEM: '▣'
  }
  return iconMap[type] || '•'
}

const formatPOStatus = (status) => {
  const statusMap = {
    OPEN: 'Open',
    PARTIAL: 'Partial',
    COMPLETED: 'Completed'
  }
  return statusMap[status] || status || 'Open'
}

const formatJobStatus = (status) => {
  const statusMap = {
    PENDING: 'Pending',
    PROCESSING: 'Processing',
    COMPLETED: 'Completed',
    FAILED: 'Failed'
  }
  return statusMap[status] || status
}

const jobStatusTone = (status) => {
  if (status === 'FAILED') return 'danger'
  if (status === 'COMPLETED') return 'good'
  if (status === 'PROCESSING') return 'neutral'
  return 'neutral'
}

const utilizationTone = (utilization) => {
  if (utilization >= 85) return 'danger'
  if (utilization >= 55) return 'medium'
  return 'good'
}

const formatZone = (zone) => {
  const normalized = String(zone || '').trim()
  if (normalized === 'A区') return 'Zone A'
  if (normalized === 'B区') return 'Zone B'
  if (normalized === 'C区') return 'Zone C'
  return normalized || 'Zone'
}

const formatDate = (value) => {
  if (!value) return 'Not set'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not set'

  return date.toLocaleDateString('en-US')
}

const formatDateTime = (value) => {
  if (!value) return 'Not set'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not set'

  return date.toLocaleString('en-US')
}
</script>

<style scoped>
.print-center {
  min-height: 100vh;
  padding: 24px;
  background:
    radial-gradient(circle at top left, rgba(96, 165, 250, 0.18), transparent 28%),
    radial-gradient(circle at top right, rgba(52, 211, 153, 0.14), transparent 26%),
    linear-gradient(180deg, #f6fbff 0%, #eef3f9 100%);
  color: #0f172a;
}

.hero-card,
.workspace-panel,
.inline-banner,
.history-modal {
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08);
}

.hero-card {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
  padding: 28px;
  border-radius: 30px;
}

.eyebrow,
.panel-eyebrow {
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #64748b;
}

.hero-copy h1,
.panel-topline h2,
.panel-topline h3,
.history-header h2 {
  margin: 0;
  font-size: clamp(1.65rem, 2vw, 2.45rem);
  line-height: 1.05;
  font-weight: 800;
}

.panel-topline h2,
.panel-topline h3,
.history-header h2 {
  font-size: 1.3rem;
}

.hero-text {
  max-width: 720px;
  margin: 14px 0 0;
  color: #475569;
  font-size: 1rem;
  line-height: 1.7;
}

.hero-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 24px;
}

.hero-metric {
  min-width: 110px;
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.hero-metric span,
.panel-meta,
.template-card-copy p,
.selection-note,
.summary-row span,
.meta-cell span,
.guide-item p,
.recent-job p,
.history-meta,
.notice-copy span,
.detail-row > span {
  color: #64748b;
}

.hero-metric span {
  display: block;
  font-size: 0.78rem;
}

.hero-metric strong {
  display: block;
  margin-top: 6px;
  font-size: 1.45rem;
}

.hero-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.primary-btn,
.ghost-btn,
.text-btn,
.icon-btn {
  border: none;
  border-radius: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.primary-btn:hover,
.ghost-btn:hover,
.text-btn:hover,
.icon-btn:hover {
  transform: translateY(-1px);
}

.primary-btn:disabled,
.ghost-btn:disabled,
.text-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  transform: none;
}

.primary-btn {
  padding: 14px 18px;
  background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%);
  color: white;
  box-shadow: 0 14px 28px rgba(29, 78, 216, 0.24);
}

.ghost-btn {
  padding: 14px 18px;
  background: rgba(255, 255, 255, 0.78);
  color: #0f172a;
  border: 1px solid rgba(148, 163, 184, 0.24);
}

.ghost-btn.small,
.primary-btn.small {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 0.92rem;
}

.wide {
  width: 100%;
  justify-content: center;
}

.inline-banner {
  margin-top: 16px;
  padding: 16px 18px;
  border-radius: 22px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.inline-banner.info {
  color: #1d4ed8;
}

.inline-banner.error {
  background: rgba(255, 241, 242, 0.84);
  color: #be123c;
}

.inline-banner.success {
  background: rgba(236, 253, 245, 0.88);
  color: #047857;
}

.notice-copy {
  display: grid;
  gap: 4px;
}

.notice-close,
.text-btn,
.icon-btn {
  background: transparent;
  color: inherit;
}

.notice-close {
  padding: 0;
  font-size: 0.92rem;
  font-weight: 700;
}

.print-layout {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr) 340px;
  gap: 20px;
  margin-top: 20px;
  align-items: start;
}

.workspace-panel {
  border-radius: 30px;
  padding: 22px;
}

.template-panel,
.action-panel {
  position: sticky;
  top: 18px;
}

.panel-topline {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 18px;
}

.panel-topline.compact {
  margin-bottom: 16px;
}

.template-grid,
.source-list,
.recent-list,
.history-list {
  display: grid;
  gap: 14px;
}

.template-card,
.source-card,
.template-detail-card,
.action-card,
.summary-card,
.primary-actions-card,
.guide-card,
.recent-card,
.history-card {
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(255, 255, 255, 0.74);
}

.template-card {
  width: 100%;
  padding: 16px;
  text-align: left;
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.template-card:hover,
.source-card:hover {
  transform: translateY(-2px);
  border-color: rgba(59, 130, 246, 0.28);
  box-shadow: 0 14px 28px rgba(148, 163, 184, 0.18);
}

.template-card.active {
  border-color: rgba(37, 99, 235, 0.3);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.88) 0%, rgba(239, 246, 255, 0.86) 100%);
}

.template-card-top,
.record-title-row,
.history-top,
.history-actions {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.template-badge,
.template-size-pill,
.support-pill,
.field-pill,
.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.template-badge {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.14), rgba(15, 23, 42, 0.08));
  font-size: 0.82rem;
  font-weight: 800;
  color: #0f172a;
}

.template-size-pill,
.support-pill,
.field-pill,
.status-pill {
  padding: 7px 10px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
}

.template-size-pill,
.field-pill,
.status-pill.neutral {
  background: rgba(241, 245, 249, 0.92);
  color: #334155;
}

.support-pill,
.status-pill.good {
  background: rgba(219, 234, 254, 0.92);
  color: #1d4ed8;
}

.status-pill.danger {
  background: rgba(255, 228, 230, 0.92);
  color: #be123c;
}

.status-pill.medium {
  background: rgba(254, 240, 138, 0.92);
  color: #a16207;
}

.template-card-copy {
  margin-top: 14px;
}

.template-card-copy strong,
.source-card strong,
.summary-row strong,
.guide-item strong,
.recent-job strong,
.history-card strong {
  color: #0f172a;
}

.template-card-copy p,
.template-detail-copy,
.empty-state span,
.guide-item p,
.recent-job p,
.record-title-row p,
.history-top p {
  margin: 6px 0 0;
  line-height: 1.55;
}

.template-support,
.detail-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.template-support {
  margin-top: 14px;
}

.template-detail-card,
.action-card,
.summary-card,
.primary-actions-card,
.guide-card,
.recent-card {
  margin-top: 18px;
  padding: 18px;
}

.detail-row,
.summary-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.detail-row + .detail-row,
.summary-row + .summary-row,
.guide-item + .guide-item,
.recent-job + .recent-job {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid rgba(226, 232, 240, 0.9);
}

.detail-size {
  padding: 8px 10px;
  border-radius: 14px;
  background: rgba(241, 245, 249, 0.9);
  font-size: 0.82rem;
  font-weight: 700;
  color: #334155;
}

.type-switcher,
.source-tabs,
.source-toolbar,
.option-grid {
  display: grid;
  gap: 12px;
}

.type-switcher {
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
}

.type-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(255, 255, 255, 0.72);
  cursor: pointer;
  font-weight: 700;
  color: #334155;
  transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
}

.type-chip.active {
  border-color: rgba(59, 130, 246, 0.24);
  background: linear-gradient(135deg, rgba(219, 234, 254, 0.92), rgba(255, 255, 255, 0.92));
  color: #0f172a;
}

.source-tabs {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  margin-top: 18px;
}

.source-tab {
  padding: 16px;
  text-align: left;
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(255, 255, 255, 0.68);
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease;
}

.source-tab.active {
  border-color: rgba(59, 130, 246, 0.24);
  background: rgba(239, 246, 255, 0.9);
}

.source-tab span {
  display: block;
  margin-top: 6px;
  color: #64748b;
  line-height: 1.45;
}

.source-toolbar {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  margin: 18px 0;
}

.search-shell {
  position: relative;
}

.search-input,
.option-input {
  width: 100%;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.82);
  color: #0f172a;
  font-size: 0.98rem;
  padding: 14px 16px;
  box-sizing: border-box;
}

.search-input:focus,
.option-input:focus {
  outline: none;
  border-color: rgba(59, 130, 246, 0.35);
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.08);
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.source-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 14px;
  padding: 16px;
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.source-card.selected {
  border-color: rgba(37, 99, 235, 0.28);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(239, 246, 255, 0.9));
}

.record-check {
  position: relative;
  width: 22px;
  height: 22px;
  margin-top: 2px;
}

.record-check input {
  position: absolute;
  opacity: 0;
  inset: 0;
  cursor: pointer;
}

.record-check span {
  display: block;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  border: 1.5px solid rgba(148, 163, 184, 0.4);
  background: rgba(255, 255, 255, 0.9);
  box-sizing: border-box;
}

.record-check input:checked + span {
  border-color: #2563eb;
  background: radial-gradient(circle at center, #2563eb 0 42%, white 46%);
}

.record-content {
  min-width: 0;
}

.record-title-row p,
.history-top p {
  font-size: 0.88rem;
}

.record-meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.record-meta-grid.bin-grid {
  margin-top: 12px;
}

.meta-cell {
  padding: 10px 12px;
  border-radius: 16px;
  background: rgba(248, 250, 252, 0.86);
}

.meta-cell strong {
  display: block;
  margin-top: 4px;
}

.utilization-track {
  height: 10px;
  margin-top: 14px;
  border-radius: 999px;
  background: rgba(226, 232, 240, 0.88);
  overflow: hidden;
}

.utilization-fill {
  height: 100%;
  border-radius: inherit;
}

.utilization-fill.good {
  background: linear-gradient(90deg, #60a5fa, #2563eb);
}

.utilization-fill.medium {
  background: linear-gradient(90deg, #fbbf24, #f59e0b);
}

.utilization-fill.danger {
  background: linear-gradient(90deg, #fb7185, #e11d48);
}

.option-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.option-field {
  display: grid;
  gap: 8px;
}

.option-field span,
.output-note span {
  font-size: 0.85rem;
  font-weight: 700;
  color: #64748b;
}

.output-note {
  margin-top: 14px;
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.86);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.primary-actions-card {
  display: grid;
  gap: 12px;
}

.guide-item code {
  padding: 3px 7px;
  border-radius: 10px;
  background: rgba(241, 245, 249, 0.94);
  font-family: 'SF Mono', SFMono-Regular, ui-monospace, monospace;
  font-size: 0.82rem;
}

.recent-job,
.history-card {
  padding: 16px;
}

.text-btn {
  padding: 0;
  font-size: 0.92rem;
  font-weight: 700;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.38);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 1200;
  padding: 20px;
  box-sizing: border-box;
}

.history-modal {
  width: min(860px, 100%);
  max-height: min(88vh, 920px);
  border-radius: 30px;
  padding: 22px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 18px;
}

.icon-btn {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  font-size: 1.35rem;
}

.history-list {
  overflow-y: auto;
  padding-right: 4px;
}

.history-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
  font-size: 0.88rem;
}

.empty-state {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 32px 20px;
  text-align: center;
  border-radius: 22px;
  border: 1px dashed rgba(148, 163, 184, 0.26);
  background: rgba(248, 250, 252, 0.78);
}

.empty-state.large {
  min-height: 260px;
  place-content: center;
}

.empty-state.compact {
  padding: 20px 14px;
}

@media (max-width: 1360px) {
  .print-layout {
    grid-template-columns: minmax(0, 1fr) 320px;
  }

  .template-panel {
    grid-column: 1 / -1;
    position: static;
  }
}

@media (max-width: 960px) {
  .print-center {
    padding: 16px;
  }

  .hero-card {
    flex-direction: column;
    border-radius: 26px;
  }

  .hero-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .hero-actions .ghost-btn,
  .hero-actions .primary-btn {
    flex: 1;
    justify-content: center;
  }

  .print-layout {
    grid-template-columns: 1fr;
  }

  .action-panel,
  .template-panel {
    position: static;
  }

  .source-toolbar,
  .option-grid {
    grid-template-columns: 1fr;
  }

  .toolbar-actions {
    justify-content: space-between;
  }
}

@media (max-width: 640px) {
  .print-center {
    padding: 12px;
  }

  .hero-card,
  .workspace-panel,
  .history-modal {
    border-radius: 24px;
  }

  .hero-metrics {
    grid-template-columns: 1fr 1fr;
  }

  .type-switcher,
  .source-tabs,
  .record-meta-grid {
    grid-template-columns: 1fr;
  }

  .hero-actions,
  .toolbar-actions,
  .history-actions {
    flex-direction: column;
    width: 100%;
  }

  .ghost-btn,
  .primary-btn {
    width: 100%;
  }

  .record-title-row,
  .panel-topline,
  .history-top,
  .history-header {
    flex-direction: column;
    align-items: stretch;
  }

  .history-modal {
    max-height: calc(100dvh - 24px);
    padding: 18px;
  }
}
</style>
