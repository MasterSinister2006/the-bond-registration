import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";

import { apiGet, apiPost, apiPostForm, errorMessage } from "@/lib/api";
import { ConfettiField, Sparkle, ToteIllustration } from "@/components/Artwork";
import type { EventConfig, ProofSubmitted, Registration, RegistrationCreated } from "@/lib/types";
import type { FormEvent, ReactNode } from "react";

/* Rendered only if /event is unreachable, so the page never shows an empty shell.
   Keep in step with backend/routers/event.py. */
const FALLBACK_EVENT: EventConfig = {
  name: "THE BOND",
  eyebrow: "Tote Bag Bedazzling Party",
  description:
    "An evening of design, decoration and a little sparkle — with good company, new faces and a tote bag that leaves looking like yours.",
  date_label: "Thursday, 17 September 2026",
  time_label: "5:30 PM — 7:30 PM",
  venue: "Sayaji Bagh, Vadodara",
  price_label: "₹359",
  price_amount: 359,
  currency: "INR",
  payment_upi_id: "shah.parshva2007@oksbi",
  payment_name: "Parshva Shah",
  payment_qr_url: "",
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

/* ── Small building blocks ─────────────────────────────────────── */

/** Reveals a block once as it scrolls in. Movement is dropped under reduced-motion. */
function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** One row of the event spec list: a ruled label/value pair. */
function Particular({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div data-testid={testId} className="flex items-baseline justify-between gap-6 border-t border-[var(--rule)] py-3.5">
      <span className="eyebrow shrink-0">{label}</span>
      <span className="text-right text-[0.95rem] leading-snug text-[var(--ink)]">{value}</span>
    </div>
  );
}

/** Form field: label above a ruled input. */
function Field({
  label,
  id,
  children,
  hint,
  required = true,
}: {
  label: string;
  id: string;
  children: ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div data-testid={`${id}-field`} className="min-w-0">
      <label htmlFor={id} data-testid={`${id}-label`} className="eyebrow mb-2 block">
        {label}
        {required && <span aria-hidden="true" className="ml-1 text-[var(--clay)]">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[0.75rem] leading-relaxed text-[var(--ink-soft)]">{hint}</p>}
    </div>
  );
}

/** Countdown rendered as one quiet sentence rather than a row of digit boxes. */
function CountdownLine({ target }: { target: string }) {
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
      total: seconds,
    };
  }, [now, target]);

  if (parts.total === 0) {
    return (
      <p data-testid="event-hero-countdown" className="eyebrow">
        The evening has begun
      </p>
    );
  }

  return (
    <p data-testid="event-hero-countdown" className="eyebrow flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span>Doors open in</span>
      <span data-testid="countdown-days" className="font-heading text-[1.05rem] tracking-normal text-[var(--clay-deep)] normal-case">
        {parts.days}d
      </span>
      <span data-testid="countdown-hours" className="font-heading text-[1.05rem] tracking-normal text-[var(--clay-deep)] normal-case">
        {String(parts.hours).padStart(2, "0")}h
      </span>
      <span data-testid="countdown-minutes" className="font-heading text-[1.05rem] tracking-normal text-[var(--clay-deep)] normal-case">
        {String(parts.minutes).padStart(2, "0")}m
      </span>
      <span data-testid="countdown-seconds" className="font-heading text-[1.05rem] tracking-normal text-[var(--clay-deep)] normal-case tabular-nums">
        {String(parts.seconds).padStart(2, "0")}s
      </span>
    </p>
  );
}

