import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiGetWithHeaders, apiPost, apiPostWithHeaders, errorMessage } from "@/lib/api";
import type { ApprovalResponse, LoginResponse, Registration } from "@/lib/types";

const STATUS_LABELS: Record<Registration["status"], string> = {
  awaiting_payment: "Awaiting proof",
  proof_submitted: "Ready to review",
  paid: "Confirmed",
  rejected: "Rejected",
};

export default function Admin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Session lives in memory only — closing the tab signs you out, and nothing
  // sensitive is left behind in browser storage on a shared machine.
  const [session, setSession] = useState<{ token: string; email: string } | null>(null);
  const queryClient = useQueryClient();

  const authHeader: Record<string, string> = session
    ? { Authorization: `Bearer ${session.token}` }
    : {};

  const loginMutation = useMutation({
    mutationFn: () => apiPost<LoginResponse>("/admin/login", { email, password }),
    onSuccess: (data) => {
      setSession({ token: data.token, email: data.email });
      setPassword("");
      toast.success(`Signed in as ${data.email}`);
    },
    onError: (error) => toast.error(errorMessage(error, "That email and password did not match.")),
  });

  const registrationsQuery = useQuery({
    queryKey: ["admin-registrations", session?.email],
    queryFn: () => apiGetWithHeaders<Registration[]>("/admin/registrations", authHeader),
    enabled: Boolean(session),
    retry: false,
  });

  const latestIntegrationStatuses = registrationsQuery.data?.[0]?.integration_statuses;

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      apiPostWithHeaders<ApprovalResponse>(`/admin/registrations/${id}/approve`, undefined, authHeader),
    onSuccess: () => {
      toast.success("Approved — their confirmation is live.");
      queryClient.invalidateQueries({ queryKey: ["admin-registrations", session?.email] });
    },
    onError: (error) =>
      toast.error(errorMessage(error, "This payment proof could not be approved. Refresh and try again.")),
  });

  const signOut = () => {
    setSession(null);
    setPassword("");
    queryClient.removeQueries({ queryKey: ["admin-registrations"] });
  };

  const pending = registrationsQuery.data?.filter((r) => r.status === "proof_submitted").length ?? 0;
  const confirmed = registrationsQuery.data?.filter((r) => r.status === "paid").length ?? 0;

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <header className="border-b border-[var(--rule)]">
        <div className="mx-auto flex max-w-[1000px] items-center justify-between gap-6 px-5 py-3.5 md:px-8">
          <span className="font-heading text-[1.35rem] leading-none">The Bond</span>
          <div className="flex items-center gap-5 text-[0.875rem]">
            {session && (
              <>
                <span
                  data-testid="admin-signed-in-as"
                  className="hidden text-[0.8rem] normal-case tracking-normal text-[var(--ink-soft)] sm:inline"
                >
                  {session.email}
                </span>
                <button
                  data-testid="admin-sign-out"
                  type="button"
                  onClick={signOut}
                  className="link-rule text-[var(--ink-soft)] hover:text-[var(--ink)]"
                >
                  Sign out
                </button>
              </>
            )}
            <a data-testid="admin-back-link" href="/" className="link-rule text-[var(--ink-soft)] hover:text-[var(--ink)]">
              Back to the event page
            </a>
          </div>
        </div>
      </header>

      <main data-testid="admin-page" className="mx-auto max-w-[1000px] px-5 py-12 md:px-8 md:py-20">
        <div className="grid gap-6 md:grid-cols-[1.618fr_1fr] md:items-end">
          <div>
            <p data-testid="admin-eyebrow" className="eyebrow">
              Organiser
            </p>
            <h1 data-testid="admin-title" className="mt-4 text-[clamp(2rem,5vw,2.62rem)]">
              Review bookings.
            </h1>
            <p data-testid="admin-description" className="mt-4 max-w-[48ch] text-[0.975rem] leading-[1.75] text-[var(--ink-soft)]">
              Check each transfer against the account statement, then approve. The attendee's confirmation
              appears on their page straight away.
            </p>
          </div>

          {session && !registrationsQuery.isError && (
            <dl className="flex gap-8 md:justify-end">
              <div>
                <dt className="eyebrow">To review</dt>
                <dd className="mt-1 font-heading text-[2rem] leading-none tabular-nums">{pending}</dd>
              </div>
              <div>
                <dt className="eyebrow">Confirmed</dt>
                <dd className="mt-1 font-heading text-[2rem] leading-none tabular-nums">{confirmed}</dd>
              </div>
            </dl>
          )}
        </div>

        {!session ? (
          <div data-testid="admin-login-card" className="mt-12 max-w-md border border-[var(--rule)] bg-[var(--paper-card)] p-7 md:p-9">
            <h2 data-testid="admin-login-title" className="text-[1.62rem]">
              Organiser sign in
            </h2>
            <p data-testid="admin-login-help" className="mt-3 text-[0.9rem] leading-relaxed text-[var(--ink-soft)]">
              For The Bond team only. Attendee names, phone numbers and emails are behind
              this, so keep your password to yourself.
            </p>
            <form
              data-testid="admin-login-form"
              onSubmit={(e) => {
                e.preventDefault();
                loginMutation.mutate();
              }}
              className="mt-7 space-y-5"
            >
              <div>
                <label htmlFor="admin-email" className="eyebrow mb-2 block">
                  Email
                </label>
                <input
                  data-testid="admin-email-input"
                  id="admin-email"
                  className="field-line"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div>
                <label htmlFor="admin-password" className="eyebrow mb-2 block">
                  Password
                </label>
                <input
                  data-testid="admin-password-input"
                  id="admin-password"
                  className="field-line"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  required
                />
              </div>
              <button
                data-testid="admin-login-submit"
                type="submit"
                disabled={loginMutation.isPending}
                className="btn-ink w-full"
              >
                {loginMutation.isPending ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </div>
        ) : (
          <section data-testid="admin-registration-list" className="mt-12">
            {registrationsQuery.isPending && (
              <p data-testid="admin-loading-state" className="border-t border-[var(--rule)] py-8 text-[0.9rem] text-[var(--ink-soft)]">
                Loading bookings…
              </p>
            )}

            {registrationsQuery.isError && (
              <div data-testid="admin-error-state" className="max-w-md border-l-2 border-[var(--destructive,#9c3f36)] bg-[var(--paper-card)] py-5 pl-5 pr-6">
                <p className="text-[0.95rem]">Your session has expired, or that account no longer has access.</p>
                <button
                  data-testid="admin-retry-button"
                  type="button"
                  onClick={signOut}
                  className="btn-outline-ink mt-5"
                >
                  Sign in again
                </button>
              </div>
            )}

            {registrationsQuery.data?.length === 0 && (
              <div data-testid="admin-empty-state" className="border-t border-[var(--rule)] py-16 text-center">
                <p className="font-heading text-[1.3rem]">No bookings yet</p>
                <p className="mt-2 text-[0.9rem] text-[var(--ink-soft)]">
                  New submissions will appear here as they arrive.
                </p>
              </div>
            )}

            {registrationsQuery.data?.map((registration) => (
              <article
                key={registration.id}
                data-testid={`admin-registration-${registration.id}`}
                className="grid gap-5 border-t border-[var(--rule)] py-6 last:border-b md:grid-cols-[1.618fr_1fr] md:items-center md:gap-8"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 data-testid={`admin-name-${registration.id}`} className="text-[1.3rem]">
                      {registration.full_name}
                    </h3>
                    <span
                      data-testid={`admin-status-${registration.id}`}
                      className={`text-[0.6875rem] uppercase tracking-[0.14em] ${
                        registration.status === "proof_submitted"
                          ? "text-[var(--clay-deep)]"
                          : "text-[var(--ink-soft)]"
                      }`}
                    >
                      {STATUS_LABELS[registration.status]}
                    </span>
                  </div>

                  <dl className="mt-3 grid gap-x-8 gap-y-1 text-[0.875rem] text-[var(--ink-soft)] sm:grid-cols-2">
                    <dd data-testid={`admin-email-${registration.id}`} className="truncate">
                      {registration.email}
                    </dd>
                    <dd data-testid={`admin-phone-${registration.id}`}>{registration.phone}</dd>
                    <dd data-testid={`admin-payment-reference-${registration.id}`} className="truncate text-[var(--ink)]">
                      UTR {registration.payment_reference ?? "—"}
                    </dd>
                    <dd data-testid={`admin-participant-type-${registration.id}`}>
                      {registration.participant_type} · age {registration.age}
                    </dd>
                  </dl>
                </div>

                <div className="md:justify-self-end">
                  {registration.status === "proof_submitted" ? (
                    <button
                      data-testid={`admin-approve-${registration.id}`}
                      type="button"
                      onClick={() => approveMutation.mutate(registration.id)}
                      disabled={approveMutation.isPending}
                      className="btn-ink w-full md:w-auto"
                    >
                      {approveMutation.isPending ? "Approving…" : "Approve payment"}
                    </button>
                  ) : registration.status === "paid" ? (
                    <p data-testid={`admin-confirmed-${registration.id}`} className="eyebrow text-[var(--clay-deep)] md:text-right">
                      Confirmed
                    </p>
                  ) : (
                    <p data-testid={`admin-awaiting-${registration.id}`} className="eyebrow md:text-right">
                      Waiting for proof
                    </p>
                  )}
                </div>
              </article>
            ))}
          </section>
        )}

        <div data-testid="admin-integration-status" className="mt-14 border-t border-[var(--rule)] pt-5">
          <p className="eyebrow">Integrations</p>
          <dl className="mt-3 grid gap-x-8 gap-y-1.5 text-[0.8rem] text-[var(--ink-soft)] sm:grid-cols-3">
            <div className="flex gap-2">
              <dt>Sheets</dt>
              <dd data-testid="admin-sheets-status" className="text-[var(--ink)]">
                {latestIntegrationStatuses?.google_sheets ?? "—"}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt>Calendar</dt>
              <dd data-testid="admin-calendar-status" className="text-[var(--ink)]">
                {latestIntegrationStatuses?.google_calendar ?? "—"}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt>Email</dt>
              <dd data-testid="admin-email-status" className="text-[var(--ink)]">
                {latestIntegrationStatuses?.email ?? "—"}
              </dd>
            </div>
          </dl>
        </div>
      </main>
    </div>
  );
}
