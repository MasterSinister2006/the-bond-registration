export interface EventConfig {
  name: string;
  eyebrow: string;
  description: string;
  date_label: string;
  time_label: string;
  venue: string;
  price_label: string;
  price_amount: number;
  currency: string;
  payment_upi_id: string;
  payment_name: string;
  payment_qr_url: string;
  included: string[];
  instagram_url: string;
  whatsapp_url: string;
  countdown_iso: string;
}

export interface IntegrationStatuses {
  google_sheets: string;
  google_calendar: string;
  email: string;
}

export type RegistrationStatus = "awaiting_payment" | "proof_submitted" | "paid" | "rejected";

export interface Registration {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  age: string;
  participant_type: string;
  discovery_source: string;
  discovery_other: string | null;
  payment_reference: string | null;
  status: RegistrationStatus;
  created_at: string;
  approved_at: string | null;
  integration_statuses: IntegrationStatuses;
}

export interface RegistrationCreated {
  registration: Registration;
  next_step: string;
}

export interface ProofSubmitted {
  registration: Registration;
  next_step: string;
}

export interface ApprovalResponse {
  registration: Registration;
  message: string;
}