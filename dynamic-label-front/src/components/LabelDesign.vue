<template>
  <div class="label-designer">
    <!-- 环境光效背景 -->
    <div class="ambient-light light-1"></div>
    <div class="ambient-light light-2"></div>
    <div class="ambient-light light-3"></div>
    
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <button @click="newDesign" class="btn btn-primary">📄 New</button>
        <button @click="saveDesign" class="btn btn-success">💾 Save</button>
        <button @click="exportImage" class="btn btn-info">📤 Export</button>
        <button @click="printLabel" class="btn btn-warning">🖨️ Print</button>
      </div>
      <div class="toolbar-center">
        <span class="zoom-controls">
          <button @click="zoomOut" class="btn btn-sm">🔍-</button>
          <span class="zoom-level">{{ Math.round(zoom * 100) }}%</span>
          <button @click="zoomIn" class="btn btn-sm">🔍+</button>
        </span>
        <button @click="fitToScreen" class="btn btn-sm">📐 Fit Screen</button>
      </div>
      <div class="toolbar-right">
        <select v-model="selectedTemplate" @change="loadTemplateByType" class="template-select">
          <option value="">Select Template</option>
          <option value="product">Product Label</option>
          <option value="warehouse">Warehouse Label</option>
          <option value="shipping">Shipping Label</option>
        </select>
      </div>
    </div>

    <div class="main-content">
      <!-- Component Library -->
      <div class="component-panel">
        <h3>📦 Component Library</h3>
        
        <!-- Basic Elements -->
        <div class="component-group">
          <h4>Basic Elements</h4>
          <div class="component-item" draggable="true" @dragstart="onDragStart($event, 'text')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 7V4a2 2 0 0 1 2-2h8.5L20 7.5V20a2 2 0 0 1-2 2h-5.5"/>
              <polyline points="14,2 14,8 20,8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10,9 9,9 8,9"/>
            </svg>
            <span>Text</span>
          </div>
          <div class="component-item" draggable="true" @dragstart="onDragStart($event, 'rectangle')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            </svg>
            <span>Rectangle</span>
          </div>
          <div class="component-item" draggable="true" @dragstart="onDragStart($event, 'circle')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
            </svg>
            <span>Circle</span>
          </div>
          <div class="component-item" draggable="true" @dragstart="onDragStart($event, 'line')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span>Line</span>
          </div>
        </div>

        <!-- Barcode Types -->
        <div class="component-group">
          <h4>Barcode Types</h4>
          <div class="component-item" draggable="true" @dragstart="onDragStart($event, 'barcode')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 5v14"/>
              <path d="M8 5v14"/>
              <path d="M13 5v14"/>
              <path d="M18 5v14"/>
              <path d="M23 5v14"/>
            </svg>
            <span>Barcode</span>
          </div>
          <div class="component-item" draggable="true" @dragstart="onDragStart($event, 'qrcode')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="5" height="5"/>
              <rect x="16" y="3" width="5" height="5"/>
              <rect x="3" y="16" width="5" height="5"/>
              <path d="M21 16h-3"/>
              <path d="M21 20h-3"/>
              <path d="M12 7v3"/>
              <path d="M12 11v3"/>
              <path d="M12 15v3"/>
            </svg>
            <span>QR Code</span>
          </div>
          <div class="component-item" draggable="true" @dragstart="onDragStart($event, 'datamatrix')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <rect x="7" y="7" width="3" height="3"/>
              <rect x="14" y="7" width="3" height="3"/>
              <rect x="7" y="14" width="3" height="3"/>
              <rect x="14" y="14" width="3" height="3"/>
            </svg>
            <span>DataMatrix</span>
          </div>
        </div>

        <!-- Image Types -->
        <div class="component-group">
          <h4>Image Types</h4>
          <div class="component-item" draggable="true" @dragstart="onDragStart($event, 'logo')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21,15 16,10 5,21"/>
            </svg>
            <span>Logo</span>
          </div>
          <div class="component-item" draggable="true" @dragstart="onDragStart($event, 'image')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21,15 16,10 5,21"/>
            </svg>
            <span>Background</span>
          </div>
        </div>

        <!-- Dynamic Fields -->
        <div class="component-group">
          <h4>Dynamic Fields</h4>
          <div class="component-item dynamic-field" draggable="true" @dragstart="onDragStart($event, 'dynamic-sku')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
            </svg>
            <span>SKU</span>
            <span class="field-badge">动态</span>
          </div>
          <div class="component-item dynamic-field" draggable="true" @dragstart="onDragStart($event, 'dynamic-lot')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <path d="M9 9h6v6H9z"/>
            </svg>
            <span>Lot No.</span>
            <span class="field-badge">Dynamic</span>
          </div>
          <div class="component-item dynamic-field" draggable="true" @dragstart="onDragStart($event, 'dynamic-qty')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
              <path d="M9 14l2 2 4-4"/>
            </svg>
            <span>Quantity</span>
            <span class="field-badge">Dynamic</span>
          </div>
          <div class="component-item dynamic-field" draggable="true" @dragstart="onDragStart($event, 'dynamic-bin')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
            <span>Bin Code</span>
            <span class="field-badge">Dynamic</span>
          </div>
          <div class="component-item dynamic-field" draggable="true" @dragstart="onDragStart($event, 'dynamic-date')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span>Date</span>
            <span class="field-badge">Dynamic</span>
          </div>
          <div class="component-item dynamic-field" draggable="true" @dragstart="onDragStart($event, 'dynamic-sn')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="16" rx="2"/>
              <line x1="7" y1="8" x2="17" y2="8"/>
              <line x1="7" y1="12" x2="17" y2="12"/>
              <line x1="7" y1="16" x2="12" y2="16"/>
            </svg>
            <span>Serial No.</span>
            <span class="field-badge">Unique</span>
          </div>
        </div>
      </div>

      <!-- Canvas Area -->
      <div class="canvas-container">
        <!-- Canvas Toolbar -->
        <div class="canvas-toolbar">
          <div class="paper-size-selector">
            <label>Paper Size:</label>
            <select v-model="paperSize" @change="updatePaperSize" class="paper-select">
              <option value="50x30">50×30mm</option>
              <option value="100x60">100×60mm</option>
              <option value="80x50">80×50mm</option>
              <option value="120x80">120×80mm</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div class="canvas-controls">
            <button @click="toggleGrid" class="btn btn-sm" :class="{ active: showGrid }">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>
              Grid
            </button>
            <button @click="toggleRulers" class="btn btn-sm" :class="{ active: showRulers }">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 3v18h18"/>
                <path d="M18 17V7"/>
                <path d="M13 17V7"/>
                <path d="M8 17V7"/>
                <path d="M3 7h18"/>
                <path d="M3 12h18"/>
                <path d="M3 17h18"/>
              </svg>
              Rulers
            </button>
            <button @click="previewMode" class="btn btn-sm btn-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              Preview
            </button>
          </div>
        </div>

        <div class="canvas-wrapper" 
             @dragover="onDragOver" 
             @drop="onDrop">
          <!-- 打印纸背景 -->
          <div class="paper-background" :class="{ 'show-grid': showGrid, 'show-rulers': showRulers }">
            <canvas id="labelCanvas" ref="canvasRef"></canvas>
            <!-- 对齐辅助线 -->
            <div v-if="showAlignmentGuides" class="alignment-guides">
              <div v-for="guide in alignmentGuides" :key="guide.id" 
                   :class="['guide-line', guide.type]" 
                   :style="guide.style"></div>
            </div>
          </div>
        </div>
        
        <!-- Canvas Status -->
        <div class="canvas-status">
          <span>Position: ({{ mousePos.x }}, {{ mousePos.y }})</span>
          <span>Zoom: {{ Math.round(zoom * 100) }}%</span>
          <span>Elements: {{ canvasObjects.length }}</span>
          <span>Paper: {{ paperSize }}</span>
        </div>
      </div>

      <!-- Properties Panel -->
      <div class="properties-panel">
        <h3>⚙️ Properties</h3>
        
        <!-- Canvas Properties -->
        <div v-if="!selectedElement" class="canvas-properties">
          <div class="property-section">
            <h4>Canvas Settings</h4>
            <div class="property-group">
              <label>Paper Size:</label>
              <select v-model="paperSize" @change="updatePaperSize" class="property-select">
                <option value="50x30">50×30mm</option>
                <option value="100x60">100×60mm</option>
                <option value="80x50">80×50mm</option>
                <option value="120x80">120×80mm</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div v-if="paperSize === 'custom'" class="property-group">
              <label>Custom Size:</label>
              <div class="size-inputs">
                <input v-model.number="canvasWidth" type="number" placeholder="Width" @change="resizeCanvas">
                <span>×</span>
                <input v-model.number="canvasHeight" type="number" placeholder="Height" @change="resizeCanvas">
                <span>px</span>
              </div>
            </div>
            <div class="property-group">
              <label>Print Orientation:</label>
              <div class="radio-group">
                <label class="radio-item">
                  <input type="radio" v-model="printOrientation" value="portrait">
                  <span>Portrait</span>
                </label>
                <label class="radio-item">
                  <input type="radio" v-model="printOrientation" value="landscape">
                  <span>Landscape</span>
                </label>
              </div>
            </div>
            <div class="property-group">
              <label>Background Color:</label>
              <input v-model="canvasBackground" type="color" @change="updateCanvasBackground">
            </div>
            <div class="property-group">
              <label>Background Image:</label>
              <input type="file" @change="handleBackgroundImage" accept="image/*" class="file-input">
            </div>
          </div>

          <div class="property-section">
            <h4>Data Binding</h4>
            <div class="property-group">
              <label>Bind Product:</label>
              <select v-model="boundProduct" @change="updateDynamicFields" class="property-select">
                <option :value="null">None (Design Mode)</option>
                <option v-for="item in mockInventory" :key="item.sku" :value="item">
                  {{ item.name }}
                </option>
              </select>
            </div>
            <div v-if="boundProduct" class="bound-info">
              <div class="info-row">
                <span class="label">SKU:</span>
                <span class="value">{{ boundProduct.sku }}</span>
              </div>
              <div class="info-row">
                <span class="label">Price:</span>
                <span class="value">${{ boundProduct.price }}</span>
              </div>
            </div>
          </div>

          <div class="property-section">
            <h4>Template Management</h4>
            <div class="template-actions">
              <button @click="saveTemplate" class="btn btn-success btn-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17,21 17,13 7,13 7,21"/>
                  <polyline points="7,3 7,8 15,8"/>
                </svg>
                Save Template
              </button>
              <button @click="loadTemplate" class="btn btn-info btn-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14,2 14,8 20,8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10,9 9,9 8,9"/>
                </svg>
                Load Template
              </button>
            </div>
            <div class="template-list">
              <div class="template-item" v-for="template in savedTemplates" :key="template.id" @click="applyTemplate(template)">
                <div class="template-preview">
                  <img :src="template.preview" :alt="template.name">
                </div>
                <div class="template-info">
                  <span class="template-name">{{ template.name }}</span>
                  <span class="template-size">{{ template.size }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 元素属性 -->
        <div v-if="selectedElement" class="element-properties">
          <div class="element-header">
            <span>{{ getElementTypeName(selectedElement.type) }}</span>
            <button @click="deleteElement" class="btn btn-danger btn-sm">🗑️</button>
          </div>

          <!-- 通用属性 -->
          <div class="property-group">
            <label>位置 X:</label>
            <input v-model.number="selectedElement.left" type="number" @input="updateElement">
          </div>
          <div class="property-group">
            <label>位置 Y:</label>
            <input v-model.number="selectedElement.top" type="number" @input="updateElement">
          </div>
          <div class="property-group">
            <label>宽度:</label>
            <input v-model.number="selectedElement.width" type="number" @input="updateElement">
          </div>
          <div class="property-group">
            <label>高度:</label>
            <input v-model.number="selectedElement.height" type="number" @input="updateElement">
          </div>
          <div class="property-group">
            <label>旋转:</label>
            <input v-model.number="selectedElement.angle" type="number" min="0" max="360" @input="updateElement">
          </div>

          <!-- 动态字段属性 -->
          <div v-if="selectedElement.type === 'dynamic-field'" class="dynamic-field-properties">
            <div class="property-section">
              <h4>Dynamic Field Settings</h4>
              <div class="property-group">
                <label>Field Type:</label>
                <select v-model="selectedElement.fieldType" @change="updateDynamicField" class="property-select">
                  <option value="SKU">SKU</option>
                  <option value="LOT">Lot No.</option>
                  <option value="QTY">Quantity</option>
                  <option value="BIN">Bin Code</option>
                  <option value="DATE">Date</option>
                </select>
              </div>
              <div class="property-group">
                <label>Display Text:</label>
                <input v-model="selectedElement.text" @input="updateElement" class="text-input" readonly>
                <small class="field-note">This field will be replaced with actual data during printing</small>
              </div>
            </div>

            <div class="property-section">
              <h4>Font Settings</h4>
              <div class="property-group">
                <label>Font:</label>
                <select v-model="selectedElement.fontFamily" @change="updateElement" class="property-select">
                  <option value="Arial">Arial</option>
                  <option value="Helvetica">Helvetica</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Verdana">Verdana</option>
                </select>
              </div>
              <div class="property-group">
                <label>Font Size:</label>
                <input v-model.number="selectedElement.fontSize" type="number" min="8" max="200" @input="updateElement">
              </div>
              <div class="property-group">
                <label>Font Color:</label>
                <input v-model="selectedElement.fill" type="color" @input="updateElement">
              </div>
              <div class="property-group">
                <label>Font Style:</label>
                <div class="checkbox-group">
                  <label class="checkbox-item">
                    <input type="checkbox" v-model="selectedElement.fontWeight" value="bold" @change="updateElement">
                    <span>Bold</span>
                  </label>
                  <label class="checkbox-item">
                    <input type="checkbox" v-model="selectedElement.fontStyle" value="italic" @change="updateElement">
                    <span>Italic</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- 文本属性 -->
          <div v-if="selectedElement.type === 'text'" class="text-properties">
            <div class="property-section">
              <h4>文本内容</h4>
              <div class="property-group">
                <label>文本内容:</label>
                <textarea v-model="selectedElement.text" @input="updateElement" class="text-input" rows="3"></textarea>
              </div>
              <div class="property-group">
                <label>动态绑定:</label>
                <select v-model="selectedElement.dynamicField" @change="updateElement" class="property-select">
                  <option value="">无绑定</option>
                  <option value="sku">SKU</option>
                  <option value="lot">批次号</option>
                  <option value="qty">数量</option>
                  <option value="bin">库位号</option>
                  <option value="date">日期</option>
                </select>
              </div>
            </div>

            <div class="property-section">
              <h4>字体设置</h4>
              <div class="property-group">
                <label>字体:</label>
                <select v-model="selectedElement.fontFamily" @change="updateElement" class="property-select">
                  <option value="Arial">Arial</option>
                  <option value="Helvetica">Helvetica</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Verdana">Verdana</option>
                </select>
              </div>
              <div class="property-group">
                <label>字体大小:</label>
                <input v-model.number="selectedElement.fontSize" type="number" min="8" max="200" @input="updateElement">
              </div>
              <div class="property-group">
                <label>字体颜色:</label>
                <input v-model="selectedElement.fill" type="color" @input="updateElement">
              </div>
              <div class="property-group">
                <label>字体样式:</label>
                <div class="checkbox-group">
                  <label class="checkbox-item">
                    <input type="checkbox" v-model="selectedElement.fontWeight" value="bold" @change="updateElement">
                    <span>粗体</span>
                  </label>
                  <label class="checkbox-item">
                    <input type="checkbox" v-model="selectedElement.fontStyle" value="italic" @change="updateElement">
                    <span>斜体</span>
                  </label>
                </div>
              </div>
              <div class="property-group">
                <label>对齐方式:</label>
                <div class="alignment-buttons">
                  <button @click="setTextAlign('left')" class="btn btn-sm" :class="{ active: selectedElement.textAlign === 'left' }">左</button>
                  <button @click="setTextAlign('center')" class="btn btn-sm" :class="{ active: selectedElement.textAlign === 'center' }">中</button>
                  <button @click="setTextAlign('right')" class="btn btn-sm" :class="{ active: selectedElement.textAlign === 'right' }">右</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Barcode Properties -->
          <div v-if="selectedElement.type === 'barcode'" class="barcode-properties">
            <div class="property-section">
              <h4>Barcode Content</h4>
              <div class="property-group">
                <label>Barcode Data:</label>
                <input v-model="selectedElement.barcodeData" @input="updateBarcode" class="text-input" placeholder="Enter barcode data">
              </div>
              <div class="property-group">
                <label>Dynamic Binding:</label>
                <select v-model="selectedElement.dynamicField" @change="updateElement" class="property-select">
                  <option value="">No Binding</option>
                  <option value="sku">SKU</option>
                  <option value="lot">Lot No.</option>
                  <option value="qty">Quantity</option>
                  <option value="bin">Bin Code</option>
                </select>
              </div>
            </div>

            <div class="property-section">
              <h4>Barcode Settings</h4>
              <div class="property-group">
                <label>Barcode Format:</label>
                <select v-model="selectedElement.barcodeFormat" @change="updateBarcode" class="property-select">
                  <option value="CODE128">Code 128</option>
                  <option value="EAN13">EAN-13</option>
                  <option value="EAN8">EAN-8</option>
                  <option value="CODE39">Code 39</option>
                  <option value="ITF14">ITF-14</option>
                  <option value="MSI">MSI</option>
                </select>
              </div>
              <div class="property-group">
                <label>Barcode Size:</label>
                <div class="size-inputs">
                  <input v-model.number="selectedElement.barcodeWidth" type="number" min="1" max="10" @input="updateBarcode" placeholder="Width">
                  <input v-model.number="selectedElement.barcodeHeight" type="number" min="10" max="200" @input="updateBarcode" placeholder="Height">
                </div>
              </div>
              <div class="property-group">
                <label>Display Options:</label>
                <div class="checkbox-group">
                  <label class="checkbox-item">
                    <input type="checkbox" v-model="selectedElement.showText" @change="updateBarcode">
                    <span>Show Text</span>
                  </label>
                  <label class="checkbox-item">
                    <input type="checkbox" v-model="selectedElement.showBackground" @change="updateBarcode">
                    <span>Show Background</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- QR Code Properties -->
          <div v-if="selectedElement.type === 'qrcode'" class="qrcode-properties">
            <div class="property-section">
              <h4>QR Code Content</h4>
              <div class="property-group">
                <label>QR Code Data:</label>
                <input v-model="selectedElement.qrData" @input="updateQRCode" class="text-input" placeholder="Enter QR code data">
              </div>
              <div class="property-group">
                <label>QR Code Type:</label>
                <div class="qr-type-display">
                  <span class="qr-type-badge">{{ selectedElement.qrType }}</span>
                  <span class="qr-type-info">{{ getQRTypeDescription(selectedElement.qrType) }}</span>
                </div>
              </div>
            </div>
            
            <div class="property-section">
              <h4>QR Code Settings</h4>
              <div class="property-group">
                <label>QR Code Size:</label>
                <input v-model.number="selectedElement.qrSize" type="number" min="50" max="300" @input="updateQRCode">
              </div>
              <div class="property-group">
                <label>Error Correction Level:</label>
                <select v-model="selectedElement.errorCorrectionLevel" @change="updateQRCode" class="property-select">
                  <option value="L">Low (7%)</option>
                  <option value="M">Medium (15%)</option>
                  <option value="Q">Quartile (25%)</option>
                  <option value="H">High (30%)</option>
                </select>
              </div>
            </div>
            
            <div class="property-group">
              <label>快速模板:</label>
              <div class="qr-templates">
                <button @click="applyQRTemplate('item')" class="btn btn-sm btn-outline">物料</button>
                <button @click="applyQRTemplate('lot')" class="btn btn-sm btn-outline">批次</button>
                <button @click="applyQRTemplate('bin')" class="btn btn-sm btn-outline">库位</button>
                <button @click="applyQRTemplate('po')" class="btn btn-sm btn-outline">采购订单</button>
                <button @click="applyQRTemplate('so')" class="btn btn-sm btn-outline">销售订单</button>
                <button @click="applyQRTemplate('move')" class="btn btn-sm btn-outline">移库任务</button>
              </div>
            </div>
            
            <div class="property-group">
              <label>技术信息:</label>
              <div class="tech-info">
                <small>版本: {{ selectedElement.qrData?.v || 'N/A' }}</small>
                <small>时间戳: {{ formatTimestamp(selectedElement.qrData?.ts) }}</small>
                <small>随机数: {{ selectedElement.qrData?.nonce?.substring(0, 8) || 'N/A' }}...</small>
                <small>签名: {{ selectedElement.qrData?.sig?.substring(0, 16) || 'N/A' }}...</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部状态栏 -->
    <div class="status-bar">
      <span>就绪</span>
      <span>|</span>
      <span>画布: {{ canvasWidth }} × {{ canvasHeight }}</span>
      <span>|</span>
      <span>选中: {{ selectedElement ? getElementTypeName(selectedElement.type) : '无' }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as fabric from 'fabric'
import JsBarcode from 'jsbarcode'

// 响应式数据
const canvasRef = ref(null)
const fabricCanvas = ref(null)
const selectedElement = ref(null)
const elementCounter = ref(0)
const canvasWidth = ref(800)
const canvasHeight = ref(600)
const canvasBackground = ref('#ffffff')
const zoom = ref(1)
const mousePos = ref({ x: 0, y: 0 })
const canvasObjects = ref([])
const draggedComponent = ref(null)
const selectedTemplate = ref('')

// 新增的响应式数据
const paperSize = ref('100x60')
const printOrientation = ref('portrait')
const showGrid = ref(false)
const showRulers = ref(false)
const showAlignmentGuides = ref(false)
const alignmentGuides = ref([])
const savedTemplates = ref([
  {
    id: 1,
    name: '产品标签',
    size: '100×60mm',
    preview: '/api/templates/product-preview.png'
  },
  {
    id: 2,
    name: '仓库标签',
    size: '80×50mm',
    preview: '/api/templates/warehouse-preview.png'
  }
])

// Data Binding
const boundProduct = ref(null)
const mockInventory = [
  { sku: 'PAD-001-XL', name: 'Smart Tablet XL', price: 599.00, description: '12-inch High Performance Tablet' },
  { sku: 'LAP-002-15', name: 'Pro Laptop 15"', price: 1299.00, description: 'Professional Workstation Laptop' },
  { sku: 'PHN-003-6', name: 'Smartphone 6"', price: 899.00, description: 'Latest Gen Smartphone' },
  { sku: 'WCH-004-S', name: 'Smart Watch S', price: 299.00, description: 'Fitness Tracking Smart Watch' }
]

// 生命周期
onMounted(async () => {
  await nextTick()
  initCanvas()
})

onBeforeUnmount(() => {
  if (fabricCanvas.value) {
    fabricCanvas.value.dispose()
  }
})

  // 初始化画布
  const initCanvas = () => {
    if (!canvasRef.value) return
    
    fabricCanvas.value = new fabric.Canvas('labelCanvas', {
      width: canvasWidth.value,
      height: canvasHeight.value,
      backgroundColor: canvasBackground.value,
      selection: true
    })

    setupCanvasEvents()
  }

  // 设置画布事件
  const setupCanvasEvents = () => {
    if (!fabricCanvas.value) return
    
    // 选择事件
    fabricCanvas.value.on('selection:created', handleSelection)
    fabricCanvas.value.on('selection:updated', handleSelection)
    fabricCanvas.value.on('selection:cleared', () => {
      selectedElement.value = null
    })

    // 对象修改事件
    fabricCanvas.value.on('object:modified', handleObjectModified)
    
    // 鼠标移动事件
    fabricCanvas.value.on('mouse:move', (e) => {
      const pointer = fabricCanvas.value.getPointer(e.e)
      mousePos.value = {
        x: Math.round(pointer.x),
        y: Math.round(pointer.y)
      }
    })

    // 鼠标点击事件 - 处理画布点击和元素点击
    fabricCanvas.value.on('mouse:down', handleMouseDown)
  }

// 拖拽开始
const onDragStart = (event, componentType) => {
  draggedComponent.value = componentType
}

// 拖拽悬停
const onDragOver = (event) => {
  event.preventDefault()
}

// 拖拽放置
const onDrop = (event) => {
  event.preventDefault()
  
  if (!draggedComponent.value || !fabricCanvas.value) return
  
  const rect = event.target.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  
  switch (draggedComponent.value) {
    case 'text':
      createTextElement(x, y)
      break
    case 'rectangle':
      createRectangleElement(x, y)
      break
    case 'circle':
      createCircleElement(x, y)
      break
    case 'barcode':
      createBarcodeElement(x, y)
      break
    case 'qrcode':
      createQRCodeElement(x, y)
      break
    case 'dynamic-sku':
      createDynamicFieldElement(x, y, 'SKU')
      break
    case 'dynamic-lot':
      createDynamicFieldElement(x, y, 'LOT')
      break
    case 'dynamic-qty':
      createDynamicFieldElement(x, y, 'QTY')
      break
    case 'dynamic-bin':
      createDynamicFieldElement(x, y, 'BIN')
      break
    case 'dynamic-date':
      createDynamicFieldElement(x, y, 'DATE')
      break
  }
  
  draggedComponent.value = null
}

// 创建文本元素
const createTextElement = (x, y) => {
  const textElement = new fabric.Text('新文本', {
    left: x,
    top: y,
    fontSize: 16,
    fill: '#000000',
    fontWeight: 'normal',
    id: ++elementCounter.value,
    type: 'text',
    text: '新文本'
  })
  
  fabricCanvas.value.add(textElement)
  fabricCanvas.value.setActiveObject(textElement)
  handleSelection({ target: textElement })
  updateCanvasObjects()
}

// 创建动态字段元素
const createDynamicFieldElement = (x, y, fieldType) => {
  // 定义占位符文本
  const placeholders = {
    SKU: 'SKU-XXXXXX',
    LOT: 'LOT-YYYYYY', 
    QTY: '100 pcs',
    BIN: 'A1-03-02',
    DATE: '2025-09-24'
  }
  
  const placeholderText = placeholders[fieldType] || 'Dynamic Field'
  
  const dynamicElement = new fabric.Text(placeholderText, {
    left: x,
    top: y,
    fontSize: 16,
    fill: '#0066CC', // 蓝色表示动态字段
    fontWeight: 'bold',
    id: ++elementCounter.value,
    type: 'dynamic-field',
    fieldType: fieldType,
    text: placeholderText,
    isDynamic: true
  })
  
  fabricCanvas.value.add(dynamicElement)
  fabricCanvas.value.setActiveObject(dynamicElement)
  handleSelection({ target: dynamicElement })
  updateCanvasObjects()
}

// 创建矩形元素
const createRectangleElement = (x, y) => {
  const rectElement = new fabric.Rect({
    left: x,
    top: y,
    width: 100,
    height: 60,
    fill: 'transparent',
    stroke: '#000000',
    strokeWidth: 2,
    id: ++elementCounter.value,
    type: 'rectangle'
  })
  
  fabricCanvas.value.add(rectElement)
  fabricCanvas.value.setActiveObject(rectElement)
  handleSelection({ target: rectElement })
  updateCanvasObjects()
}

// 创建圆形元素
const createCircleElement = (x, y) => {
  const circleElement = new fabric.Circle({
    left: x,
    top: y,
    radius: 30,
    fill: 'transparent',
    stroke: '#000000',
    strokeWidth: 2,
    id: ++elementCounter.value,
    type: 'circle'
  })
  
  fabricCanvas.value.add(circleElement)
  fabricCanvas.value.setActiveObject(circleElement)
  handleSelection({ target: circleElement })
  updateCanvasObjects()
}

// 创建条码元素
const createBarcodeElement = (x, y) => {
  try {
    const barcodeData = '123456789'
    
    // 创建条码占位符 - 使用矩形和线条模拟条码
    const barcodeGroup = new fabric.Group([], {
      left: x,
      top: y,
      id: ++elementCounter.value,
      type: 'barcode',
      barcodeData: barcodeData,
      barcodeFormat: 'CODE128'
    })
    
    // 添加条码背景
    const background = new fabric.Rect({
      left: 0,
      top: 0,
      width: 200,
      height: 60,
      fill: '#ffffff',
      stroke: '#cccccc',
      strokeWidth: 1
    })
    
    // 添加条码线条（模拟）
    const bars = []
    for (let i = 0; i < 20; i++) {
      const bar = new fabric.Rect({
        left: 10 + i * 8,
        top: 10,
        width: Math.random() > 0.5 ? 2 : 4,
        height: 30,
        fill: '#000000'
      })
      bars.push(bar)
    }
    
    // 添加条码文字
    const text = new fabric.Text(barcodeData, {
      left: 10,
      top: 45,
      fontSize: 12,
      fill: '#000000'
    })
    
    // 将所有元素添加到组
    barcodeGroup.add(background, ...bars, text)
    
    fabricCanvas.value.add(barcodeGroup)
    fabricCanvas.value.setActiveObject(barcodeGroup)
    handleSelection({ target: barcodeGroup })
    updateCanvasObjects()
  } catch (error) {
    console.error('创建条码失败:', error)
  }
}

// 创建二维码元素
const createQRCodeElement = (x, y) => {
  try {
    const qrData = 'https://example.com'
    
    // 创建二维码占位符 - 使用矩形模拟二维码
    const qrGroup = new fabric.Group([], {
      left: x,
      top: y,
      id: ++elementCounter.value,
      type: 'qrcode',
      qrData: qrData,
      qrSize: 100,
      qrType: 'URL'
    })
    
    // 添加二维码背景
    const background = new fabric.Rect({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      fill: '#ffffff',
      stroke: '#333333',
      strokeWidth: 2
    })
    
    // 添加二维码方块（模拟）
    const squares = []
    // 添加三个定位点（左上、右上、左下）
    const cornerSquares = [
      { x: 5, y: 5, size: 15 },
      { x: 80, y: 5, size: 15 },
      { x: 5, y: 80, size: 15 }
    ]
    
    cornerSquares.forEach(corner => {
      // 外框
      squares.push(new fabric.Rect({
        left: corner.x,
        top: corner.y,
        width: corner.size,
        height: corner.size,
        fill: '#000000'
      }))
      // 内框
      squares.push(new fabric.Rect({
        left: corner.x + 3,
        top: corner.y + 3,
        width: corner.size - 6,
        height: corner.size - 6,
        fill: '#ffffff'
      }))
      // 中心点
      squares.push(new fabric.Rect({
        left: corner.x + 6,
        top: corner.y + 6,
        width: corner.size - 12,
        height: corner.size - 12,
        fill: '#000000'
      }))
    })
    
    // 添加随机数据块
    for (let i = 0; i < 20; i++) {
      const square = new fabric.Rect({
        left: 25 + (i % 5) * 10,
        top: 25 + Math.floor(i / 5) * 10,
        width: 8,
        height: 8,
        fill: Math.random() > 0.5 ? '#000000' : '#ffffff'
      })
      squares.push(square)
    }
    
    // 添加二维码文字
    const text = new fabric.Text('QR Code', {
      left: 25,
      top: 85,
      fontSize: 10,
      fill: '#666666'
    })
    
    // 将所有元素添加到组
    qrGroup.add(background, ...squares, text)
    
    fabricCanvas.value.add(qrGroup)
    fabricCanvas.value.setActiveObject(qrGroup)
    handleSelection({ target: qrGroup })
    updateCanvasObjects()
  } catch (error) {
    console.error('创建二维码失败:', error)
  }
}

// 处理鼠标点击事件
const handleMouseDown = (e) => {
  if (e.target) {
    // 点击了元素，选择该元素
    handleSelection({ target: e.target })
  } else {
    // 点击了画布空白处，清除选择
    selectedElement.value = null
  }
}

// 处理选择事件
const handleSelection = (e) => {
  const activeObject = e.target
  if (activeObject) {
    // 计算实际的显示尺寸（考虑缩放）
    let displayWidth, displayHeight
    
    if (activeObject.type === 'text') {
      // 对于文本元素，使用缩放后的尺寸
      displayWidth = Math.round(activeObject.width * (activeObject.scaleX || 1))
      displayHeight = Math.round(activeObject.height * (activeObject.scaleY || 1))
    } else {
      // 对于其他元素，直接使用宽度和高度
      displayWidth = Math.round(activeObject.width || 0)
      displayHeight = Math.round(activeObject.height || 0)
    }
    
    selectedElement.value = {
      id: activeObject.id,
      type: activeObject.type,
      left: Math.round(activeObject.left),
      top: Math.round(activeObject.top),
      width: displayWidth,
      height: displayHeight,
      angle: Math.round(activeObject.angle || 0),
      text: activeObject.text,
      fontSize: activeObject.fontSize,
      fill: activeObject.fill,
      fontWeight: activeObject.fontWeight,
      barcodeData: activeObject.barcodeData,
      barcodeFormat: activeObject.barcodeFormat,
      qrData: activeObject.qrData,
      qrSize: activeObject.qrSize,
      qrErrorLevel: activeObject.qrErrorLevel,
      qrType: activeObject.qrType
    }
  }
}

// 处理对象修改事件
const handleObjectModified = (e) => {
  const modifiedObject = e.target
  if (modifiedObject && selectedElement.value && modifiedObject.id === selectedElement.value.id) {
    selectedElement.value.left = Math.round(modifiedObject.left)
    selectedElement.value.top = Math.round(modifiedObject.top)
    selectedElement.value.width = Math.round(modifiedObject.width * (modifiedObject.scaleX || 1))
    selectedElement.value.height = Math.round(modifiedObject.height * (modifiedObject.scaleY || 1))
    selectedElement.value.angle = Math.round(modifiedObject.angle || 0)
  }
}

// 更新画布对象列表
const updateCanvasObjects = () => {
  if (fabricCanvas.value) {
    canvasObjects.value = fabricCanvas.value.getObjects().filter(obj => obj.type)
  }
}

// 更新元素
const updateElement = () => {
  if (!selectedElement.value || !fabricCanvas.value) return
  
  const object = fabricCanvas.value.getObjects().find(obj => obj.id === selectedElement.value.id)
  if (object) {
    // 更新位置和旋转
    object.set({
      left: selectedElement.value.left,
      top: selectedElement.value.top,
      angle: selectedElement.value.angle
    })
    
    // 根据元素类型处理宽度和高度
    if (selectedElement.value.type === 'text') {
      // 对于文本元素，通过缩放来实现尺寸调整
      const originalWidth = object.width || 100
      const originalHeight = object.height || 50
      
      const scaleX = selectedElement.value.width / originalWidth
      const scaleY = selectedElement.value.height / originalHeight
      
      object.set({
        scaleX: scaleX,
        scaleY: scaleY,
        text: selectedElement.value.text,
        fontSize: selectedElement.value.fontSize,
        fill: selectedElement.value.fill,
        fontWeight: selectedElement.value.fontWeight
      })
    } else if (selectedElement.value.type === 'rectangle') {
      // 对于矩形元素，设置宽度和高度
      object.set({
        width: selectedElement.value.width,
        height: selectedElement.value.height
      })
    } else if (selectedElement.value.type === 'circle') {
      // 对于圆形元素，设置半径（宽度的一半）
      const radius = selectedElement.value.width / 2
      object.set({
        radius: radius
      })
    }
    
    // 强制重新渲染画布
    fabricCanvas.value.requestRenderAll()
    
    // 更新画布对象列表
    updateCanvasObjects()
  }
}

// 更新动态字段
const updateDynamicField = () => {
  if (!selectedElement.value || !fabricCanvas.value) return
  
  const object = fabricCanvas.value.getObjects().find(obj => obj.id === selectedElement.value.id)
  if (object && selectedElement.value.type === 'dynamic-field') {
    let newText = 'Dynamic Field'
    
    if (boundProduct.value) {
      // 如果绑定了商品，使用商品数据
      switch (selectedElement.value.fieldType) {
        case 'SKU': newText = boundProduct.value.sku; break
        case 'LOT': newText = 'L' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-001'; break
        case 'QTY': newText = '1 pcs'; break
        case 'BIN': newText = 'A1-03-02'; break // Mock Bin
        case 'DATE': newText = new Date().toLocaleDateString(); break
        case 'SN': newText = 'SN-' + boundProduct.value.sku + '-0001'; break
        default: newText = boundProduct.value.name
      }
    } else {
      // 否则使用占位符
      const placeholders = {
        SKU: 'SKU-XXXXXX',
        LOT: 'LOT-YYYYYY', 
        QTY: '100 pcs',
        BIN: 'A1-03-02',
        DATE: '2025-09-24',
        SN: 'SN-000001'
      }
      newText = placeholders[selectedElement.value.fieldType] || 'Dynamic Field'
    }
    
    object.set({
      text: newText,
      fieldType: selectedElement.value.fieldType
    })
    
    // 更新选中元素的文本
    selectedElement.value.text = newText
    
    // 强制重新渲染画布
    fabricCanvas.value.requestRenderAll()
    
    // 更新画布对象列表
    updateCanvasObjects()
  }
}

// 更新所有动态字段（当绑定商品改变时）
const updateDynamicFields = () => {
  if (!fabricCanvas.value) return
  
  const objects = fabricCanvas.value.getObjects()
  objects.forEach(obj => {
    if (obj.type === 'dynamic-field') {
      let newText = ''
      if (boundProduct.value) {
        switch (obj.fieldType) {
          case 'SKU': newText = boundProduct.value.sku; break
          case 'LOT': newText = 'L' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-001'; break
          case 'QTY': newText = '1 pcs'; break
          case 'BIN': newText = 'A1-03-02'; break
          case 'DATE': newText = new Date().toLocaleDateString(); break
          case 'SN': newText = 'SN-' + boundProduct.value.sku + '-0001'; break
          default: newText = boundProduct.value.name
        }
      } else {
        const placeholders = {
          SKU: 'SKU-XXXXXX',
          LOT: 'LOT-YYYYYY', 
          QTY: '100 pcs',
          BIN: 'A1-03-02',
          DATE: '2025-09-24',
          SN: 'SN-000001'
        }
        newText = placeholders[obj.fieldType] || 'Dynamic Field'
      }
      obj.set({ text: newText })
    } else if (obj.type === 'qrcode' && boundProduct.value) {
      // 自动更新二维码为商品SKU或JSON
      obj.set({ qrData: boundProduct.value.sku })
    } else if (obj.type === 'barcode' && boundProduct.value) {
      // 自动更新条码为商品SKU
      obj.set({ barcodeData: boundProduct.value.sku })
    }
  })
  
  // 强制重新渲染画布，确保视觉更新
  fabricCanvas.value.requestRenderAll()
  updateCanvasObjects()
}

// 更新条码
const updateBarcode = () => {
  if (!selectedElement.value || selectedElement.value.type !== 'barcode' || !fabricCanvas.value) return
  
  const object = fabricCanvas.value.getObjects().find(obj => obj.id === selectedElement.value.id)
  if (object) {
    try {
      const tempCanvas = document.createElement('canvas')
      JsBarcode(tempCanvas, selectedElement.value.barcodeData, {
        format: selectedElement.value.barcodeFormat,
        width: 2,
        height: 50,
        displayValue: true,
        fontSize: 14,
        margin: 10
      })
      
      // 使用 fabric.Image.fromURL 替代 loadSVGFromURL
      fabric.Image.fromURL(tempCanvas.toDataURL(), (newBarcode) => {
        newBarcode.set({
          left: object.left,
          top: object.top,
          id: object.id,
          type: 'barcode',
          barcodeData: selectedElement.value.barcodeData,
          barcodeFormat: selectedElement.value.barcodeFormat
        })
        
        fabricCanvas.value.remove(object)
        fabricCanvas.value.add(newBarcode)
        fabricCanvas.value.renderAll()
      })
    } catch (error) {
      console.error('更新条码失败:', error)
      alert('条码格式不正确，请检查输入内容')
    }
  }
}

// 更新二维码
const updateQRCode = () => {
  if (!selectedElement.value || selectedElement.value.type !== 'qrcode' || !fabricCanvas.value) return
  
  const object = fabricCanvas.value.getObjects().find(obj => obj.id === selectedElement.value.id)
  if (object) {
    // 简单更新二维码元素的属性
    object.set({
      qrData: selectedElement.value.qrData,
      qrSize: selectedElement.value.qrSize
    })
    fabricCanvas.value.renderAll()
  }
}

// 删除元素
const deleteElement = () => {
  if (!selectedElement.value || !fabricCanvas.value) return
  
  const object = fabricCanvas.value.getObjects().find(obj => obj.id === selectedElement.value.id)
  if (object) {
    fabricCanvas.value.remove(object)
    selectedElement.value = null
    fabricCanvas.value.renderAll()
    updateCanvasObjects()
  }
}



// 缩放控制
const zoomIn = () => {
  if (zoom.value < 3) {
    zoom.value += 0.1
    updateZoom()
  }
}

const zoomOut = () => {
  if (zoom.value > 0.1) {
    zoom.value -= 0.1
    updateZoom()
  }
}

const updateZoom = () => {
  if (fabricCanvas.value) {
    fabricCanvas.value.setZoom(zoom.value)
    fabricCanvas.value.renderAll()
  }
}

const fitToScreen = () => {
  if (fabricCanvas.value) {
    zoom.value = 1
    updateZoom()
  }
}

// 画布操作
const resizeCanvas = () => {
  if (fabricCanvas.value) {
    fabricCanvas.value.setDimensions({
      width: canvasWidth.value,
      height: canvasHeight.value
    })
    fabricCanvas.value.renderAll()
  }
}

const updateCanvasBackground = () => {
  if (fabricCanvas.value) {
    fabricCanvas.value.backgroundColor = canvasBackground.value
    fabricCanvas.value.renderAll()
  }
}

// 模板操作
const newDesign = () => {
  if (fabricCanvas.value) {
    fabricCanvas.value.clear()
    selectedElement.value = null
    updateCanvasObjects()
  }
}

const saveDesign = () => {
  alert('保存设计功能待实现')
}

const exportImage = () => {
  if (fabricCanvas.value) {
    const dataURL = fabricCanvas.value.toDataURL({
      format: 'png',
      quality: 1
    })
    
    const link = document.createElement('a')
    link.download = `标签设计_${new Date().toLocaleDateString()}.png`
    link.href = dataURL
    link.click()
  }
}

const printLabel = () => {
  if (fabricCanvas.value) {
    const dataURL = fabricCanvas.value.toDataURL({
      format: 'png',
      quality: 1
    })
    
    const printWindow = window.open('', '_blank')
    const htmlContent = '<html><head><title>打印标签</title><style>body{margin:0;padding:20px}img{max-width:100%;height:auto}</style></head><body><img src="' + dataURL + '" alt="标签设计"></body></html>'
    printWindow.document.write(htmlContent)
    printWindow.document.close()
    
    setTimeout(() => {
      printWindow.print()
    }, 100)
  }
}

const loadTemplateByType = (templateType) => {
  if (!fabricCanvas.value) return
  
  fabricCanvas.value.clear()
  selectedElement.value = null
  
  switch (templateType) {
    case 'product':
      createProductTemplate()
      break
    case 'warehouse':
      createWarehouseTemplate()
      break
    case 'shipping':
      createShippingTemplate()
      break
  }
  
  updateCanvasObjects()
}

const createProductTemplate = () => {
  createTextElement(50, 30)
  createTextElement(50, 70)
  createBarcodeElement(50, 150)
}

const createWarehouseTemplate = () => {
  createTextElement(50, 30)
  createTextElement(50, 70)
  createQRCodeElement(50, 150)
}

const createShippingTemplate = () => {
  createTextElement(50, 30)
  createTextElement(50, 70)
  createBarcodeElement(50, 150)
}

// 新增方法
const updatePaperSize = () => {
  const sizes = {
    '50x30': { width: 400, height: 240 },
    '100x60': { width: 800, height: 480 },
    '80x50': { width: 640, height: 400 },
    '120x80': { width: 960, height: 640 }
  }
  
  if (sizes[paperSize.value]) {
    canvasWidth.value = sizes[paperSize.value].width
    canvasHeight.value = sizes[paperSize.value].height
    resizeCanvas()
  }
}

const toggleGrid = () => {
  showGrid.value = !showGrid.value
}

const toggleRulers = () => {
  showRulers.value = !showRulers.value
}

const previewMode = () => {
  // 实现预览模式
  console.log('预览模式')
}

const saveTemplate = () => {
  // 实现保存模板
  console.log('保存模板')
}

const loadTemplate = () => {
  // 实现加载模板
  console.log('加载模板')
}

const applyTemplate = (template) => {
  // 实现应用模板
  console.log('应用模板:', template)
}

const handleBackgroundImage = () => {
  // 实现背景图片处理
  console.log('处理背景图片')
}

const setTextAlign = (align) => {
  if (selectedElement.value && selectedElement.value.type === 'text') {
    selectedElement.value.textAlign = align
    updateElement()
  }
}

// 工具函数
const getElementTypeName = (type) => {
  const typeNames = {
    text: 'Text',
    rectangle: 'Rectangle',
    circle: 'Circle',
    barcode: 'Barcode',
    qrcode: 'QR Code',
    line: 'Line',
    logo: 'Logo',
    image: 'Image',
    'dynamic-field': 'Dynamic Field',
    'dynamic-sku': 'SKU Field',
    'dynamic-lot': 'Lot Field',
    'dynamic-qty': 'Quantity Field',
    'dynamic-bin': 'Bin Field',
    'dynamic-date': 'Date Field'
  }
  return typeNames[type] || 'Unknown'
}
</script>

<style scoped>
/* Apple Glass风格 */
.label-designer {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-primary);
  position: relative;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif;
  color: var(--text-primary);
}

/* 环境光效 */
.ambient-light {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.6;
  animation: float 10s infinite ease-in-out alternate;
  pointer-events: none;
  z-index: 0;
}

.light-1 {
  width: 400px;
  height: 400px;
  background: var(--light-1);
  top: -200px;
  left: -200px;
  animation-delay: 0s;
}

.light-2 {
  width: 500px;
  height: 500px;
  background: var(--light-2);
  bottom: -250px;
  right: -250px;
  animation-delay: 2s;
}

.light-3 {
  width: 350px;
  height: 350px;
  background: var(--light-3);
  top: 50%;
  right: -175px;
  animation-delay: 4s;
}

@keyframes float {
  0% { transform: translate(0, 0); }
  100% { transform: translate(30px, 20px); }
}

/* 顶部工具栏 */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--glass-border);
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  position: relative;
  z-index: 10;
}