/** Three-step progress as a ruled line — no pills, no badges. */
function StepRule({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["Your details", "Payment", "Confirmation"];
  return (
    <ol data-testid="step-rule" className="grid grid-cols-3 gap-px">
      {steps.map((label, index) => {
        const position = (index + 1) as 1 | 2 | 3;
        const done = position < current;
        const active = position === current;
        return (
          <li key={label} className="min-w-0">
            <div
              aria-hidden="true"
              className={`h-px w-full transition-colors duration-500 ${
                active || done ? "bg-[var(--clay)]" : "bg-[var(--rule)]"
              }`}
            />
            <p
              className={`mt-2 truncate text-[0.6875rem] uppercase tracking-[0.14em] ${
                active ? "text-[var(--clay-deep)]" : "text-[var(--ink-soft)]"
              }`}
            >
              <span className="tabular-nums">0{position}</span>
              <span className="mx-1.5 hidden sm:inline">·</span>
              <span className="hidden sm:inline">{label}</span>
            </p>
          </li>
        );
      })}
    </ol>
  );
}

/* ── Page ──────────────────────────────────────────────────────── */

export default function Home() {
  const eventQuery = useQuery({ queryKey: ["event"], queryFn: () => apiGet<EventConfig>("/event"), retry: false });
  const event = eventQuery.data ?? FALLBACK_EVENT;
  const reduced = useReducedMotion();

  const [form, setForm] = useState<FormValues>(INITIAL_FORM);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofReference, setProofReference] = useState("");

  const updateField = (field: keyof FormValues, value: string) =>
    setForm((previous) => ({ ...previous, [field]: value }));

  const createMutation = useMutation({
    mutationFn: (payload: FormValues) =>
      apiPost<RegistrationCreated>("/registrations", { ...payload, discovery_other: payload.discovery_other || null }),
    onSuccess: (data) => {
      setRegistration(data.registration);
      toast.success("Details saved. Payment is next.");
      window.setTimeout(
        () => document.getElementById("payment-panel")?.scrollIntoView({ behavior: "smooth", block: "center" }),
        80,
      );
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
      toast.success("Proof received. We'll confirm shortly.");
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

  const isPaid = currentRegistration?.status === "paid";
  const step: 1 | 2 | 3 = isPaid ? 3 : registration ? 2 : 1;

  const heroIn = reduced ? { opacity: 0 } : { opacity: 0, y: 18 };

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      {/* ── Masthead ─────────────────────────────────────────── */}
      <header
        data-testid="event-header-nav"
        className="sticky top-0 z-40 border-b border-[var(--rule)] bg-[var(--paper)]/92 backdrop-blur-[2px]"
      >
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-6 px-5 py-3.5 md:px-8">
          <a href="#top" data-testid="brand-mark" className="group flex items-baseline gap-2.5">
            <span className="font-heading text-[1.35rem] leading-none">The Bond</span>
            <span aria-hidden="true" className="hidden h-3 w-px bg-[var(--rule)] sm:block" />
            <span className="eyebrow hidden sm:block">Vadodara</span>
          </a>

          <nav data-testid="event-nav-links" className="flex items-center gap-6 text-[0.875rem]">
            <a data-testid="nav-about-link" href="#included" className="link-rule hidden text-[var(--ink-soft)] hover:text-[var(--ink)] sm:inline">
              The evening
            </a>
            <a data-testid="nav-admin-link" href="/admin" className="link-rule hidden text-[var(--ink-soft)] hover:text-[var(--ink)] sm:inline">
              Organiser
            </a>
            <a data-testid="header-register-link" href="#rsvp" className="link-rule font-medium text-[var(--clay-deep)]">
              Reserve
            </a>
          </nav>
        </div>
      </header>

      <main id="top" data-testid="event-page">
        {/* ── Hero: 1.618 / 1 split ──────────────────────────── */}
        <section data-testid="event-hero" className="mx-auto max-w-[1180px] px-5 pb-16 pt-14 md:px-8 md:pb-24 md:pt-24">
          <div className="grid gap-12 lg:grid-cols-[1.618fr_1fr] lg:gap-16">
            <div className="max-w-[36ch]">
              <motion.p
                data-testid="event-hero-eyebrow"
                className="eyebrow flex items-center gap-2"
                initial={heroIn}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                <Sparkle className="text-[var(--clay)]" size={11} />
                {event.eyebrow}
              </motion.p>

              <motion.h1
                data-testid="event-hero-title"
                className="mt-5 text-[clamp(3rem,10vw,4.24rem)]"
                initial={heroIn}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
              >
                Make it
                <span className="font-heading italic text-[var(--clay)]"> yours</span>.
              </motion.h1>

              <motion.p
                data-testid="event-hero-description"
                className="mt-7 max-w-[46ch] text-[1.0625rem] leading-[1.7] text-[var(--ink-soft)]"
                initial={heroIn}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
              >
                {event.description}
              </motion.p>

              <motion.div
                data-testid="event-hero-actions"
                className="mt-9 flex flex-wrap items-center gap-5"
                initial={heroIn}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
              >
                <a href="#rsvp" data-testid="hero-register-link" className="btn-ink">
                  Reserve a place
                </a>
                <span data-testid="event-price-badge" className="text-[0.9rem] text-[var(--ink-soft)]">
                  <span className="font-heading text-[1.25rem] text-[var(--ink)]">{event.price_label}</span> per person
                </span>
              </motion.div>
            </div>

            {/* Artwork + particulars */}
            <motion.aside
              data-testid="event-quick-facts"
              className="lg:pt-2"
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <ToteIllustration className="mx-auto mb-10 w-[180px] max-w-full sm:w-[220px] lg:mx-0 lg:mb-12 lg:w-[240px]" />
              <Particular label="Date" value={event.date_label} testId="event-detail-date" />
              <Particular label="Time" value={event.time_label} testId="event-detail-time" />
              <Particular label="Place" value={event.venue} testId="event-detail-venue" />
              <Particular label="Entry" value={`${event.price_label} per person`} />
              <div className="border-t border-[var(--rule)] pt-4">
                <CountdownLine target={event.countdown_iso} />
              </div>
            </motion.aside>
          </div>
        </section>

        {/* ── Full-width quiet band, dusted with confetti ─────── */}
        <section className="relative isolate overflow-hidden border-y border-[var(--rule)] bg-[var(--paper-deep)]">
          <ConfettiField className="pointer-events-none absolute inset-0 -z-10 h-full w-full" />
          <div className="mx-auto max-w-[1180px] px-5 py-14 md:px-8 md:py-20">
            <Reveal>
              <p className="max-w-[24ch] font-heading text-[clamp(1.75rem,4.4vw,2.62rem)] leading-[1.2]">
                Come alone or bring someone. Leave with something
                <span className="italic text-[var(--clay)]"> you made</span>.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ── What's included: narrow title / wide list ──────── */}
        <section id="included" data-testid="event-included-section" className="mx-auto max-w-[1180px] px-5 py-16 md:px-8 md:py-24">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.618fr] lg:gap-16">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <Reveal>
                <p data-testid="included-eyebrow" className="eyebrow">
                  What the evening holds
                </p>
                <h2 data-testid="included-title" className="mt-4 max-w-[14ch] text-[clamp(1.9rem,4.6vw,2.62rem)]">
                  More than a tote bag.
                </h2>
                <p data-testid="included-description" className="mt-5 max-w-[38ch] text-[0.975rem] leading-[1.75] text-[var(--ink-soft)]">
                  The Bond is a small community built around making things together. This is the
                  invitation to try one.
                </p>
              </Reveal>
            </div>

            <ol className="lg:pt-1">
              {event.included.map((item, index) => (
                <Reveal key={item} delay={index * 0.05}>
                  <li
                    data-testid={`included-item-${index + 1}`}
                    className="group flex items-baseline gap-5 border-t border-[var(--rule)] py-5 last:border-b md:gap-8 md:py-6"
                  >
                    <span className="font-heading text-[0.95rem] italic text-[var(--clay)] tabular-nums">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[1.0625rem] leading-snug">{item}</span>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Reservation ────────────────────────────────────── */}
        <section id="rsvp" data-testid="rsvp-section" className="border-t border-[var(--rule)] bg-[var(--paper-deep)]">
          <div className="mx-auto max-w-[1180px] px-5 py-16 md:px-8 md:py-24">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.618fr] lg:gap-16">
              {/* Left rail */}
              <div data-testid="rsvp-intro" className="lg:sticky lg:top-24 lg:self-start">
                <Reveal>
                  <p className="eyebrow">Reservation</p>
                  <h2 className="mt-4 max-w-[12ch] text-[clamp(1.9rem,4.6vw,2.62rem)]">
                    Save your
                    <span className="italic text-[var(--clay)]"> seat</span>.
                  </h2>
                  <p className="mt-5 max-w-[36ch] text-[0.975rem] leading-[1.75] text-[var(--ink-soft)]">
                    Fill in your details, pay the {event.price_label} entry through UPI, and send us the
                    receipt. We confirm each booking by hand.
                  </p>

                  <div data-testid="manual-payment-note" className="mt-8 border-l-2 border-[var(--clay)] pl-4">
                    <p className="text-[0.85rem] leading-[1.7] text-[var(--ink-soft)]">
                      A UPI link can't tell us on its own that money arrived, so an organiser checks the
                      transfer against the account before confirming. We never ask for card numbers, a UPI
                      PIN, or anything similar.
                    </p>
                  </div>
                </Reveal>
              </div>

              {/* The form panel — treated as a printed form */}
              <Reveal delay={0.08}>
                <div
                  data-testid="rsvp-form-container"
                  className="border border-[var(--rule)] bg-[var(--paper-card)]"
                >
                  <div data-testid="rsvp-form-header" className="border-b border-[var(--rule)] px-6 py-6 md:px-9 md:py-7">
                    <div className="flex items-baseline justify-between gap-4">
                      <h3 data-testid="rsvp-form-title" className="text-[1.62rem]">
                        {step === 3 ? "You're on the list" : step === 2 ? "Payment" : "Your details"}
                      </h3>
                      <span data-testid="rsvp-form-badge" className="eyebrow shrink-0">
                        Step 0{step} / 03
                      </span>
                    </div>
                    <div className="mt-5">
                      <StepRule current={step} />
                    </div>
                  </div>

                  <div className="px-6 py-7 md:px-9 md:py-9">
                    {!registration ? (
                      /* ── Step 1 ─────────────────────────── */
                      <form data-testid="registration-form" onSubmit={submitRegistration} className="space-y-7">
                        <p data-testid="rsvp-form-description" className="text-[0.9rem] leading-relaxed text-[var(--ink-soft)]">
                          Every field is required — it helps us plan the room and the materials.
                        </p>

                        <div className="grid gap-7 sm:grid-cols-2">
                          <Field id="field-full-name" label="Name">
                            <input
                              data-testid="field-full-name-input"
                              id="field-full-name"
                              className="field-line"
                              required
                              autoComplete="name"
                              value={form.full_name}
                              onChange={(e) => updateField("full_name", e.target.value)}
                              placeholder="Your full name"
                            />
                          </Field>

                          <Field id="field-email" label="Email">
                            <input
                              data-testid="field-email-input"
                              id="field-email"
                              className="field-line"
                              required
                              type="email"
                              autoComplete="email"
                              inputMode="email"
                              value={form.email}
                              onChange={(e) => updateField("email", e.target.value)}
                              placeholder="you@example.com"
                            />
                          </Field>

                          <Field id="field-phone" label="Phone">
                            <input
                              data-testid="field-phone-input"
                              id="field-phone"
                              className="field-line"
                              required
                              type="tel"
                              inputMode="tel"
                              autoComplete="tel"
                              value={form.phone}
                              onChange={(e) => updateField("phone", e.target.value)}
                              placeholder="10 digit mobile"
                            />
                          </Field>

                          <Field id="field-age" label="Age">
                            <input
                              data-testid="field-age-input"
                              id="field-age"
                              className="field-line"
                              required
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={3}
                              value={form.age}
                              onChange={(e) => updateField("age", e.target.value)}
                              placeholder="21"
                            />
                          </Field>

                          <Field id="field-participant-type" label="You are">
                            <select
                              data-testid="field-participant-type-input"
                              id="field-participant-type"
                              className="field-line field-line-select"
                              value={form.participant_type}
                              onChange={(e) => updateField("participant_type", e.target.value)}
                            >
                              <option>Student</option>
                              <option>Working Professional</option>
                              <option>Other</option>
                            </select>
                          </Field>

                          <Field id="field-discovery-source" label="How you found us">
                            <select
                              data-testid="field-discovery-source-input"
                              id="field-discovery-source"
                              className="field-line field-line-select"
                              value={form.discovery_source}
                              onChange={(e) => updateField("discovery_source", e.target.value)}
                            >
                              <option>Instagram</option>
                              <option>WhatsApp</option>
                              <option>Friends</option>
                              <option>Colleagues</option>
                              <option>Others</option>
                            </select>
                          </Field>
                        </div>

                        {form.discovery_source === "Others" && (
                          <Field id="field-discovery-other" label="Tell us where">
                            <input
                              data-testid="field-discovery-other-input"
                              id="field-discovery-other"
                              className="field-line"
                              required
                              value={form.discovery_other}
                              onChange={(e) => updateField("discovery_other", e.target.value)}
                              placeholder="A poster, a friend of a friend…"
                            />
                          </Field>
                        )}

                        <div data-testid="payment-step-preview" className="border-t border-[var(--rule)] pt-6">
                          <p data-testid="payment-step-label" className="eyebrow">
                            Next
                          </p>
                          <p data-testid="payment-instruction" className="mt-2 text-[0.875rem] leading-relaxed text-[var(--ink-soft)]">
                            Once your details are saved we'll open your UPI app with {event.price_label} already
                            filled in.
                          </p>
                        </div>

                        <div>
                          <button
                            data-testid="submit-registration-btn"
                            type="submit"
                            disabled={createMutation.isPending}
                            className="btn-ink w-full sm:w-auto sm:min-w-[15rem]"
                          >
                            {createMutation.isPending ? "Saving…" : "Continue to payment"}
                          </button>
                          <p data-testid="privacy-note" className="mt-4 max-w-[52ch] text-[0.75rem] leading-relaxed text-[var(--ink-soft)]">
                            We use these details only to organise your booking and to send you event updates.
                          </p>
                        </div>
                      </form>
                    ) : (
                      /* ── Steps 2 & 3 ────────────────────── */
                      <div data-testid="payment-panel" id="payment-panel" className="space-y-8">
                        <div data-testid="registration-created-state" className="flex items-baseline gap-3">
                          <span aria-hidden="true" className="mt-px h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--clay)]" />
                          <p className="text-[0.9rem] leading-relaxed text-[var(--ink-soft)]">
                            Saved for <span className="text-[var(--ink)]">{currentRegistration?.full_name}</span>. Pay
                            the entry below, then send the receipt.
                          </p>
                        </div>

                        {/* Amount + UPI handoff */}
                        <div data-testid="payment-method-card" className="border-t border-[var(--rule)] pt-7">
                          <div className="flex flex-wrap items-end justify-between gap-4">
                            <div>
                              <p data-testid="payment-method-label" className="eyebrow">
                                Amount due
                              </p>
                              <p data-testid="payment-method-title" className="mt-2 font-heading text-[2.62rem] leading-none">
                                {event.price_label}
                              </p>
                            </div>
                            <span data-testid="payment-safety-badge" className="eyebrow">
                              Fixed · one place
                            </span>
                          </div>

                          <div data-testid="payment-destination-copy" className="mt-7">
                            {/* Route one — Android hands upi:// straight to the payment app. */}
                            <a data-testid="upi-pay-button" href={upiPaymentLink} className="btn-ink w-full">
                              Open your UPI app
                            </a>
                            <p className="mt-3 text-[0.8rem] leading-relaxed text-[var(--ink-soft)]">
                              Works on Android, where it opens Google Pay or PhonePe with {event.price_label} already
                              filled in.
                            </p>

                            {/* Route two — the QR. iPhones ignore upi:// links, so this is the way in
                                for every iOS attendee, and for anyone paying from a laptop. */}
                            {event.payment_qr_url && (
                              <div data-testid="payment-qr-block" className="mt-8 border-t border-[var(--rule)] pt-8">
                                <p className="eyebrow">On iPhone, or paying from a laptop</p>

                                <figure className="mt-5 flex flex-col items-center">
                                  <img
                                    data-testid="payment-qr-image"
                                    src={event.payment_qr_url}
                                    alt={`UPI QR code to pay ${event.payment_name} at ${event.payment_upi_id}`}
                                    width={220}
                                    height={220}
                                    className="w-[220px] max-w-full border border-[var(--rule)] bg-white p-2"
                                  />
                                  <a
                                    data-testid="download-qr-button"
                                    href={event.payment_qr_url}
                                    download="the-bond-upi-qr.jpg"
                                    className="btn-outline-ink mt-5 w-full sm:w-auto sm:min-w-[15rem]"
                                  >
                                    Save the QR code
                                  </a>
                                </figure>

                                <ol data-testid="qr-instructions" className="mt-6 space-y-2.5 text-[0.8rem] leading-relaxed text-[var(--ink-soft)]">
                                  <li className="flex gap-3">
                                    <span className="font-heading italic text-[var(--clay)] tabular-nums">01</span>
                                    <span>Save the QR to your photos, or scan it from another phone.</span>
                                  </li>
                                  <li className="flex gap-3">
                                    <span className="font-heading italic text-[var(--clay)] tabular-nums">02</span>
                                    <span>
                                      Open Google Pay, PhonePe or Paytm, choose scan, then pick the saved image from
                                      your gallery.
                                    </span>
                                  </li>
                                  <li className="flex gap-3">
                                    <span className="font-heading italic text-[var(--clay)] tabular-nums">03</span>
                                    <span>
                                      Enter {event.price_label}, pay, then come back here with the UTR and a screenshot.
                                    </span>
                                  </li>
                                </ol>
                              </div>
                            )}

                            <dl className="mt-8 border-t border-[var(--rule)] pt-4 text-[0.875rem]">
                              <div className="flex items-baseline justify-between gap-4 py-1.5">
                                <dt className="eyebrow">Paying to</dt>
                                <dd data-testid="payment-upi-id" className="text-right break-all text-[var(--ink)]">
                                  {event.payment_upi_id}
                                </dd>
                              </div>
                              <div className="flex items-baseline justify-between gap-4 py-1.5">
                                <dt className="eyebrow">Account name</dt>
                                <dd data-testid="payment-recipient-name" className="text-right text-[var(--ink-soft)]">
                                  {event.payment_name}
                                </dd>
                              </div>
                            </dl>
                          </div>
                        </div>

                        {/* Proof upload */}
                        {!isPaid && (
                          <form
                            data-testid="proof-upload-form"
                            onSubmit={(e) => {
                              e.preventDefault();
                              proofMutation.mutate();
                            }}
                            className="space-y-6 border-t border-[var(--rule)] pt-7"
                          >
                            <div data-testid="proof-upload-instruction">
                              <p className="eyebrow">Confirm your payment</p>
                              <p className="mt-2 text-[0.875rem] leading-relaxed text-[var(--ink-soft)]">
                                Add the UTR from your payment app and the screenshot. An organiser checks it
                                against the account before confirming.
                              </p>
                            </div>

                            <Field id="payment-reference-input" label="UTR / reference number">
                              <input
                                data-testid="payment-reference-input"
                                id="payment-reference-input"
                                className="field-line"
                                required
                                value={proofReference}
                                onChange={(e) => setProofReference(e.target.value)}
                                placeholder="e.g. 4829 1047 2213"
                              />
                            </Field>

                            <div>
                              <span className="eyebrow mb-2 block">
                                Payment screenshot
                                <span aria-hidden="true" className="ml-1 text-[var(--clay)]">*</span>
                              </span>
                              <label
                                data-testid="proof-file-label"
                                htmlFor="proof-file"
                                className="flex cursor-pointer items-center justify-between gap-4 border border-dashed border-[var(--rule)] px-4 py-4 transition-colors hover:border-[var(--clay)] focus-within:border-[var(--clay)]"
                              >
                                <span className="min-w-0">
                                  <span className="block text-[0.9rem] text-[var(--ink)]">
                                    {proofFile ? "Change file" : "Choose a file"}
                                  </span>
                                  <span data-testid="proof-file-help" className="mt-0.5 block text-[0.75rem] text-[var(--ink-soft)]">
                                    JPG, PNG or PDF · up to 5 MB
                                  </span>
                                </span>
                                <span aria-hidden="true" className="eyebrow shrink-0">
                                  Browse
                                </span>
                                <input
                                  data-testid="proof-file-input"
                                  id="proof-file"
                                  type="file"
                                  accept="image/jpeg,image/png,application/pdf"
                                  onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                                  className="sr-only"
                                />
                              </label>
                              {proofFile && (
                                <p data-testid="proof-file-selected" className="mt-2 truncate text-[0.8rem] text-[var(--clay-deep)]">
                                  {proofFile.name}
                                </p>
                              )}
                            </div>

                            <button
                              data-testid="submit-proof-btn"
                              type="submit"
                              disabled={!proofFile || !proofReference || proofMutation.isPending}
                              className="btn-ink w-full sm:w-auto sm:min-w-[15rem]"
                            >
                              {proofMutation.isPending ? "Sending…" : "Send payment proof"}
                            </button>
                          </form>
                        )}

                        {/* Awaiting review */}
                        {currentRegistration?.status === "proof_submitted" && (
                          <div data-testid="proof-pending-state" className="border-t border-[var(--rule)] pt-7">
                            <p className="eyebrow">Under review</p>
                            <p className="mt-2 max-w-[52ch] text-[0.9rem] leading-relaxed text-[var(--ink-soft)]">
                              Your proof is with the organisers. Keep this page open — your confirmation appears
                              here the moment it's approved.
                            </p>
                          </div>
                        )}

                        {/* Confirmed */}
                        {isPaid && currentRegistration && (
                          <motion.div
                            data-testid="booking-confirmed-display"
                            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                            className="border-t border-[var(--rule)] pt-8"
                          >
                            <p data-testid="booking-status-label" className="eyebrow flex items-center gap-2 text-[var(--clay-deep)]">
                              <Sparkle className="text-[var(--clay)]" size={12} />
                              Reservation confirmed
                            </p>
                            <h4 data-testid="booking-confirmed-title" className="mt-3 font-heading text-[2rem] leading-tight">
                              We'll see you there,
                              <span className="italic text-[var(--clay)]"> {currentRegistration.full_name.split(" ")[0]}</span>.
                            </h4>
                            <p data-testid="booking-confirmed-copy" className="mt-4 max-w-[50ch] text-[0.95rem] leading-[1.75] text-[var(--ink-soft)]">
                              Your {event.price_label} entry is approved. {event.date_label}, {event.time_label}, at{" "}
                              {event.venue}. Come a few minutes early so we can start together.
                            </p>
                            <p data-testid="confirmation-email-status" className="mt-6 border-t border-[var(--rule)] pt-4 text-[0.75rem] text-[var(--ink-soft)]">
                              Invitation email — {currentRegistration.integration_statuses.email}
                            </p>
                          </motion.div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer data-testid="event-footer" className="border-t border-[var(--rule)]">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-5 py-10 md:flex-row md:items-end md:justify-between md:px-8 md:py-12">
          <div>
            <p data-testid="footer-brand" className="font-heading text-[1.35rem] leading-none">
              The Bond
            </p>
            <p data-testid="footer-tagline" className="mt-2 text-[0.85rem] text-[var(--ink-soft)]">
              Where creativity meets connection · Vadodara
            </p>
          </div>
          <div data-testid="social-links" className="flex gap-6 text-[0.875rem]">
            <a
              data-testid="instagram-link"
              href={event.instagram_url}
              target="_blank"
              rel="noreferrer"
              className="link-rule text-[var(--ink-soft)] hover:text-[var(--ink)]"
            >
              Instagram
            </a>
            <a
              data-testid="whatsapp-link"
              href={event.whatsapp_url}
              target="_blank"
              rel="noreferrer"
              className="link-rule text-[var(--ink-soft)] hover:text-[var(--ink)]"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
