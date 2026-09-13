import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Instagram,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Ticket,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiGet, apiPost, apiPostForm, errorMessage } from "@/lib/api";
import type { EventConfig, ProofSubmitted, Registration, RegistrationCreated } from "@/lib/types";
import type { FormEvent, ReactNode } from "react";

const FALLBACK_EVENT: EventConfig = {
  name: "THE BOND",
  eyebrow: "Tote Bag Bedazzling Party",
  description:
    "A creative evening to design, decorate and bedazzle your own tote bag — with good vibes, new connections and a little sparkle.",
  date_label: "Thursday, 17 September 2026",
  time_label: "5:30 PM — 7:30 PM",
  venue: "Sayaji Bagh, Vadodara",
  price_label: "₹359",
  price_amount: 359,
  currency: "INR",
  payment_upi_id: "shah.parshva2007@oksbi",
  payment_name: "Parshva Shah",
  payment_qr_url: "/payment-qr.jpg",
  included: [
    "Your own tote bag to customise",
    "Complimentary refreshing drink",
    "A little surprise to take home",
    "Creative community and connection",
    "Content-worthy photo moments",
  ],
  instagram_url: "https://www.instagram.com/thebondconnection_/?igshid=dWFwbzc5YTBoeDFj",
  whatsapp_url: "https://chat.whatsapp.com/BfdNYpnFY1o2l7eINv1mKM?s=cl",
  countdown_iso: "2026-09-17T17:30:00+05:30",
};

interface FormValues {
  full_name: string;
  email: string;
  phone: string;
  age: string;
  participant_type: "Student" | "Working Professional" | "Other";
  discovery_source: "Instagram" | "WhatsApp" | "Friends" | "Colleagues" | "Others";
  discovery_other: string;
}

const INITIAL_FORM: FormValues = {
  full_name: "",
  email: "",
  phone: "",
  age: "",
  participant_type: "Student",
  discovery_source: "Instagram",
  discovery_other: "",
};

