
import React, { useEffect, useState } from "react"
import { ModuleHeader } from "@/components/modules/ModuleHeader"
import { Receipt, TrendingUp, TrendingDown, FileText, Plus } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useProjectStore } from "@/store/projectStore"
import { financeService } from "@/services/financeService"
import { format } from "date-fns"
import { EmptyState } from "@/components/common/EmptyState"
import { Invoice, ClientClaim, FinanceTransaction } from "@/types/finance"
import { toast } from "sonner"

export default function Finance() {
    const { activeProjectId } = useProjectStore()
    const [activeTab, setActiveTab] = useState("ap")
    const [loading, setLoading] = useState(false)

    const [invoices, setInvoices] = useState<Invoice[]>([])
    const [claims, setClaims] = useState<ClientClaim[]>([])
    const [transactions, setTransactions] = useState<FinanceTransaction[]>([])

    useEffect(() => {
        if (activeProjectId) loadData()
    }, [activeProjectId, activeTab])

    async function loadData() {
        if (!activeProjectId) return
        setLoading(true)
        try {
            if (activeTab === 'ap') {
                const data = await financeService.getInvoices(activeProjectId)
                setInvoices(data)
            } else if (activeTab === 'ar') {
                const data = await financeService.getClaims(activeProjectId)
                setClaims(data)
            } else if (activeTab === 'cashflow') {
                const data = await financeService.getTransactions(activeProjectId)
                setTransactions(data)
            }
        } catch (err: any) {
            toast.error("Failed to load finance data")
        } finally {
            setLoading(false)
        }
    }

    // Quick Action Mockups
    const handlePay = async (inv: Invoice) => {
        if (confirm(`Mark invoice ${inv.invoice_number} as PAID and record transaction?`)) {
            try {
                await financeService.payInvoice(inv.id, inv.project_id, inv.total_amount)
                toast.success("Payment recorded")
                loadData()
            } catch (err: any) {
                toast.error(err.message)
            }
        }
    }

    if (!activeProjectId) return <EmptyState title="No Project Selected" description="Select a project to view financials." />

    return (
        <div className="space-y-6">
            <ModuleHeader
                icon={<TrendingUp size={18} />}
                title="Finance"
                description="Manage AP (Invoices), AR (Claims), and Project Cash Flow."
            />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="ap" className="gap-2">
                        <Receipt size={14} /> Accounts Payable (AP)
                    </TabsTrigger>
                    <TabsTrigger value="ar" className="gap-2">
                        <FileText size={14} /> Accounts Receivable (AR)
                    </TabsTrigger>
                    <TabsTrigger value="cashflow" className="gap-2">
                        <TrendingUp size={14} /> Cash Flow
                    </TabsTrigger>
                </TabsList>

                {/* --- AP (INVOICES) --- */}
                <TabsContent value="ap" className="space-y-4">
                    <div className="flex justify-end">
                        <Button size="sm" variant="outline" className="gap-2">
                            <Plus size={14} /> Record Invoice
                        </Button>
                    </div>
                    {invoices.length === 0 ? (
                        <EmptyState title="No Invoices" description="Record vendor invoices here." imageKeyword="invoice" />
                    ) : (
                        <div className="rounded-md border">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 text-left">
                                    <tr>
                                        <th className="p-3">Vendor</th>
                                        <th className="p-3">Inv Number</th>
                                        <th className="p-3">Due Date</th>
                                        <th className="p-3 text-right">Amount</th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoices.map(inv => (
                                        <tr key={inv.id} className="border-t">
                                            <td className="p-3 font-medium">{inv.vendor_name}</td>
                                            <td className="p-3">{inv.invoice_number}</td>
                                            <td className="p-3">{format(new Date(inv.due_date || new Date()), 'dd MMM yyyy')}</td>
                                            <td className="p-3 text-right">Rp {inv.total_amount.toLocaleString()}</td>
                                            <td className="p-3">
                                                <Badge variant={inv.status === 'PAID' ? 'default' : 'destructive'}>{inv.status}</Badge>
                                            </td>
                                            <td className="p-3 text-right">
                                                {inv.status !== 'PAID' && (
                                                    <Button size="xs" onClick={() => handlePay(inv)}>Pay</Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </TabsContent>

                {/* --- AR (CLAIMS) --- */}
                <TabsContent value="ar">
                    <div className="flex justify-end mb-4">
                        <Button size="sm" variant="outline" className="gap-2">
                            <Plus size={14} /> Create Claim
                        </Button>
                    </div>
                    {claims.length === 0 ? (
                        <EmptyState title="No Claims" description="Create progress billings (claims) to the client." imageKeyword="contract" />
                    ) : (
                        <div className="grid gap-4">
                            {claims.map(claim => (
                                <Card key={claim.id}>
                                    <CardContent className="p-4 flex justify-between items-center">
                                        <div>
                                            <div className="font-bold">{claim.claim_number}</div>
                                            <div className="text-sm text-neutral-500">Period: {claim.period_start} - {claim.period_end}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xl font-bold text-green-600">Rp {claim.amount.toLocaleString()}</div>
                                            <Badge>{claim.status}</Badge>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* --- CASH FLOW --- */}
                <TabsContent value="cashflow">
                    <div className="grid gap-4 md:grid-cols-2 mb-6">
                        <Card className="bg-green-50">
                            <CardHeader className="pb-2"><CardTitle className="text-sm text-green-700">Total Income</CardTitle></CardHeader>
                            <CardContent><div className="text-2xl font-bold text-green-700">Rp {transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0).toLocaleString()}</div></CardContent>
                        </Card>
                        <Card className="bg-red-50">
                            <CardHeader className="pb-2"><CardTitle className="text-sm text-red-700">Total Expense</CardTitle></CardHeader>
                            <CardContent><div className="text-2xl font-bold text-red-700">Rp {Math.abs(transactions.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0)).toLocaleString()}</div></CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader><CardTitle>Transaction Ledger</CardTitle></CardHeader>
                        <CardContent>
                            {transactions.length === 0 ? <p className="text-neutral-500 text-sm">No transactions recorded.</p> : (
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50 text-left">
                                        <tr>
                                            <th className="p-3">Date</th>
                                            <th className="p-3">Description</th>
                                            <th className="p-3">Category</th>
                                            <th className="p-3 text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {transactions.map(t => (
                                            <tr key={t.id} className="border-t">
                                                <td className="p-3">{format(new Date(t.transaction_date), 'dd MMM yyyy')}</td>
                                                <td className="p-3">{t.description}</td>
                                                <td className="p-3"><Badge variant="outline">{t.category}</Badge></td>
                                                <td className={`p-3 text-right font-bold ${t.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {t.amount.toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
