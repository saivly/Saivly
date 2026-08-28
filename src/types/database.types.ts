/**
 * Hand-maintained to match supabase/migrations/0001 through 0005.
 * (0003_organisations.sql: profiles gains onboarding's personal-info
 * columns; organisations + organisation_members are new, many-to-many.
 * 0004_residential_address_adyen.sql: birth_* -> residential_* on
 * profiles, + first_name/last_name/adyen_legal_entity_id.
 * 0005_profiles_email.sql: profiles.email, trigger-synced from auth.users.
 * 0006_residential_province.sql: profiles.residential_province.
 * 0007_passkey_prompt.sql: profiles.passkey_prompt_seen_at.
 * 0008_join_organisation.sql: join_organisation() RPC.
 * 0009_adyen_onboarding.sql: profiles.adyen_onboarding_completed_at.
 * 0010_organisation_adyen.sql: organisations.adyen_organization_legal_entity_id
 * / adyen_account_holder_id / adyen_balance_account_id.
 * 0011_organisation_business_lines.sql: organisations.
 * adyen_business_line_payment_processing_id / _banking_id / _issuing_id.
 * 0012_organisation_business_activity.sql: organisations.relationship_type
 * / industry_code / vat_number / support_email / support_phone /
 * annual_reserve_fund_contributions / annual_reserve_fund_currency /
 * website.
 * 0014_adyen_webhooks.sql: adyen_webhook_events (one shared table) +
 * organisations gains indexes on adyen_account_holder_id /
 * adyen_balance_account_id.
 * 0015_adyen_webhooks_split.sql: drops adyen_webhook_events, replaced
 * by adyen_payment_webhook_events / adyen_configuration_webhook_events /
 * adyen_transfer_webhook_events (one table per Adyen webhook product) +
 * organisations gains an index on adyen_organization_legal_entity_id.
 * 0016_invoices.sql: invoices table + private "invoices" storage bucket.)
 * Once you have a live project, regenerate from the real schema with:
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.types.ts
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string; // mirrored from auth.users by trigger — not app-writable
          full_name: string | null;
          first_name: string | null;
          last_name: string | null;
          avatar_url: string | null;
          date_of_birth: string | null;
          phone_number: string | null;
          residential_street: string | null;
          residential_city: string | null;
          residential_postal_code: string | null;
          residential_country: string | null;
          residential_province: string | null;
          nationality: string | null;
          personal_completed_at: string | null;
          adyen_legal_entity_id: string | null;
          adyen_onboarding_completed_at: string | null;
          passkey_prompt_seen_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never; // created by trigger
        Update: {
          full_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          avatar_url?: string | null;
          date_of_birth?: string | null;
          phone_number?: string | null;
          residential_street?: string | null;
          residential_city?: string | null;
          residential_postal_code?: string | null;
          residential_country?: string | null;
          residential_province?: string | null;
          nationality?: string | null;
          personal_completed_at?: string | null;
          adyen_legal_entity_id?: string | null;
          adyen_onboarding_completed_at?: string | null;
          passkey_prompt_seen_at?: string | null;
        };
        Relationships: [];
      };
      todos: {
        Row: {
          id: string;
          user_id: string;
          task: string;
          is_complete: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          task: string;
          is_complete?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          task?: string;
          is_complete?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      backup_codes: {
        Row: {
          id: string;
          user_id: string;
          code_hash: string;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          code_hash: string;
          used_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          code_hash?: string;
          used_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      organisations: {
        Row: {
          id: string;
          name: string;
          country: string;
          kvk_number: string | null;
          street: string | null;
          postal_code: string | null;
          city: string | null;
          company_completed_at: string | null;
          adyen_organization_legal_entity_id: string | null;
          adyen_account_holder_id: string | null;
          adyen_balance_account_id: string | null;
          adyen_business_line_payment_processing_id: string | null;
          adyen_business_line_banking_id: string | null;
          adyen_business_line_issuing_id: string | null;
          relationship_type: string | null;
          industry_code: string | null;
          vat_number: string | null;
          business_description: string | null;
          support_email: string | null;
          support_phone: string | null;
          annual_reserve_fund_contributions: number | null;
          annual_reserve_fund_currency: string | null;
          website: string | null;
          plan: "free" | "pro" | "enterprise" | null;
          subscription_completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          country: string;
          kvk_number?: string | null;
          street?: string | null;
          postal_code?: string | null;
          city?: string | null;
          company_completed_at?: string | null;
          adyen_organization_legal_entity_id?: string | null;
          adyen_account_holder_id?: string | null;
          adyen_balance_account_id?: string | null;
          adyen_business_line_payment_processing_id?: string | null;
          adyen_business_line_banking_id?: string | null;
          adyen_business_line_issuing_id?: string | null;
          relationship_type?: string | null;
          industry_code?: string | null;
          vat_number?: string | null;
          business_description?: string | null;
          support_email?: string | null;
          support_phone?: string | null;
          annual_reserve_fund_contributions?: number | null;
          annual_reserve_fund_currency?: string | null;
          website?: string | null;
          plan?: "free" | "pro" | "enterprise" | null;
          subscription_completed_at?: string | null;
        };
        Update: {
          name?: string;
          country?: string;
          kvk_number?: string | null;
          street?: string | null;
          postal_code?: string | null;
          city?: string | null;
          company_completed_at?: string | null;
          adyen_organization_legal_entity_id?: string | null;
          adyen_account_holder_id?: string | null;
          adyen_balance_account_id?: string | null;
          adyen_business_line_payment_processing_id?: string | null;
          adyen_business_line_banking_id?: string | null;
          adyen_business_line_issuing_id?: string | null;
          relationship_type?: string | null;
          industry_code?: string | null;
          vat_number?: string | null;
          business_description?: string | null;
          support_email?: string | null;
          support_phone?: string | null;
          annual_reserve_fund_contributions?: number | null;
          annual_reserve_fund_currency?: string | null;
          website?: string | null;
          plan?: "free" | "pro" | "enterprise" | null;
          subscription_completed_at?: string | null;
        };
        Relationships: [];
      };
      organisation_members: {
        Row: {
          organisation_id: string;
          user_id: string;
          role: "owner" | "member";
          created_at: string;
        };
        Insert: {
          organisation_id: string;
          user_id: string;
          role?: "owner" | "member";
        };
        Update: {
          role?: "owner" | "member";
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          id: string;
          organisation_id: string;
          uploaded_by: string;
          file_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          organisation_id: string;
          uploaded_by?: string;
          file_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      rate_limits: {
        Row: {
          key: string;
          count: number;
          window_start: string;
        };
        Insert: {
          key: string;
          count?: number;
          window_start?: string;
        };
        Update: {
          key?: string;
          count?: number;
          window_start?: string;
        };
        Relationships: [];
      };
      adyen_payment_webhook_events: {
        Row: {
          id: string;
          organisation_id: string | null;
          event_code: string;
          live: boolean;
          psp_reference: string;
          original_reference: string | null;
          merchant_account_code: string;
          merchant_reference: string | null;
          amount_value: number | null;
          amount_currency: string | null;
          success: boolean | null;
          reason: string | null;
          payload: Json;
          processing_status: "received" | "processed" | "failed" | "ignored";
          error: string | null;
          received_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          organisation_id?: string | null;
          event_code: string;
          live?: boolean;
          psp_reference: string;
          original_reference?: string | null;
          merchant_account_code: string;
          merchant_reference?: string | null;
          amount_value?: number | null;
          amount_currency?: string | null;
          success?: boolean | null;
          reason?: string | null;
          payload: Json;
          processing_status?: "received" | "processed" | "failed" | "ignored";
          error?: string | null;
          received_at?: string;
          processed_at?: string | null;
        };
        Update: {
          organisation_id?: string | null;
          processing_status?: "received" | "processed" | "failed" | "ignored";
          error?: string | null;
          processed_at?: string | null;
        };
        Relationships: [];
      };
      adyen_configuration_webhook_events: {
        Row: {
          id: string;
          organisation_id: string | null;
          event_type: string;
          live: boolean;
          balance_account_id: string | null;
          account_holder_id: string | null;
          legal_entity_id: string | null;
          raw_body_hash: string;
          payload: Json;
          processing_status: "received" | "processed" | "failed" | "ignored";
          error: string | null;
          received_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          organisation_id?: string | null;
          event_type: string;
          live?: boolean;
          balance_account_id?: string | null;
          account_holder_id?: string | null;
          legal_entity_id?: string | null;
          raw_body_hash: string;
          payload: Json;
          processing_status?: "received" | "processed" | "failed" | "ignored";
          error?: string | null;
          received_at?: string;
          processed_at?: string | null;
        };
        Update: {
          organisation_id?: string | null;
          processing_status?: "received" | "processed" | "failed" | "ignored";
          error?: string | null;
          processed_at?: string | null;
        };
        Relationships: [];
      };
      adyen_transfer_webhook_events: {
        Row: {
          id: string;
          organisation_id: string | null;
          event_type: string;
          live: boolean;
          balance_account_id: string | null;
          transfer_reference: string | null;
          transfer_status: string | null;
          amount_value: number | null;
          amount_currency: string | null;
          raw_body_hash: string;
          payload: Json;
          processing_status: "received" | "processed" | "failed" | "ignored";
          error: string | null;
          received_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          organisation_id?: string | null;
          event_type: string;
          live?: boolean;
          balance_account_id?: string | null;
          transfer_reference?: string | null;
          transfer_status?: string | null;
          amount_value?: number | null;
          amount_currency?: string | null;
          raw_body_hash: string;
          payload: Json;
          processing_status?: "received" | "processed" | "failed" | "ignored";
          error?: string | null;
          received_at?: string;
          processed_at?: string | null;
        };
        Update: {
          organisation_id?: string | null;
          processing_status?: "received" | "processed" | "failed" | "ignored";
          error?: string | null;
          processed_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      hit_rate_limit: {
        Args: {
          p_key: string;
          p_max: number;
          p_window_seconds: number;
        };
        Returns: boolean;
      };
      is_org_member: {
        Args: { org_id: string };
        Returns: boolean;
      };
      join_organisation: {
        Args: { target_org_id: string; claimed_name: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
