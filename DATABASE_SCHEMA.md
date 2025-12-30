# 数据库结构文档

## 数据库类型
- **数据库**: MySQL
- **ORM**: Sequelize
- **字符集**: utf8mb4
- **排序规则**: utf8mb4_unicode_ci

---

## 数据表列表

### 1. 用户表 (users)

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | INTEGER | 主键 | 自增 |
| username | STRING | 用户名 | 唯一，非空 |
| email | STRING | 邮箱 | 唯一，非空，邮箱格式 |
| password | STRING | 密码（加密） | 非空 |
| role | ENUM | 角色 | 'admin', 'operator', 'viewer'，默认 'operator' |
| status | ENUM | 状态 | 'active', 'inactive'，默认 'active' |
| avatar | STRING | 头像URL | 可空 |
| createdAt | DATE | 创建时间 | 自动 |
| updatedAt | DATE | 更新时间 | 自动 |

**用途**: 存储系统用户信息，包括登录凭证、角色权限和头像。

---

### 2. 商品表 (items)

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | INTEGER | 主键 | 自增 |
| sku | STRING(50) | 商品SKU编码 | 唯一，非空 |
| name | STRING(200) | 商品名称 | 非空 |
| description | TEXT | 商品描述 | 可空 |
| category | STRING(100) | 商品分类 | 可空 |
| uom | STRING(20) | 计量单位 | 默认 'pcs' |
| min_stock | INTEGER | 最小库存 | 默认 0 |
| max_stock | INTEGER | 最大库存 | 可空 |
| status | ENUM | 商品状态 | 'ACTIVE', 'INACTIVE', 'DISCONTINUED'，默认 'ACTIVE' |
| created_by | STRING(100) | 创建人 | 可空 |
| updated_by | STRING(100) | 更新人 | 可空 |
| createdAt | DATE | 创建时间 | 自动 |
| updatedAt | DATE | 更新时间 | 自动 |

**用途**: 存储商品基础信息，包括SKU、名称、分类等。

**关联关系**:
- 一对多: `lots` (批次)
- 一对多: `purchaseOrderLines` (采购订单行)
- 一对多: `salesOrderLines` (销售订单行)

---

### 3. 库存表 (inventory)

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | INTEGER | 主键 | 自增 |
| itemCode | STRING(50) | 商品编码 | 唯一，非空，索引 |
| itemName | STRING(100) | 商品名称 | 非空 |
| category | STRING(50) | 商品分类 | 非空，索引 |
| quantity | INTEGER | 当前库存数量 | 非空，默认 0 |
| minQuantity | INTEGER | 最小库存数量 | 非空，默认 10 |
| maxQuantity | INTEGER | 最大库存数量 | 非空，默认 1000 |
| unit | STRING(20) | 单位 | 非空，默认 '个' |
| price | DECIMAL(10,2) | 单价 | 非空，默认 0.00 |
| location | STRING(100) | 库位信息 | 可空 |
| supplier | STRING(100) | 供应商 | 可空 |
| leadTime | INTEGER | 交货期（天） | 非空，默认 7 |
| status | ENUM | 库存状态 | 'normal', 'low_stock', 'out_of_stock', 'overstock'，默认 'normal'，索引 |
| lastUpdated | DATE | 最后更新时间 | 非空，默认 NOW |
| tags | JSON | 动态标签信息 | 可空 |
| demandHistory | JSON | 需求历史数据 | 可空 |
| aiPredictions | JSON | AI预测结果 | 可空 |
| createdAt | DATE | 创建时间 | 自动 |
| updatedAt | DATE | 更新时间 | 自动 |

**用途**: 存储库存汇总信息，包括数量、价格、状态等，支持AI预测和历史数据。

**索引**:
- itemCode
- category
- status

---

### 4. 库位表 (bins)

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | INTEGER | 主键 | 自增 |
| bin_code | STRING(50) | 库位编码 | 唯一，非空 |
| zone | STRING(100) | 区域 | 非空 |
| aisle | STRING(50) | 通道 | 可空 |
| rack | STRING(50) | 货架 | 可空 |
| level | STRING(50) | 层级 | 可空 |
| position | STRING(50) | 位置 | 可空 |
| capacity | INTEGER | 容量 | 非空 |
| used | INTEGER | 已使用容量 | 默认 0 |
| status | ENUM | 库位状态 | 'ACTIVE', 'INACTIVE', 'MAINTENANCE'，默认 'ACTIVE' |
| temperature_zone | STRING(50) | 温区 | 可空 |
| hazard_level | ENUM | 危险等级 | 'NONE', 'LOW', 'MEDIUM', 'HIGH'，默认 'NONE' |
| created_by | STRING(100) | 创建人 | 可空 |
| updated_by | STRING(100) | 更新人 | 可空 |
| createdAt | DATE | 创建时间 | 自动 |
| updatedAt | DATE | 更新时间 | 自动 |

