const { BOMHeader, BOMLine, Item } = require('../models')
const sequelize = require('../config/database')

// Create BOM (Supports creating a new version or initial version)
const createBOM = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { sku, lines, version, notes } = req.body

        if (!sku || !lines || !Array.isArray(lines)) {
            return res.status(400).json({ success: false, message: 'Invalid parameters: sku and lines are required' })
        }

        // Check if SKU exists
        const item = await Item.findOne({ where: { sku } })
        if (!item) {
            throw new Error(`SKU ${sku} not found in Item master`)
        }

        // Default versioning logic: if not provided, find latest and increment? 
        // For now, let's assume user provides version or we simple use input.
        // If BOM exists for this SKU and Version, throw error.
        const existingBOM = await BOMHeader.findOne({ where: { sku, version: version || 'v1.0' } })
        if (existingBOM) {
            throw new Error(`BOM for ${sku} version ${version || 'v1.0'} already exists.`)
        }

        // Create Header
        const bomHeader = await BOMHeader.create({
            sku,
            version: version || 'v1.0',
            status: 'ACTIVE', // Default to ACTIVE for now
            notes,
            created_by: req.user?.username || 'system'
        }, { transaction })

        // Create Lines
        const bomLines = lines.map(line => ({
            bom_id: bomHeader.id,
            component_sku: line.component_sku,
            qty_per: line.qty_per,
            uom: line.uom || 'pcs',
            scrap_rate: line.scrap_rate || 0,
            notes: line.notes
        }))

        await BOMLine.bulkCreate(bomLines, { transaction })

        await transaction.commit()

        res.json({
            success: true,
            message: 'BOM created successfully',
            data: bomHeader
        })

    } catch (error) {
        await transaction.rollback()
        console.error('Create BOM error:', error)
        res.status(500).json({ success: false, message: error.message })
    }
}

// Get BOM by SKU (Get latest ACTIVE or specific version)
const getBOM = async (req, res) => {
    try {
        const { sku } = req.params
        const { version } = req.query

        const whereClause = { sku }
        if (version) {
            whereClause.version = version
        } else {
            // If no version specified, maybe get the latest created? 
            // Or we can just return all versions if specific logic isn't defined.
            // Let's return all versions for the SKU for now, or just the one if unique.
        }

        const boms = await BOMHeader.findAll({
            where: whereClause,
            include: [{
                model: BOMLine,
                as: 'lines'
            }],
            order: [['created_at', 'DESC']]
        })

        if (!boms || boms.length === 0) {
            return res.status(404).json({ success: false, message: 'BOM not found' })
        }

        // If specific version requested, return object. If not, return list.
        if (version) {
            res.json({ success: true, data: boms[0] })
        } else {
            res.json({ success: true, data: boms })
        }

    } catch (error) {
        console.error('Get BOM error:', error)
        res.status(500).json({ success: false, message: error.message })
    }
}

module.exports = {
    createBOM,
    getBOM
}
