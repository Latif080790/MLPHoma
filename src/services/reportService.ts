
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import { assertSupabase } from '../lib/supabaseClient'
import { format } from 'date-fns'

export const reportService = {
    /**
     * Generate a Daily Site Report (DSR) PDF
     */
    async generateDSR(projectId: string, date: string): Promise<void> {
        const supabase = assertSupabase()

        // 1. Fetch Data
        const { data: project } = await supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single()

        const { data: logs } = await supabase
            .from('progress_logs')
            .select('*')
            .eq('project_id', projectId)
            .eq('date', date)

        if (!project) throw new Error('Project not found')

        // 2. Initialize PDF
        const doc = new jsPDF()
        const primaryColor = [37, 99, 235] // Blue-600

        // HEADER
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
        doc.rect(0, 0, 210, 40, 'F')

        doc.setTextColor(255, 255, 255)
        doc.setFontSize(22)
        doc.text('DAILY SITE REPORT', 15, 25)

        doc.setFontSize(10)
        doc.text(`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, 155, 25)

        // PROJECT INFO
        doc.setTextColor(50, 50, 50)
        doc.setFontSize(14)
        doc.text('Project Information', 15, 55)
        doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2])
        doc.line(15, 58, 195, 58)

        doc.setFontSize(10)
        doc.text(`Project Name: ${project.name}`, 15, 65)
        doc.text(`Report Date: ${date}`, 15, 71)
        doc.text(`Location: ${project.location || 'N/A'}`, 15, 77)

        // LOGS TABLE
        if (logs && logs.length > 0) {
            doc.setFontSize(14)
            doc.text('Site Activity & Progress', 15, 95)

            const tableData = logs.map(log => [
                log.notes || 'No notes provided',
                `${log.progress_percentage}%`,
                log.volume_daily || '-',
                log.weather_condition || '-',
                log.gps_coordinates ? 'Captured' : 'Missing'
            ])

                ; (doc as any).autoTable({
                    startY: 100,
                    head: [['Activity/Notes', 'Progress', 'Volume', 'Weather', 'GPS']],
                    body: tableData,
                    headStyles: { fillColor: primaryColor },
                    margin: { left: 15, right: 15 }
                })
        } else {
            doc.setFontSize(10)
            doc.setTextColor(150, 150, 150)
            doc.text('No progress logs found for this date.', 15, 100)
        }

        // EVIDENCE SECTION
        const lastY = (doc as any).lastAutoTable?.finalY || 100
        doc.setTextColor(50, 50, 50)
        doc.setFontSize(14)
        doc.text('Photo Evidence', 15, lastY + 20)

        let photoY = lastY + 30
        logs?.forEach((log, index) => {
            if (log.evidence_url && photoY < 250) {
                doc.setFontSize(8)
                doc.text(`Photo ${index + 1}: ${log.notes || 'Activity'}`, 15, photoY)
                // Simplified: in a real app, we'd load the image and doc.addImage
                doc.setDrawColor(200, 200, 200)
                doc.rect(15, photoY + 2, 40, 30) // placeholder for image
                doc.text('Image Link:', 60, photoY + 15)
                doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
                doc.text(log.evidence_url.substring(0, 50) + '...', 60, photoY + 20)
                doc.setTextColor(50, 50, 50)
                photoY += 45
            }
        })

        // FOOTER
        const pageCount = (doc as any).internal.getNumberOfPages()
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i)
            doc.setFontSize(8)
            doc.setTextColor(150, 150, 150)
            doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' })
            doc.text('MLPHoma Construction Management System', 195, 290, { align: 'right' })
        }

        // Save
        doc.save(`DSR-${project.name}-${date}.pdf`)
    }
}