.toolbar-left, .toolbar-center, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  background: var(--glass-bg);
  color: var(--text-primary);
  border: 1px solid var(--glass-border);
}

.btn-primary { 
  background: var(--button-bg); 
  color: var(--button-text); 
  border: none;
}

.btn-success, .btn-info, .btn-warning, .btn-danger, .btn-secondary {
  background: var(--glass-bg);
  color: var(--text-primary);
}

.btn:hover { 
  background: var(--glass-border);
  transform: translateY(-1px);
}

.btn-primary:hover {
  background: var(--button-hover-bg);
}

.btn-sm { padding: 6px 12px; font-size: 12px; }

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.zoom-level {
  min-width: 50px;
  text-align: center;
  font-weight: 500;
  color: var(--text-secondary);
}

.template-select {
  padding: 8px 12px;
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  background: var(--glass-bg);
  color: var(--text-primary);
}

/* 主内容区域 */
.main-content {
  flex: 1;
  display: flex;
  gap: 0;
  overflow: hidden;
}

/* 左侧组件面板 */
.component-panel {
  width: 280px;
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-right: 1px solid var(--glass-border);
  padding: 20px;
  overflow-y: auto;
  position: relative;
  z-index: 5;
}

.component-panel h3 {
  margin: 0 0 20px 0;
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 600;
}

