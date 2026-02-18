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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      agent_registrations: {
        Row: {
          agent_key: string
          agent_name: string
          created_at: string
          id: string
          last_heartbeat: string
          metadata: Json | null
        }
        Insert: {
          agent_key: string
          agent_name: string
          created_at?: string
          id?: string
          last_heartbeat?: string
          metadata?: Json | null
        }
        Update: {
          agent_key?: string
          agent_name?: string
          created_at?: string
          id?: string
          last_heartbeat?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      asset_characters: {
        Row: {
          asset_id: string
          character_id: string
          id: string
        }
        Insert: {
          asset_id: string
          character_id: string
          id?: string
        }
        Update: {
          asset_id?: string
          character_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_characters_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_characters_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_path_history: {
        Row: {
          asset_id: string
          detected_at: string
          id: string
          new_path: string
          old_path: string
        }
        Insert: {
          asset_id: string
          detected_at?: string
          id?: string
          new_path: string
          old_path: string
        }
        Update: {
          asset_id?: string
          detected_at?: string
          id?: string
          new_path?: string
          old_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_path_history_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          ai_description: string | null
          art_source: Database["public"]["Enums"]["art_source"] | null
          artboards: number
          asset_type: Database["public"]["Enums"]["asset_type"] | null
          big_theme: string | null
          color_placeholder: string | null
          created_at: string
          design_ref: string | null
          design_style: string | null
          file_created_at: string | null
          file_path: string
          file_size: number
          file_type: Database["public"]["Enums"]["file_type"]
          filename: string
          height: number
          id: string
          ingested_at: string
          is_licensed: boolean
          licensor_id: string | null
          little_theme: string | null
          modified_at: string
          product_subtype_id: string | null
          property_id: string | null
          scene_description: string | null
          status: Database["public"]["Enums"]["asset_status"]
          tags: string[] | null
          thumbnail_error: string | null
          thumbnail_url: string | null
          width: number
          workflow_status: string | null
        }
        Insert: {
          ai_description?: string | null
          art_source?: Database["public"]["Enums"]["art_source"] | null
          artboards?: number
          asset_type?: Database["public"]["Enums"]["asset_type"] | null
          big_theme?: string | null
          color_placeholder?: string | null
          created_at?: string
          design_ref?: string | null
          design_style?: string | null
          file_created_at?: string | null
          file_path: string
          file_size?: number
          file_type: Database["public"]["Enums"]["file_type"]
          filename: string
          height?: number
          id?: string
          ingested_at?: string
          is_licensed?: boolean
          licensor_id?: string | null
          little_theme?: string | null
          modified_at?: string
          product_subtype_id?: string | null
          property_id?: string | null
          scene_description?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          tags?: string[] | null
          thumbnail_error?: string | null
          thumbnail_url?: string | null
          width?: number
          workflow_status?: string | null
        }
        Update: {
          ai_description?: string | null
          art_source?: Database["public"]["Enums"]["art_source"] | null
          artboards?: number
          asset_type?: Database["public"]["Enums"]["asset_type"] | null
          big_theme?: string | null
          color_placeholder?: string | null
          created_at?: string
          design_ref?: string | null
          design_style?: string | null
          file_created_at?: string | null
          file_path?: string
          file_size?: number
          file_type?: Database["public"]["Enums"]["file_type"]
          filename?: string
          height?: number
          id?: string
          ingested_at?: string
          is_licensed?: boolean
          licensor_id?: string | null
          little_theme?: string | null
          modified_at?: string
          product_subtype_id?: string | null
          property_id?: string | null
          scene_description?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          tags?: string[] | null
          thumbnail_error?: string | null
          thumbnail_url?: string | null
          width?: number
          workflow_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_licensor_id_fkey"
            columns: ["licensor_id"]
            isOneToOne: false
            referencedRelation: "licensors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_product_subtype_id_fkey"
            columns: ["product_subtype_id"]
            isOneToOne: false
            referencedRelation: "product_subtypes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      characters: {
        Row: {
          created_at: string
          external_id: string | null
          id: string
          name: string
          property_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_id?: string | null
          id?: string
          name: string
          property_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_id?: string | null
          id?: string
          name?: string
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "characters_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invited_by: string
          role: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by: string
          role?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
          role?: string
        }
        Relationships: []
      }
      licensors: {
        Row: {
          created_at: string
          external_id: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_id?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_id?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      processing_queue: {
        Row: {
          agent_id: string | null
          asset_id: string
          claimed_at: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          job_type: string
          status: Database["public"]["Enums"]["queue_status"]
        }
        Insert: {
          agent_id?: string | null
          asset_id: string
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type?: string
          status?: Database["public"]["Enums"]["queue_status"]
        }
        Update: {
          agent_id?: string | null
          asset_id?: string
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type?: string
          status?: Database["public"]["Enums"]["queue_status"]
        }
        Relationships: [
          {
            foreignKeyName: "processing_queue_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_queue_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          external_id: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_id?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_id?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_subtypes: {
        Row: {
          created_at: string
          external_id: string | null
          id: string
          name: string
          type_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_id?: string | null
          id?: string
          name: string
          type_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_id?: string | null
          id?: string
          name?: string
          type_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_subtypes_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["id"]
          },
        ]
      }
      product_types: {
        Row: {
          category_id: string
          created_at: string
          external_id: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          external_id?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          external_id?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_types_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          created_at: string
          external_id: string | null
          id: string
          licensor_id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_id?: string | null
          id?: string
          licensor_id: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_id?: string | null
          id?: string
          licensor_id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_licensor_id_fkey"
            columns: ["licensor_id"]
            isOneToOne: false
            referencedRelation: "licensors"
            referencedColumns: ["id"]
          },
        ]
      }
      render_queue: {
        Row: {
          asset_id: string
          claimed_at: string | null
          claimed_by: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          status: string
        }
        Insert: {
          asset_id: string
          claimed_at?: string | null
          claimed_by?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          status?: string
        }
        Update: {
          asset_id?: string
          claimed_at?: string | null
          claimed_by?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "render_queue_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_jobs: {
        Args: { p_agent_id: string; p_batch_size?: number }
        Returns: {
          agent_id: string | null
          asset_id: string
          claimed_at: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          job_type: string
          status: Database["public"]["Enums"]["queue_status"]
        }[]
        SetofOptions: {
          from: "*"
          to: "processing_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_asset_count: { Args: never; Returns: number }
      get_filter_counts: { Args: never; Returns: Json }
      reset_stale_jobs: {
        Args: { p_timeout_minutes?: number }
        Returns: number
      }
    }
    Enums: {
      art_source:
        | "freelancer"
        | "straight_style_guide"
        | "style_guide_composition"
      asset_status: "pending" | "processing" | "tagged" | "error"
      asset_type: "art_piece" | "product"
      file_type: "psd" | "ai"
      queue_status:
        | "pending"
        | "claimed"
        | "processing"
        | "completed"
        | "failed"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      art_source: [
        "freelancer",
        "straight_style_guide",
        "style_guide_composition",
      ],
      asset_status: ["pending", "processing", "tagged", "error"],
      asset_type: ["art_piece", "product"],
      file_type: ["psd", "ai"],
      queue_status: ["pending", "claimed", "processing", "completed", "failed"],
    },
  },
} as const
