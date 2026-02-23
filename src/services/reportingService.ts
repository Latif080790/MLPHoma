import { DashboardStats } from './dashboardService'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

// Add types for jspdf-autotable since it extends jsPDF
declare module 'jspdf' {
    interface jsPDF {
        autoTable: (options: any) => jsPDF
    }
}

export type ReportFormat = 'PDF' | 'EXCEL'
export type ReportType = 'WEEKLY_STATUS' | 'EXECUTIVE_SUMMARY' | 'RISK_AUDIT'

interface ReportOptions {
    projectId: string
    projectName: string
    stats: DashboardStats
    type: ReportType
    format: ReportFormat
}

export const reportingService = {
    async generateReport(options: ReportOptions): Promise<void> {
        if (options.format === 'PDF') {
            await this.generatePDF(options)
        } else {
            await this.generateCSV(options) // Fallback to CSV for Excel for simplicity in browser
        }
    },

    async generatePDF(options: { projectName: string, stats: DashboardStats, type: ReportType }) {
        const { projectName, stats, type } = options
        const doc = new jsPDF()
        const dateStr = new Date().toISOString().split('T')[0]

        // Header
        doc.setFontSize(22)
        doc.setTextColor(30, 58, 138) // dark blue
        doc.text(`Project Report: ${projectName}`, 14, 20)

        doc.setFontSize(11)
        doc.setTextColor(100)
        doc.text(`Generated: ${dateStr}`, 14, 28)
        doc.text(`Report Type: ${type.replace('_', ' ')}`, 14, 34)

        let startY = 45

        // KPIs
        doc.setFontSize(14)
        doc.setTextColor(0)
        doc.text('Key Performance Indicators (KPIs)', 14, startY)

        doc.autoTable({
            startY: startY + 5,
            head: [['Metric', 'Value', 'Status']],
            body: [
                ['Health Index (PHI)', `${stats.phi?.score || 0} / 100`, stats.phi?.rating || 'N/A'],
                ['Cost Performance (CPI)', (stats.cpi || 1).toFixed(2), (stats.cpi || 0) >= 1 ? 'Optimal' : 'Over Budget'],
                ['Schedule Performance (SPI)', (stats.spi || 1).toFixed(2), (stats.spi || 0) >= 1 ? 'On Track' : 'Delayed'],
                ['Overall Progress', `${stats.overallProgress}%`, ''],
                ['Budget Utilized', `Rp ${(stats.utilizedBudget / 1000000).toFixed(2)} M / Rp ${(stats.totalBudget / 1000000).toFixed(2)} M`, '']
            ],
            theme: 'grid',
            headStyles: { fillColor: [30, 58, 138] },
        })

        startY = (doc as any).lastAutoTable.finalY + 15

        // Risks
        if (stats.topRisks && stats.topRisks.length > 0) {
            doc.setFontSize(14)
            doc.text('Critical Risks', 14, startY)
            doc.autoTable({
                startY: startY + 5,
                head: [['Risk Description', 'Score']],
                body: stats.topRisks.map(r => [r.description, r.score]),
                theme: 'striped',
                headStyles: { fillColor: [220, 38, 38] }, // Red for risks
            })
            startY = (doc as any).lastAutoTable.finalY + 15
        }

        // Action Items / Anomalies
        if (stats.anomalies && stats.anomalies.length > 0) {
            doc.setFontSize(14)
            doc.text('Detected Anomalies', 14, startY)
            doc.autoTable({
                startY: startY + 5,
                head: [['Type', 'Description']],
                body: stats.anomalies.map(a => [a.type, a.description]),
                theme: 'plain',
                headStyles: { fillColor: [202, 138, 4] },
            })
        }

        doc.save(`${projectName.replace(/\s+/g, '_')}_${type}_${dateStr}.pdf`)
    },

    async generateCSV(options: { projectName: string, stats: DashboardStats, type: ReportType }) {
        const { projectName, stats } = options
        const rows = [
            ['Project Name', projectName],
            ['Generated Date', new Date().toISOString().split('T')[0]],
            [''],
            ['Metric', 'Value'],
            ['Total Budget', stats.totalBudget.toString()],
            ['Utilized Budget', stats.utilizedBudget.toString()],
            ['Overall Progress (%)', stats.overallProgress.toString()],
            ['CPI', (stats.cpi || 1).toString()],
            ['SPI', (stats.spi || 1).toString()],
            ['PHI Score', (stats.phi?.score || 0).toString()],
            ['Critical Risks', stats.criticalRisks.toString()]
        ]

        const csvContent = "data:text/csv;charset=utf-8,"
            + rows.map(e => e.join(",")).join("\n")

        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", `${projectName.replace(/\s+/g, '_')}_data.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }
}