**用途**: 存储仓库库位信息，支持多层级库位管理。

**关联关系**:
- 一对多: `lots` (批次)

---

### 5. 批次表 (lots)

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | INTEGER | 主键 | 自增 |
| lot_number | STRING(100) | 批次号 | 唯一，非空 |
| sku | STRING(50) | 商品SKU | 非空，外键 -> items.sku |
| qty | INTEGER | 数量 | 非空 |
| uom | STRING(20) | 计量单位 | 默认 'pcs' |
| bin_id | INTEGER | 库位ID | 非空，外键 -> bins.id |
| bin_code | STRING(50) | 库位编码 | 外键 -> bins.bin_code |
| expiry_date | DATE | 过期时间 | 可空 |
| manufacture_date | DATE | 生产日期 | 可空 |
| supplier | STRING(200) | 供应商 | 可空 |
| po_number | STRING(100) | 采购订单号 | 可空 |
| quality_status | ENUM | 质检状态 | 'PENDING', 'PASSED', 'FAILED', 'QUARANTINE'，默认 'PENDING' |
| status | ENUM | 批次状态 | 'ACTIVE', 'EXPIRED', 'CONSUMED', 'DAMAGED'，默认 'ACTIVE' |
| notes | TEXT | 备注 | 可空 |
| created_by | STRING(100) | 创建人 | 可空 |
| updated_by | STRING(100) | 更新人 | 可空 |
| createdAt | DATE | 创建时间 | 自动 |
| updatedAt | DATE | 更新时间 | 自动 |

**用途**: 存储批次库存信息，支持批次管理和过期管理。

**关联关系**:
- 多对一: `item` (商品)
- 多对一: `bin` (库位)

---

### 6. 交易记录表 (transactions)

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | INTEGER | 主键 | 自增 |
| transactionType | ENUM | 交易类型 | 'in', 'out'，非空，索引 |
| itemCode | STRING(50) | 商品编码 | 非空，索引 |
| itemName | STRING(100) | 商品名称 | 非空 |
| quantity | INTEGER | 交易数量 | 非空 |
| beforeQuantity | INTEGER | 交易前库存 | 非空 |
| afterQuantity | INTEGER | 交易后库存 | 非空 |
| operator | STRING(50) | 操作员 | 可空 |
| operatorId | INTEGER | 操作员ID | 可空，索引 |
| location | STRING(100) | 库位 | 可空 |
| supplier | STRING(100) | 供应商 | 可空 |
| customer | STRING(100) | 客户 | 可空 |
| notes | TEXT | 备注 | 可空 |
| scanCode | STRING(100) | 扫描码 | 可空 |
| transactionTime | DATE | 交易时间 | 非空，默认 NOW，索引 |
| createdAt | DATE | 创建时间 | 自动 |
| updatedAt | DATE | 更新时间 | 自动 |

**用途**: 记录所有入库和出库交易，用于库存追溯和审计。

**索引**:
- itemCode
- transactionType
- transactionTime
- operatorId

---

### 7. 采购订单表 (purchase_orders)

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | BIGINT | 主键 | 自增 |
| po_number | STRING(64) | 采购订单号 | 唯一，非空 |
| supplier_id | BIGINT | 供应商ID | 可空 |
| supplier_name | STRING(255) | 供应商名称 | 可空 |
| order_date | DATE | 订单日期 | 默认 NOW |
| expected_date | DATE | 预期到货日期 | 可空 |
| status | ENUM | 订单状态 | 'DRAFT', 'SENT', 'CONFIRMED', 'PARTIAL', 'COMPLETED', 'CANCELLED'，默认 'DRAFT' |
| total_amount | DECIMAL(15,2) | 订单总金额 | 默认 0 |
| currency | STRING(3) | 货币类型 | 默认 'CNY' |
| payment_terms | STRING(255) | 付款条件 | 可空 |
| delivery_terms | STRING(255) | 交货条件 | 可空 |
| notes | TEXT | 备注 | 可空 |
| created_by | STRING(64) | 创建人 | 可空 |
| created_at | DATE | 创建时间 | 自动 |
| updated_at | DATE | 更新时间 | 自动 |

**用途**: 存储采购订单主信息。

**关联关系**:
- 一对多: `lines` (采购订单行)

---