function Countdown({ target }: { target: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const parts = useMemo(() => {
    const seconds = Math.max(0, Math.floor((new Date(target).getTime() - now) / 1000));
    return {
      days: Math.floor(seconds / 86400),
      hours: Math.floor((seconds % 86400) / 3600),
      minutes: Math.floor((seconds % 3600) / 60),
      seconds: seconds % 60,
    };
  }, [now, target]);

  return (
    <div data-testid="event-hero-countdown" className="grid grid-cols-4 gap-2 sm:gap-3">
      {Object.entries(parts).map(([label, value]) => (
        <div key={label} data-testid={`countdown-${label}`} className="rounded-xl border border-white/10 bg-white/[0.06] p-3 text-center backdrop-blur-sm">
          <div className="font-mono text-xl font-bold text-cyan-300 sm:text-2xl">{String(value).padStart(2, "0")}</div>
          <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
        </div>
      ))}
    </div>
  );
}

function Field({ label, id, children, required = true }: { label: string; id: string; children: ReactNode; required?: boolean }) {
  return (
    <div data-testid={`${id}-field`} className="space-y-2">
      <label htmlFor={id} data-testid={`${id}-label`} className="text-sm font-medium text-slate-200">
        {label} {required && <span className="text-cyan-300">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function Home() {
  const eventQuery = useQuery({ queryKey: ["event"], queryFn: () => apiGet<EventConfig>("/event"), retry: false });
  const event = eventQuery.data ?? FALLBACK_EVENT;
  const [form, setForm] = useState<FormValues>(INITIAL_FORM);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofReference, setProofReference] = useState("");

  const updateField = (field: keyof FormValues, value: string) => setForm((previous) => ({ ...previous, [field]: value }));

  const createMutation = useMutation({
    mutationFn: (payload: FormValues) =>
      apiPost<RegistrationCreated>("/registrations", { ...payload, discovery_other: payload.discovery_other || null }),
    onSuccess: (data) => {
      setRegistration(data.registration);
      toast.success("Details saved — complete your payment proof below.");
      window.setTimeout(() => document.getElementById("payment-panel")?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    },
    onError: (error) =>
      toast.error(errorMessage(error, "We could not save your details. Please check the form and try again.")),
  });

  const proofMutation = useMutation({
    mutationFn: async () => {
      if (!registration || !proofFile) throw new Error("Choose a payment screenshot first");
      const data = new FormData();
      data.append("payment_reference", proofReference);
      data.append("proof", proofFile);
      return apiPostForm<ProofSubmitted>(`/registrations/${registration.id}/proof`, data);
    },
    onSuccess: (data) => {
      setRegistration(data.registration);
      toast.success("Proof submitted — your spot is waiting for organizer approval.");
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Please upload a JPG, PNG or PDF payment screenshot under 5 MB.")),
  });

  const statusQuery = useQuery({
    queryKey: ["registration", registration?.id],
    queryFn: () => apiGet<Registration>(`/registrations/${registration?.id}`),
    enabled: Boolean(registration?.id),
    refetchInterval: (query) => (query.state.data?.status === "paid" ? false : 3500),
  });
  const currentRegistration = statusQuery.data ?? registration;
  const upiPaymentLink = `upi://pay?pa=${encodeURIComponent(event.payment_upi_id)}&pn=${encodeURIComponent(event.payment_name)}&am=${event.price_amount}&cu=${event.currency}&tn=${encodeURIComponent(`${event.name} entry`)}`;

  const submitRegistration = (eventSubmit: FormEvent<HTMLFormElement>) => {
    eventSubmit.preventDefault();
    createMutation.mutate(form);
  };

  return (
    <main data-testid="event-page" className="min-h-screen overflow-hidden bg-[#0a0d14] text-slate-100">
      <header data-testid="event-header-nav" className="relative z-20 border-b border-white/10 bg-[#0a0d14]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <a href="#top" data-testid="brand-mark" className="group flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-300 transition-transform group-hover:rotate-6"><Sparkles size={19} /></span>
            <span><span className="block font-heading text-lg font-bold tracking-tight">THE BOND</span><span className="block font-mono text-[9px] uppercase tracking-[0.24em] text-slate-500">connection club</span></span>
          </a>
          <nav data-testid="event-nav-links" className="hidden items-center gap-7 text-sm text-slate-400 md:flex">
            <a data-testid="nav-about-link" href="#included" className="transition-colors hover:text-cyan-300">What’s included</a>
            <a data-testid="nav-rsvp-link" href="#rsvp" className="transition-colors hover:text-cyan-300">Book your spot</a>
            <a data-testid="nav-admin-link" href="/admin" className="transition-colors hover:text-cyan-300">Organizer</a>
          </nav>
          <a data-testid="header-register-link" href="#rsvp" className="hidden items-center gap-2 rounded-full bg-cyan-300 px-4 py-2 text-sm font-bold text-[#071017] transition-transform hover:-translate-y-0.5 sm:flex">Register <ArrowRight size={15} /></a>
        </div>
      </header>

      <section id="top" data-testid="event-hero" className="relative isolate">
        <div className="absolute inset-0 -z-10 bg-cover bg-center opacity-40" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1773385404894-104116c1ef31?auto=format&fit=crop&w=1800&q=85')" }} />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#0a0d14]/45 via-[#0a0d14]/80 to-[#0a0d14]" />
        <div className="mx-auto grid max-w-7xl gap-14 px-5 pb-24 pt-20 lg:grid-cols-[1.06fr_0.94fr] lg:items-end lg:px-8 lg:pb-28 lg:pt-28">
          <motion.div initial={{ opacity: 0, x: -22 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }} className="max-w-3xl">
            <div data-testid="event-hero-eyebrow" className="mb-6 flex items-center gap-3 font-mono text-xs uppercase tracking-[0.22em] text-cyan-300"><span className="h-px w-8 bg-cyan-300" /> {event.eyebrow}</div>
            <h1 data-testid="event-hero-title" className="max-w-3xl font-heading text-5xl font-extrabold leading-[0.96] tracking-[-0.045em] text-white sm:text-6xl lg:text-8xl">Make it <span className="text-cyan-300">yours.</span></h1>
            <p data-testid="event-hero-description" className="mt-7 max-w-xl text-lg leading-relaxed text-slate-300 sm:text-xl">{event.description} Come alone, bring a friend, and leave with something made by you.</p>
            <div data-testid="event-hero-actions" className="mt-9 flex flex-wrap items-center gap-4">
              <a data-testid="hero-register-link" href="#rsvp" className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 font-bold text-[#071017] shadow-[0_0_30px_rgba(0,240,255,0.2)] transition-all hover:-translate-y-1 hover:bg-cyan-200">Book your spot <ArrowRight size={17} /></a>
              <Badge data-testid="event-price-badge" className="h-11 rounded-xl border border-white/15 bg-white/10 px-4 font-mono text-sm text-white backdrop-blur-sm">{event.price_label} / person</Badge>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.6 }} className="lg:justify-self-end">
            <div data-testid="event-quick-facts" className="grid max-w-md grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-[#111625]/75 p-2 backdrop-blur-xl">
              <div data-testid="event-detail-date" className="rounded-xl bg-white/[0.06] p-4"><CalendarDays className="mb-5 text-cyan-300" size={18} /><p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Date</p><p className="mt-1 text-sm font-semibold text-white">17 Sep</p></div>
              <div data-testid="event-detail-time" className="rounded-xl bg-white/[0.06] p-4"><Clock3 className="mb-5 text-cyan-300" size={18} /><p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Time</p><p className="mt-1 text-sm font-semibold text-white">5:30 PM</p></div>
              <div data-testid="event-detail-venue" className="rounded-xl bg-white/[0.06] p-4"><MapPin className="mb-5 text-cyan-300" size={18} /><p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Venue</p><p className="mt-1 text-sm font-semibold text-white">Vadodara</p></div>
            </div>
          </motion.div>
        </div>
      </section>

      <section data-testid="event-countdown-section" className="mx-auto -mt-8 max-w-7xl px-5 lg:px-8">
        <div className="grid gap-5 rounded-2xl border border-cyan-300/15 bg-[#111625]/90 p-5 shadow-2xl backdrop-blur-xl sm:grid-cols-[1fr_1.4fr] sm:items-center sm:p-7">
          <div data-testid="countdown-copy"><p className="font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-300">The clock is ticking</p><h2 className="mt-2 font-heading text-2xl font-bold text-white">See you under the sparkle.</h2></div>
          <Countdown target={event.countdown_iso} />
        </div>
      </section>

      <section id="included" data-testid="event-included-section" className="mx-auto grid max-w-7xl gap-14 px-5 py-24 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
        <div><p data-testid="included-eyebrow" className="font-mono text-xs uppercase tracking-[0.22em] text-cyan-300">More than a tote bag</p><h2 data-testid="included-title" className="mt-4 max-w-md font-heading text-4xl font-bold leading-tight text-white sm:text-5xl">Come create. Come connect. Come belong.</h2><p data-testid="included-description" className="mt-6 max-w-md leading-relaxed text-slate-400">THE BOND is a community built around connection, creativity and shared experiences. This is your invitation to try something new together.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          {event.included.map((item, index) => <div key={item} data-testid={`included-item-${index + 1}`} className="group rounded-2xl border border-white/10 bg-[#161c2e]/80 p-5 transition-all hover:-translate-y-1 hover:border-cyan-300/30"><CheckCircle2 className="mb-8 text-cyan-300 transition-transform group-hover:scale-110" size={20} /><p className="text-base font-medium leading-relaxed text-slate-200">{item}</p></div>)}
        </div>
      </section>

      <section id="rsvp" data-testid="rsvp-section" className="mx-auto grid max-w-7xl gap-10 px-5 pb-28 lg:grid-cols-[0.86fr_1.14fr] lg:px-8">
        <div data-testid="rsvp-intro" className="lg:sticky lg:top-28 lg:self-start"><p className="font-mono text-xs uppercase tracking-[0.22em] text-cyan-300">Reserve your seat</p><h2 className="mt-4 font-heading text-4xl font-bold leading-tight text-white sm:text-5xl">A little sparkle is waiting.</h2><p className="mt-6 max-w-md leading-relaxed text-slate-400">Fill in every detail, tap the UPI payment button, and upload your proof. Your invitation confirmation appears here after organizer approval.</p><div data-testid="manual-payment-note" className="mt-8 flex gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm leading-relaxed text-amber-100"><ShieldCheck className="mt-0.5 shrink-0 text-amber-300" size={18} /><span>UPI intent opens your payment app with ₹359 prefilled. Final payment confirmation still requires the organizer’s verified transaction statement.</span></div></div>
        <Card data-testid="rsvp-form-container" className="rounded-3xl border-white/10 bg-[#161c2e]/90 py-0 shadow-2xl backdrop-blur-xl">
          <CardHeader data-testid="rsvp-form-header" className="border-b border-white/10 px-6 py-7 sm:px-8"><div className="flex items-start justify-between gap-4"><div><Badge data-testid="rsvp-form-badge" className="border border-cyan-300/20 bg-cyan-300/10 text-cyan-300">Step 01 · Details</Badge><CardTitle data-testid="rsvp-form-title" className="mt-4 text-2xl text-white">Book your spot</CardTitle><CardDescription data-testid="rsvp-form-description" className="mt-2 text-slate-400">Every field is required so we can make your experience feel personal.</CardDescription></div><Ticket data-testid="rsvp-form-icon" className="text-cyan-300" /></div></CardHeader>
          <CardContent className="px-6 py-7 sm:px-8">
            {!registration ? <form data-testid="registration-form" onSubmit={submitRegistration} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="field-full-name" label="Name of participant"><Input data-testid="field-full-name-input" id="field-full-name" required autoComplete="name" value={form.full_name} onChange={(e) => updateField("full_name", e.target.value)} placeholder="Your full name" /></Field>
                <Field id="field-email" label="Email ID"><Input data-testid="field-email-input" id="field-email" required type="email" autoComplete="email" inputMode="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} placeholder="you@example.com" /></Field>
                <Field id="field-phone" label="Phone number"><Input data-testid="field-phone-input" id="field-phone" required type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => updateField("phone", e.target.value)} placeholder="10 digit mobile number" /></Field>
                <Field id="field-age" label="Age"><Input data-testid="field-age-input" id="field-age" required inputMode="numeric" pattern="[0-9]*" maxLength={3} value={form.age} onChange={(e) => updateField("age", e.target.value)} placeholder="Your age" /></Field>
              </div>
              <Field id="field-participant-type" label="You are a">
                <select data-testid="field-participant-type-input" id="field-participant-type" value={form.participant_type} onChange={(e) => updateField("participant_type", e.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-[#0a0d14] px-3 text-sm text-white outline-none transition-colors focus:border-cyan-300"><option>Student</option><option>Working Professional</option><option>Other</option></select>
              </Field>
              <Field id="field-discovery-source" label="How did you hear about this event?"><select data-testid="field-discovery-source-input" id="field-discovery-source" value={form.discovery_source} onChange={(e) => updateField("discovery_source", e.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-[#0a0d14] px-3 text-sm text-white outline-none transition-colors focus:border-cyan-300"><option>Instagram</option><option>WhatsApp</option><option>Friends</option><option>Colleagues</option><option>Others</option></select></Field>
              {form.discovery_source === "Others" && <Field id="field-discovery-other" label="Please mention"><Input data-testid="field-discovery-other-input" id="field-discovery-other" required value={form.discovery_other} onChange={(e) => updateField("discovery_other", e.target.value)} placeholder="Tell us where you found us" /></Field>}
              <div data-testid="payment-step-preview" className="border-t border-white/10 pt-5"><p data-testid="payment-step-label" className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300">Step 02 · Payment</p><p data-testid="payment-instruction" className="text-xs leading-relaxed text-slate-500">After your details are saved, the secure UPI button will open Google Pay or your preferred UPI app with ₹359 prefilled.</p></div>
              <Button data-testid="submit-registration-btn" type="submit" size="lg" disabled={createMutation.isPending} className="h-12 w-full rounded-xl bg-cyan-300 font-bold text-[#071017] hover:bg-cyan-200">{createMutation.isPending ? "Saving your spot…" : "Continue to payment"}<ArrowRight size={17} /></Button>
              <p data-testid="privacy-note" className="text-center text-xs leading-relaxed text-slate-500">By continuing, you agree that The Bond may use these details to coordinate your booking and event updates.</p>
            </form> : <div data-testid="payment-panel" id="payment-panel" className="space-y-6">
              <div data-testid="registration-created-state" className="flex gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.07] p-4 text-sm leading-relaxed text-emerald-100"><Check className="mt-0.5 shrink-0 text-emerald-300" size={18} /><span>Details saved. Tap the button below to pay ₹359, then attach your payment proof.</span></div>
              <div data-testid="payment-method-card" className="rounded-2xl border border-white/10 bg-[#0a0d14]/70 p-5"><div className="flex items-center justify-between gap-3"><div><p data-testid="payment-method-label" className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300">UPI payment</p><h3 data-testid="payment-method-title" className="mt-2 font-heading text-xl font-semibold text-white">Pay ₹359 to reserve</h3></div><Badge data-testid="payment-safety-badge" className="border border-amber-300/20 bg-amber-300/10 text-[10px] text-amber-200">Fixed amount</Badge></div><div data-testid="payment-destination-copy" className="mt-5 space-y-4 text-sm text-slate-300">{event.payment_qr_url && <img data-testid="payment-qr-image" src={event.payment_qr_url} alt="The Bond payment QR code" className="mx-auto max-w-[180px] rounded-xl border border-white/10 bg-white p-3" />}<p>On mobile, this button opens Google Pay or another UPI app with the amount already filled. On desktop, use the UPI app on your phone and return here with the transaction reference.</p><a data-testid="upi-pay-button" href={upiPaymentLink} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 font-bold text-[#071017] transition-all hover:-translate-y-0.5 hover:bg-cyan-200">Open Google Pay / UPI app <ArrowRight size={16} /></a><div className="rounded-lg border border-white/10 bg-white/[0.04] p-3"><p className="font-mono text-xs text-slate-500">Payment destination</p><p data-testid="payment-upi-id" className="mt-1 font-mono font-semibold text-cyan-300">{event.payment_upi_id}</p><p data-testid="payment-recipient-name" className="mt-1 text-xs text-slate-500">{event.payment_name}</p></div></div></div>
              <form data-testid="proof-upload-form" onSubmit={(e) => { e.preventDefault(); proofMutation.mutate(); }} className="space-y-4"><div data-testid="proof-upload-instruction"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300">Step 03 · Confirm payment</p><p className="mt-2 text-sm leading-relaxed text-slate-400">Enter the UTR from the payment app and attach your screenshot. The organizer checks it before confirming your invitation.</p></div><Field id="payment-reference-input" label="UPI / transaction reference"><Input data-testid="payment-reference-input" id="payment-reference-input" required value={proofReference} onChange={(e) => setProofReference(e.target.value)} placeholder="Enter your UTR after payment" /></Field><label data-testid="proof-file-label" htmlFor="proof-file" className="flex cursor-pointer items-center gap-4 rounded-xl border border-dashed border-white/20 bg-white/[0.03] p-4 transition-colors hover:border-cyan-300/50"><UploadCloud className="text-cyan-300" size={22} /><span><span className="block text-sm font-medium text-white">Choose payment screenshot</span><span data-testid="proof-file-help" className="block text-xs text-slate-500">JPG, PNG or PDF · max 5 MB</span></span><Input data-testid="proof-file-input" id="proof-file" type="file" accept="image/jpeg,image/png,application/pdf" onChange={(e) => setProofFile(e.target.files?.[0] ?? null)} className="sr-only" /></label>{proofFile && <p data-testid="proof-file-selected" className="text-xs text-cyan-300">Selected: {proofFile.name}</p>}<Button data-testid="submit-proof-btn" type="submit" disabled={!proofFile || !proofReference || proofMutation.isPending || currentRegistration?.status === "paid"} size="lg" className="h-12 w-full rounded-xl bg-cyan-300 font-bold text-[#071017] hover:bg-cyan-200">{proofMutation.isPending ? "Uploading proof…" : "Submit payment confirmation"}<UploadCloud size={17} /></Button></form>
              {currentRegistration?.status === "proof_submitted" && <div data-testid="proof-pending-state" className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4 text-sm leading-relaxed text-cyan-100"><Clock3 className="mb-3 text-cyan-300" size={18} /><p>Your payment is under review. Keep this page open — your invitation confirmation appears here after The Bond team approves it.</p></div>}
              {currentRegistration?.status === "paid" && <div data-testid="booking-confirmed-display" className="rounded-2xl border border-emerald-300/30 bg-emerald-950/30 p-6 shadow-[0_0_35px_rgba(16,185,129,0.12)]"><div className="flex items-center justify-between gap-3"><div><p data-testid="booking-status-label" className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300">Invitation confirmed</p><h3 data-testid="booking-confirmed-title" className="mt-2 font-heading text-2xl font-bold text-white">You’re on the guest list.</h3></div><CheckCircle2 className="text-emerald-300" /></div><p data-testid="booking-confirmed-copy" className="mt-5 text-sm leading-relaxed text-slate-300">Thank you, {currentRegistration.full_name}. Your ₹359 payment has been approved and your invitation email will contain the event details.</p><p data-testid="confirmation-email-status" className="mt-5 text-xs leading-relaxed text-slate-500">Email confirmation: <span className={currentRegistration.integration_statuses.email === "SENT" ? "text-emerald-300" : "text-amber-200"}>{currentRegistration.integration_statuses.email}</span></p></div>}
            </div>}
          </CardContent>
        </Card>
      </section>

      <footer data-testid="event-footer" className="border-t border-white/10 bg-[#070a10]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between lg:px-8"><div><p data-testid="footer-brand" className="font-heading text-xl font-bold text-white">THE BOND <span className="text-cyan-300">🤍</span></p><p data-testid="footer-tagline" className="mt-1 text-sm text-slate-500">Where creativity meets connection.</p></div><div data-testid="social-links" className="flex gap-3"><a data-testid="instagram-link" href={event.instagram_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 transition-colors hover:border-cyan-300/30 hover:text-cyan-300"><Instagram size={16} /> Instagram <ExternalLink size={12} /></a><a data-testid="whatsapp-link" href={event.whatsapp_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 transition-colors hover:border-cyan-300/30 hover:text-cyan-300"><MessageCircle size={16} /> WhatsApp <ExternalLink size={12} /></a></div></div>
      </footer>
    </main>
  );
}