.component-group {
  margin-bottom: 25px;
}

.component-group h4 {
  margin: 0 0 15px 0;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 600;
}

.component-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  margin-bottom: 8px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  cursor: grab;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.component-item:hover {
  background: var(--glass-border);
  border-color: var(--text-tertiary);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.component-item:active {
  cursor: grabbing;
}

.component-icon {
  font-size: 20px;
}

/* 动态字段样式 */
.dynamic-field {
  position: relative;
}

.field-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  background: var(--text-tertiary);
  color: var(--text-primary);
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 8px;
  font-weight: 500;
}

/* 画布工具栏 */
.canvas-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: var(--glass-bg);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--glass-border);
}

.paper-size-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.paper-size-selector label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

.paper-select {
  padding: 6px 12px;
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  background: var(--glass-bg);
  color: var(--text-primary);
  font-size: 14px;
}

.canvas-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn.active {
  background: var(--button-bg);
  color: var(--button-text);
}

/* 打印纸背景 */
.paper-background {
  position: relative;
  background: #f5f5f5;
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 20px;
  margin: 20px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.paper-background.show-grid {
  background-image: 
    linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px);
  background-size: 20px 20px;
}

.paper-background.show-rulers::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: 
    linear-gradient(to right, #000 1px, transparent 1px),
    linear-gradient(to bottom, #000 1px, transparent 1px);
  background-size: 20px 20px;
  pointer-events: none;
}

/* 对齐辅助线 */
.alignment-guides {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 10;
}

.guide-line {
  position: absolute;
  background: var(--text-tertiary);
  opacity: 0.8;
}

.guide-line.horizontal {
  height: 1px;
  width: 100%;
}

.guide-line.vertical {
  width: 1px;
  height: 100%;
}

/* 属性面板增强 */
.property-section {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.property-section h4 {
  margin: 0 0 16px 0;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.property-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  font-size: 14px;
  background: var(--glass-bg);
  color: var(--text-primary);
}

.radio-group {
  display: flex;
  gap: 16px;
}

.radio-item {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.radio-item input[type="radio"] {
  margin: 0;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.checkbox-item input[type="checkbox"] {
  margin: 0;
}

.alignment-buttons {
  display: flex;
  gap: 4px;
}

.alignment-buttons .btn {
  flex: 1;
  padding: 6px 12px;
  font-size: 12px;
}

.template-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.template-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.template-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  cursor: pointer;
  background: var(--glass-bg);
  transition: all 0.2s ease;
}

.template-item:hover {
  border-color: #007AFF;
  background: #f8f9ff;
}

.template-preview {
  width: 40px;
  height: 30px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
}

.template-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.template-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.template-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.template-size {
  font-size: 12px;
  color: #666;
}

.file-input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  font-size: 14px;
}

/* 中间画布区域 */
.canvas-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: transparent;
  position: relative;
  z-index: 1;
}

.canvas-wrapper {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  position: relative;
}

#labelCanvas {
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  background: white;
  box-shadow: 0 8px 24px rgba(0,0,0,0.08);
}

