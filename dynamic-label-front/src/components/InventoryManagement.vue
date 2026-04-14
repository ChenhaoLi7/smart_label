<template>
  <div class="inventory-management">
    <div class="ambient ambient-one"></div>
    <div class="ambient ambient-two"></div>
    <div class="ambient ambient-three"></div>

    <div v-if="!isMobile" class="desktop-layout">
      <div class="page-back-row">
        <button @click="goBack" class="page-back-btn" aria-label="Back to dashboard">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span>Back to Dashboard</span>
        </button>
      </div>

      <section class="hero-panel glass-panel">
        <div class="hero-copy">
          <p class="eyebrow">Inventory Atlas</p>
          <h1>Stock Control Center</h1>
          <p class="hero-subtitle">
            A calmer, more readable command surface for items, lots, bins, and movement history.
          </p>

          <div class="hero-pills">
            <div class="hero-pill">
              <span>Today</span>
              <strong>{{ formattedToday }}</strong>
            </div>
            <div class="hero-pill">
              <span>Last Sync</span>
              <strong>{{ lastUpdatedLabel }}</strong>
            </div>
            <div class="hero-pill">
              <span>Inventory Health</span>
              <strong>{{ inventoryHealthText }}</strong>
            </div>
          </div>
        </div>

        <div class="hero-actions">
          <button @click="refreshData" class="btn btn-glass">
            <span>Refresh</span>
          </button>
          <button @click="exportData" class="btn btn-glass">
            <span>Export</span>
          </button>
          <button @click="showBarcodeLookup = true" class="btn btn-primary">
            <span>New Item</span>
          </button>
        </div>
      </section>

      <section class="overview-grid">
        <article
          v-for="card in statCards"
          :key="card.label"
          class="metric-card glass-panel"
          :class="card.tone"
        >
          <div class="metric-topline">
            <span class="metric-icon">{{ card.icon }}</span>
            <span class="metric-badge">{{ card.badge }}</span>
          </div>
          <strong class="metric-value">{{ card.value }}</strong>
          <span class="metric-label">{{ card.label }}</span>
          <p class="metric-note">{{ card.note }}</p>
        </article>

        <article class="signal-card glass-panel">
          <div class="signal-header">
            <div>
              <p class="eyebrow">Attention Layer</p>
              <h2>What this inventory is telling you</h2>
            </div>
            <span class="signal-chip">{{ activeRowCount }} visible rows</span>
          </div>

          <div class="signal-list">
            <div v-for="signal in quickSignals" :key="signal.label" class="signal-row">
              <div class="signal-copy">
                <strong>{{ signal.label }}</strong>
                <p>{{ signal.note }}</p>
              </div>
              <span class="signal-value" :class="signal.tone">{{ signal.value }}</span>
            </div>
          </div>
        </article>
      </section>

      <section class="workspace-panel glass-panel">
        <div class="workspace-header">
          <div>
            <p class="eyebrow">Current Workspace</p>
            <h2>{{ activeTabMeta.title }}</h2>
            <p class="workspace-subtitle">{{ activeTabMeta.description }}</p>
          </div>

          <div class="workspace-tools">
            <label class="field-shell search-shell">
              <span class="field-label">Search</span>
              <input
                v-model="searchQuery"
                :placeholder="activeTabMeta.searchPlaceholder"
                class="field-input"
              >
            </label>

            <label class="field-shell">
              <span class="field-label">Sort</span>
              <select v-model="sortBy" class="field-input select-input">
                <option
                  v-for="option in activeSortOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </label>
          </div>
        </div>

        <div class="tab-bar">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            @click="activeTab = tab.key"
            :class="['tab-btn', { active: activeTab === tab.key }]"
          >
            {{ tab.label }}
          </button>
        </div>

        <div v-if="loadError" class="state-banner error">
          {{ loadError }}
        </div>
        <div v-else-if="feedbackMessage" class="state-banner" :class="feedbackType">
          {{ feedbackMessage }}
        </div>
        <div v-else-if="isLoading" class="state-banner info">
          Syncing inventory data...
        </div>

        <div class="table-shell">
          <div v-if="activeTab === 'items'" class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Item</th>
                  <th>Total Qty</th>
                  <th>Available</th>
                  <th>Bin Count</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="filteredItems.length === 0">
                  <td colspan="7">
                    <div class="empty-state">
                      <strong>No items found</strong>
                      <p>Try changing the search keyword or add your first item.</p>
                    </div>
                  </td>
                </tr>
                <tr v-for="item in filteredItems" :key="item.sku">
                  <td><span class="mono-pill">{{ item.sku }}</span></td>
                  <td>
                    <div class="cell-stack">
                      <strong>{{ item.name }}</strong>
                      <small>{{ formatItemMeta(item) }}</small>
                    </div>
                  </td>
                  <td>{{ item.totalQty }}</td>
                  <td>{{ item.availableQty }}</td>
                  <td>{{ item.binCount }} bins</td>
                  <td>
                    <span :class="['status-badge', item.status]">
                      {{ getStatusText(item.status) }}
                    </span>
                  </td>
                  <td class="action-cell">
                    <button @click="openEditItemModal(item)" class="row-action ghost">Edit</button>
                    <button @click="printItemLabel(item)" class="row-action primary">Print</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-else-if="activeTab === 'lots'" class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Lot Number</th>
                  <th>SKU</th>
                  <th>Quantity</th>
                  <th>Bin</th>
                  <th>Expiry Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="filteredLots.length === 0">
                  <td colspan="7">
                    <div class="empty-state">
                      <strong>No lots found</strong>
                      <p>Lots will appear here once inbound or production creates batches.</p>
                    </div>
                  </td>
                </tr>
                <tr v-for="lot in filteredLots" :key="lot.id">
                  <td>
                    <div class="cell-stack">
                      <strong class="mono-inline">{{ lot.lot }}</strong>
                      <small>{{ lot.item?.name || 'Traceable batch' }}</small>
                    </div>
                  </td>
                  <td><span class="mono-pill">{{ lot.sku }}</span></td>
                  <td>{{ lot.qty }} {{ lot.uom }}</td>
                  <td>{{ lot.bin }}</td>
                  <td><span :class="getExpiryClass(lot.exp)">{{ formatDate(lot.exp) }}</span></td>
                  <td>
                    <span :class="['status-badge', lot.status]">
                      {{ getStatusText(lot.status) }}
                    </span>
                  </td>
                  <td class="action-cell">
                    <button @click="openEditLotModal(lot)" class="row-action primary">Edit</button>
                    <button @click="openCountModal(lot)" class="row-action warning">Count</button>
                    <button @click="viewLotDetails(lot)" class="row-action ghost">Details</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-else-if="activeTab === 'bins'" class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Bin Code</th>
                  <th>Zone</th>
                  <th>Capacity</th>
                  <th>Used</th>
                  <th>Utilization</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="filteredBins.length === 0">
                  <td colspan="7">
                    <div class="empty-state">
                      <strong>No bins found</strong>
                      <p>Create warehouse locations to make stock movement easier to trace.</p>
                    </div>
                  </td>
                </tr>
                <tr v-for="bin in filteredBins" :key="bin.id">
                  <td><span class="mono-pill">{{ bin.bin_code }}</span></td>
                  <td>{{ bin.zone }}</td>
                  <td>{{ bin.capacity }}</td>
                  <td>{{ bin.used }}</td>
                  <td>
                    <div class="utilization-stack">
                      <div class="utilization-bar">
                        <div
                          :class="['utilization-fill', getUtilizationClass(bin.utilization)]"
                          :style="{ width: `${bin.utilization}%` }"
                        ></div>
                      </div>
                      <span class="utilization-text">{{ bin.utilization }}%</span>
                    </div>
                  </td>
                  <td>
                    <span :class="['status-badge', bin.status]">
                      {{ getStatusText(bin.status) }}
                    </span>
                  </td>
                  <td class="action-cell">
                    <button @click="viewBinDetails(bin)" class="row-action ghost">Details</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-else class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type</th>
                  <th>SKU</th>
                  <th>Quantity</th>
                  <th>Location</th>
                  <th>User</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="filteredTransactions.length === 0">
                  <td colspan="8">
                    <div class="empty-state">
                      <strong>No transaction history</strong>
                      <p>Inbound, outbound, and count records will appear here automatically.</p>
                    </div>
                  </td>
                </tr>
                <tr v-for="txn in filteredTransactions" :key="txn.id">
                  <td>{{ formatDateTime(txn.timestamp) }}</td>
                  <td>
                    <span :class="['type-badge', txn.type]">
                      {{ getTransactionTypeText(txn.type) }}
                    </span>
                  </td>
                  <td><span class="mono-pill">{{ txn.sku }}</span></td>
                  <td>{{ txn.qty }} {{ txn.uom }}</td>
                  <td>{{ txn.bin }}</td>
                  <td>{{ txn.user }}</td>
                  <td>
                    <span :class="['status-badge', txn.status]">
                      {{ getStatusText(txn.status) }}
                    </span>
                  </td>
                  <td class="action-cell">
                    <button @click="viewTransactionDetails(txn)" class="row-action ghost">Details</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>

    <div v-else class="mobile-layout">
      <div class="mobile-back-row">
        <button @click="goBack" class="page-back-btn mobile-back-btn" aria-label="Back to dashboard">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span>Back</span>
        </button>
      </div>

      <section class="mobile-hero glass-panel">
        <div>
          <p class="eyebrow">Inventory Atlas</p>
          <h2>Stock Control</h2>
          <p>{{ inventoryHealthText }} · {{ lastUpdatedLabel }}</p>
        </div>
        <div class="mobile-hero-actions">
          <button @click="refreshData" class="mobile-chip">Refresh</button>
          <button @click="exportData" class="mobile-chip">Export</button>
        </div>
      </section>

      <section class="mobile-stat-grid">
        <article v-for="card in statCards" :key="card.label" class="mobile-stat-card glass-panel">
          <span class="mobile-stat-icon">{{ card.icon }}</span>
          <div>
            <strong>{{ card.value }}</strong>
            <span>{{ card.label }}</span>
          </div>
        </article>
      </section>

      <div class="mobile-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          @click="activeTab = tab.key"
          :class="['mobile-tab-btn', { active: activeTab === tab.key }]"
        >
          {{ tab.label }}
        </button>
      </div>

      <section class="mobile-toolbar glass-panel">
        <input
          v-model="searchQuery"
          :placeholder="activeTabMeta.searchPlaceholder"
          class="mobile-search-input"
        >
        <select v-model="sortBy" class="mobile-sort-select">
          <option v-for="option in activeSortOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </section>

      <div v-if="loadError" class="state-banner error mobile-state">
        {{ loadError }}
      </div>
      <div v-else-if="feedbackMessage" class="state-banner mobile-state" :class="feedbackType">
        {{ feedbackMessage }}
      </div>
      <div v-else-if="isLoading" class="state-banner info mobile-state">
        Syncing inventory data...
      </div>

      <div class="mobile-list">
        <div v-if="activeTab === 'items'" class="list-stack">
          <div v-if="filteredItems.length === 0" class="mobile-empty glass-panel">
            <strong>No items found</strong>
            <p>Try another keyword or create a new item.</p>
          </div>
          <article v-for="item in filteredItems" :key="item.sku" class="mobile-card glass-panel">
            <div class="mobile-card-top">
              <div>
                <strong>{{ item.name }}</strong>
                <p>{{ item.sku }} · {{ formatItemMeta(item) }}</p>
              </div>
              <span :class="['status-badge', item.status]">{{ getStatusText(item.status) }}</span>
            </div>
            <div class="mobile-info-grid">
              <div>
                <span>Total</span>
                <strong>{{ item.totalQty }}</strong>
              </div>
              <div>
                <span>Available</span>
                <strong>{{ item.availableQty }}</strong>
              </div>
              <div>
                <span>Bins</span>
                <strong>{{ item.binCount }}</strong>
              </div>
            </div>
            <div class="mobile-action-row">
              <button @click="openEditItemModal(item)" class="row-action ghost">Edit</button>
              <button @click="printItemLabel(item)" class="row-action primary">Print</button>
            </div>
          </article>
        </div>

        <div v-else-if="activeTab === 'lots'" class="list-stack">
          <div v-if="filteredLots.length === 0" class="mobile-empty glass-panel">
            <strong>No lots found</strong>
            <p>Batch records will show up here after inbound or production.</p>
          </div>
          <article v-for="lot in filteredLots" :key="lot.id" class="mobile-card glass-panel" @click="viewLotDetails(lot)">
            <div class="mobile-card-top">
              <div>
                <strong>{{ lot.lot }}</strong>
                <p>{{ lot.sku }}</p>
              </div>
              <span :class="['status-badge', lot.status]">{{ getStatusText(lot.status) }}</span>
            </div>
            <div class="mobile-info-grid">
              <div>
                <span>Qty</span>
                <strong>{{ lot.qty }} {{ lot.uom }}</strong>
              </div>
              <div>
                <span>Bin</span>
                <strong>{{ lot.bin }}</strong>
              </div>
              <div>
                <span>Expiry</span>
                <strong :class="getExpiryClass(lot.exp)">{{ formatDate(lot.exp) }}</strong>
              </div>
            </div>
            <div class="mobile-action-row">
              <button @click.stop="openEditLotModal(lot)" class="row-action primary">Edit</button>
              <button @click.stop="openCountModal(lot)" class="row-action warning">Count</button>
              <button @click.stop="viewLotDetails(lot)" class="row-action ghost">Details</button>
            </div>
          </article>
        </div>

        <div v-else-if="activeTab === 'bins'" class="list-stack">
          <div v-if="filteredBins.length === 0" class="mobile-empty glass-panel">
            <strong>No bins found</strong>
            <p>Warehouse locations will appear here once configured.</p>
          </div>
          <article v-for="bin in filteredBins" :key="bin.id" class="mobile-card glass-panel" @click="viewBinDetails(bin)">
            <div class="mobile-card-top">
              <div>
                <strong>{{ bin.bin_code }}</strong>
                <p>{{ bin.zone }}</p>
              </div>
              <span :class="['status-badge', bin.status]">{{ getStatusText(bin.status) }}</span>
            </div>
            <div class="mobile-info-grid">
              <div>
                <span>Capacity</span>
                <strong>{{ bin.capacity }}</strong>
              </div>
              <div>
                <span>Used</span>
                <strong>{{ bin.used }}</strong>
              </div>
              <div>
                <span>Utilization</span>
                <strong>{{ bin.utilization }}%</strong>
              </div>
            </div>
            <div class="utilization-bar mobile-bar">
              <div
                :class="['utilization-fill', getUtilizationClass(bin.utilization)]"
                :style="{ width: `${bin.utilization}%` }"
              ></div>
            </div>
          </article>
        </div>

        <div v-else class="list-stack">
          <div v-if="filteredTransactions.length === 0" class="mobile-empty glass-panel">
            <strong>No transaction history</strong>
            <p>Inventory activity will appear here when operations happen.</p>
          </div>
          <article v-for="txn in filteredTransactions" :key="txn.id" class="mobile-card glass-panel" @click="viewTransactionDetails(txn)">
            <div class="mobile-card-top">
              <span :class="['type-badge', txn.type]">{{ getTransactionTypeText(txn.type) }}</span>
              <p class="mobile-time">{{ formatDateTime(txn.timestamp) }}</p>
            </div>
            <div class="mobile-info-grid">
              <div>
                <span>SKU</span>
                <strong>{{ txn.sku }}</strong>
              </div>
              <div>
                <span>Qty</span>
                <strong>{{ txn.qty }} {{ txn.uom }}</strong>
              </div>
              <div>
                <span>User</span>
                <strong>{{ txn.user }}</strong>
              </div>
            </div>
            <div class="mobile-action-row">
              <button @click.stop="viewTransactionDetails(txn)" class="row-action ghost">Details</button>
            </div>
          </article>
        </div>
      </div>
    </div>

    <div v-if="showDetailsModal" class="modal-overlay" @click="closeDetailsModal">
      <div class="modal-content glass-panel" @click.stop>
        <div class="modal-header">
          <div>
            <p class="eyebrow">Structured Detail</p>
            <h3>{{ detailsModalTitle }}</h3>
          </div>
          <button @click="closeDetailsModal" class="close-btn">&times;</button>
        </div>
        <div class="modal-body detail-body" v-if="selectedItem">
          <section class="detail-hero">
            <div>
              <p class="detail-hero-label">{{ detailHero.kicker }}</p>
              <h4>{{ detailHero.title }}</h4>
              <p>{{ detailHero.subtitle }}</p>
            </div>
            <span :class="detailHero.badgeClass">{{ detailHero.badgeText }}</span>
          </section>

          <section class="detail-grid">
            <article v-for="section in detailSections" :key="section.title" class="detail-card">
              <div class="detail-card-head">
                <p class="eyebrow">{{ section.title }}</p>
              </div>
              <div class="detail-list">
                <div v-for="field in section.fields" :key="field.label" class="detail-row">
                  <span>{{ field.label }}</span>
                  <strong :class="field.tone || ''">{{ field.value }}</strong>
                </div>
              </div>
            </article>
          </section>
        </div>
      </div>
    </div>

    <div v-if="showEditItemModal" class="modal-overlay" @click="closeEditItemModal">
      <div class="modal-content glass-panel edit-item-modal" @click.stop>
        <div class="modal-header">
          <div>
            <p class="eyebrow">Item Editor</p>
            <h3>Edit SKU</h3>
          </div>
          <button @click="closeEditItemModal" class="close-btn">&times;</button>
        </div>
        <div class="modal-body edit-item-body">
          <div class="edit-hint">
            <strong>Linked records stay in sync.</strong>
            <p>If you change the SKU code, linked lots and inventory history will be updated together.</p>
          </div>

          <div class="edit-form-grid">
            <label class="edit-field">
              <span>SKU Code</span>
              <input v-model="editItemForm.sku" class="field-input" placeholder="e.g. WATER-500ML">
            </label>

            <label class="edit-field">
              <span>Item Name</span>
              <input v-model="editItemForm.name" class="field-input" placeholder="e.g. Kirkland Water 500ml">
            </label>

            <label class="edit-field">
              <span>Category</span>
              <input v-model="editItemForm.category" class="field-input" placeholder="e.g. Beverages">
            </label>

            <label class="edit-field">
              <span>Unit</span>
              <select v-model="editItemForm.uom" class="field-input select-input">
                <option value="pcs">pcs</option>
                <option value="can">can</option>
                <option value="bottle">bottle</option>
                <option value="box">box</option>
                <option value="pack">pack</option>
                <option value="kg">kg</option>
                <option value="L">L</option>
              </select>
            </label>

            <label class="edit-field">
              <span>Price</span>
              <input v-model="editItemForm.price" type="number" min="0" step="0.01" class="field-input" placeholder="Optional">
            </label>

            <label class="edit-field">
              <span>Status</span>
              <select v-model="editItemForm.status" class="field-input select-input">
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="DISCONTINUED">Discontinued</option>
              </select>
            </label>

            <label class="edit-field">
              <span>Min Stock</span>
              <input v-model="editItemForm.min_stock" type="number" min="0" class="field-input" placeholder="0">
            </label>

            <label class="edit-field">
              <span>Max Stock</span>
              <input v-model="editItemForm.max_stock" type="number" min="0" class="field-input" placeholder="Optional">
            </label>

            <label class="edit-field edit-field-full">
              <span>Description</span>
              <textarea
                v-model="editItemForm.description"
                class="field-input field-textarea"
                rows="4"
                placeholder="Brand, notes, or supplier details"
              ></textarea>
            </label>
          </div>

          <div class="edit-actions">
            <button @click="closeEditItemModal" class="btn btn-glass">Cancel</button>
            <button @click="saveItemEdits" class="btn btn-primary" :disabled="isSavingItem">
              <span>{{ isSavingItem ? 'Saving...' : 'Save Changes' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showCountModal" class="modal-overlay" @click="closeCountModal">
      <div class="modal-content glass-panel edit-item-modal" @click.stop>
        <div class="modal-header">
          <div>
            <p class="eyebrow">Cycle Count</p>
            <h3>Adjust Actual Quantity</h3>
          </div>
          <button @click="closeCountModal" class="close-btn">&times;</button>
        </div>
        <div class="modal-body edit-item-body">
          <div class="edit-hint">
            <strong>Use the real counted quantity from the warehouse.</strong>
            <p>The system will calculate the difference and write an audit record automatically.</p>
          </div>

          <div class="edit-form-grid">
            <label class="edit-field">
              <span>Lot Number</span>
              <input :value="countForm.lot_number" class="field-input" disabled>
            </label>

            <label class="edit-field">
              <span>SKU</span>
              <input :value="countForm.sku" class="field-input" disabled>
            </label>

            <label class="edit-field">
              <span>Current Qty</span>
              <input :value="countForm.current_qty" class="field-input" disabled>
            </label>

            <label class="edit-field">
              <span>Actual Qty</span>
              <input v-model="countForm.actual_qty" type="number" min="0" class="field-input" placeholder="Enter counted quantity">
            </label>

            <label class="edit-field edit-field-full">
              <span>Reason</span>
              <textarea
                v-model="countForm.reason"
                class="field-input field-textarea"
                rows="3"
                placeholder="e.g. Weekly count / Broken bottle / Restock mismatch"
              ></textarea>
            </label>
          </div>

          <div v-if="countDeltaLabel" class="count-preview">
            <span>Adjustment Preview</span>
            <strong :class="countDeltaTone">{{ countDeltaLabel }}</strong>
          </div>

          <div class="edit-actions">
            <button @click="closeCountModal" class="btn btn-glass">Cancel</button>
            <button @click="submitCountAdjustment" class="btn btn-primary" :disabled="isSubmittingCount">
              <span>{{ isSubmittingCount ? 'Saving...' : 'Save Count' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showEditLotModal" class="modal-overlay" @click="closeEditLotModal">
      <div class="modal-content glass-panel edit-item-modal" @click.stop>
        <div class="modal-header">
          <div>
            <p class="eyebrow">Lot Editor</p>
            <h3>Edit Expiry Date</h3>
          </div>
          <button @click="closeEditLotModal" class="close-btn">&times;</button>
        </div>
        <div class="modal-body edit-item-body">
          <div class="edit-hint">
            <strong>Keep lot traceability accurate.</strong>
            <p>Use this to update the real expiry date for a specific batch after receiving or recounting stock.</p>
          </div>

          <div class="edit-form-grid">
            <label class="edit-field">
              <span>Lot Number</span>
              <input :value="editLotForm.lot_number" class="field-input" disabled>
            </label>

            <label class="edit-field">
              <span>SKU</span>
              <input :value="editLotForm.sku" class="field-input" disabled>
            </label>

            <label class="edit-field">
              <span>Current Bin</span>
              <input :value="editLotForm.bin" class="field-input" disabled>
            </label>

            <label class="edit-field">
              <span>Quantity</span>
              <input :value="`${editLotForm.qty} ${editLotForm.uom}`" class="field-input" disabled>
            </label>

            <label class="edit-field edit-field-full">
              <span>Expiry Date</span>
              <input v-model="editLotForm.expiry_date" type="date" class="field-input">
              <small class="field-footnote">Leave blank if this batch has no expiry date.</small>
            </label>
          </div>

          <div class="edit-actions">
            <button @click="closeEditLotModal" class="btn btn-glass">Cancel</button>
            <button @click="saveLotEdits" class="btn btn-primary" :disabled="isSavingLot">
              <span>{{ isSavingLot ? 'Saving...' : 'Save Changes' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <BarcodeItemLookup
      v-if="showBarcodeLookup"
      @close="showBarcodeLookup = false"
      @item-created="onItemCreated"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import BarcodeItemLookup from './BarcodeItemLookup.vue'

const router = useRouter()
const showBarcodeLookup = ref(false)
const onItemCreated = () => {
  showBarcodeLookup.value = false
  refreshData()
}

const goBack = () => {
  router.push('/dashboard')
}

const activeTab = ref('items')
const searchQuery = ref('')
const sortBy = ref('sku')
const showDetailsModal = ref(false)
const selectedItem = ref(null)
const detailsModalTitle = ref('')
const showEditItemModal = ref(false)
const isSavingItem = ref(false)
const showEditLotModal = ref(false)
const isSavingLot = ref(false)
const showCountModal = ref(false)
const isSubmittingCount = ref(false)
const isMobile = ref(false)
const isLoading = ref(false)
const loadError = ref('')
const feedbackMessage = ref('')
const feedbackType = ref('success')
const lastUpdated = ref('')
let feedbackTimeout = null
const editItemForm = ref({
  originalSku: '',
  sku: '',
  name: '',
  description: '',
  category: '',
  uom: 'pcs',
  price: '',
  min_stock: 0,
  max_stock: '',
  status: 'ACTIVE'
})
const editLotForm = ref({
  lot_number: '',
  sku: '',
  qty: 0,
  uom: 'pcs',
  bin: '',
  expiry_date: ''
})
const countForm = ref({
  lot_number: '',
  sku: '',
  current_qty: 0,
  actual_qty: 0,
  reason: 'Cycle Count'
})

const stats = ref({
  totalItems: 0,
  totalLots: 0,
  totalBins: 0,
  lowStock: 0
})

const items = ref([])
const lots = ref([])
const bins = ref([])
const transactions = ref([])

const tabs = [
  { key: 'items', label: 'Items' },
  { key: 'lots', label: 'Lots' },
  { key: 'bins', label: 'Bins' },
  { key: 'transactions', label: 'History' }
]

const sortOptionsMap = {
  items: [
    { value: 'sku', label: 'Sort by SKU' },
    { value: 'name', label: 'Sort by Name' },
    { value: 'price', label: 'Sort by Price' },
    { value: 'totalQty', label: 'Sort by Quantity' }
  ],
  lots: [
    { value: 'lot', label: 'Sort by Lot Number' },
    { value: 'exp', label: 'Sort by Expiry' },
    { value: 'qty', label: 'Sort by Quantity' }
  ],
  bins: [
    { value: 'bin_code', label: 'Sort by Bin Code' },
    { value: 'zone', label: 'Sort by Zone' },
    { value: 'utilization', label: 'Sort by Utilization' }
  ],
  transactions: [
    { value: 'timestamp', label: 'Sort by Time' },
    { value: 'type', label: 'Sort by Type' },
    { value: 'user', label: 'Sort by User' }
  ]
}

const backendSortFieldMap = {
  items: {
    sku: 'sku',
    name: 'name',
    price: 'price',
    totalQty: 'sku'
  },
  lots: {
    lot: 'lot_number',
    exp: 'expiry_date',
    qty: 'qty'
  },
  bins: {
    bin_code: 'bin_code',
    zone: 'zone',
    utilization: 'bin_code'
  },
  transactions: {
    timestamp: 'transactionTime',
    type: 'transactionType',
    user: 'operator'
  }
}

const activeSortOptions = computed(() => sortOptionsMap[activeTab.value] || sortOptionsMap.items)

const activeTabMeta = computed(() => ({
  items: {
    label: 'Items',
    title: 'Item Inventory',
    description: 'Read SKU availability, bin spread, and status at a glance.',
    searchPlaceholder: 'Search SKU or item name...'
  },
  lots: {
    label: 'Lots',
    title: 'Lot Inventory',
    description: 'Trace batches, expiry windows, and storage positions.',
    searchPlaceholder: 'Search lot number or SKU...'
  },
  bins: {
    label: 'Bins',
    title: 'Bin Network',
    description: 'Monitor bin capacity, utilization, and readiness.',
    searchPlaceholder: 'Search bin code or zone...'
  },
  transactions: {
    label: 'History',
    title: 'Inventory History',
    description: 'Follow inbound, outbound, count, and adjustment activity.',
    searchPlaceholder: 'Search SKU or operator...'
  }
}[activeTab.value]))

const filteredItems = computed(() => {
  let filtered = items.value

  if (searchQuery.value) {
    const needle = searchQuery.value.toLowerCase()
    filtered = filtered.filter((item) =>
      item.sku.toLowerCase().includes(needle) ||
      item.name.toLowerCase().includes(needle)
    )
  }

  if (sortBy.value === 'sku') {
    return [...filtered].sort((a, b) => a.sku.localeCompare(b.sku))
  }
  if (sortBy.value === 'name') {
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name))
  }
  if (sortBy.value === 'totalQty') {
    return [...filtered].sort((a, b) => Number(b.totalQty || 0) - Number(a.totalQty || 0))
  }
  if (sortBy.value === 'price') {
    return [...filtered].sort((a, b) => Number(b.price || 0) - Number(a.price || 0))
  }

  return filtered
})

const filteredLots = computed(() => {
  let filtered = lots.value

  if (searchQuery.value) {
    const needle = searchQuery.value.toLowerCase()
    filtered = filtered.filter((lot) =>
      lot.lot.toLowerCase().includes(needle) ||
      lot.sku.toLowerCase().includes(needle)
    )
  }

  if (sortBy.value === 'lot') {
    return [...filtered].sort((a, b) => a.lot.localeCompare(b.lot))
  }
  if (sortBy.value === 'exp') {
    return [...filtered].sort((a, b) => new Date(a.exp || 0) - new Date(b.exp || 0))
  }
  if (sortBy.value === 'qty') {
    return [...filtered].sort((a, b) => Number(b.qty || 0) - Number(a.qty || 0))
  }

  return filtered
})

const filteredBins = computed(() => {
  let filtered = bins.value

  if (searchQuery.value) {
    const needle = searchQuery.value.toLowerCase()
    filtered = filtered.filter((bin) =>
      bin.bin_code.toLowerCase().includes(needle) ||
      bin.zone.toLowerCase().includes(needle)
    )
  }

  if (sortBy.value === 'bin_code') {
    return [...filtered].sort((a, b) => a.bin_code.localeCompare(b.bin_code))
  }
  if (sortBy.value === 'zone') {
    return [...filtered].sort((a, b) => a.zone.localeCompare(b.zone))
  }
  if (sortBy.value === 'utilization') {
    return [...filtered].sort((a, b) => Number(b.utilization || 0) - Number(a.utilization || 0))
  }

  return filtered
})

const filteredTransactions = computed(() => {
  let filtered = transactions.value

  if (searchQuery.value) {
    const needle = searchQuery.value.toLowerCase()
    filtered = filtered.filter((txn) =>
      txn.sku.toLowerCase().includes(needle) ||
      txn.user.toLowerCase().includes(needle)
    )
  }

  if (sortBy.value === 'timestamp') {
    return [...filtered].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
  }
  if (sortBy.value === 'type') {
    return [...filtered].sort((a, b) => a.type.localeCompare(b.type))
  }
  if (sortBy.value === 'user') {
    return [...filtered].sort((a, b) => a.user.localeCompare(b.user))
  }

  return filtered
})

const activeRowCount = computed(() => {
  if (activeTab.value === 'items') return filteredItems.value.length
  if (activeTab.value === 'lots') return filteredLots.value.length
  if (activeTab.value === 'bins') return filteredBins.value.length
  return filteredTransactions.value.length
})

const formattedToday = computed(() => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date())
})

const lastUpdatedLabel = computed(() => {
  if (!lastUpdated.value) return 'Waiting for first sync'
  return formatDateTime(lastUpdated.value)
})

const inventoryHealthText = computed(() => {
  if (stats.value.lowStock === 0) return 'Stable and ready'
  if (stats.value.lowStock <= 3) return 'A few items need attention'
  return 'Replenishment should be reviewed'
})

const statCards = computed(() => [
  {
    icon: '📦',
    value: stats.value.totalItems,
    label: 'Tracked Items',
    note: 'SKU visibility across active inventory',
    badge: 'Coverage',
    tone: 'tone-blue'
  },
  {
    icon: '🧾',
    value: stats.value.totalLots,
    label: 'Live Lots',
    note: 'Traceable stock batches in circulation',
    badge: 'Traceability',
    tone: 'tone-violet'
  },
  {
    icon: '🗺️',
    value: stats.value.totalBins,
    label: 'Storage Bins',
    note: 'Mapped warehouse locations',
    badge: 'Layout',
    tone: 'tone-amber'
  },
  {
    icon: '⚠️',
    value: stats.value.lowStock,
    label: 'Low Stock',
    note: stats.value.lowStock > 0 ? 'Needs replenishment review' : 'No urgent shortage right now',
    badge: stats.value.lowStock > 0 ? 'Watchlist' : 'Healthy',
    tone: stats.value.lowStock > 0 ? 'tone-rose' : 'tone-mint'
  }
])

const quickSignals = computed(() => [
  {
    label: 'Stock Health',
    note: stats.value.lowStock > 0
      ? 'Some SKUs are below target and should be replenished soon.'
      : 'Low-stock watchlist is clear at the moment.',
    value: `${stats.value.lowStock} flagged`,
    tone: stats.value.lowStock > 0 ? 'danger' : 'ok'
  },
  {
    label: 'Current Lens',
    note: activeTabMeta.value.description,
    value: activeTabMeta.value.label,
    tone: 'neutral'
  },
  {
    label: 'Data Density',
    note: 'Visible rows after current filters and sorting are applied.',
    value: `${activeRowCount.value} rows`,
    tone: 'neutral'
  }
])

const selectedDetailType = computed(() => {
  if (!selectedItem.value) return 'unknown'
  if (selectedItem.value.detailType === 'transaction') return 'transaction'
  if (selectedItem.value.lot || selectedItem.value.lot_number) return 'lot'
  if (selectedItem.value.bin_code) return 'bin'
  return 'item'
})

const detailHero = computed(() => {
  if (!selectedItem.value) {
    return {
      kicker: '',
      title: '',
      subtitle: '',
      badgeText: '',
      badgeClass: 'status-badge'
    }
  }

  if (selectedDetailType.value === 'lot') {
    return {
      kicker: 'Batch Snapshot',
      title: selectedItem.value.lot || selectedItem.value.lot_number,
      subtitle: `${selectedItem.value.sku} · ${selectedItem.value.qty} ${selectedItem.value.uom || 'pcs'} in ${selectedItem.value.bin || '—'}`,
      badgeText: getStatusText(selectedItem.value.status || 'ACTIVE'),
      badgeClass: `status-badge ${selectedItem.value.status || 'ACTIVE'}`
    }
  }

  if (selectedDetailType.value === 'bin') {
    return {
      kicker: 'Location Snapshot',
      title: selectedItem.value.bin_code,
      subtitle: `${selectedItem.value.zone || 'Unassigned zone'} · ${selectedItem.value.utilization || 0}% utilized`,
      badgeText: getStatusText(selectedItem.value.status || 'ACTIVE'),
      badgeClass: `status-badge ${selectedItem.value.status || 'ACTIVE'}`
    }
  }

  if (selectedDetailType.value === 'transaction') {
    return {
      kicker: 'Activity Snapshot',
      title: getTransactionTypeText(selectedItem.value.type || 'ADJUST'),
      subtitle: `${selectedItem.value.sku} · ${selectedItem.value.qty} ${selectedItem.value.uom || 'pcs'} · ${selectedItem.value.bin || '—'}`,
      badgeText: getStatusText(selectedItem.value.status || 'COMPLETED'),
      badgeClass: `status-badge ${selectedItem.value.status || 'COMPLETED'}`
    }
  }

  return {
    kicker: 'Item Snapshot',
    title: selectedItem.value.name || selectedItem.value.sku,
    subtitle: formatItemMeta(selectedItem.value),
    badgeText: getStatusText(selectedItem.value.status || 'ACTIVE'),
    badgeClass: `status-badge ${selectedItem.value.status || 'ACTIVE'}`
  }
})

const detailSections = computed(() => {
  if (!selectedItem.value) return []

  if (selectedDetailType.value === 'lot') {
    return [
      {
        title: 'Identity',
        fields: [
          { label: 'Lot Number', value: selectedItem.value.lot || selectedItem.value.lot_number || '—' },
          { label: 'SKU', value: selectedItem.value.sku || '—' },
          { label: 'Item Name', value: selectedItem.value.item?.name || 'Traceable batch' }
        ]
      },
      {
        title: 'Storage',
        fields: [
          { label: 'Current Bin', value: selectedItem.value.bin || selectedItem.value.bin_code || '—' },
          { label: 'Quantity', value: `${selectedItem.value.qty ?? 0} ${selectedItem.value.uom || 'pcs'}` },
          { label: 'Status', value: getStatusText(selectedItem.value.status || 'ACTIVE') }
        ]
      },
      {
        title: 'Shelf Life',
        fields: [
          { label: 'Expiry Date', value: formatDate(selectedItem.value.exp || selectedItem.value.expiry_date), tone: getExpiryClass(selectedItem.value.exp || selectedItem.value.expiry_date) },
          { label: 'Created At', value: formatDateTime(selectedItem.value.createdAt) },
          { label: 'Updated At', value: formatDateTime(selectedItem.value.updatedAt) }
        ]
      }
    ]
  }

  if (selectedDetailType.value === 'bin') {
    return [
      {
        title: 'Identity',
        fields: [
          { label: 'Bin Code', value: selectedItem.value.bin_code || '—' },
          { label: 'Zone', value: selectedItem.value.zone || '—' },
          { label: 'Status', value: getStatusText(selectedItem.value.status || 'ACTIVE') }
        ]
      },
      {
        title: 'Capacity',
        fields: [
          { label: 'Capacity', value: selectedItem.value.capacity ?? '—' },
          { label: 'Used', value: selectedItem.value.used ?? 0 },
          { label: 'Utilization', value: `${selectedItem.value.utilization ?? 0}%` }
        ]
      },
      {
        title: 'Tracking',
        fields: [
          { label: 'Created At', value: formatDateTime(selectedItem.value.createdAt) },
          { label: 'Updated At', value: formatDateTime(selectedItem.value.updatedAt) }
        ]
      }
    ]
  }

  if (selectedDetailType.value === 'transaction') {
    return [
      {
        title: 'Activity',
        fields: [
          { label: 'Type', value: getTransactionTypeText(selectedItem.value.type || 'ADJUST') },
          { label: 'Time', value: formatDateTime(selectedItem.value.timestamp) },
          { label: 'Status', value: getStatusText(selectedItem.value.status || 'COMPLETED') }
        ]
      },
      {
        title: 'Stock Impact',
        fields: [
          { label: 'SKU', value: selectedItem.value.sku || '—' },
          { label: 'Quantity', value: `${selectedItem.value.qty ?? 0} ${selectedItem.value.uom || 'pcs'}` },
          { label: 'Location', value: selectedItem.value.bin || '—' }
        ]
      },
      {
        title: 'Audit',
        fields: [
          { label: 'Operator', value: selectedItem.value.user || 'System' },
          { label: 'Before Qty', value: selectedItem.value.beforeQuantity ?? '—' },
          { label: 'After Qty', value: selectedItem.value.afterQuantity ?? '—' },
          { label: 'Note', value: selectedItem.value.notes || '—' }
        ]
      }
    ]
  }

  return [
    {
      title: 'Identity',
      fields: [
        { label: 'SKU', value: selectedItem.value.sku || '—' },
        { label: 'Item Name', value: selectedItem.value.name || '—' },
        { label: 'Category', value: selectedItem.value.category || 'Uncategorized' }
      ]
    },
    {
      title: 'Inventory',
      fields: [
        { label: 'Total Qty', value: `${selectedItem.value.totalQty ?? 0} ${selectedItem.value.uom || 'pcs'}` },
        { label: 'Available', value: `${selectedItem.value.available ?? 0} ${selectedItem.value.uom || 'pcs'}` },
        { label: 'Bins', value: `${selectedItem.value.binCount ?? 0}` }
      ]
    },
    {
      title: 'Planning',
      fields: [
        { label: 'Price', value: selectedItem.value.price !== null && selectedItem.value.price !== undefined && selectedItem.value.price !== '' ? formatPrice(selectedItem.value.price) : '—' },
        { label: 'Min Stock', value: `${selectedItem.value.min_stock ?? 0}` },
        { label: 'Max Stock', value: selectedItem.value.max_stock ?? '—' }
      ]
    }
  ]
})

const countDelta = computed(() => {
  const actual = Number(countForm.value.actual_qty)
  const current = Number(countForm.value.current_qty)

  if (!Number.isFinite(actual) || !Number.isFinite(current)) return null
  return actual - current
})

const countDeltaLabel = computed(() => {
  if (countDelta.value === null) return ''
  if (countDelta.value === 0) return 'No change'
  if (countDelta.value > 0) return `Increase by ${countDelta.value}`
  return `Decrease by ${Math.abs(countDelta.value)}`
})

const countDeltaTone = computed(() => {
  if (countDelta.value === null || countDelta.value === 0) return 'neutral'
  return countDelta.value > 0 ? 'positive' : 'negative'
})

const checkDevice = () => {
  isMobile.value = window.innerWidth <= 768
}

watch(activeTab, (newTab) => {
  const defaultSort = sortOptionsMap[newTab]?.[0]?.value
  if (defaultSort) {
    sortBy.value = defaultSort
  }
})

watch([activeTab, searchQuery], () => {
  loadData()
})

onMounted(() => {
  checkDevice()
  window.addEventListener('resize', checkDevice)
  refreshData()
})

onUnmounted(() => {
  window.removeEventListener('resize', checkDevice)
  window.clearTimeout(feedbackTimeout)
})

const getAuthHeaders = () => {
  const token = localStorage.getItem('token')
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
}

const showFeedback = (message, type = 'success') => {
  feedbackMessage.value = message
  feedbackType.value = type

  window.clearTimeout(feedbackTimeout)
  feedbackTimeout = window.setTimeout(() => {
    feedbackMessage.value = ''
  }, 3500)
}

const loadStats = async () => {
  try {
    const response = await fetch('/api/inventory-management/stats', {
      headers: getAuthHeaders()
    })
    const result = await response.json()

    if (result.success) {
      stats.value = {
        totalItems: result.data.totalItems || 0,
        totalLots: result.data.totalLots || 0,
        totalBins: result.data.totalBins || 0,
        lowStock: result.data.lowStockCount || 0
      }
    }
  } catch (error) {
    console.error('Failed to load stats:', error)
  }
}

const loadData = async () => {
  isLoading.value = true
  loadError.value = ''

  try {
    const backendSortBy = backendSortFieldMap[activeTab.value]?.[sortBy.value] ||
      (activeTab.value === 'transactions' ? 'transactionTime' : 'sku')
    const params = new URLSearchParams({
      search: searchQuery.value,
      sortBy: backendSortBy,
      limit: 100
    })

    let url = ''
    if (activeTab.value === 'items') url = `/api/inventory-management/items?${params}`
    else if (activeTab.value === 'lots') url = `/api/inventory-management/lots?${params}`
    else if (activeTab.value === 'bins') url = `/api/inventory-management/bins?${params}`
    else if (activeTab.value === 'transactions') url = `/api/inventory-management/transactions?${params}`

    const response = await fetch(url, { headers: getAuthHeaders() })
    const result = await response.json()

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to load inventory data')
    }

    if (activeTab.value === 'items') {
      items.value = result.data.items || []
    } else if (activeTab.value === 'lots') {
      lots.value = (result.data.lots || []).map((lot) => ({
        ...lot,
        lot: lot.lot_number,
        bin: lot.bin?.bin_code || 'N/A',
        exp: lot.expiry_date
      }))
    } else if (activeTab.value === 'bins') {
      bins.value = result.data.bins || []
    } else if (activeTab.value === 'transactions') {
      transactions.value = (result.data.transactions || []).map((transaction) => ({
        ...transaction,
        detailType: 'transaction',
        timestamp: transaction.transactionTime,
        type: typeof transaction.notes === 'string' && transaction.notes.startsWith('Cycle Count Adjustment:')
          ? 'COUNT'
          : typeof transaction.notes === 'string' && transaction.notes.startsWith('BIN_TRANSFER:')
            ? 'MOVE'
            : transaction.transactionType === 'in'
              ? 'INBOUND'
              : 'OUTBOUND',
        sku: transaction.itemCode,
        qty: transaction.quantity,
        uom: transaction.uom || 'pcs',
        user: transaction.operator || 'System',
        bin: transaction.location || '—',
        beforeQuantity: transaction.beforeQuantity,
        afterQuantity: transaction.afterQuantity,
        notes: transaction.notes || '',
        status: 'COMPLETED'
      }))
    }

    lastUpdated.value = new Date().toISOString()
  } catch (error) {
    console.error('Failed to load data:', error)
    loadError.value = error.message || 'Failed to load inventory data'
  } finally {
    isLoading.value = false
  }
}

const refreshData = async () => {
  await Promise.all([loadStats(), loadData()])
}

const exportData = async () => {
  try {
    const response = await fetch('/api/inventory-management/export', {
      headers: getAuthHeaders()
    })
    const result = await response.json()

    if (result.success) {
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `inventory-export-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
    }
  } catch (error) {
    console.error('Export failed:', error)
  }
}

const printItemLabel = async (item) => {
  if (!confirm(`Generate QR label for ${item.sku}?`)) return

  try {
    const response = await fetch('/api/print-center/print', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        templateId: 'ITEM-60x40',
        printType: 'ITEM',
        items: [{ sku: item.sku }],
        options: { copies: 1, format: 'PDF' }
      })
    })

    const result = await response.json()
    if (result.success && result.data.download_url) {
      const backendOrigin = `http://${window.location.hostname}:3000`
      const link = document.createElement('a')
      link.href = `${backendOrigin}${result.data.download_url}`
      link.download = `Label-${item.sku}-${Date.now()}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } else {
      alert(`Failed to generate label: ${result.message || 'Unknown error'}`)
    }
  } catch (error) {
    console.error('Print error:', error)
    alert(`Error printing label: ${error.message}`)
  }
}

const openEditItemModal = (item) => {
  editItemForm.value = {
    originalSku: item.sku,
    sku: item.sku,
    name: item.name || '',
    description: item.description || '',
    category: item.category || '',
    uom: item.uom || 'pcs',
    price: item.price ?? '',
    min_stock: item.min_stock ?? 0,
    max_stock: item.max_stock ?? '',
    status: item.status || 'ACTIVE'
  }
  showEditItemModal.value = true
}

const closeEditItemModal = () => {
  showEditItemModal.value = false
}

const openCountModal = (lot) => {
  countForm.value = {
    lot_number: lot.lot || lot.lot_number,
    sku: lot.sku,
    current_qty: Number(lot.qty || 0),
    actual_qty: Number(lot.qty || 0),
    reason: 'Cycle Count'
  }

  showCountModal.value = true
}

const openEditLotModal = (lot) => {
  editLotForm.value = {
    lot_number: lot.lot || lot.lot_number,
    sku: lot.sku || '',
    qty: Number(lot.qty || 0),
    uom: lot.uom || 'pcs',
    bin: lot.bin || '—',
    expiry_date: formatDateForInput(lot.exp || lot.expiry_date)
  }
  showEditLotModal.value = true
}

const closeEditLotModal = () => {
  showEditLotModal.value = false
}

const closeCountModal = () => {
  showCountModal.value = false
}

const submitCountAdjustment = async () => {
  const lotNumber = String(countForm.value.lot_number || '').trim()
  const actualQty = Number(countForm.value.actual_qty)

  if (!lotNumber || !Number.isFinite(actualQty) || actualQty < 0) {
    alert('请填写有效的盘点数量')
    return
  }

  isSubmittingCount.value = true

  try {
    const response = await fetch('/api/inventory-management/adjust', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        lot_number: lotNumber,
        actual_qty: actualQty,
        reason: String(countForm.value.reason || 'Cycle Count').trim()
      })
    })

    const result = await response.json()

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to save cycle count')
    }

    closeCountModal()
    await refreshData()

    const adjustment = Number(result.data?.adjustment || 0)
    const summary = adjustment === 0
      ? `${lotNumber} already matched the system quantity`
      : `${lotNumber} count saved. Adjustment ${adjustment > 0 ? `+${adjustment}` : adjustment}`

    showFeedback(summary, 'success')
  } catch (error) {
    console.error('Failed to adjust inventory:', error)
    showFeedback(error.message || 'Failed to save cycle count', 'error')
  } finally {
    isSubmittingCount.value = false
  }
}

const saveItemEdits = async () => {
  const originalSku = editItemForm.value.originalSku
  const nextSku = String(editItemForm.value.sku || '').trim()

  if (!originalSku || !nextSku || !String(editItemForm.value.name || '').trim()) {
    alert('SKU 和商品名称不能为空')
    return
  }

  if (originalSku !== nextSku) {
    const shouldContinue = confirm('Changing the SKU code will also update linked lots and history. Continue?')
    if (!shouldContinue) return
  }

  isSavingItem.value = true

  try {
    const response = await fetch(`/api/inventory-management/items/${encodeURIComponent(originalSku)}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        sku: nextSku,
        name: editItemForm.value.name,
        description: editItemForm.value.description,
        category: editItemForm.value.category,
        uom: editItemForm.value.uom,
        price: editItemForm.value.price === '' ? null : Number(editItemForm.value.price),
        min_stock: editItemForm.value.min_stock,
        max_stock: editItemForm.value.max_stock === '' ? null : Number(editItemForm.value.max_stock),
        status: editItemForm.value.status
      })
    })

    const result = await response.json()

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to update item')
    }

    closeEditItemModal()
    await refreshData()
  } catch (error) {
    console.error('Failed to update item:', error)
    alert(error.message || 'Failed to update item')
  } finally {
    isSavingItem.value = false
  }
}

