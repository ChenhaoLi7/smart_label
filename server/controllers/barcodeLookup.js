/**
 * Barcode Lookup Controller
 * 级联查询多个公开条码数据库：
 *   1. Open Food Facts (全球，免费，无需Key)
 *   2. Yahoo Shopping Japan API (日本JAN码，需要 AppID)
 * 如果都查不到，返回 null，前端降级为手动输入。
 */

// ── 数据源 1: Open Food Facts ─────────────────────────────────────────
const lookupOpenFoodFacts = async (barcode) => {
  try {
    const url = `https://world.openfoodfacts.net/api/v2/product/${barcode}?fields=product_name,product_name_en,product_name_ja,brands,categories_en,image_url,quantity`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'PilotInventorySystem/1.0 (lab-pilot-test)' }
    })
    if (!res.ok) return null
    const data = await res.json()

    if (data.status === 1 && data.product) {
      const p = data.product
      return {
        source: 'Open Food Facts',
        product_name: p.product_name || p.product_name_en || p.product_name_ja || '',
        brands: p.brands || '',
        categories_en: p.categories_en || '',
        image_url: p.image_url || '',
        quantity: p.quantity || ''
      }
    }
    return null
  } catch (err) {
    console.error('[OFF] Lookup error:', err.message)
    return null
  }
}

// ── 数据源 2: Yahoo Shopping Japan (JAN コード) ───────────────────────
const lookupYahooJapan = async (barcode) => {
  const appId = process.env.YAHOO_JAPAN_APPID
  if (!appId) {
    console.log('[Yahoo JP] No YAHOO_JAPAN_APPID configured, skipping.')
    return null
  }

  try {
    const url = `https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch?appid=${appId}&jan_code=${barcode}&results=1`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()

    if (data.hits && data.hits.length > 0) {
      const hit = data.hits[0]
      return {
        source: 'Yahoo Shopping Japan',
        product_name: hit.name || '',
        brands: hit.brand?.name || '',
        categories_en: hit.genreCategory?.name || '',
        image_url: hit.image?.medium || '',
        quantity: ''
      }
    }
    return null
  } catch (err) {
    console.error('[Yahoo JP] Lookup error:', err.message)
    return null
  }
}

// ── 主查询函数 (级联) ─────────────────────────────────────────────────
const lookupBarcode = async (req, res) => {
  const barcode = req.params.code
  if (!barcode) {
    return res.status(400).json({ success: false, message: 'Barcode is required' })
  }

  console.log(`[Barcode Lookup] Searching for: ${barcode}`)

  // 先查 Open Food Facts
  let product = await lookupOpenFoodFacts(barcode)
  if (product) {
    console.log(`[Barcode Lookup] ✅ Found in ${product.source}`)
    return res.json({ success: true, data: product })
  }

  // 再查 Yahoo Japan (适合 JAN 码 49/45 开头)
  product = await lookupYahooJapan(barcode)
  if (product) {
    console.log(`[Barcode Lookup] ✅ Found in ${product.source}`)
    return res.json({ success: true, data: product })
  }

  // 全部查不到
  console.log(`[Barcode Lookup] ❌ Not found in any database`)
  return res.json({
    success: true,
    data: null,
    message: 'Product not found in any public database'
  })
}

module.exports = { lookupBarcode }