### 8. 采购订单行表 (purchase_order_lines)

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | BIGINT | 主键 | 自增 |
| po_id | BIGINT | 采购订单ID | 非空，外键 -> purchase_orders.id，索引 |
| line_number | INTEGER | 行号 | 非空 |
| sku | STRING(64) | 商品SKU | 非空，外键 -> items.sku，索引 |
| item_name | STRING(255) | 商品名称 | 可空 |
| description | TEXT | 商品描述 | 可空 |
| qty | DECIMAL(18,4) | 订购数量 | 非空，默认 0 |
| received_qty | DECIMAL(18,4) | 已收货数量 | 默认 0 |
| uom | STRING(16) | 计量单位 | 默认 'pcs' |
| unit_price | DECIMAL(15,4) | 单价 | 默认 0 |
| line_amount | DECIMAL(15,2) | 行金额 | 默认 0 |
| tax_rate | DECIMAL(5,4) | 税率 | 默认 0 |
| delivery_date | DATE | 要求交货日期 | 可空 |
| status | ENUM | 行状态 | 'OPEN', 'PARTIAL', 'CLOSED', 'CANCELLED'，默认 'OPEN'，索引 |
| notes | TEXT | 行备注 | 可空 |
| created_at | DATE | 创建时间 | 自动 |
| updated_at | DATE | 更新时间 | 自动 |

**用途**: 存储采购订单明细行。

**关联关系**:
- 多对一: `purchaseOrder` (采购订单)
- 多对一: `item` (商品)

**索引**:
- po_id
- sku
- status

---

### 9. 销售订单表 (sales_orders)

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | BIGINT | 主键 | 自增 |
| so_number | STRING(64) | 销售订单号 | 唯一，非空 |
| customer_id | BIGINT | 客户ID | 可空 |
| customer_name | STRING(255) | 客户名称 | 可空 |
| order_date | DATE | 订单日期 | 默认 NOW |
| ship_date | DATE | 要求发货日期 | 可空 |
| delivery_date | DATE | 要求交货日期 | 可空 |
| priority | ENUM | 优先级 | 'LOW', 'NORMAL', 'HIGH', 'URGENT'，默认 'NORMAL' |
| status | ENUM | 订单状态 | 'DRAFT', 'CONFIRMED', 'PICKING', 'PARTIAL', 'SHIPPED', 'DELIVERED', 'CANCELLED'，默认 'DRAFT' |
| total_amount | DECIMAL(15,2) | 订单总金额 | 默认 0 |
| currency | STRING(3) | 货币类型 | 默认 'CNY' |
| payment_method | STRING(64) | 付款方式 | 可空 |
| shipping_address | TEXT | 收货地址 | 可空 |
| shipping_method | STRING(64) | 配送方式 | 可空 |
| tracking_number | STRING(128) | 物流单号 | 可空 |
| notes | TEXT | 备注 | 可空 |
| created_by | STRING(64) | 创建人 | 可空 |
| created_at | DATE | 创建时间 | 自动 |
| updated_at | DATE | 更新时间 | 自动 |

**用途**: 存储销售订单主信息。

**关联关系**:
- 一对多: `lines` (销售订单行)

---

### 10. 销售订单行表 (sales_order_lines)

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | BIGINT | 主键 | 自增 |
| so_id | BIGINT | 销售订单ID | 非空，外键 -> sales_orders.id |
| so_number | STRING(50) | 销售订单号 | 非空 |
| sku | STRING(50) | 商品SKU | 非空，外键 -> items.sku |
| item_name | STRING(200) | 商品名称 | 可空 |
| qty | INTEGER | 销售数量 | 非空 |
| picked_qty | INTEGER | 已拣选数量 | 默认 0 |
| shipped_qty | INTEGER | 已发货数量 | 默认 0 |
| uom | STRING(20) | 计量单位 | 默认 'pcs' |
| unit_price | DECIMAL(10,2) | 单价 | 默认 0 |
| line_amount | DECIMAL(10,2) | 行金额 | 默认 0 |
| status | ENUM | 行状态 | 'OPEN', 'PARTIAL', 'COMPLETED'，默认 'OPEN' |
| notes | TEXT | 备注 | 可空 |
| createdAt | DATE | 创建时间 | 自动 |
| updatedAt | DATE | 更新时间 | 自动 |

**用途**: 存储销售订单明细行。

**关联关系**:
- 多对一: `salesOrder` (销售订单)
- 多对一: `item` (商品)

---

### 11. 打印任务表 (print_jobs)

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | INTEGER | 主键 | 自增 |
| job_number | STRING(50) | 打印任务号 | 唯一，非空 |
| template_name | STRING(100) | 模板名称 | 非空 |
| template_id | INTEGER | 模板ID | 可空 |
| print_type | ENUM | 打印类型 | 'LOT', 'BIN', 'ITEM', 'SO', 'PO', 'TASK'，非空 |
| total_count | INTEGER | 总打印数量 | 非空 |
| copies_per_item | INTEGER | 每项打印份数 | 默认 1 |
| format | ENUM | 输出格式 | 'PDF', 'PNG', 'ZPL'，默认 'PDF' |
| dpi | INTEGER | 打印分辨率 | 默认 300 |
| status | ENUM | 任务状态 | 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'，默认 'PENDING' |
| output_file | STRING(500) | 输出文件路径 | 可空 |
| error_message | TEXT | 错误信息 | 可空 |
| created_by | STRING(100) | 创建人 | 可空 |
| completed_at | DATE | 完成时间 | 可空 |
| createdAt | DATE | 创建时间 | 自动 |
| updatedAt | DATE | 更新时间 | 自动 |

