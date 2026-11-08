export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      beta_codes: {
        Row: {
          active: boolean
          code_hash: string
          created_at: string
          expires_at: string | null
          id: string
          label: string | null
          max_redemptions: number
          redemptions: number
        }
        Insert: {
          active?: boolean
          code_hash: string
          created_at?: string
          expires_at?: string | null
          id?: string
          label?: string | null
          max_redemptions?: number
          redemptions?: number
        }
        Update: {
          active?: boolean
          code_hash?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          label?: string | null
          max_redemptions?: number
          redemptions?: number
        }
        Relationships: []
      }
      beta_redeem_failures: {
        Row: {
          failed_at: string
          id: number
          ip_hash: string
        }
        Insert: {
          failed_at?: string
          id?: never
          ip_hash: string
        }
        Update: {
          failed_at?: string
          id?: never
          ip_hash?: string
        }
        Relationships: []
      }
      license_activations: {
        Row: {
          activated_at: string
          app_version: string | null
          device_hash: string
          device_name: string | null
          id: string
          last_seen_at: string
          license_id: string
        }
        Insert: {
          activated_at?: string
          app_version?: string | null
          device_hash: string
          device_name?: string | null
          id?: string
          last_seen_at?: string
          license_id: string
        }
        Update: {
          activated_at?: string
          app_version?: string | null
          device_hash?: string
          device_name?: string | null
          id?: string
          last_seen_at?: string
          license_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "license_activations_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      licenses: {
        Row: {
          beta_code_id: string | null
          created_at: string
          email: string | null
          expires_at: string | null
          id: string
          key_hash: string
          key_hint: string
          max_activations: number
          note: string | null
          plan: string
          status: string
          updated_at: string
        }
        Insert: {
          beta_code_id?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string | null
          id?: string
          key_hash: string
          key_hint: string
          max_activations?: number
          note?: string | null
          plan?: string
          status?: string
          updated_at?: string
        }
        Update: {
          beta_code_id?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_hint?: string
          max_activations?: number
          note?: string | null
          plan?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "licenses_beta_code_id_fkey"
            columns: ["beta_code_id"]
            isOneToOne: false
            referencedRelation: "beta_codes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_license: {
        Args: {
          p_app_version?: string
          p_device_id: string
          p_device_name?: string
          p_key: string
        }
        Returns: Json
      }
      beta_normalize_code: { Args: { p_code: string }; Returns: string }
      create_beta_code: {
        Args: {
          p_code?: string
          p_expires_at?: string
          p_label?: string
          p_max_redemptions?: number
        }
        Returns: {
          code: string
          code_id: string
        }[]
      }
      deactivate_license: {
        Args: { p_device_id: string; p_key: string }
        Returns: Json
      }
      issue_license: {
        Args: {
          p_email?: string
          p_expires_at?: string
          p_max_activations?: number
          p_note?: string
          p_plan?: string
        }
        Returns: {
          license_id: string
          license_key: string
        }[]
      }
      license_normalize_key: { Args: { p_key: string }; Returns: string }
      license_sha256: { Args: { p_value: string }; Returns: string }
      license_summary: {
        Args: { p_license: Database["public"]["Tables"]["licenses"]["Row"] }
        Returns: Json
      }
      redeem_beta_code: {
        Args: { p_code: string; p_ip: string }
        Returns: Json
      }
      validate_license: {
        Args: { p_app_version?: string; p_device_id: string; p_key: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
