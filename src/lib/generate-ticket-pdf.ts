import { jsPDF } from 'jspdf'

// Color palette — Japanese minimalist
const CHARCOAL = '#1a1a2e'
const GOLD = '#C8A951'
const CREAM = '#f9f7f4'
const DARK_CHARCOAL = '#0f0f1e'
const LIGHT_GOLD = '#e8d48b'

interface TicketPdfData {
  customerName: string
  eventName: string
  showDate: string
  location: string
  seatCodes: string[]
  transactionId: string
  totalAmount: number
  qrCodeDataUrl: string
}

export async function generateTicketPdf(data: TicketPdfData): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  // ── Header band ──────────────────────────────────────────
  doc.setFillColor(DARK_CHARCOAL)
  doc.rect(0, 0, pageW, 52, 'F')

  // Gold accent line at bottom of header
  doc.setDrawColor(GOLD)
  doc.setLineWidth(0.8)
  doc.line(0, 52, pageW, 52)

  // Brand text
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(GOLD)
  doc.text('TEATERAN', pageW / 2, 22, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(LIGHT_GOLD)
  doc.text('E-TIKET RESMI  |  OFFICIAL E-TICKET', pageW / 2, 30, { align: 'center' })

  doc.setFontSize(8)
  doc.setTextColor('#888888')
  doc.text('Japanese-Inspired Theater Experience', pageW / 2, 37, { align: 'center' })

  // ── Event Title ──────────────────────────────────────────
  const yStart = 62

  doc.setFontSize(9)
  doc.setTextColor('#999999')
  doc.text('PERTUNJUKAN', pageW / 2, yStart, { align: 'center' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(CHARCOAL)
  doc.text(data.eventName, pageW / 2, yStart + 10, { align: 'center' })

  // Decorative gold line under title
  const titleW = doc.getTextWidth(data.eventName)
  doc.setDrawColor(GOLD)
  doc.setLineWidth(0.3)
  doc.line((pageW - titleW) / 2 - 8, yStart + 13, (pageW + titleW) / 2 + 8, yStart + 13)

  // ── Event Details ────────────────────────────────────────
  const detailY = yStart + 22

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor('#666666')

  // Date
  doc.setFontSize(8)
  doc.setTextColor('#999999')
  doc.text('TANGGAL', pageW / 2, detailY, { align: 'center' })
  doc.setFontSize(11)
  doc.setTextColor(CHARCOAL)
  doc.text(data.showDate, pageW / 2, detailY + 7, { align: 'center' })

  // Location
  doc.setFontSize(8)
  doc.setTextColor('#999999')
  doc.text('LOKASI', pageW / 2, detailY + 16, { align: 'center' })
  doc.setFontSize(11)
  doc.setTextColor(CHARCOAL)
  doc.text(data.location, pageW / 2, detailY + 23, { align: 'center' })

  // ── Seat Codes (prominent) ───────────────────────────────
  const seatY = detailY + 36

  // Background card for seats
  const cardPad = 12
  const seatLabelH = 8
  const seatCodeH = 18
  const cardTotalH = seatLabelH + seatCodeH + cardPad * 2
  const cardW = pageW - 40
  const cardX = 20

  doc.setFillColor(CHARCOAL)
  doc.roundedRect(cardX, seatY, cardW, cardTotalH, 3, 3, 'F')

  doc.setFontSize(7)
  doc.setTextColor(GOLD)
  doc.text('NOMOR KURSI  /  SEAT NUMBERS', pageW / 2, seatY + cardPad + 4, { align: 'center' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  doc.setTextColor('#ffffff')
  doc.text(data.seatCodes.join('    '), pageW / 2, seatY + cardPad + seatLabelH + 12, { align: 'center' })

  // ── QR Code ──────────────────────────────────────────────
  const qrY = seatY + cardTotalH + 12
  const qrSize = 40
  const qrX = pageW / 2 - qrSize / 2

  // Add QR code image (base64 data URL)
  doc.addImage(data.qrCodeDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)

  doc.setFontSize(7)
  doc.setTextColor('#999999')
  doc.text('Scan QR Code di pintu masuk', pageW / 2, qrY + qrSize + 5, { align: 'center' })

  // ── Divider ──────────────────────────────────────────────
  const divY = qrY + qrSize + 12
  doc.setDrawColor('#e0e0e0')
  doc.setLineWidth(0.2)
  doc.line(30, divY, pageW - 30, divY)

  // ── Customer & Amount ────────────────────────────────────
  const infoY = divY + 8

  // Customer Name
  doc.setFontSize(7)
  doc.setTextColor('#999999')
  doc.text('NAMA PESANAN', 20, infoY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(CHARCOAL)
  doc.text(data.customerName, 20, infoY + 7)

  // Transaction ID
  doc.setFontSize(7)
  doc.setTextColor('#999999')
  doc.text('TRANSACTION ID', pageW - 20, infoY, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(CHARCOAL)
  doc.text(data.transactionId, pageW - 20, infoY + 7, { align: 'right' })

  // Total Amount
  const amtY = infoY + 18
  doc.setFontSize(7)
  doc.setTextColor('#999999')
  doc.text('TOTAL PEMBAYARAN', pageW / 2, amtY, { align: 'center' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(GOLD)
  doc.text('Rp ' + data.totalAmount.toLocaleString('id-ID'), pageW / 2, amtY + 10, { align: 'center' })

  // ── Note ─────────────────────────────────────────────────
  const noteY = amtY + 22

  doc.setFillColor(CREAM)
  doc.roundedRect(20, noteY, pageW - 40, 18, 2, 2, 'F')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor('#666666')
  doc.text('Tunjukkan e-tiket ini ke meja registrasi saat hari H.', pageW / 2, noteY + 8, { align: 'center' })
  doc.text('Show this e-ticket at the registration desk on the event day.', pageW / 2, noteY + 13, { align: 'center' })

  // ── Footer ───────────────────────────────────────────────
  const footerY = pageH - 20
  doc.setFillColor(DARK_CHARCOAL)
  doc.rect(0, footerY - 2, pageW, 22, 'F')

  doc.setFontSize(7)
  doc.setTextColor(GOLD)
  doc.text('TEATERAN', pageW / 2, footerY + 5, { align: 'center' })
  doc.setFontSize(6)
  doc.setTextColor('#666666')
  doc.text('www.teateran.com  |  E-Tiket ini digenerate secara otomatis dan sah sebagai bukti pembayaran.', pageW / 2, footerY + 11, { align: 'center' })

  return Buffer.from(doc.output('arraybuffer'))
}