**用途**: 存储打印任务信息。

**关联关系**:
- 一对多: `scanLogs` (扫码日志)

---

### 12. 扫码日志表 (scan_logs)

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | INTEGER | 主键 | 自增 |
| print_job_id | INTEGER | 打印任务ID | 外键 -> print_jobs.id |
| raw_content | TEXT | 原始扫描内容 | 非空 |
| parsed_type | STRING(50) | 解析后的类型 | 可空 |
| parsed_id | STRING(100) | 解析后的ID | 可空 |
| parsed_data | JSON | 解析后的完整数据 | 可空 |
| scan_type | ENUM | 扫码类型 | 'INBOUND', 'OUTBOUND', 'MOVE', 'COUNT', 'VERIFY'，可空 |
| user_id | INTEGER | 操作用户ID | 可空 |
| user_name | STRING(100) | 操作用户名称 | 可空 |
| device_id | STRING(100) | 设备ID | 可空 |
| device_type | ENUM | 设备类型 | 'CAMERA', 'SCANNER', 'MANUAL', 'FILE'，可空 |
| ip_address | STRING(45) | IP地址 | 可空 |
| user_agent | STRING(500) | 用户代理 | 可空 |
| success | BOOLEAN | 是否成功 | 默认 true |
| error_message | TEXT | 错误信息 | 可空 |
| processing_time | INTEGER | 处理时间(毫秒) | 可空 |
| next_action | STRING(100) | 下一步动作 | 可空 |
| business_result | JSON | 业务处理结果 | 可空 |
| createdAt | DATE | 创建时间 | 自动 |
| updatedAt | DATE | 更新时间 | 自动 |

**用途**: 记录所有扫码操作日志，用于追溯和审计。

---

## 数据库关系图

```
users (用户)
  └─ 无直接关联

items (商品)
  ├─ 1:N → lots (批次)
  ├─ 1:N → purchase_order_lines (采购订单行)
  └─ 1:N → sales_order_lines (销售订单行)

inventory (库存汇总)
  └─ 独立表（通过 itemCode 关联 items）

bins (库位)
  └─ 1:N → lots (批次)

lots (批次)
  ├─ N:1 → items (商品)
  └─ N:1 → bins (库位)

transactions (交易记录)
  └─ 独立表（通过 itemCode 关联 items）

purchase_orders (采购订单)
  └─ 1:N → purchase_order_lines (采购订单行)

purchase_order_lines (采购订单行)
  ├─ N:1 → purchase_orders (采购订单)
  └─ N:1 → items (商品)

sales_orders (销售订单)
  └─ 1:N → sales_order_lines (销售订单行)

sales_order_lines (销售订单行)
  ├─ N:1 → sales_orders (销售订单)
  └─ N:1 → items (商品)

print_jobs (打印任务)
  └─ 1:N → scan_logs (扫码日志)

scan_logs (扫码日志)
  └─ N:1 → print_jobs (打印任务)
```

---

## 特殊字段说明

### JSON 字段
- `inventory.tags` - 动态标签信息
- `inventory.demandHistory` - 需求历史数据（用于AI预测）
- `inventory.aiPredictions` - AI预测结果
- `scan_logs.parsed_data` - 解析后的完整数据
- `scan_logs.business_result` - 业务处理结果

### ENUM 字段说明
- **用户角色**: admin（管理员）、operator（操作员）、viewer（查看者）
- **订单状态**: DRAFT（草稿）、CONFIRMED（已确认）、COMPLETED（已完成）等
- **库存状态**: normal（正常）、low_stock（低库存）、out_of_stock（缺货）、overstock（超储）

---

## 索引优化

主要索引字段：
- `inventory.itemCode` - 商品编码查询
- `inventory.category` - 分类查询
- `inventory.status` - 状态筛选
- `transactions.itemCode` - 交易记录查询
- `transactions.transactionType` - 交易类型筛选
- `transactions.transactionTime` - 时间范围查询
- `purchase_order_lines.po_id` - 订单行查询
- `purchase_order_lines.sku` - 商品查询

---

## 数据库配置

配置文件: `server/config/database.js`

- **连接池配置**:
  - max: 5 (最大连接数)
  - min: 0 (最小连接数)
  - acquire: 30000 (获取连接超时时间，毫秒)
  - idle: 10000 (空闲连接超时时间，毫秒)




