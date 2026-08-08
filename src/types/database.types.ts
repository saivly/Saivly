/**
 * Hand-maintained to match supabase/migrations/0001 and 0002.
 * Once you have a live project, regenerate from the real schema with:
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.types.ts
 */
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never; // created by trigger
        Update: {
          full_name?: string | null;
          avatar_url?: string | null;
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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