.canvas-status {
  display: flex;
  justify-content: space-between;
  padding: 10px 20px;
  background: var(--glass-bg);
  border-top: 1px solid var(--glass-border);
  font-size: 12px;
  color: var(--text-secondary);
}

/* 右侧属性面板 */
.properties-panel {
  width: 300px;
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-left: 1px solid var(--glass-border);
  padding: 20px;
  overflow-y: auto;
  position: relative;
  z-index: 5;
}

.properties-panel h3 {
  margin: 0 0 20px 0;
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 600;
}

.property-group {
  margin-bottom: 20px;
}

.property-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

.property-group input,
.property-group select,
.property-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  font-size: 14px;
  background: var(--glass-bg);
  color: var(--text-primary);
  transition: border-color 0.3s;
}

.property-group input:focus,
.property-group select:focus,
.property-group textarea:focus {
  outline: none;
  border-color: var(--text-tertiary);
}

.size-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
}

.size-inputs input {
  width: calc(50% - 10px);
}

.text-input {
  resize: vertical;
  min-height: 60px;
}

/* 二维码属性样式 */
.qr-type-display {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.qr-type-badge {
  display: inline-block;
  padding: 4px 8px;
  background: var(--text-tertiary);
  color: var(--text-primary);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  text-align: center;
}

.qr-type-info {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.qr-content-info {
  display: flex;
  justify-content: space-between;
  margin-top: 5px;
}

.qr-content-info small {
  color: #888;
  font-size: 11px;
}

.qr-size-info {
  margin-top: 5px;
}

.qr-size-info small {
  color: #888;
  font-size: 11px;
}

.qr-templates {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 8px;
}

.btn-outline {
  background: transparent;
  border: 1px solid #007bff;
  color: #007bff;
}

.btn-outline:hover {
  background: #007bff;
  color: white;
}

/* 业务数据样式 */
.business-data {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 20px;
}

.business-data h4 {
  margin: 0 0 15px 0;
  color: #495057;
  font-size: 14px;
  font-weight: 600;
}

.tech-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
  background: #e9ecef;
  padding: 10px;
  border-radius: 6px;
}

.tech-info small {
  color: #6c757d;
  font-size: 11px;
  font-family: 'Courier New', monospace;
}

/* 元素属性 */
.element-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #e0e0e0;
}

.element-header span {
  font-weight: 600;
  color: #333;
}

/* 底部状态栏 */
.status-bar {
  padding: 8px 20px;
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid var(--glass-border);
  display: flex;
  justify-content: space-between;
  color: var(--text-secondary);
  font-size: 12px;
  position: relative;
  z-index: 10;
}

.bound-info {
  margin-top: 15px;
  padding: 15px;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 8px;
  border: 1px solid var(--glass-border);
}

.info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
}

.info-row:last-child {
  margin-bottom: 0;
}

.info-row .label {
  color: var(--text-secondary);
}

.info-row .value {
  color: var(--text-primary);
  font-weight: 600;
  font-family: 'SF Mono', SFMono-Regular, ui-monospace, monospace;
}

.status-bar span {
  margin-right: 15px;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .component-panel { width: 200px; }
  .properties-panel { width: 250px; }
}

@media (max-width: 768px) {
  .main-content {
    flex-direction: column;
  }
  
  .component-panel,
  .properties-panel {
    width: 100%;
    height: auto;
  }
}
</style>
