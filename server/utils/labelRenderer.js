const PDFDocument = require('pdfkit')
const QRCode = require('qrcode')
const fs = require('fs')
const path = require('path')

/**
 * 生成批次标签 PDF (50x50mm)
 */
const generateLotLabelPDF = async (labelData, outputPath) => {
    return new Promise(async (resolve, reject) => {
        try {
            // 创建 PDF (A4 可以放多个标签)
            const doc = new PDFDocument({
                size: [141.73, 141.73], // 50mm x 50mm in points (1mm = 2.83465 points)
                margin: 5
            })

            const stream = fs.createWriteStream(outputPath)
            doc.pipe(stream)

            for (let i = 0; i < labelData.length; i++) {
                if (i > 0) doc.addPage()

                const label = labelData[i]

                // Title
                doc.fontSize(10).font('Helvetica-Bold').text('LOT LABEL', { align: 'center' })
                doc.moveDown(0.3)

                // SKU
                doc.fontSize(8).font('Helvetica-Bold').text('SKU:', { continued: true })
                doc.font('Helvetica').text(' ' + label.sku)
                doc.moveDown(0.2)

                // Lot Number
                doc.fontSize(8).font('Helvetica-Bold').text('Lot:', { continued: true })
                doc.font('Helvetica').text(' ' + label.lot)
                doc.moveDown(0.2)

                // Quantity
                doc.fontSize(8).font('Helvetica-Bold').text('Qty:', { continued: true })
                doc.font('Helvetica').text(` ${label.qty} ${label.uom}`)
                doc.moveDown(0.2)

                // Bin Location
                doc.fontSize(8).font('Helvetica-Bold').text('Bin:', { continued: true })
                doc.font('Helvetica').text(' ' + label.bin)
                doc.moveDown(0.2)

                // Expiry Date
                doc.fontSize(8).font('Helvetica-Bold').text('Exp:', { continued: true })
                doc.font('Helvetica').text(' ' + label.exp)
                doc.moveDown(0.5)

                // Generate QR Code
                const qrCodeDataUrl = await QRCode.toDataURL(label.qr_content, {
                    errorCorrectionLevel: 'M',
                    type: 'image/png',
                    width: 200
                })

                // Add QR Code to PDF (centered)
                const qrSize = 60
                const qrX = (doc.page.width - qrSize) / 2
                doc.image(qrCodeDataUrl, qrX, doc.y, { width: qrSize, height: qrSize })
            }

            doc.end()

            stream.on('finish', () => {
                resolve(outputPath)
            })

            stream.on('error', reject)
        } catch (error) {
            reject(error)
        }
    })
}

/**
 * 生成库位标签 PDF (80x40mm)
 */
const generateBinLabelPDF = async (labelData, outputPath) => {
    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: [226.77, 113.39], // 80mm x 40mm
                margin: 5
            })

            const stream = fs.createWriteStream(outputPath)
            doc.pipe(stream)

            for (let i = 0; i < labelData.length; i++) {
                if (i > 0) doc.addPage()

                const label = labelData[i]

                // Left side text information
                const textX = 10
                doc.fontSize(12).font('Helvetica-Bold').text('BIN LABEL', textX, 10)
                doc.moveDown(0.3)

                doc.fontSize(10).font('Helvetica-Bold').text('Bin:', textX, doc.y, { continued: true })
                doc.font('Helvetica').text(' ' + label.bin_code)
                doc.moveDown(0.2)

                doc.fontSize(10).font('Helvetica-Bold').text('Zone:', textX, doc.y, { continued: true })
                doc.font('Helvetica').text(' ' + label.zone)
                doc.moveDown(0.2)

                doc.fontSize(10).font('Helvetica-Bold').text('Capacity:', textX, doc.y, { continued: true })
                doc.font('Helvetica').text(' ' + label.capacity)

                // Right side QR code
                const qrCodeDataUrl = await QRCode.toDataURL(label.qr_content, {
                    errorCorrectionLevel: 'M',
                    type: 'image/png',
                    width: 200
                })

                const qrSize = 80
                const qrX = doc.page.width - qrSize - 10
                doc.image(qrCodeDataUrl, qrX, 10, { width: qrSize, height: qrSize })
            }

            doc.end()

            stream.on('finish', () => {
                resolve(outputPath)
            })

            stream.on('error', reject)
        } catch (error) {
            reject(error)
        }
    })
}

/**
 * 生成物料标签 PDF (60x40mm)
 */
const generateItemLabelPDF = async (labelData, outputPath) => {
    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: [170.08, 113.39], // 60mm x 40mm
                margin: 5
            })

            const stream = fs.createWriteStream(outputPath)
            doc.pipe(stream)

            for (let i = 0; i < labelData.length; i++) {
                if (i > 0) doc.addPage()

                const label = labelData[i]

                doc.fontSize(10).font('Helvetica-Bold').text('ITEM LABEL', { align: 'center' })
                doc.moveDown(0.3)

                doc.fontSize(8).font('Helvetica-Bold').text('SKU:', { continued: true })
                doc.font('Helvetica').text(' ' + label.sku)
                doc.moveDown(0.2)

                doc.fontSize(8).font('Helvetica-Bold').text('Name:', { continued: true })
                doc.font('Helvetica').text(' ' + label.name)
                doc.moveDown(0.2)

                doc.fontSize(8).font('Helvetica-Bold').text('Spec:', { continued: true })
                doc.font('Helvetica').text(' ' + label.spec)
                doc.moveDown(0.5)

                // QR Code
                const qrCodeDataUrl = await QRCode.toDataURL(label.qr_content, {
                    errorCorrectionLevel: 'M',
                    type: 'image/png',
                    width: 200
                })

                const qrSize = 50
                const qrX = (doc.page.width - qrSize) / 2
                doc.image(qrCodeDataUrl, qrX, doc.y, { width: qrSize, height: qrSize })
            }

            doc.end()

            stream.on('finish', () => {
                resolve(outputPath)
            })

            stream.on('error', reject)
        } catch (error) {
            reject(error)
        }
    })
}

/**
 * 根据打印类型生成 PDF
 */
const generateLabelPDF = async (printType, labelData, outputPath) => {
    switch (printType) {
        case 'LOT':
            return await generateLotLabelPDF(labelData, outputPath)
        case 'BIN':
            return await generateBinLabelPDF(labelData, outputPath)
        case 'ITEM':
            return await generateItemLabelPDF(labelData, outputPath)
        default:
            throw new Error(`不支持的打印类型: ${printType}`)
    }
}

module.exports = {
    generateLabelPDF,
    generateLotLabelPDF,
    generateBinLabelPDF,
    generateItemLabelPDF
}
