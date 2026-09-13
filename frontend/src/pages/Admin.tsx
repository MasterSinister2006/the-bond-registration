import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Clock3, LockKeyhole, ShieldCheck, Ticket } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiGetWithHeaders, apiPostWithHeaders, errorMessage } from "@/lib/api";
import type { ApprovalResponse, Registration } from "@/lib/types";

const STATUS_LABELS: Record<Registration["status"], string> = {
  awaiting_payment: "Awaiting proof",
  proof_submitted: "Ready to review",
  paid: "Approved",
  rejected: "Rejected",
};

export default function Admin() {
  const [pin, setPin] = useState("");
  const [activePin, setActivePin] = useState("");
  const queryClient = useQueryClient();
  const registrationsQuery = useQuery({
    queryKey: ["admin-registrations", activePin],
    queryFn: () => apiGetWithHeaders<Registration[]>("/admin/registrations", { "X-Admin-Pin": activePin }),
    enabled: Boolean(activePin),
    retry: false,
  });
  const latestIntegrationStatuses = registrationsQuery.data?.[0]?.integration_statuses;
  const approveMutation = useMutation({
    mutationFn: (id: string) => apiPostWithHeaders<ApprovalResponse>(`/admin/registrations/${id}/approve`, undefined, { "X-Admin-Pin": activePin }),
    onSuccess: () => {
      toast.success("Approved — attendee confirmation is ready.");
      queryClient.invalidateQueries({ queryKey: ["admin-registrations", activePin] });
    },
    onError: (error) =>
      toast.error(errorMessage(error, "This payment proof could not be approved. Refresh and try again.")),
  });

  return (
    <main data-testid="admin-page" className="min-h-screen bg-[#0a0d14] px-5 py-8 text-slate-100 sm:py-14">
      <div className="mx-auto max-w-4xl">
        <a data-testid="admin-back-link" href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-cyan-300"><ArrowLeft size={16} /> Back to public page</a>
        <div className="mt-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p data-testid="admin-eyebrow" className="font-mono text-xs uppercase tracking-[0.22em] text-cyan-300">Organizer space</p><h1 data-testid="admin-title" className="mt-3 font-heading text-4xl font-bold text-white">Review bookings.</h1><p data-testid="admin-description" className="mt-3 max-w-xl text-slate-400">Check payment references and approve genuine transfers with one tap. The attendee sees their invitation confirmation automatically after approval.</p></div><Badge data-testid="admin-safety-badge" className="border border-emerald-300/20 bg-emerald-300/10 text-emerald-300">Manual verification · Safe by design</Badge></div>
        {!activePin ? <Card data-testid="admin-login-card" className="mt-10 max-w-lg rounded-3xl border-white/10 bg-[#161c2e]/90 py-0 shadow-2xl"><CardHeader className="px-6 pt-7"><LockKeyhole data-testid="admin-login-icon" className="mb-4 text-cyan-300" /><CardTitle data-testid="admin-login-title" className="text-2xl text-white">Enter organizer PIN</CardTitle></CardHeader><CardContent className="space-y-4 px-6 pb-7"><p data-testid="admin-login-help" className="text-sm leading-relaxed text-slate-400">This page is for The Bond team. Never share the PIN with attendees.</p><form data-testid="admin-login-form" onSubmit={(e) => { e.preventDefault(); setActivePin(pin); }} className="flex gap-3"><Input data-testid="admin-pin-input" type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Organizer PIN" required /><Button data-testid="admin-login-submit" type="submit" className="bg-cyan-300 font-bold text-[#071017] hover:bg-cyan-200">Open</Button></form></CardContent></Card> : <section data-testid="admin-registration-list" className="mt-10 space-y-4">{registrationsQuery.isPending && <p data-testid="admin-loading-state" className="text-slate-400">Loading bookings…</p>}{registrationsQuery.isError && <div data-testid="admin-error-state" className="rounded-2xl border border-red-300/20 bg-red-300/[0.06] p-5 text-red-100"><p>That PIN did not unlock the organizer space.</p><Button data-testid="admin-retry-button" type="button" variant="outline" onClick={() => setActivePin("")} className="mt-4 border-white/15 text-white hover:bg-white/10 hover:text-white">Try again</Button></div>}{registrationsQuery.data?.length === 0 && <div data-testid="admin-empty-state" className="rounded-2xl border border-white/10 bg-[#161c2e]/80 p-8 text-center"><Ticket className="mx-auto text-slate-500" /><p className="mt-3 font-medium text-white">No bookings yet</p><p className="mt-1 text-sm text-slate-500">New attendee submissions will appear here.</p></div>}{registrationsQuery.data?.map((registration) => <Card key={registration.id} data-testid={`admin-registration-${registration.id}`} className="rounded-2xl border-white/10 bg-[#161c2e]/90 py-0"><CardContent className="grid gap-5 px-5 py-5 md:grid-cols-[1fr_auto] md:items-center"><div><div className="flex flex-wrap items-center gap-3"><p data-testid={`admin-name-${registration.id}`} className="font-heading text-xl font-semibold text-white">{registration.full_name}</p><Badge data-testid={`admin-status-${registration.id}`} className={registration.status === "proof_submitted" ? "border border-amber-300/20 bg-amber-300/10 text-amber-200" : "border border-emerald-300/20 bg-emerald-300/10 text-emerald-300"}>{STATUS_LABELS[registration.status]}</Badge></div><div className="mt-3 grid gap-1 text-sm text-slate-400 sm:grid-cols-2"><p data-testid={`admin-email-${registration.id}`}>{registration.email}</p><p data-testid={`admin-phone-${registration.id}`}>{registration.phone}</p><p data-testid={`admin-payment-reference-${registration.id}`} className="font-mono text-cyan-300">UTR: {registration.payment_reference ?? "Not provided"}</p><p data-testid={`admin-participant-type-${registration.id}`}>{registration.participant_type} · age {registration.age}</p></div></div>{registration.status === "proof_submitted" ? <Button data-testid={`admin-approve-${registration.id}`} type="button" onClick={() => approveMutation.mutate(registration.id)} disabled={approveMutation.isPending} className="h-11 bg-emerald-400 font-bold text-[#071017] hover:bg-emerald-300"><Check size={16} /> Approve payment</Button> : registration.status === "paid" ? <div data-testid={`admin-confirmed-${registration.id}`} className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] px-4 py-3"><p className="font-mono text-[9px] uppercase tracking-widest text-slate-500">Invitation confirmed</p><p className="mt-1 font-medium text-emerald-300">Ready to email</p></div> : <div data-testid={`admin-awaiting-${registration.id}`} className="flex items-center gap-2 text-sm text-slate-500"><Clock3 size={15} /> Waiting for proof</div>}</CardContent></Card>)}</section>}
        <div data-testid="admin-integration-status" className="mt-10 flex gap-3 rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] p-4 text-xs leading-relaxed text-amber-100/80"><ShieldCheck className="shrink-0 text-amber-300" size={17} /><span>Integration status · Sheets: <strong data-testid="admin-sheets-status" className="text-amber-200">{latestIntegrationStatuses?.google_sheets ?? "MOCKED — add credentials"}</strong> · Calendar: <strong data-testid="admin-calendar-status" className="text-amber-200">{latestIntegrationStatuses?.google_calendar ?? "MOCKED — add credentials"}</strong> · Email: <strong data-testid="admin-email-status" className="text-amber-200">{latestIntegrationStatuses?.email ?? "MOCKED — add credentials"}</strong></span></div>
      </div>
    </main>
  );
}