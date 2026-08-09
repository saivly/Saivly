/**
 * Hand-maintained to match supabase/migrations/0001 through 0005.
 * (0003_organisations.sql: profiles gains onboarding's personal-info
 * columns; organisations + organisation_members are new, many-to-many.
 * 0004_residential_address_adyen.sql: birth_* -> residential_* on
 * profiles, + first_name/last_name/adyen_legal_entity_id.
 * 0005_profiles_email.sql: profiles.email, trigger-synced from auth.users.
 * 0006_residential_province.sql: profiles.residential_province.)
 * Once you have a live project, regenerate from the real schema with:
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.types.ts
 */
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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