const saveLotEdits = async () => {
  const lotNumber = String(editLotForm.value.lot_number || '').trim()

  if (!lotNumber) {
    alert('Lot number is required')
    return
  }

  isSavingLot.value = true

  try {
    const response = await fetch(`/api/inventory-management/lots/${encodeURIComponent(lotNumber)}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        expiry_date: editLotForm.value.expiry_date || null
      })
    })

    const result = await response.json()

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to update lot')
    }

    closeEditLotModal()
    await refreshData()
    showFeedback(`${lotNumber} expiry date updated`, 'success')
  } catch (error) {
    console.error('Failed to update lot:', error)
    showFeedback(error.message || 'Failed to update lot', 'error')
  } finally {
    isSavingLot.value = false
  }
}

const viewLotDetails = (lot) => {
  selectedItem.value = lot
  detailsModalTitle.value = `Lot Details - ${lot.lot}`
  showDetailsModal.value = true
}

const viewBinDetails = (bin) => {
  selectedItem.value = bin
  detailsModalTitle.value = `Bin Details - ${bin.bin_code}`
  showDetailsModal.value = true
}

const viewTransactionDetails = (txn) => {
  selectedItem.value = txn
  detailsModalTitle.value = `Activity Details - ${getTransactionTypeText(txn.type)}`
  showDetailsModal.value = true
}

const closeDetailsModal = () => {
  showDetailsModal.value = false
  selectedItem.value = null
}

const getStatusText = (status) => {
  const statusMap = {
    ACTIVE: '正常',
    INACTIVE: '停用',
    LOW_STOCK: '库存不足',
    OUT_OF_STOCK: '缺货',
    COMPLETED: '已完成',
    PENDING: '待处理',
    CANCELLED: '已取消',
    EXPIRED: '过期',
    DAMAGED: '异常'
  }

  return statusMap[status] || status
}

const getTransactionTypeText = (type) => {
  const typeMap = {
    INBOUND: '入库',
    OUTBOUND: '出库',
    MOVE: '移库',
    ADJUST: '调整',
    COUNT: '盘点'
  }

  return typeMap[type] || type
}

const getExpiryClass = (expDate) => {
  if (!expDate) return 'expiry-normal'

  const daysUntilExpiry = Math.ceil((new Date(expDate) - new Date()) / (1000 * 60 * 60 * 24))
  if (daysUntilExpiry < 30) return 'expiry-warning'
  if (daysUntilExpiry < 90) return 'expiry-notice'
  return 'expiry-normal'
}

const getUtilizationClass = (utilization) => {
  if (utilization > 80) return 'high'
  if (utilization > 50) return 'medium'
  return 'low'
}

const formatDate = (dateString) => {
  if (!dateString) return '—'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-CA')
}

const formatDateForInput = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

const formatDateTime = (dateTimeString) => {
  if (!dateTimeString) return '—'
  const date = new Date(dateTimeString)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-CA')
}

const formatPrice = (price) => {
  const numericPrice = Number(price)
  if (!Number.isFinite(numericPrice)) return '—'
  return numericPrice.toFixed(2)
}

const formatItemMeta = (item) => {
  const parts = []

  if (item.category) {
    parts.push(item.category)
  } else {
    parts.push('Uncategorized item')
  }

  if (item.uom) {
    parts.push(item.uom)
  }

  if (item.price !== null && item.price !== undefined && item.price !== '') {
    parts.push(`Price ${formatPrice(item.price)}`)
  }

  return parts.join(' · ')
}
</script>

<style scoped>
.inventory-management {
  --bg-start: #f7f8fb;
  --bg-end: #edf2f7;
  --surface: rgba(255, 255, 255, 0.72);
  --surface-strong: rgba(255, 255, 255, 0.9);
  --border: rgba(15, 23, 42, 0.08);
  --border-strong: rgba(15, 23, 42, 0.14);
  --text: #111827;
  --muted: #6b7280;
  --muted-strong: #4b5563;
  --shadow-soft: 0 18px 48px rgba(15, 23, 42, 0.08);
  --shadow-card: 0 22px 60px rgba(15, 23, 42, 0.1);
  --accent-blue: #0071e3;
  --accent-mint: #17b26a;
  --accent-amber: #f59e0b;
  --accent-rose: #ef4444;
  min-height: 100vh;
  padding: 24px;
  position: relative;
  overflow: hidden;
  color: var(--text);
  font-family: "SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif;
  background:
    radial-gradient(circle at top left, rgba(125, 211, 252, 0.18), transparent 28%),
    radial-gradient(circle at 80% 20%, rgba(187, 247, 208, 0.18), transparent 24%),
    linear-gradient(180deg, var(--bg-start) 0%, var(--bg-end) 100%);
}

.ambient {
  position: absolute;
  border-radius: 999px;
  filter: blur(48px);
  opacity: 0.45;
  pointer-events: none;
}

.ambient-one {
  width: 18rem;
  height: 18rem;
  top: -6rem;
  left: -6rem;
  background: rgba(56, 189, 248, 0.22);
}

.ambient-two {
  width: 16rem;
  height: 16rem;
  right: -4rem;
  top: 22%;
  background: rgba(59, 130, 246, 0.16);
}

.ambient-three {
  width: 20rem;
  height: 20rem;
  left: 32%;
  bottom: -8rem;
  background: rgba(16, 185, 129, 0.14);
}

.desktop-layout,
.mobile-layout {
  position: relative;
  z-index: 1;
}

.desktop-layout {
  display: grid;
  gap: 24px;
}

.page-back-row,
.mobile-back-row {
  display: flex;
}

.page-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.72);
  color: var(--text);
  font-weight: 600;
  cursor: pointer;
  box-shadow: var(--shadow-soft);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.mobile-back-btn {
  width: 100%;
  justify-content: center;
}

.glass-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 28px;
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  box-shadow: var(--shadow-soft);
}

.eyebrow {
  margin: 0 0 8px;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}

.hero-panel {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
  padding: 32px;
}

.hero-copy h1 {
  margin: 0;
  font-size: clamp(2rem, 4vw, 3.2rem);
  line-height: 1;
  letter-spacing: -0.06em;
}

.hero-subtitle {
  max-width: 42rem;
  margin: 14px 0 0;
  color: var(--muted-strong);
  font-size: 15px;
  line-height: 1.7;
}

.hero-pills,
.hero-actions,
.metric-topline,
.signal-header,
.signal-row,
.workspace-header,
.workspace-tools,
.tab-bar,
.mobile-hero,
.mobile-hero-actions,
.mobile-tabs,
.mobile-card-top,
.mobile-action-row {
  display: flex;
}

.hero-pills {
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 20px;
}

.hero-pill {
  min-width: 150px;
  padding: 12px 14px;
  border-radius: 18px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(255, 255, 255, 0.55);
}

.hero-pill span {
  display: block;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.hero-pill strong {
  display: block;
  margin-top: 6px;
  font-size: 14px;
  color: var(--text);
}

.hero-actions {
  gap: 12px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 46px;
  padding: 0 18px;
  border-radius: 16px;
  border: 1px solid transparent;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: transform 0.22s ease, box-shadow 0.22s ease, background 0.22s ease;
}

.btn:hover,
.row-action:hover,
.mobile-chip:hover {
  transform: translateY(-1px);
}

.btn-glass {
  background: rgba(255, 255, 255, 0.58);
  border-color: var(--border);
  color: var(--text);
}

.btn-primary {
  background: linear-gradient(135deg, #111827, #1f2937);
  color: #fff;
  box-shadow: 0 18px 30px rgba(17, 24, 39, 0.16);
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 18px;
}

.metric-card {
  grid-column: span 3;
  padding: 24px;
  position: relative;
  overflow: hidden;
}

.metric-card::after {
  content: '';
  position: absolute;
  inset: auto -20% -45% auto;
  width: 9rem;
  height: 9rem;
  border-radius: 999px;
  opacity: 0.12;
}

.metric-card.tone-blue::after { background: #0ea5e9; }
.metric-card.tone-violet::after { background: #8b5cf6; }
.metric-card.tone-amber::after { background: #f59e0b; }
.metric-card.tone-rose::after { background: #ef4444; }
.metric-card.tone-mint::after { background: #10b981; }

.metric-topline {
  align-items: center;
  justify-content: space-between;
}

.metric-icon {
  width: 44px;
  height: 44px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.62);
  font-size: 20px;
}

.metric-badge,
.signal-chip {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.05);
  color: var(--muted-strong);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.metric-value {
  display: block;
  margin-top: 18px;
  font-size: 40px;
  line-height: 1;
  letter-spacing: -0.06em;
}

.metric-label {
  display: block;
  margin-top: 8px;
  font-size: 15px;
  font-weight: 600;
}

.metric-note {
  margin: 10px 0 0;
  color: var(--muted-strong);
  font-size: 13px;
  line-height: 1.6;
}

.signal-card {
  grid-column: span 12;
  padding: 24px;
}

.signal-header {
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.signal-header h2 {
  margin: 0;
  font-size: 22px;
  letter-spacing: -0.03em;
}

.signal-list {
  display: grid;
  gap: 12px;
  margin-top: 18px;
}

.signal-row {
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 16px 18px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(15, 23, 42, 0.05);
}

.signal-copy strong {
  display: block;
  font-size: 15px;
}

.signal-copy p {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--muted-strong);
}

.signal-value {
  white-space: nowrap;
  font-size: 13px;
  font-weight: 700;
}

.signal-value.ok { color: var(--accent-mint); }
.signal-value.danger { color: var(--accent-rose); }
.signal-value.neutral { color: var(--accent-blue); }

.workspace-panel {
  padding: 24px;
}

.workspace-header {
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
}

.workspace-header h2 {
  margin: 0;
  font-size: 28px;
  letter-spacing: -0.04em;
}

.workspace-subtitle {
  margin: 8px 0 0;
  color: var(--muted-strong);
  font-size: 14px;
}

.workspace-tools {
  gap: 12px;
  flex-wrap: wrap;
}

.field-shell {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.search-shell {
  min-width: 280px;
}

.field-label {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.field-input {
  min-width: 0;
  height: 48px;
  padding: 0 16px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.7);
  color: var(--text);
  font-size: 14px;
}

.field-input:focus {
  outline: none;
  border-color: rgba(0, 113, 227, 0.35);
  box-shadow: 0 0 0 4px rgba(0, 113, 227, 0.08);
}

.select-input {
  min-width: 180px;
}

.tab-bar {
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
}

.tab-btn {
  min-height: 40px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.4);
  color: var(--muted-strong);
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.22s ease;
}

.tab-btn.active {
  background: linear-gradient(135deg, rgba(0, 113, 227, 0.14), rgba(0, 113, 227, 0.06));
  border-color: rgba(0, 113, 227, 0.16);
  color: var(--accent-blue);
}

.state-banner {
  margin-top: 18px;
  padding: 14px 16px;
  border-radius: 18px;
  font-size: 14px;
  font-weight: 600;
}

.state-banner.info {
  background: rgba(239, 246, 255, 0.8);
  color: #1d4ed8;
  border: 1px solid rgba(191, 219, 254, 0.9);
}

.state-banner.success {
  background: rgba(236, 253, 245, 0.92);
  color: #15803d;
  border: 1px solid rgba(134, 239, 172, 0.7);
}

.state-banner.error {
  background: rgba(255, 241, 242, 0.9);
  color: #be123c;
  border: 1px solid rgba(253, 164, 175, 0.6);
}

.table-shell {
  margin-top: 20px;
}

.table-scroll {
  overflow-x: auto;
  border-radius: 24px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(255, 255, 255, 0.45);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 18px 20px;
  text-align: left;
}

.data-table th {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
  background: rgba(255, 255, 255, 0.78);
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
}

.data-table td {
  font-size: 14px;
  color: var(--text);
  border-bottom: 1px solid rgba(15, 23, 42, 0.05);
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.data-table tbody tr:hover td {
  background: rgba(255, 255, 255, 0.68);
}

.mono-pill {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.05);
  font-family: "SF Mono", SFMono-Regular, ui-monospace, monospace;
  font-size: 12px;
}

.mono-inline {
  font-family: "SF Mono", SFMono-Regular, ui-monospace, monospace;
}

.cell-stack {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cell-stack strong {
  font-size: 14px;
}

.cell-stack small {
  color: var(--muted);
  font-size: 12px;
}

.action-cell {
  white-space: nowrap;
}

.row-action {
  min-height: 34px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s ease;
}

.row-action + .row-action {
  margin-left: 8px;
}

.row-action.ghost {
  border-color: rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.5);
  color: var(--text);
}

.row-action.primary {
  background: #111827;
  color: #fff;
}

.row-action.warning {
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.24);
  color: #b45309;
}

.status-badge,
.type-badge {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.status-badge.ACTIVE,
.status-badge.COMPLETED {
  background: rgba(220, 252, 231, 0.9);
  color: #15803d;
}

.status-badge.INACTIVE,
.status-badge.OUT_OF_STOCK,
.status-badge.CANCELLED,
.status-badge.DAMAGED {
  background: rgba(254, 226, 226, 0.95);
  color: #dc2626;
}

.status-badge.LOW_STOCK,
.status-badge.PENDING,
.status-badge.EXPIRED {
  background: rgba(254, 243, 199, 0.95);
  color: #b45309;
}

.type-badge {
  background: rgba(255, 255, 255, 0.75);
  color: var(--text);
}

.type-badge.INBOUND { color: #1d4ed8; }
.type-badge.OUTBOUND { color: #dc2626; }
.type-badge.MOVE { color: #15803d; }
.type-badge.ADJUST,
.type-badge.COUNT { color: #b45309; }

.utilization-stack {
  display: flex;
  align-items: center;
  gap: 10px;
}

.utilization-bar {
  width: 110px;
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(15, 23, 42, 0.08);
}

.mobile-bar {
  width: 100%;
}

.utilization-fill {
  height: 100%;
  border-radius: inherit;
  transition: width 0.3s ease;
}

.utilization-fill.low { background: #10b981; }
.utilization-fill.medium { background: #f59e0b; }
.utilization-fill.high { background: #ef4444; }

.utilization-text {
  font-size: 12px;
  font-weight: 700;
  color: var(--muted-strong);
}

.expiry-warning {
  color: #dc2626;
  font-weight: 700;
}

.expiry-notice {
  color: #b45309;
  font-weight: 700;
}

.expiry-normal {
  color: #15803d;
  font-weight: 700;
}

.empty-state,
.mobile-empty {
  padding: 52px 24px;
  text-align: center;
}

.empty-state strong,
.mobile-empty strong {
  display: block;
  font-size: 16px;
}

.empty-state p,
.mobile-empty p {
  margin: 10px 0 0;
  color: var(--muted-strong);
  font-size: 14px;
}

.mobile-layout {
  display: grid;
  gap: 16px;
}

.mobile-hero {
  padding: 22px 20px;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.mobile-hero h2 {
  margin: 0;
  font-size: 28px;
  letter-spacing: -0.04em;
}

.mobile-hero p:last-child {
  margin: 10px 0 0;
  color: var(--muted-strong);
  font-size: 13px;
  line-height: 1.6;
}

.mobile-hero-actions {
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.mobile-chip {
  min-height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.65);
  color: var(--text);
  font-size: 12px;
  font-weight: 700;
}

.mobile-stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.mobile-stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
}

.mobile-stat-icon {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.65);
  font-size: 18px;
}

.mobile-stat-card strong {
  display: block;
  font-size: 22px;
  line-height: 1;
}

.mobile-stat-card span:last-child {
  display: block;
  margin-top: 6px;
  color: var(--muted);
  font-size: 12px;
}

.mobile-tabs {
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.mobile-tab-btn {
  flex: 1 0 auto;
  min-height: 40px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.5);
  color: var(--muted-strong);
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.mobile-tab-btn.active {
  background: rgba(17, 24, 39, 0.95);
  color: #fff;
}

.mobile-toolbar {
  padding: 14px;
  display: grid;
  gap: 12px;
}

.mobile-search-input,
.mobile-sort-select {
  width: 100%;
  height: 46px;
  padding: 0 14px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.68);
  color: var(--text);
  font-size: 14px;
}

.mobile-state {
  margin-top: -4px;
}

.mobile-list {
  padding-bottom: 72px;
}

.list-stack {
  display: grid;
  gap: 12px;
}

.mobile-card {
  padding: 16px;
}

.mobile-card-top {
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.mobile-card-top strong {
  display: block;
  font-size: 16px;
}

.mobile-card-top p {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 12px;
}

.mobile-time {
  white-space: nowrap;
}

.mobile-info-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.mobile-info-grid span {
  display: block;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}

.mobile-info-grid strong {
  display: block;
  margin-top: 6px;
  font-size: 14px;
}

.mobile-action-row {
  gap: 8px;
  margin-top: 16px;
}

.mobile-action-row .row-action {
  flex: 1;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.28);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 1000;
}

.modal-content {
  width: min(720px, 100%);
  max-height: 84vh;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding: 24px 24px 18px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
}

.modal-header h3 {
  margin: 0;
  font-size: 22px;
  letter-spacing: -0.03em;
}

.close-btn {
  width: 38px;
  height: 38px;
  border: none;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.68);
  color: var(--muted-strong);
  font-size: 24px;
  cursor: pointer;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
}

.detail-body {
  display: grid;
  gap: 18px;
}

.detail-hero {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-start;
  padding: 20px 22px;
  border-radius: 24px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.86), rgba(191, 219, 254, 0.24));
}

.detail-hero-label {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.detail-hero h4 {
  margin: 0;
  font-size: 26px;
  letter-spacing: -0.04em;
}

.detail-hero p:last-child {
  margin: 8px 0 0;
  color: var(--muted-strong);
  line-height: 1.6;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.detail-card {
  padding: 18px;
  border-radius: 22px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(255, 255, 255, 0.7);
}

.detail-card-head {
  margin-bottom: 12px;
}

.detail-list {
  display: grid;
  gap: 12px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.detail-row span {
  color: var(--muted);
  font-size: 13px;
}

.detail-row strong {
  color: var(--text);
  text-align: right;
  line-height: 1.5;
}

.edit-item-modal {
  width: min(860px, 100%);
}

.edit-item-body {
  display: grid;
  gap: 20px;
}

.edit-hint {
  padding: 16px 18px;
  border-radius: 18px;
  border: 1px solid rgba(59, 130, 246, 0.14);
  background: linear-gradient(135deg, rgba(191, 219, 254, 0.45), rgba(255, 255, 255, 0.72));
}

.edit-hint strong {
  display: block;
  font-size: 14px;
}

.edit-hint p {
  margin: 8px 0 0;
  color: var(--muted-strong);
  font-size: 13px;
  line-height: 1.6;
}

.edit-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.edit-field {
  display: grid;
  gap: 8px;
}

.edit-field span {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}

.edit-field-full {
  grid-column: 1 / -1;
}

.field-footnote {
  color: var(--muted-strong);
  font-size: 12px;
  line-height: 1.5;
}

.field-textarea {
  min-height: 112px;
  padding: 14px 16px;
  resize: vertical;
}

.edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.count-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(255, 255, 255, 0.56);
}

.count-preview span {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}

.count-preview strong {
  font-size: 14px;
}

.count-preview strong.neutral {
  color: var(--muted-strong);
}

.count-preview strong.positive {
  color: #15803d;
}

.count-preview strong.negative {
  color: #b45309;
}

@media (max-width: 1100px) {
  .metric-card {
    grid-column: span 6;
  }
}

@media (max-width: 900px) {
  .inventory-management {
    padding: 16px;
  }

  .hero-panel,
  .workspace-header,
  .detail-hero {
    flex-direction: column;
    align-items: stretch;
  }

  .search-shell {
    min-width: 0;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .inventory-management {
    padding: 14px;
  }

  .mobile-info-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .modal-overlay {
    padding: 16px;
  }

  .modal-header,
  .modal-body {
    padding: 18px;
  }

  .edit-form-grid {
    grid-template-columns: 1fr;
  }

  .detail-row {
    flex-direction: column;
    gap: 4px;
  }

  .detail-row strong {
    text-align: left;
  }
}
</style>
