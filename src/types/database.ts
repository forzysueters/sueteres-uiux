/**
 * Tipos do banco — GERADO AUTOMATICAMENTE. Não edite à mão.
 * Regenere com: npm run db:types
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      alerts: {
        Row: {
          id: string
          asset_id: string
          sensor_id: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          status: Database["public"]["Enums"]["alert_status"]
          source: Database["public"]["Enums"]["alert_source"]
          title: string
          message: string
          ml_insight: string | null
          triggered_value: number | null
          threshold_value: number | null
          triggered_at: string
          acknowledged_by: string | null
          acknowledged_at: string | null
          resolved_by: string | null
          resolved_at: string | null
          resolution_notes: string | null
          metadata: Json
          created_at: string
          updated_at: string
          resolved: boolean | null
        }
        Insert: {
          id?: string
          asset_id: string
          sensor_id?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          status?: Database["public"]["Enums"]["alert_status"]
          source?: Database["public"]["Enums"]["alert_source"]
          title: string
          message?: string
          ml_insight?: string | null
          triggered_value?: number | null
          threshold_value?: number | null
          triggered_at?: string
          acknowledged_by?: string | null
          acknowledged_at?: string | null
          resolved_by?: string | null
          resolved_at?: string | null
          resolution_notes?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          asset_id?: string
          sensor_id?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          status?: Database["public"]["Enums"]["alert_status"]
          source?: Database["public"]["Enums"]["alert_source"]
          title?: string
          message?: string
          ml_insight?: string | null
          triggered_value?: number | null
          threshold_value?: number | null
          triggered_at?: string
          acknowledged_by?: string | null
          acknowledged_at?: string | null
          resolved_by?: string | null
          resolved_at?: string | null
          resolution_notes?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_sensor_id_fkey"
            columns: ["sensor_id"]
            isOneToOne: false
            referencedRelation: "sensors"
            referencedColumns: ["id"]
          },
        ]
      }
      areas: {
        Row: {
          id: string
          plant_id: string
          code: string
          name: string
          description: string | null
          floor_plan_url: string | null
          grid_cols: number
          grid_rows: number
          display_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          plant_id: string
          code: string
          name: string
          description?: string | null
          floor_plan_url?: string | null
          grid_cols?: number
          grid_rows?: number
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          plant_id?: string
          code?: string
          name?: string
          description?: string | null
          floor_plan_url?: string | null
          grid_cols?: number
          grid_rows?: number
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "areas_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_health_snapshots: {
        Row: {
          id: number
          asset_id: string
          captured_at: string
          uptime: number
          anomaly_score: number
          status: Database["public"]["Enums"]["asset_status"]
          active_alerts: number
        }
        Insert: {
          id?: number
          asset_id: string
          captured_at?: string
          uptime: number
          anomaly_score: number
          status: Database["public"]["Enums"]["asset_status"]
          active_alerts?: number
        }
        Update: {
          id?: number
          asset_id?: string
          captured_at?: string
          uptime?: number
          anomaly_score?: number
          status?: Database["public"]["Enums"]["asset_status"]
          active_alerts?: number
        }
        Relationships: [
          {
            foreignKeyName: "asset_health_snapshots_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_nameplates: {
        Row: {
          id: string
          asset_id: string | null
          status: Database["public"]["Enums"]["nameplate_status"]
          serial_number: string | null
          manufacturer: string | null
          model: string | null
          year_manufactured: number | null
          motor_type: string | null
          power_kw: number | null
          power_hp: number | null
          voltage: string | null
          current_a: number | null
          rpm: number | null
          poles: number | null
          frequency_hz: number | null
          connection_type: string | null
          service_factor: number | null
          insulation_class: string | null
          ip_rating: string | null
          efficiency_class: string | null
          weight_kg: number | null
          image_url: string | null
          storage_path: string | null
          ocr_provider: string | null
          ocr_confidence: number | null
          ocr_raw: Json
          extra: Json
          registered_by: string | null
          confirmed_by: string | null
          confirmed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          asset_id?: string | null
          status?: Database["public"]["Enums"]["nameplate_status"]
          serial_number?: string | null
          manufacturer?: string | null
          model?: string | null
          year_manufactured?: number | null
          motor_type?: string | null
          power_kw?: number | null
          power_hp?: number | null
          voltage?: string | null
          current_a?: number | null
          rpm?: number | null
          poles?: number | null
          frequency_hz?: number | null
          connection_type?: string | null
          service_factor?: number | null
          insulation_class?: string | null
          ip_rating?: string | null
          efficiency_class?: string | null
          weight_kg?: number | null
          image_url?: string | null
          storage_path?: string | null
          ocr_provider?: string | null
          ocr_confidence?: number | null
          ocr_raw?: Json
          extra?: Json
          registered_by?: string | null
          confirmed_by?: string | null
          confirmed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          asset_id?: string | null
          status?: Database["public"]["Enums"]["nameplate_status"]
          serial_number?: string | null
          manufacturer?: string | null
          model?: string | null
          year_manufactured?: number | null
          motor_type?: string | null
          power_kw?: number | null
          power_hp?: number | null
          voltage?: string | null
          current_a?: number | null
          rpm?: number | null
          poles?: number | null
          frequency_hz?: number | null
          connection_type?: string | null
          service_factor?: number | null
          insulation_class?: string | null
          ip_rating?: string | null
          efficiency_class?: string | null
          weight_kg?: number | null
          image_url?: string | null
          storage_path?: string | null
          ocr_provider?: string | null
          ocr_confidence?: number | null
          ocr_raw?: Json
          extra?: Json
          registered_by?: string | null
          confirmed_by?: string | null
          confirmed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_nameplates_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_nameplates_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_nameplates_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          id: string
          plant_id: string
          area_id: string | null
          tag: string
          name: string
          asset_type: Database["public"]["Enums"]["asset_type"]
          location: string
          status: Database["public"]["Enums"]["asset_status"]
          criticality: Database["public"]["Enums"]["criticality_level"]
          uptime: number
          anomaly_score: number
          grid_x: number
          grid_y: number
          image_url: string | null
          commissioned_at: string | null
          last_maintenance: string | null
          next_maintenance: string | null
          is_active: boolean
          metadata: Json
          created_at: string
          updated_at: string
          plant_x: number | null
          plant_y: number | null
          health_index: number | null
          severity: Database["public"]["Enums"]["anomaly_severity"] | null
          insight: string | null
          thermal_residual: number | null
          scored_at: string | null
        }
        Insert: {
          id?: string
          plant_id: string
          area_id?: string | null
          tag: string
          name: string
          asset_type?: Database["public"]["Enums"]["asset_type"]
          location?: string
          status?: Database["public"]["Enums"]["asset_status"]
          criticality?: Database["public"]["Enums"]["criticality_level"]
          uptime?: number
          anomaly_score?: number
          grid_x?: number
          grid_y?: number
          image_url?: string | null
          commissioned_at?: string | null
          last_maintenance?: string | null
          next_maintenance?: string | null
          is_active?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
          plant_x?: number | null
          plant_y?: number | null
          health_index?: number | null
          severity?: Database["public"]["Enums"]["anomaly_severity"] | null
          insight?: string | null
          thermal_residual?: number | null
          scored_at?: string | null
        }
        Update: {
          id?: string
          plant_id?: string
          area_id?: string | null
          tag?: string
          name?: string
          asset_type?: Database["public"]["Enums"]["asset_type"]
          location?: string
          status?: Database["public"]["Enums"]["asset_status"]
          criticality?: Database["public"]["Enums"]["criticality_level"]
          uptime?: number
          anomaly_score?: number
          grid_x?: number
          grid_y?: number
          image_url?: string | null
          commissioned_at?: string | null
          last_maintenance?: string | null
          next_maintenance?: string | null
          is_active?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
          plant_x?: number | null
          plant_y?: number | null
          health_index?: number | null
          severity?: Database["public"]["Enums"]["anomaly_severity"] | null
          insight?: string | null
          thermal_residual?: number | null
          scored_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          id: number
          actor_id: string | null
          actor_email: string | null
          action: string
          entity_type: string
          entity_id: string | null
          before_data: Json | null
          after_data: Json | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: number
          actor_id?: string | null
          actor_email?: string | null
          action: string
          entity_type: string
          entity_id?: string | null
          before_data?: Json | null
          after_data?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          actor_id?: string | null
          actor_email?: string | null
          action?: string
          entity_type?: string
          entity_id?: string | null
          before_data?: Json | null
          after_data?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          id: string
          user_id: string
          asset_id: string | null
          title: string
          is_archived: boolean
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          asset_id?: string | null
          title?: string
          is_archived?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          asset_id?: string | null
          title?: string
          is_archived?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          id: string
          conversation_id: string
          role: Database["public"]["Enums"]["chat_role"]
          content: string
          asset_context: string | null
          citations: Json
          tool_calls: Json
          model: string | null
          prompt_tokens: number | null
          completion_tokens: number | null
          latency_ms: number | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          role: Database["public"]["Enums"]["chat_role"]
          content: string
          asset_context?: string | null
          citations?: Json
          tool_calls?: Json
          model?: string | null
          prompt_tokens?: number | null
          completion_tokens?: number | null
          latency_ms?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          role?: Database["public"]["Enums"]["chat_role"]
          content?: string
          asset_context?: string | null
          citations?: Json
          tool_calls?: Json
          model?: string | null
          prompt_tokens?: number | null
          completion_tokens?: number | null
          latency_ms?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_asset_context_fkey"
            columns: ["asset_context"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      collector_config: {
        Row: {
          id: boolean
          is_enabled: boolean
          force_always: boolean
          active_isodow: number[]
          window_start: unknown
          window_end: unknown
          timezone: string
          updated_at: string
        }
        Insert: {
          id?: boolean
          is_enabled?: boolean
          force_always?: boolean
          active_isodow?: number[]
          window_start?: unknown
          window_end?: unknown
          timezone?: string
          updated_at?: string
        }
        Update: {
          id?: boolean
          is_enabled?: boolean
          force_always?: boolean
          active_isodow?: number[]
          window_start?: unknown
          window_end?: unknown
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      collector_field_map: {
        Row: {
          id: string
          source_id: string
          json_field: string
          sensor_tag: string
          scale: number
          offset_value: number
          created_at: string
        }
        Insert: {
          id?: string
          source_id: string
          json_field: string
          sensor_tag: string
          scale?: number
          offset_value?: number
          created_at?: string
        }
        Update: {
          id?: string
          source_id?: string
          json_field?: string
          sensor_tag?: string
          scale?: number
          offset_value?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collector_field_map_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "collector_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      collector_requests: {
        Row: {
          request_id: number
          source_id: string
          requested_at: string
        }
        Insert: {
          request_id: number
          source_id: string
          requested_at?: string
        }
        Update: {
          request_id?: number
          source_id?: string
          requested_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collector_requests_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "collector_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      collector_sources: {
        Row: {
          id: string
          code: string
          name: string
          url: string
          payload_key: string
          is_enabled: boolean
          timeout_ms: number
          notes: string | null
          created_at: string
          updated_at: string
          headers: Json
        }
        Insert: {
          id?: string
          code: string
          name: string
          url: string
          payload_key: string
          is_enabled?: boolean
          timeout_ms?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
          headers?: Json
        }
        Update: {
          id?: string
          code?: string
          name?: string
          url?: string
          payload_key?: string
          is_enabled?: boolean
          timeout_ms?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
          headers?: Json
        }
        Relationships: []
      }
      document_chunks: {
        Row: {
          id: string
          document_id: string
          asset_id: string | null
          chunk_index: number
          content: string
          token_count: number | null
          page_number: number | null
          embedding: string | null
          metadata: Json
          created_at: string
          content_tsv: unknown | null
        }
        Insert: {
          id?: string
          document_id: string
          asset_id?: string | null
          chunk_index: number
          content: string
          token_count?: number | null
          page_number?: number | null
          embedding?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          asset_id?: string | null
          chunk_index?: number
          content?: string
          token_count?: number | null
          page_number?: number | null
          embedding?: string | null
          metadata?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          id: string
          asset_id: string | null
          plant_id: string | null
          title: string
          document_type: Database["public"]["Enums"]["document_type"]
          description: string | null
          file_url: string | null
          storage_path: string | null
          mime_type: string | null
          size_bytes: number | null
          language: string
          version: string | null
          uploaded_by: string | null
          indexed_at: string | null
          chunk_count: number
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          asset_id?: string | null
          plant_id?: string | null
          title: string
          document_type?: Database["public"]["Enums"]["document_type"]
          description?: string | null
          file_url?: string | null
          storage_path?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          language?: string
          version?: string | null
          uploaded_by?: string | null
          indexed_at?: string | null
          chunk_count?: number
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          asset_id?: string | null
          plant_id?: string | null
          title?: string
          document_type?: Database["public"]["Enums"]["document_type"]
          description?: string | null
          file_url?: string | null
          storage_path?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          language?: string
          version?: string | null
          uploaded_by?: string | null
          indexed_at?: string | null
          chunk_count?: number
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lgpd_consents: {
        Row: {
          id: string
          user_id: string
          consent_type: Database["public"]["Enums"]["consent_type"]
          granted: boolean
          policy_version: string
          granted_at: string | null
          revoked_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          consent_type: Database["public"]["Enums"]["consent_type"]
          granted?: boolean
          policy_version?: string
          granted_at?: string | null
          revoked_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          consent_type?: Database["public"]["Enums"]["consent_type"]
          granted?: boolean
          policy_version?: string
          granted_at?: string | null
          revoked_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lgpd_consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_orders: {
        Row: {
          id: string
          asset_id: string
          alert_id: string | null
          order_number: string
          maintenance_type: Database["public"]["Enums"]["maintenance_type"]
          status: Database["public"]["Enums"]["maintenance_status"]
          priority: Database["public"]["Enums"]["criticality_level"]
          title: string
          description: string | null
          scheduled_for: string | null
          started_at: string | null
          completed_at: string | null
          assigned_to: string | null
          created_by: string | null
          estimated_hours: number | null
          downtime_minutes: number | null
          cost: number | null
          notes: string | null
          checklist: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          asset_id: string
          alert_id?: string | null
          order_number?: string
          maintenance_type?: Database["public"]["Enums"]["maintenance_type"]
          status?: Database["public"]["Enums"]["maintenance_status"]
          priority?: Database["public"]["Enums"]["criticality_level"]
          title: string
          description?: string | null
          scheduled_for?: string | null
          started_at?: string | null
          completed_at?: string | null
          assigned_to?: string | null
          created_by?: string | null
          estimated_hours?: number | null
          downtime_minutes?: number | null
          cost?: number | null
          notes?: string | null
          checklist?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          asset_id?: string
          alert_id?: string | null
          order_number?: string
          maintenance_type?: Database["public"]["Enums"]["maintenance_type"]
          status?: Database["public"]["Enums"]["maintenance_status"]
          priority?: Database["public"]["Enums"]["criticality_level"]
          title?: string
          description?: string | null
          scheduled_for?: string | null
          started_at?: string | null
          completed_at?: string | null
          assigned_to?: string | null
          created_by?: string | null
          estimated_hours?: number | null
          downtime_minutes?: number | null
          cost?: number | null
          notes?: string | null
          checklist?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_orders_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_orders_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_orders_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ml_models: {
        Row: {
          id: string
          name: string
          version: string
          model_type: Database["public"]["Enums"]["ml_model_type"]
          algorithm: string | null
          description: string | null
          target_asset_type: Database["public"]["Enums"]["asset_type"] | null
          feature_names: string[]
          hyperparameters: Json
          metrics: Json
          model_card: Json
          parent_model_id: string | null
          artifact_url: string | null
          training_rows: number | null
          trained_at: string | null
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          version?: string
          model_type: Database["public"]["Enums"]["ml_model_type"]
          algorithm?: string | null
          description?: string | null
          target_asset_type?: Database["public"]["Enums"]["asset_type"] | null
          feature_names?: string[]
          hyperparameters?: Json
          metrics?: Json
          model_card?: Json
          parent_model_id?: string | null
          artifact_url?: string | null
          training_rows?: number | null
          trained_at?: string | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          version?: string
          model_type?: Database["public"]["Enums"]["ml_model_type"]
          algorithm?: string | null
          description?: string | null
          target_asset_type?: Database["public"]["Enums"]["asset_type"] | null
          feature_names?: string[]
          hyperparameters?: Json
          metrics?: Json
          model_card?: Json
          parent_model_id?: string | null
          artifact_url?: string | null
          training_rows?: number | null
          trained_at?: string | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ml_models_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ml_models_parent_model_id_fkey"
            columns: ["parent_model_id"]
            isOneToOne: false
            referencedRelation: "ml_models"
            referencedColumns: ["id"]
          },
        ]
      }
      ml_predictions: {
        Row: {
          id: number
          model_id: string
          asset_id: string
          sensor_id: string | null
          prediction_type: Database["public"]["Enums"]["prediction_type"]
          predicted_at: string
          value: number | null
          confidence: number | null
          horizon_days: number | null
          rul_days: number | null
          recommended_action: string | null
          explanation: string | null
          features: Json
          feature_importance: Json
          alert_id: string | null
        }
        Insert: {
          id?: number
          model_id: string
          asset_id: string
          sensor_id?: string | null
          prediction_type: Database["public"]["Enums"]["prediction_type"]
          predicted_at?: string
          value?: number | null
          confidence?: number | null
          horizon_days?: number | null
          rul_days?: number | null
          recommended_action?: string | null
          explanation?: string | null
          features?: Json
          feature_importance?: Json
          alert_id?: string | null
        }
        Update: {
          id?: number
          model_id?: string
          asset_id?: string
          sensor_id?: string | null
          prediction_type?: Database["public"]["Enums"]["prediction_type"]
          predicted_at?: string
          value?: number | null
          confidence?: number | null
          horizon_days?: number | null
          rul_days?: number | null
          recommended_action?: string | null
          explanation?: string | null
          features?: Json
          feature_importance?: Json
          alert_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ml_predictions_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ml_predictions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ml_predictions_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ml_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ml_predictions_sensor_id_fkey"
            columns: ["sensor_id"]
            isOneToOne: false
            referencedRelation: "sensors"
            referencedColumns: ["id"]
          },
        ]
      }
      ml_training_runs: {
        Row: {
          id: string
          model_id: string
          started_at: string
          finished_at: string | null
          status: string
          dataset_from: string | null
          dataset_to: string | null
          row_count: number | null
          metrics: Json
          log: string | null
          triggered_by: string | null
        }
        Insert: {
          id?: string
          model_id: string
          started_at?: string
          finished_at?: string | null
          status?: string
          dataset_from?: string | null
          dataset_to?: string | null
          row_count?: number | null
          metrics?: Json
          log?: string | null
          triggered_by?: string | null
        }
        Update: {
          id?: string
          model_id?: string
          started_at?: string
          finished_at?: string | null
          status?: string
          dataset_from?: string | null
          dataset_to?: string | null
          row_count?: number | null
          metrics?: Json
          log?: string | null
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ml_training_runs_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ml_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ml_training_runs_triggered_by_fkey"
            columns: ["triggered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plants: {
        Row: {
          id: string
          code: string
          name: string
          description: string | null
          address: string | null
          city: string | null
          state: string | null
          country: string
          timezone: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          description?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          country?: string
          timezone?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          description?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          country?: string
          timezone?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          role: Database["public"]["Enums"]["user_role"]
          job_title: string | null
          department: string | null
          phone: string | null
          avatar_url: string | null
          plant_id: string | null
          two_factor_enabled: boolean
          is_active: boolean
          last_login_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string
          role?: Database["public"]["Enums"]["user_role"]
          job_title?: string | null
          department?: string | null
          phone?: string | null
          avatar_url?: string | null
          plant_id?: string | null
          two_factor_enabled?: boolean
          is_active?: boolean
          last_login_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          role?: Database["public"]["Enums"]["user_role"]
          job_title?: string | null
          department?: string | null
          phone?: string | null
          avatar_url?: string | null
          plant_id?: string | null
          two_factor_enabled?: boolean
          is_active?: boolean
          last_login_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      sensor_raw_captures: {
        Row: {
          id: number
          source_id: string
          request_id: number | null
          requested_at: string
          responded_at: string
          http_status: number | null
          payload: Json | null
          raw_body: string | null
          error: string | null
          ingested_at: string | null
          ingested_rows: number | null
        }
        Insert: {
          id?: number
          source_id: string
          request_id?: number | null
          requested_at: string
          responded_at?: string
          http_status?: number | null
          payload?: Json | null
          raw_body?: string | null
          error?: string | null
          ingested_at?: string | null
          ingested_rows?: number | null
        }
        Update: {
          id?: number
          source_id?: string
          request_id?: number | null
          requested_at?: string
          responded_at?: string
          http_status?: number | null
          payload?: Json | null
          raw_body?: string | null
          error?: string | null
          ingested_at?: string | null
          ingested_rows?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sensor_raw_captures_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "collector_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      sensor_readings: {
        Row: {
          id: number
          sensor_id: string
          asset_id: string
          ts: string
          value: number | null
          raw_value: number | null
          quality: Database["public"]["Enums"]["reading_quality"]
          status: Database["public"]["Enums"]["sensor_status"]
          source: string
        }
        Insert: {
          id?: number
          sensor_id: string
          asset_id: string
          ts?: string
          value?: number | null
          raw_value?: number | null
          quality?: Database["public"]["Enums"]["reading_quality"]
          status?: Database["public"]["Enums"]["sensor_status"]
          source?: string
        }
        Update: {
          id?: number
          sensor_id?: string
          asset_id?: string
          ts?: string
          value?: number | null
          raw_value?: number | null
          quality?: Database["public"]["Enums"]["reading_quality"]
          status?: Database["public"]["Enums"]["sensor_status"]
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "sensor_readings_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensor_readings_sensor_id_fkey"
            columns: ["sensor_id"]
            isOneToOne: false
            referencedRelation: "sensors"
            referencedColumns: ["id"]
          },
        ]
      }
      sensors: {
        Row: {
          id: string
          asset_id: string
          tag: string
          name: string
          sensor_type: Database["public"]["Enums"]["sensor_type"]
          unit: string
          min_value: number
          max_value: number
          warning_threshold: number | null
          critical_threshold: number | null
          raw_min: number | null
          raw_max: number | null
          raw_unit: string | null
          opcua_node_id: string | null
          mqtt_topic: string | null
          sampling_interval_s: number
          is_active: boolean
          metadata: Json
          created_at: string
          updated_at: string
          limit_direction: Database["public"]["Enums"]["limit_direction"]
          nominal_value: number | null
          limit_source: string | null
          display_order: number
        }
        Insert: {
          id?: string
          asset_id: string
          tag: string
          name: string
          sensor_type: Database["public"]["Enums"]["sensor_type"]
          unit: string
          min_value?: number
          max_value?: number
          warning_threshold?: number | null
          critical_threshold?: number | null
          raw_min?: number | null
          raw_max?: number | null
          raw_unit?: string | null
          opcua_node_id?: string | null
          mqtt_topic?: string | null
          sampling_interval_s?: number
          is_active?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
          limit_direction?: Database["public"]["Enums"]["limit_direction"]
          nominal_value?: number | null
          limit_source?: string | null
          display_order?: number
        }
        Update: {
          id?: string
          asset_id?: string
          tag?: string
          name?: string
          sensor_type?: Database["public"]["Enums"]["sensor_type"]
          unit?: string
          min_value?: number
          max_value?: number
          warning_threshold?: number | null
          critical_threshold?: number | null
          raw_min?: number | null
          raw_max?: number | null
          raw_unit?: string | null
          opcua_node_id?: string | null
          mqtt_topic?: string | null
          sampling_interval_s?: number
          is_active?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
          limit_direction?: Database["public"]["Enums"]["limit_direction"]
          nominal_value?: number | null
          limit_source?: string | null
          display_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "sensors_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          user_id: string
          dark_mode: boolean
          primary_color: string
          language: string
          sidebar_open: boolean
          max_alerts_display: number
          dashboard_refresh_ms: number
          notify_email: boolean
          notify_critical_only: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          dark_mode?: boolean
          primary_color?: string
          language?: string
          sidebar_open?: boolean
          max_alerts_display?: number
          dashboard_refresh_ms?: number
          notify_email?: boolean
          notify_critical_only?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          dark_mode?: boolean
          primary_color?: string
          language?: string
          sidebar_open?: boolean
          max_alerts_display?: number
          dashboard_refresh_ms?: number
          notify_email?: boolean
          notify_critical_only?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      collector_health: {
        Row: {
          code: string | null
          name: string | null
          url: string | null
          is_enabled: boolean | null
          capturas: number | null
          ok: number | null
          falhas: number | null
          pendentes: number | null
          leituras_gravadas: number | null
          ultima_captura: string | null
          ultimo_sucesso: string | null
          ultimo_erro: string | null
        }
        Relationships: []
      }
      v_alerts_full: {
        Row: {
          id: string | null
          asset_id: string | null
          asset_name: string | null
          asset_tag: string | null
          sensor_id: string | null
          sensor_name: string | null
          severity: Database["public"]["Enums"]["alert_severity"] | null
          status: Database["public"]["Enums"]["alert_status"] | null
          source: Database["public"]["Enums"]["alert_source"] | null
          title: string | null
          message: string | null
          ml_insight: string | null
          triggered_value: number | null
          threshold_value: number | null
          triggered_at: string | null
          acknowledged_at: string | null
          resolved_at: string | null
          resolution_notes: string | null
          resolved: boolean | null
          created_at: string | null
        }
        Relationships: []
      }
      v_asset_latest_prediction: {
        Row: {
          asset_id: string | null
          prediction_type: Database["public"]["Enums"]["prediction_type"] | null
          value: number | null
          confidence: number | null
          rul_days: number | null
          recommended_action: string | null
          explanation: string | null
          feature_importance: Json | null
          predicted_at: string | null
          model_name: string | null
          model_version: string | null
        }
        Relationships: []
      }
      v_assets_full: {
        Row: {
          id: string | null
          plant_id: string | null
          area_id: string | null
          tag: string | null
          name: string | null
          asset_type: Database["public"]["Enums"]["asset_type"] | null
          location: string | null
          status: Database["public"]["Enums"]["asset_status"] | null
          criticality: Database["public"]["Enums"]["criticality_level"] | null
          uptime: number | null
          anomaly_score: number | null
          grid_x: number | null
          grid_y: number | null
          plant_x: number | null
          plant_y: number | null
          health_index: number | null
          severity: Database["public"]["Enums"]["anomaly_severity"] | null
          insight: string | null
          thermal_residual: number | null
          scored_at: string | null
          image_url: string | null
          last_maintenance: string | null
          next_maintenance: string | null
          is_active: boolean | null
          area_name: string | null
          plant_name: string | null
          sensors: Json | null
          nameplate: Json | null
          active_alert_count: number | null
        }
        Relationships: []
      }
      v_kpi_metrics: {
        Row: {
          total_uptime: number | null
          active_alerts: number | null
          anomalies_detected: number | null
          assets_online: number | null
          total_assets: number | null
          predicted_failures: number | null
          critical_alerts: number | null
          open_maintenance_orders: number | null
        }
        Relationships: []
      }
      v_sensor_current: {
        Row: {
          sensor_id: string | null
          asset_id: string | null
          tag: string | null
          name: string | null
          sensor_type: Database["public"]["Enums"]["sensor_type"] | null
          unit: string | null
          min_value: number | null
          max_value: number | null
          warning_threshold: number | null
          critical_threshold: number | null
          limit_direction: Database["public"]["Enums"]["limit_direction"] | null
          nominal_value: number | null
          limit_source: string | null
          display_order: number | null
          is_active: boolean | null
          current_value: number | null
          current_raw_value: number | null
          current_quality: Database["public"]["Enums"]["reading_quality"] | null
          current_status: Database["public"]["Enums"]["sensor_status"] | null
          last_reading_at: string | null
        }
        Relationships: []
      }
      v_sensor_readings_hourly: {
        Row: {
          sensor_id: string | null
          asset_id: string | null
          bucket: string | null
          avg_value: number | null
          min_value: number | null
          max_value: number | null
          sample_count: number | null
          critical_count: number | null
          bad_quality_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      acknowledge_alert: {
        Args: {
          p_alert_id: string
        }
        Returns: unknown
      }
      apply_anomaly_score: {
        Args: {
          p_asset_id: string
          p_health_index: number
          p_anomaly_score: number
          p_severity: string
          p_insight?: string
          p_thermal_residual?: number
        }
        Returns: undefined
      }
      can_read: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      can_write: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      classify_reading: {
        Args: {
          p_value: number
          p_warning: number
          p_critical: number
          p_direction?: Database["public"]["Enums"]["limit_direction"]
          p_nominal?: number
        }
        Returns: Database["public"]["Enums"]["sensor_status"]
      }
      current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["user_role"]
      }
      ensure_readings_partition: {
        Args: {
          p_when?: string
        }
        Returns: undefined
      }
      get_asset_context: {
        Args: {
          p_asset_id: string
        }
        Returns: Json
      }
      get_asset_series: {
        Args: {
          p_asset_id: string
          p_hours?: number
          p_bucket_minutes?: number
        }
        Returns: {
          "sensor_id": string
          "sensor_name": string
          "unit": string
          "bucket": string
          "avg_value": number
        }[]
      }
      get_sensor_series: {
        Args: {
          p_sensor_id: string
          p_from?: string
          p_to?: string
          p_bucket_minutes?: number
        }
        Returns: {
          "bucket": string
          "avg_value": number
          "min_value": number
          "max_value": number
          "samples": number
        }[]
      }
      has_role: {
        Args: {
          p_roles?: Database["public"]["Enums"]["user_role"][]
        }
        Returns: boolean
      }
      ingest_readings: {
        Args: {
          p_readings: Json
        }
        Returns: number
      }
      iot_collector_dispatch: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      iot_collector_drain: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      iot_collector_ingest: {
        Args: {
          p_limit?: number
        }
        Returns: number
      }
      iot_collector_tick: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      iot_collector_window_open: {
        Args: {
          p_at?: string
        }
        Returns: boolean
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      log_audit_event: {
        Args: {
          p_action: string
          p_entity_type: string
          p_entity_id?: string
          p_metadata?: Json
        }
        Returns: undefined
      }
      match_document_chunks: {
        Args: {
          query_embedding: string
          match_count?: number
          filter_asset_id?: string
          similarity_threshold?: number
        }
        Returns: {
          "id": string
          "document_id": string
          "document_title": string
          "asset_id": string
          "content": string
          "page_number": number
          "similarity": number
        }[]
      }
      recompute_asset_health: {
        Args: {
          p_asset_id?: string
        }
        Returns: number
      }
      resolve_alert: {
        Args: {
          p_alert_id: string
          p_notes?: string
        }
        Returns: unknown
      }
      safe_double: {
        Args: {
          p_text: string
        }
        Returns: number
      }
      safe_jsonb: {
        Args: {
          p_text: string
        }
        Returns: Json
      }
      scale_raw_signal: {
        Args: {
          p_raw: number
          p_raw_min: number
          p_raw_max: number
          p_value_min: number
          p_value_max: number
        }
        Returns: number
      }
      search_document_chunks: {
        Args: {
          p_query: string
          p_asset_id?: string
          p_limit?: number
        }
        Returns: {
          "id": string
          "document_id": string
          "document_title": string
          "document_type": Database["public"]["Enums"]["document_type"]
          "asset_id": string
          "content": string
          "page_number": number
          "rank": number
        }[]
      }
    }
    Enums: {
      alert_severity: "info" | "warning" | "critical"
      alert_source: "rule" | "ml" | "manual" | "system"
      alert_status: "active" | "acknowledged" | "resolved"
      anomaly_severity: "ok" | "info" | "alerta" | "critico"
      asset_status: "normal" | "warning" | "critical" | "offline"
      asset_type: "motor" | "pump" | "compressor" | "fan" | "panel" | "gearbox" | "other"
      chat_role: "user" | "assistant" | "system" | "tool"
      consent_type: "data_processing" | "telemetry" | "marketing" | "ai_processing"
      criticality_level: "low" | "medium" | "high" | "critical"
      document_type: "manual" | "datasheet" | "procedure" | "report" | "certificate" | "floor_plan" | "other"
      limit_direction: "above" | "below" | "band"
      maintenance_status: "scheduled" | "pending" | "in_progress" | "completed" | "cancelled"
      maintenance_type: "preventive" | "corrective" | "predictive" | "calibration" | "inspection"
      ml_model_type: "baseline" | "anomaly" | "prediction"
      nameplate_status: "draft" | "confirmed" | "rejected"
      prediction_type: "baseline_deviation" | "anomaly_score" | "remaining_useful_life" | "failure_probability"
      reading_quality: "good" | "uncertain" | "bad" | "disconnected"
      sensor_status: "normal" | "warning" | "critical"
      sensor_type: "voltage" | "current" | "temperature" | "rpm" | "vibration" | "pressure" | "flow" | "power" | "speed" | "humidity" | "other"
      user_role: "admin" | "engineer" | "technician" | "viewer"
    }
    CompositeTypes: Record<PropertyKey, never>
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type ViewRow<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
