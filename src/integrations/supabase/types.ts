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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      advisory_escalations: {
        Row: {
          context: Json
          created_at: string
          facility_id: string | null
          farm_id: string
          handled_by: string | null
          id: string
          is_synthetic: boolean
          kind: Database["public"]["Enums"]["escalation_kind"]
          message: string | null
          requester_user_id: string
          resolution_note: string | null
          status: Database["public"]["Enums"]["escalation_status"]
          subject_user_id: string
          updated_at: string
        }
        Insert: {
          context?: Json
          created_at?: string
          facility_id?: string | null
          farm_id: string
          handled_by?: string | null
          id?: string
          is_synthetic?: boolean
          kind: Database["public"]["Enums"]["escalation_kind"]
          message?: string | null
          requester_user_id: string
          resolution_note?: string | null
          status?: Database["public"]["Enums"]["escalation_status"]
          subject_user_id: string
          updated_at?: string
        }
        Update: {
          context?: Json
          created_at?: string
          facility_id?: string | null
          farm_id?: string
          handled_by?: string | null
          id?: string
          is_synthetic?: boolean
          kind?: Database["public"]["Enums"]["escalation_kind"]
          message?: string | null
          requester_user_id?: string
          resolution_note?: string | null
          status?: Database["public"]["Enums"]["escalation_status"]
          subject_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "advisory_escalations_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "nearby_service_facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisory_escalations_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farm_records"
            referencedColumns: ["id"]
          },
        ]
      }
      advisory_evidence: {
        Row: {
          advisory_kind: string
          advisory_ref: string | null
          confidence: number | null
          created_at: string
          farm_id: string
          freshness_seconds: number | null
          id: string
          knowledge_contribution_id: string | null
          note: string | null
          observation_id: string | null
          source_key: string
        }
        Insert: {
          advisory_kind: string
          advisory_ref?: string | null
          confidence?: number | null
          created_at?: string
          farm_id: string
          freshness_seconds?: number | null
          id?: string
          knowledge_contribution_id?: string | null
          note?: string | null
          observation_id?: string | null
          source_key: string
        }
        Update: {
          advisory_kind?: string
          advisory_ref?: string | null
          confidence?: number | null
          created_at?: string
          farm_id?: string
          freshness_seconds?: number | null
          id?: string
          knowledge_contribution_id?: string | null
          note?: string | null
          observation_id?: string | null
          source_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "advisory_evidence_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farm_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisory_evidence_knowledge_contribution_id_fkey"
            columns: ["knowledge_contribution_id"]
            isOneToOne: false
            referencedRelation: "knowledge_contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisory_evidence_observation_id_fkey"
            columns: ["observation_id"]
            isOneToOne: false
            referencedRelation: "external_data_observations"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_records: {
        Row: {
          agreement_code: string
          created_at: string
          document_id: string | null
          id: string
          is_synthetic: boolean
          party_id: string
          party_type: string
          signed_at: string | null
          signed_by: string | null
          status: Database["public"]["Enums"]["record_status"]
          tenant_id: string | null
          version: string
        }
        Insert: {
          agreement_code: string
          created_at?: string
          document_id?: string | null
          id?: string
          is_synthetic?: boolean
          party_id: string
          party_type: string
          signed_at?: string | null
          signed_by?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          tenant_id?: string | null
          version: string
        }
        Update: {
          agreement_code?: string
          created_at?: string
          document_id?: string | null
          id?: string
          is_synthetic?: boolean
          party_id?: string
          party_type?: string
          signed_at?: string | null
          signed_by?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          tenant_id?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreement_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      api_consumers: {
        Row: {
          created_at: string
          id: string
          is_first_party: boolean
          name: string
          status: Database["public"]["Enums"]["membership_status"]
          tenant_id: string | null
          tier: Database["public"]["Enums"]["consumer_tier"]
        }
        Insert: {
          created_at?: string
          id?: string
          is_first_party?: boolean
          name: string
          status?: Database["public"]["Enums"]["membership_status"]
          tenant_id?: string | null
          tier?: Database["public"]["Enums"]["consumer_tier"]
        }
        Update: {
          created_at?: string
          id?: string
          is_first_party?: boolean
          name?: string
          status?: Database["public"]["Enums"]["membership_status"]
          tenant_id?: string | null
          tier?: Database["public"]["Enums"]["consumer_tier"]
        }
        Relationships: [
          {
            foreignKeyName: "api_consumers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      area_crop_benchmarks: {
        Row: {
          adoption_share: number
          created_at: string
          crop: string
          crop_year: number
          district: string
          id: string
          is_synthetic: boolean
          price_high_per_quintal: number
          price_low_per_quintal: number
          season_code: string
          source: string
          state_name: string
          typical_cost_per_acre: number
          typical_price_per_quintal: number
          typical_yield_quintal_per_acre: number
          updated_at: string
          yield_high_quintal_per_acre: number
          yield_low_quintal_per_acre: number
        }
        Insert: {
          adoption_share?: number
          created_at?: string
          crop: string
          crop_year: number
          district: string
          id?: string
          is_synthetic?: boolean
          price_high_per_quintal: number
          price_low_per_quintal: number
          season_code?: string
          source?: string
          state_name: string
          typical_cost_per_acre: number
          typical_price_per_quintal: number
          typical_yield_quintal_per_acre: number
          updated_at?: string
          yield_high_quintal_per_acre: number
          yield_low_quintal_per_acre: number
        }
        Update: {
          adoption_share?: number
          created_at?: string
          crop?: string
          crop_year?: number
          district?: string
          id?: string
          is_synthetic?: boolean
          price_high_per_quintal?: number
          price_low_per_quintal?: number
          season_code?: string
          source?: string
          state_name?: string
          typical_cost_per_acre?: number
          typical_price_per_quintal?: number
          typical_yield_quintal_per_acre?: number
          updated_at?: string
          yield_high_quintal_per_acre?: number
          yield_low_quintal_per_acre?: number
        }
        Relationships: []
      }
      audit_events: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          decision: string
          id: string
          metadata: Json
          purpose_code: string | null
          subject_id: string | null
          subject_type: string | null
          tenant_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          decision?: string
          id?: string
          metadata?: Json
          purpose_code?: string | null
          subject_id?: string | null
          subject_type?: string | null
          tenant_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          decision?: string
          id?: string
          metadata?: Json
          purpose_code?: string | null
          subject_id?: string | null
          subject_type?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      baseline_consents: {
        Row: {
          accepted_at: string
          channel: Database["public"]["Enums"]["onboarding_channel"]
          id: string
          kind: Database["public"]["Enums"]["consent_kind"]
          locale: string
          policy_version: string
          purposes: Json
          revoked_at: string | null
          subject_user_id: string
          witnessed_by_user_id: string | null
        }
        Insert: {
          accepted_at?: string
          channel?: Database["public"]["Enums"]["onboarding_channel"]
          id?: string
          kind?: Database["public"]["Enums"]["consent_kind"]
          locale?: string
          policy_version: string
          purposes?: Json
          revoked_at?: string | null
          subject_user_id: string
          witnessed_by_user_id?: string | null
        }
        Update: {
          accepted_at?: string
          channel?: Database["public"]["Enums"]["onboarding_channel"]
          id?: string
          kind?: Database["public"]["Enums"]["consent_kind"]
          locale?: string
          policy_version?: string
          purposes?: Json
          revoked_at?: string | null
          subject_user_id?: string
          witnessed_by_user_id?: string | null
        }
        Relationships: []
      }
      commerce_entitlements: {
        Row: {
          currency: string | null
          ends_at: string | null
          features: Json
          has_retainer: boolean
          id: string
          plan_code: string
          profile_id: string | null
          retainer_amount: number | null
          starts_at: string
          status: Database["public"]["Enums"]["membership_status"]
          tenant_id: string | null
          transaction_fee_bps: number | null
          updated_at: string
        }
        Insert: {
          currency?: string | null
          ends_at?: string | null
          features?: Json
          has_retainer?: boolean
          id?: string
          plan_code?: string
          profile_id?: string | null
          retainer_amount?: number | null
          starts_at?: string
          status?: Database["public"]["Enums"]["membership_status"]
          tenant_id?: string | null
          transaction_fee_bps?: number | null
          updated_at?: string
        }
        Update: {
          currency?: string | null
          ends_at?: string | null
          features?: Json
          has_retainer?: boolean
          id?: string
          plan_code?: string
          profile_id?: string | null
          retainer_amount?: number | null
          starts_at?: string
          status?: Database["public"]["Enums"]["membership_status"]
          tenant_id?: string | null
          transaction_fee_bps?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commerce_entitlements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "marketplace_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_entitlements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_broker_requests: {
        Row: {
          app_id: string
          consumer_id: string | null
          created_at: string
          decided_at: string | null
          environment: Database["public"]["Enums"]["partner_env"]
          grant_id: string | null
          id: string
          purpose_code: string
          reason: string
          requested_scopes: string[]
          status: string
          subject_user_id: string
        }
        Insert: {
          app_id: string
          consumer_id?: string | null
          created_at?: string
          decided_at?: string | null
          environment?: Database["public"]["Enums"]["partner_env"]
          grant_id?: string | null
          id?: string
          purpose_code: string
          reason?: string
          requested_scopes?: string[]
          status?: string
          subject_user_id: string
        }
        Update: {
          app_id?: string
          consumer_id?: string | null
          created_at?: string
          decided_at?: string | null
          environment?: Database["public"]["Enums"]["partner_env"]
          grant_id?: string | null
          id?: string
          purpose_code?: string
          reason?: string
          requested_scopes?: string[]
          status?: string
          subject_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_broker_requests_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "partner_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_broker_requests_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "api_consumers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_broker_requests_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "consent_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_broker_requests_purpose_code_fkey"
            columns: ["purpose_code"]
            isOneToOne: false
            referencedRelation: "data_purposes"
            referencedColumns: ["code"]
          },
        ]
      }
      consent_grants: {
        Row: {
          consumer_id: string
          expires_at: string | null
          granted_at: string
          id: string
          purpose_code: string
          revoked_at: string | null
          subject_user_id: string
        }
        Insert: {
          consumer_id: string
          expires_at?: string | null
          granted_at?: string
          id?: string
          purpose_code: string
          revoked_at?: string | null
          subject_user_id: string
        }
        Update: {
          consumer_id?: string
          expires_at?: string | null
          granted_at?: string
          id?: string
          purpose_code?: string
          revoked_at?: string | null
          subject_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_grants_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "api_consumers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_grants_purpose_code_fkey"
            columns: ["purpose_code"]
            isOneToOne: false
            referencedRelation: "data_purposes"
            referencedColumns: ["code"]
          },
        ]
      }
      consent_policies: {
        Row: {
          code: string
          description: string
          is_active: boolean
          max_duration_days: number
          purpose_code: string
          requires_explicit_consent: boolean
          scope_template: Json
          updated_at: string
        }
        Insert: {
          code: string
          description?: string
          is_active?: boolean
          max_duration_days?: number
          purpose_code: string
          requires_explicit_consent?: boolean
          scope_template?: Json
          updated_at?: string
        }
        Update: {
          code?: string
          description?: string
          is_active?: boolean
          max_duration_days?: number
          purpose_code?: string
          requires_explicit_consent?: boolean
          scope_template?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_policies_purpose_code_fkey"
            columns: ["purpose_code"]
            isOneToOne: false
            referencedRelation: "data_purposes"
            referencedColumns: ["code"]
          },
        ]
      }
      contact_verifications: {
        Row: {
          attempts: number
          channel: Database["public"]["Enums"]["contact_channel"]
          code_hash: string | null
          created_at: string
          expires_at: string | null
          id: string
          is_synthetic: boolean
          provider: string
          provider_ref: string | null
          status: Database["public"]["Enums"]["contact_verification_status"]
          target: string
          user_id: string | null
          verified_at: string | null
        }
        Insert: {
          attempts?: number
          channel: Database["public"]["Enums"]["contact_channel"]
          code_hash?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_synthetic?: boolean
          provider?: string
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["contact_verification_status"]
          target: string
          user_id?: string | null
          verified_at?: string | null
        }
        Update: {
          attempts?: number
          channel?: Database["public"]["Enums"]["contact_channel"]
          code_hash?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_synthetic?: boolean
          provider?: string
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["contact_verification_status"]
          target?: string
          user_id?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      content_translations: {
        Row: {
          created_at: string
          entity: string
          entity_id: string
          field: string
          id: string
          locale: string
          value: string
        }
        Insert: {
          created_at?: string
          entity: string
          entity_id: string
          field: string
          id?: string
          locale: string
          value: string
        }
        Update: {
          created_at?: string
          entity?: string
          entity_id?: string
          field?: string
          id?: string
          locale?: string
          value?: string
        }
        Relationships: []
      }
      crop_outcome_scenarios: {
        Row: {
          assumptions: Json
          break_even_price: number
          break_even_yield: number
          created_at: string
          created_by: string | null
          crop: string
          expected_yield_quintal: number
          farm_id: string
          gross_realization: number
          harvest_window: string | null
          id: string
          label: Database["public"]["Enums"]["price_label"]
          net_contribution: number
          risks: Json
          scenario: string
          season_code: string
          selling_price: number
          selling_price_label: Database["public"]["Enums"]["price_label"]
          target_market: string | null
          total_cost: number
          value_add_alternative: string | null
        }
        Insert: {
          assumptions?: Json
          break_even_price: number
          break_even_yield: number
          created_at?: string
          created_by?: string | null
          crop: string
          expected_yield_quintal: number
          farm_id: string
          gross_realization: number
          harvest_window?: string | null
          id?: string
          label?: Database["public"]["Enums"]["price_label"]
          net_contribution: number
          risks?: Json
          scenario: string
          season_code: string
          selling_price: number
          selling_price_label?: Database["public"]["Enums"]["price_label"]
          target_market?: string | null
          total_cost: number
          value_add_alternative?: string | null
        }
        Update: {
          assumptions?: Json
          break_even_price?: number
          break_even_yield?: number
          created_at?: string
          created_by?: string | null
          crop?: string
          expected_yield_quintal?: number
          farm_id?: string
          gross_realization?: number
          harvest_window?: string | null
          id?: string
          label?: Database["public"]["Enums"]["price_label"]
          net_contribution?: number
          risks?: Json
          scenario?: string
          season_code?: string
          selling_price?: number
          selling_price_label?: Database["public"]["Enums"]["price_label"]
          target_market?: string | null
          total_cost?: number
          value_add_alternative?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crop_outcome_scenarios_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farm_records"
            referencedColumns: ["id"]
          },
        ]
      }
      crop_suitability_assessments: {
        Row: {
          change_factors: Json
          confidence: number
          created_at: string
          crop: string
          factors: Json
          farm_id: string
          id: string
          is_synthetic: boolean
          score: number
          season_code: string
          soil_basis: Database["public"]["Enums"]["soil_basis"]
          sources: Json
          sowing_window: string | null
          variety: string | null
        }
        Insert: {
          change_factors?: Json
          confidence?: number
          created_at?: string
          crop: string
          factors?: Json
          farm_id: string
          id?: string
          is_synthetic?: boolean
          score: number
          season_code: string
          soil_basis?: Database["public"]["Enums"]["soil_basis"]
          sources?: Json
          sowing_window?: string | null
          variety?: string | null
        }
        Update: {
          change_factors?: Json
          confidence?: number
          created_at?: string
          crop?: string
          factors?: Json
          farm_id?: string
          id?: string
          is_synthetic?: boolean
          score?: number
          season_code?: string
          soil_basis?: Database["public"]["Enums"]["soil_basis"]
          sources?: Json
          sowing_window?: string | null
          variety?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crop_suitability_assessments_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farm_records"
            referencedColumns: ["id"]
          },
        ]
      }
      data_purposes: {
        Row: {
          code: string
          created_at: string
          description: string
          label: string
          requires_explicit_consent: boolean
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          label: string
          requires_explicit_consent?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          label?: string
          requires_explicit_consent?: boolean
        }
        Relationships: []
      }
      district_rollouts: {
        Row: {
          checklist: Json
          config: Json
          created_at: string
          created_by: string | null
          fpo_tenant_id: string | null
          geography_id: string
          govt_tenant_id: string | null
          id: string
          is_synthetic: boolean
          label: string
          status: Database["public"]["Enums"]["rollout_status"]
          template_code: string
          updated_at: string
        }
        Insert: {
          checklist?: Json
          config?: Json
          created_at?: string
          created_by?: string | null
          fpo_tenant_id?: string | null
          geography_id: string
          govt_tenant_id?: string | null
          id?: string
          is_synthetic?: boolean
          label: string
          status?: Database["public"]["Enums"]["rollout_status"]
          template_code: string
          updated_at?: string
        }
        Update: {
          checklist?: Json
          config?: Json
          created_at?: string
          created_by?: string | null
          fpo_tenant_id?: string | null
          geography_id?: string
          govt_tenant_id?: string | null
          id?: string
          is_synthetic?: boolean
          label?: string
          status?: Database["public"]["Enums"]["rollout_status"]
          template_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "district_rollouts_fpo_tenant_id_fkey"
            columns: ["fpo_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "district_rollouts_geography_id_fkey"
            columns: ["geography_id"]
            isOneToOne: false
            referencedRelation: "geographies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "district_rollouts_govt_tenant_id_fkey"
            columns: ["govt_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      district_template_clones: {
        Row: {
          applied_config: Json
          cloned_scheme_codes: Json
          config_overrides: Json
          created_at: string
          created_by: string | null
          forked_code: boolean
          geography_id: string
          id: string
          is_synthetic: boolean
          local_roles: Json
          locale: string
          rollout_id: string
          sequence_index: number
          template_id: string
          template_version: number
        }
        Insert: {
          applied_config?: Json
          cloned_scheme_codes?: Json
          config_overrides?: Json
          created_at?: string
          created_by?: string | null
          forked_code?: boolean
          geography_id: string
          id?: string
          is_synthetic?: boolean
          local_roles?: Json
          locale?: string
          rollout_id: string
          sequence_index?: number
          template_id: string
          template_version: number
        }
        Update: {
          applied_config?: Json
          cloned_scheme_codes?: Json
          config_overrides?: Json
          created_at?: string
          created_by?: string | null
          forked_code?: boolean
          geography_id?: string
          id?: string
          is_synthetic?: boolean
          local_roles?: Json
          locale?: string
          rollout_id?: string
          sequence_index?: number
          template_id?: string
          template_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "district_template_clones_geography_id_fkey"
            columns: ["geography_id"]
            isOneToOne: false
            referencedRelation: "geographies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "district_template_clones_rollout_id_fkey"
            columns: ["rollout_id"]
            isOneToOne: false
            referencedRelation: "district_rollouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "district_template_clones_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "district_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      district_templates: {
        Row: {
          checklist: Json
          code: string
          config: Json
          created_at: string
          created_by: string | null
          default_locale: string
          description: string
          id: string
          is_active: boolean
          label: string
          local_roles: Json
          locales: Json
          scheme_codes: Json
          updated_at: string
          version: number
        }
        Insert: {
          checklist?: Json
          code: string
          config?: Json
          created_at?: string
          created_by?: string | null
          default_locale?: string
          description?: string
          id?: string
          is_active?: boolean
          label: string
          local_roles?: Json
          locales?: Json
          scheme_codes?: Json
          updated_at?: string
          version?: number
        }
        Update: {
          checklist?: Json
          code?: string
          config?: Json
          created_at?: string
          created_by?: string | null
          default_locale?: string
          description?: string
          id?: string
          is_active?: boolean
          label?: string
          local_roles?: Json
          locales?: Json
          scheme_codes?: Json
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      document_extractions: {
        Row: {
          adapter_code: string
          confidence: Json
          confirmed_at: string | null
          created_at: string
          document_id: string
          farmer_user_id: string
          id: string
          model_code: string | null
          provenance: Database["public"]["Enums"]["field_provenance"]
          suggested_fields: Json
        }
        Insert: {
          adapter_code: string
          confidence?: Json
          confirmed_at?: string | null
          created_at?: string
          document_id: string
          farmer_user_id: string
          id?: string
          model_code?: string | null
          provenance?: Database["public"]["Enums"]["field_provenance"]
          suggested_fields?: Json
        }
        Update: {
          adapter_code?: string
          confidence?: Json
          confirmed_at?: string | null
          created_at?: string
          document_id?: string
          farmer_user_id?: string
          id?: string
          model_code?: string | null
          provenance?: Database["public"]["Enums"]["field_provenance"]
          suggested_fields?: Json
        }
        Relationships: [
          {
            foreignKeyName: "document_extractions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "farmer_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_records: {
        Row: {
          checksum: string | null
          created_at: string
          doc_type: string
          id: string
          is_synthetic: boolean
          owner_id: string
          owner_type: string
          provider: string
          reviewed_by: string | null
          status: Database["public"]["Enums"]["record_status"]
          storage_path: string | null
          tenant_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          doc_type: string
          id?: string
          is_synthetic?: boolean
          owner_id: string
          owner_type: string
          provider?: string
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          storage_path?: string | null
          tenant_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          checksum?: string | null
          created_at?: string
          doc_type?: string
          id?: string
          is_synthetic?: boolean
          owner_id?: string
          owner_type?: string
          provider?: string
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          storage_path?: string | null
          tenant_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      external_data_observations: {
        Row: {
          adapter_name: string
          confidence: number | null
          created_at: string
          farm_id: string | null
          fetched_at: string
          freshness_seconds: number | null
          geography_id: string | null
          id: string
          is_synthetic: boolean
          kind: Database["public"]["Enums"]["observation_kind"]
          observed_at: string
          payload: Json
          source_key: string
        }
        Insert: {
          adapter_name: string
          confidence?: number | null
          created_at?: string
          farm_id?: string | null
          fetched_at?: string
          freshness_seconds?: number | null
          geography_id?: string | null
          id?: string
          is_synthetic?: boolean
          kind: Database["public"]["Enums"]["observation_kind"]
          observed_at?: string
          payload?: Json
          source_key: string
        }
        Update: {
          adapter_name?: string
          confidence?: number | null
          created_at?: string
          farm_id?: string | null
          fetched_at?: string
          freshness_seconds?: number | null
          geography_id?: string | null
          id?: string
          is_synthetic?: boolean
          kind?: Database["public"]["Enums"]["observation_kind"]
          observed_at?: string
          payload?: Json
          source_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_data_observations_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farm_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_data_observations_geography_id_fkey"
            columns: ["geography_id"]
            isOneToOne: false
            referencedRelation: "geographies"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_records: {
        Row: {
          application_id: string | null
          area_acres: number | null
          baseline_profile: Json
          boundary: Json
          captured_by_user_id: string | null
          centroid_lat: number | null
          centroid_lng: number | null
          channel: Database["public"]["Enums"]["onboarding_channel"]
          client_draft_id: string
          client_updated_at: string | null
          created_at: string
          farmer_user_id: string
          geography_id: string | null
          id: string
          is_synthetic: boolean
          label: string
          plot_ref: string
          primary_crop: string | null
          sync_state: Database["public"]["Enums"]["farm_sync_state"]
          updated_at: string
          village_code: string | null
        }
        Insert: {
          application_id?: string | null
          area_acres?: number | null
          baseline_profile?: Json
          boundary?: Json
          captured_by_user_id?: string | null
          centroid_lat?: number | null
          centroid_lng?: number | null
          channel?: Database["public"]["Enums"]["onboarding_channel"]
          client_draft_id: string
          client_updated_at?: string | null
          created_at?: string
          farmer_user_id: string
          geography_id?: string | null
          id?: string
          is_synthetic?: boolean
          label: string
          plot_ref: string
          primary_crop?: string | null
          sync_state?: Database["public"]["Enums"]["farm_sync_state"]
          updated_at?: string
          village_code?: string | null
        }
        Update: {
          application_id?: string | null
          area_acres?: number | null
          baseline_profile?: Json
          boundary?: Json
          captured_by_user_id?: string | null
          centroid_lat?: number | null
          centroid_lng?: number | null
          channel?: Database["public"]["Enums"]["onboarding_channel"]
          client_draft_id?: string
          client_updated_at?: string | null
          created_at?: string
          farmer_user_id?: string
          geography_id?: string | null
          id?: string
          is_synthetic?: boolean
          label?: string
          plot_ref?: string
          primary_crop?: string | null
          sync_state?: Database["public"]["Enums"]["farm_sync_state"]
          updated_at?: string
          village_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "farm_records_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "onboarding_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_records_geography_id_fkey"
            columns: ["geography_id"]
            isOneToOne: false
            referencedRelation: "geographies"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_season_records: {
        Row: {
          area_acres: number
          created_at: string
          crop: string
          crop_year: number
          farm_id: string | null
          farmer_user_id: string
          id: string
          input_cost_total: number
          input_costs: Json
          is_synthetic: boolean
          notes: string | null
          price_per_quintal: number | null
          provenance: Database["public"]["Enums"]["field_provenance"]
          revenue_inr: number | null
          season_code: string
          updated_at: string
          yield_quintal: number | null
        }
        Insert: {
          area_acres?: number
          created_at?: string
          crop: string
          crop_year: number
          farm_id?: string | null
          farmer_user_id: string
          id?: string
          input_cost_total?: number
          input_costs?: Json
          is_synthetic?: boolean
          notes?: string | null
          price_per_quintal?: number | null
          provenance?: Database["public"]["Enums"]["field_provenance"]
          revenue_inr?: number | null
          season_code: string
          updated_at?: string
          yield_quintal?: number | null
        }
        Update: {
          area_acres?: number
          created_at?: string
          crop?: string
          crop_year?: number
          farm_id?: string | null
          farmer_user_id?: string
          id?: string
          input_cost_total?: number
          input_costs?: Json
          is_synthetic?: boolean
          notes?: string | null
          price_per_quintal?: number | null
          provenance?: Database["public"]["Enums"]["field_provenance"]
          revenue_inr?: number | null
          season_code?: string
          updated_at?: string
          yield_quintal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "farm_season_records_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farm_records"
            referencedColumns: ["id"]
          },
        ]
      }
      farmer_documents: {
        Row: {
          created_at: string
          doc_kind: Database["public"]["Enums"]["farmer_doc_kind"]
          extraction_error: string | null
          farmer_user_id: string
          id: string
          is_synthetic: boolean
          mime_type: string | null
          state: Database["public"]["Enums"]["extraction_state"]
          storage_path: string
          updated_at: string
          uploaded_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          doc_kind: Database["public"]["Enums"]["farmer_doc_kind"]
          extraction_error?: string | null
          farmer_user_id: string
          id?: string
          is_synthetic?: boolean
          mime_type?: string | null
          state?: Database["public"]["Enums"]["extraction_state"]
          storage_path: string
          updated_at?: string
          uploaded_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          doc_kind?: Database["public"]["Enums"]["farmer_doc_kind"]
          extraction_error?: string | null
          farmer_user_id?: string
          id?: string
          is_synthetic?: boolean
          mime_type?: string | null
          state?: Database["public"]["Enums"]["extraction_state"]
          storage_path?: string
          updated_at?: string
          uploaded_by_user_id?: string | null
        }
        Relationships: []
      }
      farmer_input_plans: {
        Row: {
          area_hectares: number
          created_at: string
          created_by_user_id: string
          crop: string
          farm_id: string
          growth_stage: string
          id: string
          mode: string
          snapshot: Json
          subject_user_id: string
          updated_at: string
        }
        Insert: {
          area_hectares?: number
          created_at?: string
          created_by_user_id: string
          crop: string
          farm_id: string
          growth_stage: string
          id?: string
          mode?: string
          snapshot?: Json
          subject_user_id: string
          updated_at?: string
        }
        Update: {
          area_hectares?: number
          created_at?: string
          created_by_user_id?: string
          crop?: string
          farm_id?: string
          growth_stage?: string
          id?: string
          mode?: string
          snapshot?: Json
          subject_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "farmer_input_plans_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farm_records"
            referencedColumns: ["id"]
          },
        ]
      }
      farmer_insurance_snapshots: {
        Row: {
          contact_label: string | null
          cover_state: string
          created_at: string
          crop: string | null
          crop_year: number
          district: string | null
          farmer_share_per_acre: number | null
          farmer_user_id: string
          id: string
          indicative_premium_per_acre: number | null
          is_synthetic: boolean
          scheme_code: string | null
          season_code: string
          source: string
          state_name: string | null
          sum_insured_per_acre: number | null
          updated_at: string
        }
        Insert: {
          contact_label?: string | null
          cover_state?: string
          created_at?: string
          crop?: string | null
          crop_year: number
          district?: string | null
          farmer_share_per_acre?: number | null
          farmer_user_id: string
          id?: string
          indicative_premium_per_acre?: number | null
          is_synthetic?: boolean
          scheme_code?: string | null
          season_code: string
          source?: string
          state_name?: string | null
          sum_insured_per_acre?: number | null
          updated_at?: string
        }
        Update: {
          contact_label?: string | null
          cover_state?: string
          created_at?: string
          crop?: string | null
          crop_year?: number
          district?: string | null
          farmer_share_per_acre?: number | null
          farmer_user_id?: string
          id?: string
          indicative_premium_per_acre?: number | null
          is_synthetic?: boolean
          scheme_code?: string | null
          season_code?: string
          source?: string
          state_name?: string | null
          sum_insured_per_acre?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      farmer_profiles: {
        Row: {
          bank_account_hash: string | null
          bank_account_holder: string | null
          bank_account_last4: string | null
          bank_branch: string | null
          bank_ifsc: string | null
          bank_name: string | null
          captured_by_user_id: string | null
          centroid_lat: number | null
          centroid_lng: number | null
          created_at: string
          date_of_birth: string | null
          district_geography_id: string | null
          farmer_user_id: string
          field_provenance: Json
          full_name: string | null
          gender: string | null
          id: string
          irrigation_source: string | null
          is_synthetic: boolean
          land_record_ref_hash: string | null
          ownership_type:
            | Database["public"]["Enums"]["land_ownership_type"]
            | null
          photo_path: string | null
          social_category: Database["public"]["Enums"]["social_category"] | null
          state_geography_id: string | null
          total_extent_acres: number | null
          updated_at: string
          village_code: string | null
        }
        Insert: {
          bank_account_hash?: string | null
          bank_account_holder?: string | null
          bank_account_last4?: string | null
          bank_branch?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          captured_by_user_id?: string | null
          centroid_lat?: number | null
          centroid_lng?: number | null
          created_at?: string
          date_of_birth?: string | null
          district_geography_id?: string | null
          farmer_user_id: string
          field_provenance?: Json
          full_name?: string | null
          gender?: string | null
          id?: string
          irrigation_source?: string | null
          is_synthetic?: boolean
          land_record_ref_hash?: string | null
          ownership_type?:
            | Database["public"]["Enums"]["land_ownership_type"]
            | null
          photo_path?: string | null
          social_category?:
            | Database["public"]["Enums"]["social_category"]
            | null
          state_geography_id?: string | null
          total_extent_acres?: number | null
          updated_at?: string
          village_code?: string | null
        }
        Update: {
          bank_account_hash?: string | null
          bank_account_holder?: string | null
          bank_account_last4?: string | null
          bank_branch?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          captured_by_user_id?: string | null
          centroid_lat?: number | null
          centroid_lng?: number | null
          created_at?: string
          date_of_birth?: string | null
          district_geography_id?: string | null
          farmer_user_id?: string
          field_provenance?: Json
          full_name?: string | null
          gender?: string | null
          id?: string
          irrigation_source?: string | null
          is_synthetic?: boolean
          land_record_ref_hash?: string | null
          ownership_type?:
            | Database["public"]["Enums"]["land_ownership_type"]
            | null
          photo_path?: string | null
          social_category?:
            | Database["public"]["Enums"]["social_category"]
            | null
          state_geography_id?: string | null
          total_extent_acres?: number | null
          updated_at?: string
          village_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "farmer_profiles_district_geography_id_fkey"
            columns: ["district_geography_id"]
            isOneToOne: false
            referencedRelation: "geographies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farmer_profiles_state_geography_id_fkey"
            columns: ["state_geography_id"]
            isOneToOne: false
            referencedRelation: "geographies"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          description: string | null
          enabled: boolean
          environments: Json
          key: string
          label: string
          updated_at: string
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          environments?: Json
          key: string
          label: string
          updated_at?: string
        }
        Update: {
          description?: string | null
          enabled?: boolean
          environments?: Json
          key?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      fpo_access_reviews: {
        Row: {
          created_at: string
          decision: Database["public"]["Enums"]["fpo_access_review_decision"]
          id: string
          is_synthetic: boolean
          new_role: Database["public"]["Enums"]["app_role"] | null
          notes: string | null
          previous_role: Database["public"]["Enums"]["app_role"] | null
          reviewed_at: string
          reviewed_by: string | null
          staff_member_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          decision: Database["public"]["Enums"]["fpo_access_review_decision"]
          id?: string
          is_synthetic?: boolean
          new_role?: Database["public"]["Enums"]["app_role"] | null
          notes?: string | null
          previous_role?: Database["public"]["Enums"]["app_role"] | null
          reviewed_at?: string
          reviewed_by?: string | null
          staff_member_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          decision?: Database["public"]["Enums"]["fpo_access_review_decision"]
          id?: string
          is_synthetic?: boolean
          new_role?: Database["public"]["Enums"]["app_role"] | null
          notes?: string | null
          previous_role?: Database["public"]["Enums"]["app_role"] | null
          reviewed_at?: string
          reviewed_by?: string | null
          staff_member_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fpo_access_reviews_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "fpo_staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_access_reviews_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_application_events: {
        Row: {
          actor_user_id: string | null
          application_id: string
          created_at: string
          from_status:
            | Database["public"]["Enums"]["fpo_application_status"]
            | null
          id: string
          note: string | null
          tenant_id: string
          to_status: Database["public"]["Enums"]["fpo_application_status"]
        }
        Insert: {
          actor_user_id?: string | null
          application_id: string
          created_at?: string
          from_status?:
            | Database["public"]["Enums"]["fpo_application_status"]
            | null
          id?: string
          note?: string | null
          tenant_id: string
          to_status: Database["public"]["Enums"]["fpo_application_status"]
        }
        Update: {
          actor_user_id?: string | null
          application_id?: string
          created_at?: string
          from_status?:
            | Database["public"]["Enums"]["fpo_application_status"]
            | null
          id?: string
          note?: string | null
          tenant_id?: string
          to_status?: Database["public"]["Enums"]["fpo_application_status"]
        }
        Relationships: [
          {
            foreignKeyName: "fpo_application_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "fpo_scheme_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_application_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_bank_accounts: {
        Row: {
          account_last4: string | null
          account_type: string | null
          bank_name: string
          branch: string | null
          created_at: string
          created_by: string | null
          id: string
          ifsc: string | null
          is_primary: boolean
          is_synthetic: boolean
          signatories: string[]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          account_last4?: string | null
          account_type?: string | null
          bank_name: string
          branch?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          ifsc?: string | null
          is_primary?: boolean
          is_synthetic?: boolean
          signatories?: string[]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          account_last4?: string | null
          account_type?: string | null
          bank_name?: string
          branch?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          ifsc?: string | null
          is_primary?: boolean
          is_synthetic?: boolean
          signatories?: string[]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fpo_bank_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_buyer_enquiries: {
        Row: {
          buyer_name: string
          buyer_org_id: string | null
          buyer_type: string
          created_at: string
          delivery_terms: string | null
          id: string
          is_synthetic: boolean
          lot_id: string | null
          note: string | null
          offered_price_per_unit: number | null
          payment_terms: string | null
          pickup_location: string | null
          quantity: number | null
          responded_at: string | null
          responded_by_user_id: string | null
          status: Database["public"]["Enums"]["fpo_enquiry_status"]
          tenant_id: string
          unit: string
          updated_at: string
        }
        Insert: {
          buyer_name: string
          buyer_org_id?: string | null
          buyer_type?: string
          created_at?: string
          delivery_terms?: string | null
          id?: string
          is_synthetic?: boolean
          lot_id?: string | null
          note?: string | null
          offered_price_per_unit?: number | null
          payment_terms?: string | null
          pickup_location?: string | null
          quantity?: number | null
          responded_at?: string | null
          responded_by_user_id?: string | null
          status?: Database["public"]["Enums"]["fpo_enquiry_status"]
          tenant_id: string
          unit?: string
          updated_at?: string
        }
        Update: {
          buyer_name?: string
          buyer_org_id?: string | null
          buyer_type?: string
          created_at?: string
          delivery_terms?: string | null
          id?: string
          is_synthetic?: boolean
          lot_id?: string | null
          note?: string | null
          offered_price_per_unit?: number | null
          payment_terms?: string | null
          pickup_location?: string | null
          quantity?: number | null
          responded_at?: string | null
          responded_by_user_id?: string | null
          status?: Database["public"]["Enums"]["fpo_enquiry_status"]
          tenant_id?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fpo_buyer_enquiries_buyer_org_id_fkey"
            columns: ["buyer_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_buyer_enquiries_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "fpo_produce_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_buyer_enquiries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_campaign_members: {
        Row: {
          assigned_agent_user_id: string | null
          authorization_recorded_at: string | null
          campaign_id: string
          created_at: string
          farmer_application_id: string | null
          id: string
          member_id: string
          note: string | null
          state: Database["public"]["Enums"]["fpo_facilitation_state"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assigned_agent_user_id?: string | null
          authorization_recorded_at?: string | null
          campaign_id: string
          created_at?: string
          farmer_application_id?: string | null
          id?: string
          member_id: string
          note?: string | null
          state?: Database["public"]["Enums"]["fpo_facilitation_state"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assigned_agent_user_id?: string | null
          authorization_recorded_at?: string | null
          campaign_id?: string
          created_at?: string
          farmer_application_id?: string | null
          id?: string
          member_id?: string
          note?: string | null
          state?: Database["public"]["Enums"]["fpo_facilitation_state"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fpo_campaign_members_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "fpo_member_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_campaign_members_farmer_application_id_fkey"
            columns: ["farmer_application_id"]
            isOneToOne: false
            referencedRelation: "scheme_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_campaign_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "fpo_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_campaign_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_documents: {
        Row: {
          created_at: string
          doc_type: string
          expires_at: string | null
          id: string
          is_synthetic: boolean
          issued_on: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewer_user_id: string | null
          status: Database["public"]["Enums"]["fpo_doc_status"]
          storage_path: string | null
          tenant_id: string
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          doc_type: string
          expires_at?: string | null
          id?: string
          is_synthetic?: boolean
          issued_on?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewer_user_id?: string | null
          status?: Database["public"]["Enums"]["fpo_doc_status"]
          storage_path?: string | null
          tenant_id: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: string
          expires_at?: string | null
          id?: string
          is_synthetic?: boolean
          issued_on?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewer_user_id?: string | null
          status?: Database["public"]["Enums"]["fpo_doc_status"]
          storage_path?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fpo_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_farmer_consents: {
        Row: {
          created_at: string
          evidence: string | null
          expires_at: string | null
          farmer_user_id: string
          granted_at: string
          granted_by: string | null
          id: string
          is_synthetic: boolean
          purpose_code: string
          revoked_at: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          evidence?: string | null
          expires_at?: string | null
          farmer_user_id: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          is_synthetic?: boolean
          purpose_code: string
          revoked_at?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          evidence?: string | null
          expires_at?: string | null
          farmer_user_id?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          is_synthetic?: boolean
          purpose_code?: string
          revoked_at?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fpo_farmer_consents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_grant_funds: {
        Row: {
          application_id: string | null
          created_at: string
          funder_name: string
          id: string
          is_synthetic: boolean
          next_installment_amount: number | null
          next_installment_due: string | null
          note: string | null
          received_amount: number
          reporting_deadline: string | null
          sanctioned_amount: number
          sanctioned_on: string | null
          scheme_id: string | null
          tenant_id: string
          title: string
          uc_state: Database["public"]["Enums"]["fpo_uc_state"]
          updated_at: string
          utilized_amount: number
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          funder_name: string
          id?: string
          is_synthetic?: boolean
          next_installment_amount?: number | null
          next_installment_due?: string | null
          note?: string | null
          received_amount?: number
          reporting_deadline?: string | null
          sanctioned_amount?: number
          sanctioned_on?: string | null
          scheme_id?: string | null
          tenant_id: string
          title: string
          uc_state?: Database["public"]["Enums"]["fpo_uc_state"]
          updated_at?: string
          utilized_amount?: number
        }
        Update: {
          application_id?: string | null
          created_at?: string
          funder_name?: string
          id?: string
          is_synthetic?: boolean
          next_installment_amount?: number | null
          next_installment_due?: string | null
          note?: string | null
          received_amount?: number
          reporting_deadline?: string | null
          sanctioned_amount?: number
          sanctioned_on?: string | null
          scheme_id?: string | null
          tenant_id?: string
          title?: string
          uc_state?: Database["public"]["Enums"]["fpo_uc_state"]
          updated_at?: string
          utilized_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "fpo_grant_funds_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "fpo_scheme_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_grant_funds_scheme_id_fkey"
            columns: ["scheme_id"]
            isOneToOne: false
            referencedRelation: "schemes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_grant_funds_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_grant_utilizations: {
        Row: {
          amount: number
          created_at: string
          grant_id: string
          id: string
          is_synthetic: boolean
          note: string | null
          purpose: string
          recorded_by_user_id: string | null
          spent_on: string
          tenant_id: string
          updated_at: string
          voucher_reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          grant_id: string
          id?: string
          is_synthetic?: boolean
          note?: string | null
          purpose: string
          recorded_by_user_id?: string | null
          spent_on?: string
          tenant_id: string
          updated_at?: string
          voucher_reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          grant_id?: string
          id?: string
          is_synthetic?: boolean
          note?: string | null
          purpose?: string
          recorded_by_user_id?: string | null
          spent_on?: string
          tenant_id?: string
          updated_at?: string
          voucher_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fpo_grant_utilizations_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "fpo_grant_funds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_grant_utilizations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_leadership: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_signatory: boolean
          is_synthetic: boolean
          person_name: string
          phone: string | null
          role_title: string
          tenant_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_signatory?: boolean
          is_synthetic?: boolean
          person_name: string
          phone?: string | null
          role_title: string
          tenant_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_signatory?: boolean
          is_synthetic?: boolean
          person_name?: string
          phone?: string | null
          role_title?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fpo_leadership_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_ledger_entries: {
        Row: {
          amount: number
          amount_settled: number
          bank_reference: string | null
          campaign_id: string | null
          category: Database["public"]["Enums"]["fpo_ledger_category"]
          created_at: string
          created_by_user_id: string | null
          description: string
          direction: Database["public"]["Enums"]["fpo_ledger_direction"]
          due_date: string | null
          entry_date: string
          id: string
          is_reconciled: boolean
          is_synthetic: boolean
          lot_id: string | null
          member_id: string | null
          note: string | null
          party_name: string | null
          payment_state: Database["public"]["Enums"]["fpo_payment_state"]
          reconciled_at: string | null
          reconciled_by_user_id: string | null
          reference: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          amount_settled?: number
          bank_reference?: string | null
          campaign_id?: string | null
          category?: Database["public"]["Enums"]["fpo_ledger_category"]
          created_at?: string
          created_by_user_id?: string | null
          description: string
          direction: Database["public"]["Enums"]["fpo_ledger_direction"]
          due_date?: string | null
          entry_date?: string
          id?: string
          is_reconciled?: boolean
          is_synthetic?: boolean
          lot_id?: string | null
          member_id?: string | null
          note?: string | null
          party_name?: string | null
          payment_state?: Database["public"]["Enums"]["fpo_payment_state"]
          reconciled_at?: string | null
          reconciled_by_user_id?: string | null
          reference?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_settled?: number
          bank_reference?: string | null
          campaign_id?: string | null
          category?: Database["public"]["Enums"]["fpo_ledger_category"]
          created_at?: string
          created_by_user_id?: string | null
          description?: string
          direction?: Database["public"]["Enums"]["fpo_ledger_direction"]
          due_date?: string | null
          entry_date?: string
          id?: string
          is_reconciled?: boolean
          is_synthetic?: boolean
          lot_id?: string | null
          member_id?: string | null
          note?: string | null
          party_name?: string | null
          payment_state?: Database["public"]["Enums"]["fpo_payment_state"]
          reconciled_at?: string | null
          reconciled_by_user_id?: string | null
          reference?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fpo_ledger_entries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "fpo_procurement_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_ledger_entries_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "fpo_produce_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_ledger_entries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "fpo_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_ledger_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_logistics_options: {
        Row: {
          capacity: number | null
          capacity_unit: string | null
          contact: string | null
          created_at: string
          id: string
          is_active: boolean
          is_synthetic: boolean
          kind: Database["public"]["Enums"]["fpo_logistics_kind"]
          location: string | null
          note: string | null
          provider_name: string
          provider_org_id: string | null
          rate: number | null
          rate_basis: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          capacity_unit?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_synthetic?: boolean
          kind: Database["public"]["Enums"]["fpo_logistics_kind"]
          location?: string | null
          note?: string | null
          provider_name: string
          provider_org_id?: string | null
          rate?: number | null
          rate_basis?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          capacity_unit?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_synthetic?: boolean
          kind?: Database["public"]["Enums"]["fpo_logistics_kind"]
          location?: string | null
          note?: string | null
          provider_name?: string
          provider_org_id?: string | null
          rate?: number | null
          rate_basis?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fpo_logistics_options_provider_org_id_fkey"
            columns: ["provider_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_logistics_options_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_market_price_observations: {
        Row: {
          basis: Database["public"]["Enums"]["fpo_price_basis"]
          commodity: string
          created_at: string
          district_code: string | null
          id: string
          is_synthetic: boolean
          market_name: string
          note: string | null
          observed_on: string
          price_per_unit: number
          source: string | null
          state_code: string | null
          tenant_id: string
          unit: string
          updated_at: string
          variety: string | null
        }
        Insert: {
          basis?: Database["public"]["Enums"]["fpo_price_basis"]
          commodity: string
          created_at?: string
          district_code?: string | null
          id?: string
          is_synthetic?: boolean
          market_name: string
          note?: string | null
          observed_on?: string
          price_per_unit: number
          source?: string | null
          state_code?: string | null
          tenant_id: string
          unit?: string
          updated_at?: string
          variety?: string | null
        }
        Update: {
          basis?: Database["public"]["Enums"]["fpo_price_basis"]
          commodity?: string
          created_at?: string
          district_code?: string | null
          id?: string
          is_synthetic?: boolean
          market_name?: string
          note?: string | null
          observed_on?: string
          price_per_unit?: number
          source?: string | null
          state_code?: string | null
          tenant_id?: string
          unit?: string
          updated_at?: string
          variety?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fpo_market_price_observations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_member_campaigns: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          id: string
          is_synthetic: boolean
          name: string
          note: string | null
          scheme_id: string | null
          status: Database["public"]["Enums"]["fpo_campaign_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          is_synthetic?: boolean
          name: string
          note?: string | null
          scheme_id?: string | null
          status?: Database["public"]["Enums"]["fpo_campaign_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          is_synthetic?: boolean
          name?: string
          note?: string | null
          scheme_id?: string | null
          status?: Database["public"]["Enums"]["fpo_campaign_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fpo_member_campaigns_scheme_id_fkey"
            columns: ["scheme_id"]
            isOneToOne: false
            referencedRelation: "schemes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_member_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_member_segments: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          filters: Json
          id: string
          is_smart: boolean
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          filters?: Json
          id?: string
          is_smart?: boolean
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          filters?: Json
          id?: string
          is_smart?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fpo_member_segments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_member_tag_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          member_id: string
          tag_id: string
          tenant_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          member_id: string
          tag_id: string
          tenant_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          member_id?: string
          tag_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fpo_member_tag_assignments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "fpo_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_member_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "fpo_member_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_member_tag_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_member_tags: {
        Row: {
          code: string
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          label: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          label: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          label?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fpo_member_tags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_members: {
        Row: {
          acreage: number | null
          added_by: string | null
          contact_hint: string | null
          created_at: string
          crops: string[]
          display_name: string
          exited_on: string | null
          farmer_user_id: string | null
          field_officer_user_id: string | null
          geography_id: string | null
          id: string
          import_batch_id: string | null
          is_synthetic: boolean
          joined_on: string | null
          member_ref: string
          member_type: string | null
          membership_number: string | null
          notes: string | null
          source: string | null
          status: Database["public"]["Enums"]["member_status"]
          tenant_id: string
          updated_at: string
          village_cluster: string | null
          village_code: string | null
        }
        Insert: {
          acreage?: number | null
          added_by?: string | null
          contact_hint?: string | null
          created_at?: string
          crops?: string[]
          display_name: string
          exited_on?: string | null
          farmer_user_id?: string | null
          field_officer_user_id?: string | null
          geography_id?: string | null
          id?: string
          import_batch_id?: string | null
          is_synthetic?: boolean
          joined_on?: string | null
          member_ref: string
          member_type?: string | null
          membership_number?: string | null
          notes?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["member_status"]
          tenant_id: string
          updated_at?: string
          village_cluster?: string | null
          village_code?: string | null
        }
        Update: {
          acreage?: number | null
          added_by?: string | null
          contact_hint?: string | null
          created_at?: string
          crops?: string[]
          display_name?: string
          exited_on?: string | null
          farmer_user_id?: string | null
          field_officer_user_id?: string | null
          geography_id?: string | null
          id?: string
          import_batch_id?: string | null
          is_synthetic?: boolean
          joined_on?: string | null
          member_ref?: string
          member_type?: string | null
          membership_number?: string | null
          notes?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["member_status"]
          tenant_id?: string
          updated_at?: string
          village_cluster?: string | null
          village_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fpo_members_geography_id_fkey"
            columns: ["geography_id"]
            isOneToOne: false
            referencedRelation: "geographies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_members_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "member_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_notification_deliveries: {
        Row: {
          channel: Database["public"]["Enums"]["fpo_notice_channel"]
          created_at: string
          id: string
          is_synthetic: boolean
          member_id: string | null
          notification_id: string
          read_at: string | null
          recipient_label: string
          recipient_user_id: string | null
          state: Database["public"]["Enums"]["fpo_delivery_state"]
          tenant_id: string
          updated_at: string
          withheld_reason: string | null
        }
        Insert: {
          channel?: Database["public"]["Enums"]["fpo_notice_channel"]
          created_at?: string
          id?: string
          is_synthetic?: boolean
          member_id?: string | null
          notification_id: string
          read_at?: string | null
          recipient_label: string
          recipient_user_id?: string | null
          state?: Database["public"]["Enums"]["fpo_delivery_state"]
          tenant_id: string
          updated_at?: string
          withheld_reason?: string | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["fpo_notice_channel"]
          created_at?: string
          id?: string
          is_synthetic?: boolean
          member_id?: string | null
          notification_id?: string
          read_at?: string | null
          recipient_label?: string
          recipient_user_id?: string | null
          state?: Database["public"]["Enums"]["fpo_delivery_state"]
          tenant_id?: string
          updated_at?: string
          withheld_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fpo_notification_deliveries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "fpo_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_notification_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "fpo_notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_notification_deliveries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_notifications: {
        Row: {
          application_id: string | null
          audience: Database["public"]["Enums"]["fpo_notice_audience"]
          body: string
          campaign_id: string | null
          category: Database["public"]["Enums"]["fpo_notice_category"]
          created_at: string
          created_by_user_id: string | null
          id: string
          is_synthetic: boolean
          language_code: string
          lot_id: string | null
          member_id: string | null
          recipient_count: number
          requested_channels: Database["public"]["Enums"]["fpo_notice_channel"][]
          scheduled_for: string | null
          segment_id: string | null
          sent_at: string | null
          state: Database["public"]["Enums"]["fpo_notice_state"]
          tenant_id: string
          title: string
          updated_at: string
          withheld_count: number
        }
        Insert: {
          application_id?: string | null
          audience?: Database["public"]["Enums"]["fpo_notice_audience"]
          body: string
          campaign_id?: string | null
          category?: Database["public"]["Enums"]["fpo_notice_category"]
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          is_synthetic?: boolean
          language_code?: string
          lot_id?: string | null
          member_id?: string | null
          recipient_count?: number
          requested_channels?: Database["public"]["Enums"]["fpo_notice_channel"][]
          scheduled_for?: string | null
          segment_id?: string | null
          sent_at?: string | null
          state?: Database["public"]["Enums"]["fpo_notice_state"]
          tenant_id: string
          title: string
          updated_at?: string
          withheld_count?: number
        }
        Update: {
          application_id?: string | null
          audience?: Database["public"]["Enums"]["fpo_notice_audience"]
          body?: string
          campaign_id?: string | null
          category?: Database["public"]["Enums"]["fpo_notice_category"]
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          is_synthetic?: boolean
          language_code?: string
          lot_id?: string | null
          member_id?: string | null
          recipient_count?: number
          requested_channels?: Database["public"]["Enums"]["fpo_notice_channel"][]
          scheduled_for?: string | null
          segment_id?: string | null
          sent_at?: string | null
          state?: Database["public"]["Enums"]["fpo_notice_state"]
          tenant_id?: string
          title?: string
          updated_at?: string
          withheld_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "fpo_notifications_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "fpo_scheme_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_notifications_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "fpo_procurement_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_notifications_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "fpo_produce_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_notifications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "fpo_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_notifications_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "fpo_member_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_opportunities: {
        Row: {
          application_deadline: string | null
          benefit_summary: string
          category: Database["public"]["Enums"]["fpo_opportunity_category"]
          commodities: string[]
          created_at: string
          created_by: string | null
          district_code: string | null
          eligibility_summary: string
          geography_note: string | null
          id: string
          is_active: boolean
          is_synthetic: boolean
          last_verified_at: string | null
          provider_name: string
          required_documents: string[]
          scheme_id: string | null
          source_name: string
          source_url: string | null
          state_code: string | null
          tenant_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          application_deadline?: string | null
          benefit_summary: string
          category: Database["public"]["Enums"]["fpo_opportunity_category"]
          commodities?: string[]
          created_at?: string
          created_by?: string | null
          district_code?: string | null
          eligibility_summary: string
          geography_note?: string | null
          id?: string
          is_active?: boolean
          is_synthetic?: boolean
          last_verified_at?: string | null
          provider_name: string
          required_documents?: string[]
          scheme_id?: string | null
          source_name?: string
          source_url?: string | null
          state_code?: string | null
          tenant_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          application_deadline?: string | null
          benefit_summary?: string
          category?: Database["public"]["Enums"]["fpo_opportunity_category"]
          commodities?: string[]
          created_at?: string
          created_by?: string | null
          district_code?: string | null
          eligibility_summary?: string
          geography_note?: string | null
          id?: string
          is_active?: boolean
          is_synthetic?: boolean
          last_verified_at?: string | null
          provider_name?: string
          required_documents?: string[]
          scheme_id?: string | null
          source_name?: string
          source_url?: string | null
          state_code?: string | null
          tenant_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fpo_opportunities_scheme_id_fkey"
            columns: ["scheme_id"]
            isOneToOne: false
            referencedRelation: "schemes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_opportunities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_opportunity_profiles: {
        Row: {
          annual_turnover_lakh: number | null
          benefits_10k_status: string | null
          block_mandal: string | null
          cbbo: string | null
          commodity_group: string | null
          created_at: string
          data_readiness_score: number | null
          district: string | null
          enam_status: string | null
          existing_infrastructure: string | null
          fpo_name: string
          fssai_status: string | null
          gst_status: string | null
          id: string
          last_verified: string | null
          loan_requirement_lakh: number | null
          member_count: number | null
          notes: string | null
          opportunity_score: number | null
          owner_name: string | null
          primary_commodity: string | null
          priority_need: string | null
          recommended_next_action: string | null
          registration_number: string
          registry_id: string | null
          source_url: string | null
          state_name: string
          top_scheme_1: string | null
          top_scheme_2: string | null
          top_scheme_3: string | null
          udyam_status: string | null
          updated_at: string
          verification_status: string | null
        }
        Insert: {
          annual_turnover_lakh?: number | null
          benefits_10k_status?: string | null
          block_mandal?: string | null
          cbbo?: string | null
          commodity_group?: string | null
          created_at?: string
          data_readiness_score?: number | null
          district?: string | null
          enam_status?: string | null
          existing_infrastructure?: string | null
          fpo_name: string
          fssai_status?: string | null
          gst_status?: string | null
          id?: string
          last_verified?: string | null
          loan_requirement_lakh?: number | null
          member_count?: number | null
          notes?: string | null
          opportunity_score?: number | null
          owner_name?: string | null
          primary_commodity?: string | null
          priority_need?: string | null
          recommended_next_action?: string | null
          registration_number: string
          registry_id?: string | null
          source_url?: string | null
          state_name: string
          top_scheme_1?: string | null
          top_scheme_2?: string | null
          top_scheme_3?: string | null
          udyam_status?: string | null
          updated_at?: string
          verification_status?: string | null
        }
        Update: {
          annual_turnover_lakh?: number | null
          benefits_10k_status?: string | null
          block_mandal?: string | null
          cbbo?: string | null
          commodity_group?: string | null
          created_at?: string
          data_readiness_score?: number | null
          district?: string | null
          enam_status?: string | null
          existing_infrastructure?: string | null
          fpo_name?: string
          fssai_status?: string | null
          gst_status?: string | null
          id?: string
          last_verified?: string | null
          loan_requirement_lakh?: number | null
          member_count?: number | null
          notes?: string | null
          opportunity_score?: number | null
          owner_name?: string | null
          primary_commodity?: string | null
          priority_need?: string | null
          recommended_next_action?: string | null
          registration_number?: string
          registry_id?: string | null
          source_url?: string | null
          state_name?: string
          top_scheme_1?: string | null
          top_scheme_2?: string | null
          top_scheme_3?: string | null
          udyam_status?: string | null
          updated_at?: string
          verification_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fpo_opportunity_profiles_registry_id_fkey"
            columns: ["registry_id"]
            isOneToOne: false
            referencedRelation: "fpo_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_opportunity_tracking: {
        Row: {
          created_at: string
          id: string
          is_synthetic: boolean
          note: string | null
          opportunity_id: string
          owner_user_id: string | null
          status: Database["public"]["Enums"]["fpo_opportunity_track_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_synthetic?: boolean
          note?: string | null
          opportunity_id: string
          owner_user_id?: string | null
          status?: Database["public"]["Enums"]["fpo_opportunity_track_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_synthetic?: boolean
          note?: string | null
          opportunity_id?: string
          owner_user_id?: string | null
          status?: Database["public"]["Enums"]["fpo_opportunity_track_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fpo_opportunity_tracking_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "fpo_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_opportunity_tracking_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_procurement_campaigns: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          demand_window_end: string | null
          demand_window_start: string | null
          id: string
          input_category: Database["public"]["Enums"]["fpo_input_category"]
          is_synthetic: boolean
          name: string
          note: string | null
          required_by: string | null
          season: string | null
          status: Database["public"]["Enums"]["fpo_procurement_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          demand_window_end?: string | null
          demand_window_start?: string | null
          id?: string
          input_category: Database["public"]["Enums"]["fpo_input_category"]
          is_synthetic?: boolean
          name: string
          note?: string | null
          required_by?: string | null
          season?: string | null
          status?: Database["public"]["Enums"]["fpo_procurement_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          demand_window_end?: string | null
          demand_window_start?: string | null
          id?: string
          input_category?: Database["public"]["Enums"]["fpo_input_category"]
          is_synthetic?: boolean
          name?: string
          note?: string | null
          required_by?: string | null
          season?: string | null
          status?: Database["public"]["Enums"]["fpo_procurement_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fpo_procurement_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_procurement_demand: {
        Row: {
          authorization_recorded_at: string | null
          campaign_id: string
          created_at: string
          generic_name: string | null
          id: string
          indicative_price_per_unit: number | null
          is_synthetic: boolean
          member_authorized: boolean
          member_id: string | null
          note: string | null
          product_name: string
          quantity: number
          tenant_id: string
          unit: string
          updated_at: string
        }
        Insert: {
          authorization_recorded_at?: string | null
          campaign_id: string
          created_at?: string
          generic_name?: string | null
          id?: string
          indicative_price_per_unit?: number | null
          is_synthetic?: boolean
          member_authorized?: boolean
          member_id?: string | null
          note?: string | null
          product_name: string
          quantity: number
          tenant_id: string
          unit?: string
          updated_at?: string
        }
        Update: {
          authorization_recorded_at?: string | null
          campaign_id?: string
          created_at?: string
          generic_name?: string | null
          id?: string
          indicative_price_per_unit?: number | null
          is_synthetic?: boolean
          member_authorized?: boolean
          member_id?: string | null
          note?: string | null
          product_name?: string
          quantity?: number
          tenant_id?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fpo_procurement_demand_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "fpo_procurement_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_procurement_demand_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "fpo_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_procurement_demand_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_procurement_distributions: {
        Row: {
          amount_collected: number
          amount_due: number
          campaign_id: string
          created_at: string
          distributed_at: string | null
          id: string
          is_synthetic: boolean
          member_id: string | null
          note: string | null
          payment_state: Database["public"]["Enums"]["fpo_payment_state"]
          product_name: string
          quantity: number
          tenant_id: string
          unit: string
          updated_at: string
        }
        Insert: {
          amount_collected?: number
          amount_due?: number
          campaign_id: string
          created_at?: string
          distributed_at?: string | null
          id?: string
          is_synthetic?: boolean
          member_id?: string | null
          note?: string | null
          payment_state?: Database["public"]["Enums"]["fpo_payment_state"]
          product_name: string
          quantity: number
          tenant_id: string
          unit?: string
          updated_at?: string
        }
        Update: {
          amount_collected?: number
          amount_due?: number
          campaign_id?: string
          created_at?: string
          distributed_at?: string | null
          id?: string
          is_synthetic?: boolean
          member_id?: string | null
          note?: string | null
          payment_state?: Database["public"]["Enums"]["fpo_payment_state"]
          product_name?: string
          quantity?: number
          tenant_id?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fpo_procurement_distributions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "fpo_procurement_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_procurement_distributions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "fpo_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_procurement_distributions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_procurement_rfqs: {
        Row: {
          aggregated_quantity: number
          campaign_id: string
          created_at: string
          delivery_by: string | null
          id: string
          is_open: boolean
          is_synthetic: boolean
          marketplace_rfq_id: string | null
          product_name: string
          specification: string | null
          tenant_id: string
          unit: string
          updated_at: string
        }
        Insert: {
          aggregated_quantity: number
          campaign_id: string
          created_at?: string
          delivery_by?: string | null
          id?: string
          is_open?: boolean
          is_synthetic?: boolean
          marketplace_rfq_id?: string | null
          product_name: string
          specification?: string | null
          tenant_id: string
          unit?: string
          updated_at?: string
        }
        Update: {
          aggregated_quantity?: number
          campaign_id?: string
          created_at?: string
          delivery_by?: string | null
          id?: string
          is_open?: boolean
          is_synthetic?: boolean
          marketplace_rfq_id?: string | null
          product_name?: string
          specification?: string | null
          tenant_id?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fpo_procurement_rfqs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "fpo_procurement_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_procurement_rfqs_marketplace_rfq_id_fkey"
            columns: ["marketplace_rfq_id"]
            isOneToOne: false
            referencedRelation: "marketplace_rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_procurement_rfqs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_produce_contributions: {
        Row: {
          confirmed_quantity: number
          created_at: string
          delivered_quantity: number
          expected_quantity: number
          grade: string | null
          id: string
          is_synthetic: boolean
          lot_id: string
          member_id: string | null
          note: string | null
          tenant_id: string
          unit: string
          updated_at: string
        }
        Insert: {
          confirmed_quantity?: number
          created_at?: string
          delivered_quantity?: number
          expected_quantity?: number
          grade?: string | null
          id?: string
          is_synthetic?: boolean
          lot_id: string
          member_id?: string | null
          note?: string | null
          tenant_id: string
          unit?: string
          updated_at?: string
        }
        Update: {
          confirmed_quantity?: number
          created_at?: string
          delivered_quantity?: number
          expected_quantity?: number
          grade?: string | null
          id?: string
          is_synthetic?: boolean
          lot_id?: string
          member_id?: string | null
          note?: string | null
          tenant_id?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fpo_produce_contributions_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "fpo_produce_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_produce_contributions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "fpo_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_produce_contributions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_produce_lots: {
        Row: {
          aggregated_quantity: number
          commodity: string
          created_at: string
          created_by_user_id: string | null
          expected_quantity: number
          grade: string | null
          harvest_window_end: string | null
          harvest_window_start: string | null
          id: string
          is_synthetic: boolean
          lot_code: string | null
          marketplace_listing_id: string | null
          marketplace_rfq_id: string | null
          note: string | null
          reserve_price_per_unit: number | null
          season: string | null
          status: Database["public"]["Enums"]["fpo_produce_lot_status"]
          storage_location: string | null
          tenant_id: string
          unit: string
          updated_at: string
          variety: string | null
        }
        Insert: {
          aggregated_quantity?: number
          commodity: string
          created_at?: string
          created_by_user_id?: string | null
          expected_quantity?: number
          grade?: string | null
          harvest_window_end?: string | null
          harvest_window_start?: string | null
          id?: string
          is_synthetic?: boolean
          lot_code?: string | null
          marketplace_listing_id?: string | null
          marketplace_rfq_id?: string | null
          note?: string | null
          reserve_price_per_unit?: number | null
          season?: string | null
          status?: Database["public"]["Enums"]["fpo_produce_lot_status"]
          storage_location?: string | null
          tenant_id: string
          unit?: string
          updated_at?: string
          variety?: string | null
        }
        Update: {
          aggregated_quantity?: number
          commodity?: string
          created_at?: string
          created_by_user_id?: string | null
          expected_quantity?: number
          grade?: string | null
          harvest_window_end?: string | null
          harvest_window_start?: string | null
          id?: string
          is_synthetic?: boolean
          lot_code?: string | null
          marketplace_listing_id?: string | null
          marketplace_rfq_id?: string | null
          note?: string | null
          reserve_price_per_unit?: number | null
          season?: string | null
          status?: Database["public"]["Enums"]["fpo_produce_lot_status"]
          storage_location?: string | null
          tenant_id?: string
          unit?: string
          updated_at?: string
          variety?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fpo_produce_lots_marketplace_listing_id_fkey"
            columns: ["marketplace_listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_produce_lots_marketplace_rfq_id_fkey"
            columns: ["marketplace_rfq_id"]
            isOneToOne: false
            referencedRelation: "marketplace_rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_produce_lots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_profiles: {
        Row: {
          active_farmers: number
          annual_produce_tonnes: number | null
          cin: string | null
          created_at: string
          created_by: string | null
          display_name: string
          district_code: string | null
          email: string | null
          equipment: string[]
          fpo_category: string | null
          fpo_code: string
          gps_lat: number | null
          gps_lng: number | null
          gst: string | null
          id: string
          incorporation_date: string | null
          input_categories: string[]
          is_synthetic: boolean
          legal_name: string
          logistics_relationships: string[]
          mandal: string | null
          onboarding_step: string
          operational_districts: string[]
          org_type: string | null
          organization_id: string | null
          pan: string | null
          phone: string | null
          pin_code: string | null
          primary_crops: string[]
          processing_facilities: string[]
          produce_categories: string[]
          promoting_org: string | null
          registered_address: string | null
          registered_farmers: number
          registration_number: string | null
          secondary_crops: string[]
          state: Database["public"]["Enums"]["fpo_profile_state"]
          state_code: string | null
          storage_facilities: string[]
          tenant_id: string
          total_acres: number
          updated_at: string
          verified_at: string | null
          village: string | null
          villages_served: string[]
          warehouse_relationships: string[]
          website: string | null
        }
        Insert: {
          active_farmers?: number
          annual_produce_tonnes?: number | null
          cin?: string | null
          created_at?: string
          created_by?: string | null
          display_name: string
          district_code?: string | null
          email?: string | null
          equipment?: string[]
          fpo_category?: string | null
          fpo_code: string
          gps_lat?: number | null
          gps_lng?: number | null
          gst?: string | null
          id?: string
          incorporation_date?: string | null
          input_categories?: string[]
          is_synthetic?: boolean
          legal_name: string
          logistics_relationships?: string[]
          mandal?: string | null
          onboarding_step?: string
          operational_districts?: string[]
          org_type?: string | null
          organization_id?: string | null
          pan?: string | null
          phone?: string | null
          pin_code?: string | null
          primary_crops?: string[]
          processing_facilities?: string[]
          produce_categories?: string[]
          promoting_org?: string | null
          registered_address?: string | null
          registered_farmers?: number
          registration_number?: string | null
          secondary_crops?: string[]
          state?: Database["public"]["Enums"]["fpo_profile_state"]
          state_code?: string | null
          storage_facilities?: string[]
          tenant_id: string
          total_acres?: number
          updated_at?: string
          verified_at?: string | null
          village?: string | null
          villages_served?: string[]
          warehouse_relationships?: string[]
          website?: string | null
        }
        Update: {
          active_farmers?: number
          annual_produce_tonnes?: number | null
          cin?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string
          district_code?: string | null
          email?: string | null
          equipment?: string[]
          fpo_category?: string | null
          fpo_code?: string
          gps_lat?: number | null
          gps_lng?: number | null
          gst?: string | null
          id?: string
          incorporation_date?: string | null
          input_categories?: string[]
          is_synthetic?: boolean
          legal_name?: string
          logistics_relationships?: string[]
          mandal?: string | null
          onboarding_step?: string
          operational_districts?: string[]
          org_type?: string | null
          organization_id?: string | null
          pan?: string | null
          phone?: string | null
          pin_code?: string | null
          primary_crops?: string[]
          processing_facilities?: string[]
          produce_categories?: string[]
          promoting_org?: string | null
          registered_address?: string | null
          registered_farmers?: number
          registration_number?: string | null
          secondary_crops?: string[]
          state?: Database["public"]["Enums"]["fpo_profile_state"]
          state_code?: string | null
          storage_facilities?: string[]
          tenant_id?: string
          total_acres?: number
          updated_at?: string
          verified_at?: string | null
          village?: string | null
          villages_served?: string[]
          warehouse_relationships?: string[]
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fpo_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_registry: {
        Row: {
          block_mandal: string | null
          cbbo: string | null
          created_at: string
          district: string | null
          fpo_name: string
          id: string
          incorporation_date: string | null
          qa_note: string | null
          registration_act: string | null
          registration_number: string
          scheme: string | null
          sfac_serial: number | null
          source_as_of: string | null
          source_url: string | null
          state_code: string | null
          state_name: string
          updated_at: string
        }
        Insert: {
          block_mandal?: string | null
          cbbo?: string | null
          created_at?: string
          district?: string | null
          fpo_name: string
          id?: string
          incorporation_date?: string | null
          qa_note?: string | null
          registration_act?: string | null
          registration_number: string
          scheme?: string | null
          sfac_serial?: number | null
          source_as_of?: string | null
          source_url?: string | null
          state_code?: string | null
          state_name: string
          updated_at?: string
        }
        Update: {
          block_mandal?: string | null
          cbbo?: string | null
          created_at?: string
          district?: string | null
          fpo_name?: string
          id?: string
          incorporation_date?: string | null
          qa_note?: string | null
          registration_act?: string | null
          registration_number?: string
          scheme?: string | null
          sfac_serial?: number | null
          source_as_of?: string | null
          source_url?: string | null
          state_code?: string | null
          state_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      fpo_role_permissions: {
        Row: {
          created_at: string
          id: string
          is_synthetic: boolean
          level: Database["public"]["Enums"]["fpo_permission_level"]
          rationale: string | null
          section: string
          staff_role: Database["public"]["Enums"]["app_role"]
          tenant_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_synthetic?: boolean
          level?: Database["public"]["Enums"]["fpo_permission_level"]
          rationale?: string | null
          section: string
          staff_role: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_synthetic?: boolean
          level?: Database["public"]["Enums"]["fpo_permission_level"]
          rationale?: string | null
          section?: string
          staff_role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fpo_role_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_scheme_applications: {
        Row: {
          assigned_user_id: string | null
          benefit_amount: number | null
          created_at: string
          created_by_user_id: string | null
          decided_at: string | null
          id: string
          is_synthetic: boolean
          note: string | null
          pending_documents: string[]
          reference_no: string | null
          requested_amount: number | null
          requires_signatory: boolean
          scheme_id: string
          status: Database["public"]["Enums"]["fpo_application_status"]
          submitted_at: string | null
          submitted_by_user_id: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_user_id?: string | null
          benefit_amount?: number | null
          created_at?: string
          created_by_user_id?: string | null
          decided_at?: string | null
          id?: string
          is_synthetic?: boolean
          note?: string | null
          pending_documents?: string[]
          reference_no?: string | null
          requested_amount?: number | null
          requires_signatory?: boolean
          scheme_id: string
          status?: Database["public"]["Enums"]["fpo_application_status"]
          submitted_at?: string | null
          submitted_by_user_id?: string | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_user_id?: string | null
          benefit_amount?: number | null
          created_at?: string
          created_by_user_id?: string | null
          decided_at?: string | null
          id?: string
          is_synthetic?: boolean
          note?: string | null
          pending_documents?: string[]
          reference_no?: string | null
          requested_amount?: number | null
          requires_signatory?: boolean
          scheme_id?: string
          status?: Database["public"]["Enums"]["fpo_application_status"]
          submitted_at?: string | null
          submitted_by_user_id?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fpo_scheme_applications_scheme_id_fkey"
            columns: ["scheme_id"]
            isOneToOne: false
            referencedRelation: "schemes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_scheme_applications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_scheme_catalog: {
        Row: {
          applicable_state: string | null
          application_window: string | null
          beneficiary: string | null
          category: string | null
          created_at: string
          data_note: string | null
          eligibility_trigger: string | null
          fpo_relevance: string | null
          id: string
          implementer: string | null
          indicative_limit: string | null
          key_benefit: string | null
          level: string | null
          scheme_id: string
          scheme_name: string
          source_url: string | null
          updated_at: string
        }
        Insert: {
          applicable_state?: string | null
          application_window?: string | null
          beneficiary?: string | null
          category?: string | null
          created_at?: string
          data_note?: string | null
          eligibility_trigger?: string | null
          fpo_relevance?: string | null
          id?: string
          implementer?: string | null
          indicative_limit?: string | null
          key_benefit?: string | null
          level?: string | null
          scheme_id: string
          scheme_name: string
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          applicable_state?: string | null
          application_window?: string | null
          beneficiary?: string | null
          category?: string | null
          created_at?: string
          data_note?: string | null
          eligibility_trigger?: string | null
          fpo_relevance?: string | null
          id?: string
          implementer?: string | null
          indicative_limit?: string | null
          key_benefit?: string | null
          level?: string | null
          scheme_id?: string
          scheme_name?: string
          source_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fpo_scheme_eligibility: {
        Row: {
          advisory_note: string | null
          assessed_at: string
          assessed_by: string | null
          bucket: Database["public"]["Enums"]["fpo_eligibility_bucket"]
          created_at: string
          id: string
          is_synthetic: boolean
          missing_information: string[]
          reasons: Json
          scheme_id: string
          source_name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          advisory_note?: string | null
          assessed_at?: string
          assessed_by?: string | null
          bucket?: Database["public"]["Enums"]["fpo_eligibility_bucket"]
          created_at?: string
          id?: string
          is_synthetic?: boolean
          missing_information?: string[]
          reasons?: Json
          scheme_id: string
          source_name?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          advisory_note?: string | null
          assessed_at?: string
          assessed_by?: string | null
          bucket?: Database["public"]["Enums"]["fpo_eligibility_bucket"]
          created_at?: string
          id?: string
          is_synthetic?: boolean
          missing_information?: string[]
          reasons?: Json
          scheme_id?: string
          source_name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fpo_scheme_eligibility_scheme_id_fkey"
            columns: ["scheme_id"]
            isOneToOne: false
            referencedRelation: "schemes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_scheme_eligibility_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_scheme_matrix: {
        Row: {
          commodity_group: string | null
          created_at: string
          district: string | null
          flag_10k_benefits: string | null
          flag_aif: string | null
          flag_enam: string | null
          flag_mechanisation_chc: string | null
          flag_midh: string | null
          flag_nmeo_op: string | null
          flag_pm_rkvy: string | null
          flag_pmfme: string | null
          flag_pmmsy: string | null
          flag_sampada: string | null
          flag_state_income_support: string | null
          flag_state_micro_irrigation: string | null
          flag_state_other_benefit: string | null
          fpo_name: string
          id: string
          priority_need: string | null
          registration_number: string
          registry_id: string | null
          state_name: string
          updated_at: string
        }
        Insert: {
          commodity_group?: string | null
          created_at?: string
          district?: string | null
          flag_10k_benefits?: string | null
          flag_aif?: string | null
          flag_enam?: string | null
          flag_mechanisation_chc?: string | null
          flag_midh?: string | null
          flag_nmeo_op?: string | null
          flag_pm_rkvy?: string | null
          flag_pmfme?: string | null
          flag_pmmsy?: string | null
          flag_sampada?: string | null
          flag_state_income_support?: string | null
          flag_state_micro_irrigation?: string | null
          flag_state_other_benefit?: string | null
          fpo_name: string
          id?: string
          priority_need?: string | null
          registration_number: string
          registry_id?: string | null
          state_name: string
          updated_at?: string
        }
        Update: {
          commodity_group?: string | null
          created_at?: string
          district?: string | null
          flag_10k_benefits?: string | null
          flag_aif?: string | null
          flag_enam?: string | null
          flag_mechanisation_chc?: string | null
          flag_midh?: string | null
          flag_nmeo_op?: string | null
          flag_pm_rkvy?: string | null
          flag_pmfme?: string | null
          flag_pmmsy?: string | null
          flag_sampada?: string | null
          flag_state_income_support?: string | null
          flag_state_micro_irrigation?: string | null
          flag_state_other_benefit?: string | null
          fpo_name?: string
          id?: string
          priority_need?: string | null
          registration_number?: string
          registry_id?: string | null
          state_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fpo_scheme_matrix_registry_id_fkey"
            columns: ["registry_id"]
            isOneToOne: false
            referencedRelation: "fpo_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_staff_members: {
        Row: {
          contact_hint: string | null
          created_at: string
          created_by: string | null
          designation: string | null
          display_name: string
          district_scope: string[]
          id: string
          invitation_id: string | null
          is_synthetic: boolean
          last_reviewed_at: string | null
          mandal_scope: string[]
          notes: string | null
          staff_role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["fpo_staff_status"]
          suspended_reason: string | null
          tenant_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          contact_hint?: string | null
          created_at?: string
          created_by?: string | null
          designation?: string | null
          display_name: string
          district_scope?: string[]
          id?: string
          invitation_id?: string | null
          is_synthetic?: boolean
          last_reviewed_at?: string | null
          mandal_scope?: string[]
          notes?: string | null
          staff_role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["fpo_staff_status"]
          suspended_reason?: string | null
          tenant_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          contact_hint?: string | null
          created_at?: string
          created_by?: string | null
          designation?: string | null
          display_name?: string
          district_scope?: string[]
          id?: string
          invitation_id?: string | null
          is_synthetic?: boolean
          last_reviewed_at?: string | null
          mandal_scope?: string[]
          notes?: string | null
          staff_role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["fpo_staff_status"]
          suspended_reason?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fpo_staff_members_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "tenant_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_staff_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_supplier_quotes: {
        Row: {
          availability_date: string | null
          available_quantity: number | null
          certification_label: string | null
          created_at: string
          delivery_days: number | null
          id: string
          is_selected: boolean
          is_synthetic: boolean
          min_order_quantity: number | null
          note: string | null
          rfq_id: string
          selected_at: string | null
          selected_by_user_id: string | null
          supplier_name: string
          supplier_org_id: string | null
          supplier_rating: number | null
          tenant_id: string
          transport_cost: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          availability_date?: string | null
          available_quantity?: number | null
          certification_label?: string | null
          created_at?: string
          delivery_days?: number | null
          id?: string
          is_selected?: boolean
          is_synthetic?: boolean
          min_order_quantity?: number | null
          note?: string | null
          rfq_id: string
          selected_at?: string | null
          selected_by_user_id?: string | null
          supplier_name: string
          supplier_org_id?: string | null
          supplier_rating?: number | null
          tenant_id: string
          transport_cost?: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          availability_date?: string | null
          available_quantity?: number | null
          certification_label?: string | null
          created_at?: string
          delivery_days?: number | null
          id?: string
          is_selected?: boolean
          is_synthetic?: boolean
          min_order_quantity?: number | null
          note?: string | null
          rfq_id?: string
          selected_at?: string | null
          selected_by_user_id?: string | null
          supplier_name?: string
          supplier_org_id?: string | null
          supplier_rating?: number | null
          tenant_id?: string
          transport_cost?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fpo_supplier_quotes_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "fpo_procurement_rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_supplier_quotes_supplier_org_id_fkey"
            columns: ["supplier_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_supplier_quotes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_task_comments: {
        Row: {
          author_user_id: string | null
          body: string
          created_at: string
          id: string
          is_synthetic: boolean
          task_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          author_user_id?: string | null
          body: string
          created_at?: string
          id?: string
          is_synthetic?: boolean
          task_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          author_user_id?: string | null
          body?: string
          created_at?: string
          id?: string
          is_synthetic?: boolean
          task_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fpo_task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "fpo_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_task_comments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fpo_tasks: {
        Row: {
          application_id: string | null
          assigned_to_user_id: string | null
          assignee_label: string | null
          campaign_id: string | null
          category: Database["public"]["Enums"]["fpo_notice_category"]
          completed_at: string | null
          created_at: string
          created_by_user_id: string | null
          description: string | null
          due_date: string | null
          id: string
          is_synthetic: boolean
          lot_id: string | null
          member_id: string | null
          priority: Database["public"]["Enums"]["fpo_task_priority"]
          status: Database["public"]["Enums"]["fpo_task_status"]
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          application_id?: string | null
          assigned_to_user_id?: string | null
          assignee_label?: string | null
          campaign_id?: string | null
          category?: Database["public"]["Enums"]["fpo_notice_category"]
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_synthetic?: boolean
          lot_id?: string | null
          member_id?: string | null
          priority?: Database["public"]["Enums"]["fpo_task_priority"]
          status?: Database["public"]["Enums"]["fpo_task_status"]
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          application_id?: string | null
          assigned_to_user_id?: string | null
          assignee_label?: string | null
          campaign_id?: string | null
          category?: Database["public"]["Enums"]["fpo_notice_category"]
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_synthetic?: boolean
          lot_id?: string | null
          member_id?: string | null
          priority?: Database["public"]["Enums"]["fpo_task_priority"]
          status?: Database["public"]["Enums"]["fpo_task_status"]
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fpo_tasks_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "fpo_scheme_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_tasks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "fpo_procurement_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_tasks_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "fpo_produce_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "fpo_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fpo_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      geographies: {
        Row: {
          code: string
          created_at: string
          id: string
          level: Database["public"]["Enums"]["geo_level"]
          name: string
          parent_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          level: Database["public"]["Enums"]["geo_level"]
          name: string
          parent_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          level?: Database["public"]["Enums"]["geo_level"]
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "geographies_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "geographies"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_verification_checks: {
        Row: {
          adapter_name: string
          application_id: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          evidence_ref: string | null
          id: string
          is_synthetic: boolean
          jurisdiction_code: string
          manual_review_note: string | null
          reason_category: string | null
          reference_hash: string | null
          requested_by_user_id: string | null
          status: Database["public"]["Enums"]["identity_check_status"]
          subject_user_id: string
        }
        Insert: {
          adapter_name: string
          application_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          evidence_ref?: string | null
          id?: string
          is_synthetic?: boolean
          jurisdiction_code?: string
          manual_review_note?: string | null
          reason_category?: string | null
          reference_hash?: string | null
          requested_by_user_id?: string | null
          status?: Database["public"]["Enums"]["identity_check_status"]
          subject_user_id: string
        }
        Update: {
          adapter_name?: string
          application_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          evidence_ref?: string | null
          id?: string
          is_synthetic?: boolean
          jurisdiction_code?: string
          manual_review_note?: string | null
          reason_category?: string | null
          reference_hash?: string | null
          requested_by_user_id?: string | null
          status?: Database["public"]["Enums"]["identity_check_status"]
          subject_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "identity_verification_checks_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "onboarding_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      infestation_treatments: {
        Row: {
          created_at: string
          dose_per_hectare: number
          id: string
          infestation_id: string
          is_organic: boolean
          product_code: string
          reentry_note: string | null
          safety_interval_days: number
          unit: string
        }
        Insert: {
          created_at?: string
          dose_per_hectare: number
          id?: string
          infestation_id: string
          is_organic?: boolean
          product_code: string
          reentry_note?: string | null
          safety_interval_days?: number
          unit?: string
        }
        Update: {
          created_at?: string
          dose_per_hectare?: number
          id?: string
          infestation_id?: string
          is_organic?: boolean
          product_code?: string
          reentry_note?: string | null
          safety_interval_days?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "infestation_treatments_infestation_id_fkey"
            columns: ["infestation_id"]
            isOneToOne: false
            referencedRelation: "infestation_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "infestation_treatments_product_code_fkey"
            columns: ["product_code"]
            isOneToOne: false
            referencedRelation: "input_products"
            referencedColumns: ["code"]
          },
        ]
      }
      infestation_types: {
        Row: {
          code: string
          created_at: string
          crop: string
          id: string
          is_synthetic: boolean
          kind: string
          name: string
          severity: string
          symptoms: string[]
        }
        Insert: {
          code: string
          created_at?: string
          crop: string
          id?: string
          is_synthetic?: boolean
          kind: string
          name: string
          severity?: string
          symptoms?: string[]
        }
        Update: {
          code?: string
          created_at?: string
          crop?: string
          id?: string
          is_synthetic?: boolean
          kind?: string
          name?: string
          severity?: string
          symptoms?: string[]
        }
        Relationships: []
      }
      input_products: {
        Row: {
          brand_names: string[]
          category: string
          code: string
          cost_max_minor: number
          cost_min_minor: number
          created_at: string
          currency: string
          generic_name: string
          id: string
          is_synthetic: boolean
          kind: string
          nutrient_or_active: string
          preparation_notes: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          brand_names?: string[]
          category: string
          code: string
          cost_max_minor?: number
          cost_min_minor?: number
          created_at?: string
          currency?: string
          generic_name: string
          id?: string
          is_synthetic?: boolean
          kind: string
          nutrient_or_active: string
          preparation_notes?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          brand_names?: string[]
          category?: string
          code?: string
          cost_max_minor?: number
          cost_min_minor?: number
          created_at?: string
          currency?: string
          generic_name?: string
          id?: string
          is_synthetic?: boolean
          kind?: string
          nutrient_or_active?: string
          preparation_notes?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      insurer_alert_rules: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          event_type: Database["public"]["Enums"]["insurer_risk_event"] | null
          id: string
          insurer_tenant_id: string
          min_severity: Database["public"]["Enums"]["insurer_risk_severity"]
          name: string
          rainfall_deviation_threshold_pct: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          event_type?: Database["public"]["Enums"]["insurer_risk_event"] | null
          id?: string
          insurer_tenant_id: string
          min_severity?: Database["public"]["Enums"]["insurer_risk_severity"]
          name: string
          rainfall_deviation_threshold_pct?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          event_type?: Database["public"]["Enums"]["insurer_risk_event"] | null
          id?: string
          insurer_tenant_id?: string
          min_severity?: Database["public"]["Enums"]["insurer_risk_severity"]
          name?: string
          rainfall_deviation_threshold_pct?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurer_alert_rules_insurer_tenant_id_fkey"
            columns: ["insurer_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      insurer_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          detail: string | null
          id: string
          insurer_tenant_id: string
          risk_cell_id: string
          rule_id: string | null
          severity: Database["public"]["Enums"]["insurer_risk_severity"]
          status: Database["public"]["Enums"]["insurer_alert_status"]
          title: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          insurer_tenant_id: string
          risk_cell_id: string
          rule_id?: string | null
          severity: Database["public"]["Enums"]["insurer_risk_severity"]
          status?: Database["public"]["Enums"]["insurer_alert_status"]
          title: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          insurer_tenant_id?: string
          risk_cell_id?: string
          rule_id?: string | null
          severity?: Database["public"]["Enums"]["insurer_risk_severity"]
          status?: Database["public"]["Enums"]["insurer_alert_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurer_alerts_insurer_tenant_id_fkey"
            columns: ["insurer_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurer_alerts_risk_cell_id_fkey"
            columns: ["risk_cell_id"]
            isOneToOne: false
            referencedRelation: "insurer_risk_cells"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurer_alerts_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "insurer_alert_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      insurer_campaign_targets: {
        Row: {
          campaign_id: string
          created_at: string
          fpo_name: string
          id: string
          premium_opportunity_inr: number
          registration_number: string
          registry_id: string | null
          target_farmers: number
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          fpo_name: string
          id?: string
          premium_opportunity_inr?: number
          registration_number: string
          registry_id?: string | null
          target_farmers?: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          fpo_name?: string
          id?: string
          premium_opportunity_inr?: number
          registration_number?: string
          registry_id?: string | null
          target_farmers?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurer_campaign_targets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "insurer_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurer_campaign_targets_registry_id_fkey"
            columns: ["registry_id"]
            isOneToOne: false
            referencedRelation: "fpo_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      insurer_campaigns: {
        Row: {
          commodity: string | null
          created_at: string
          created_by: string | null
          district: string | null
          ends_on: string | null
          id: string
          insurer_tenant_id: string
          name: string
          notes: string | null
          owner_name: string | null
          premium_opportunity_inr: number
          season: string | null
          starts_on: string | null
          state: Database["public"]["Enums"]["insurer_campaign_state"]
          state_name: string | null
          target_acres: number
          target_farmers: number
          updated_at: string
        }
        Insert: {
          commodity?: string | null
          created_at?: string
          created_by?: string | null
          district?: string | null
          ends_on?: string | null
          id?: string
          insurer_tenant_id: string
          name: string
          notes?: string | null
          owner_name?: string | null
          premium_opportunity_inr?: number
          season?: string | null
          starts_on?: string | null
          state?: Database["public"]["Enums"]["insurer_campaign_state"]
          state_name?: string | null
          target_acres?: number
          target_farmers?: number
          updated_at?: string
        }
        Update: {
          commodity?: string | null
          created_at?: string
          created_by?: string | null
          district?: string | null
          ends_on?: string | null
          id?: string
          insurer_tenant_id?: string
          name?: string
          notes?: string | null
          owner_name?: string | null
          premium_opportunity_inr?: number
          season?: string | null
          starts_on?: string | null
          state?: Database["public"]["Enums"]["insurer_campaign_state"]
          state_name?: string | null
          target_acres?: number
          target_farmers?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurer_campaigns_insurer_tenant_id_fkey"
            columns: ["insurer_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      insurer_claim_documents: {
        Row: {
          claim_id: string
          created_at: string
          doc_type: string
          id: string
          insurer_tenant_id: string
          label: string
          received_at: string | null
          required: boolean
          status: Database["public"]["Enums"]["insurer_claim_doc_status"]
          updated_at: string
        }
        Insert: {
          claim_id: string
          created_at?: string
          doc_type: string
          id?: string
          insurer_tenant_id: string
          label: string
          received_at?: string | null
          required?: boolean
          status?: Database["public"]["Enums"]["insurer_claim_doc_status"]
          updated_at?: string
        }
        Update: {
          claim_id?: string
          created_at?: string
          doc_type?: string
          id?: string
          insurer_tenant_id?: string
          label?: string
          received_at?: string | null
          required?: boolean
          status?: Database["public"]["Enums"]["insurer_claim_doc_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurer_claim_documents_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "insurer_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurer_claim_documents_insurer_tenant_id_fkey"
            columns: ["insurer_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      insurer_claim_events: {
        Row: {
          actor_user_id: string | null
          claim_id: string
          created_at: string
          from_stage: Database["public"]["Enums"]["insurer_claim_stage"] | null
          id: string
          insurer_tenant_id: string
          note: string | null
          to_stage: Database["public"]["Enums"]["insurer_claim_stage"]
        }
        Insert: {
          actor_user_id?: string | null
          claim_id: string
          created_at?: string
          from_stage?: Database["public"]["Enums"]["insurer_claim_stage"] | null
          id?: string
          insurer_tenant_id: string
          note?: string | null
          to_stage: Database["public"]["Enums"]["insurer_claim_stage"]
        }
        Update: {
          actor_user_id?: string | null
          claim_id?: string
          created_at?: string
          from_stage?: Database["public"]["Enums"]["insurer_claim_stage"] | null
          id?: string
          insurer_tenant_id?: string
          note?: string | null
          to_stage?: Database["public"]["Enums"]["insurer_claim_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "insurer_claim_events_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "insurer_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurer_claim_events_insurer_tenant_id_fkey"
            columns: ["insurer_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      insurer_claims: {
        Row: {
          affected_members: number
          approved_amount_inr: number | null
          assessed_loss_pct: number | null
          claim_reference: string
          claimed_amount_inr: number
          created_at: string
          created_by: string | null
          crop: string | null
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          district: string | null
          fpo_name: string
          id: string
          insurer_tenant_id: string
          internal_notes: string | null
          peril: Database["public"]["Enums"]["insurer_risk_event"]
          registration_number: string
          reported_acres: number | null
          reported_at: string
          response_due_at: string | null
          risk_cell_id: string | null
          season: string
          stage: Database["public"]["Enums"]["insurer_claim_stage"]
          state_name: string | null
          surveyor_name: string | null
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          affected_members?: number
          approved_amount_inr?: number | null
          assessed_loss_pct?: number | null
          claim_reference: string
          claimed_amount_inr?: number
          created_at?: string
          created_by?: string | null
          crop?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          district?: string | null
          fpo_name: string
          id?: string
          insurer_tenant_id: string
          internal_notes?: string | null
          peril: Database["public"]["Enums"]["insurer_risk_event"]
          registration_number: string
          reported_acres?: number | null
          reported_at?: string
          response_due_at?: string | null
          risk_cell_id?: string | null
          season?: string
          stage?: Database["public"]["Enums"]["insurer_claim_stage"]
          state_name?: string | null
          surveyor_name?: string | null
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          affected_members?: number
          approved_amount_inr?: number | null
          assessed_loss_pct?: number | null
          claim_reference?: string
          claimed_amount_inr?: number
          created_at?: string
          created_by?: string | null
          crop?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          district?: string | null
          fpo_name?: string
          id?: string
          insurer_tenant_id?: string
          internal_notes?: string | null
          peril?: Database["public"]["Enums"]["insurer_risk_event"]
          registration_number?: string
          reported_acres?: number | null
          reported_at?: string
          response_due_at?: string | null
          risk_cell_id?: string | null
          season?: string
          stage?: Database["public"]["Enums"]["insurer_claim_stage"]
          state_name?: string | null
          surveyor_name?: string | null
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurer_claims_insurer_tenant_id_fkey"
            columns: ["insurer_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurer_claims_risk_cell_id_fkey"
            columns: ["risk_cell_id"]
            isOneToOne: false
            referencedRelation: "insurer_risk_cells"
            referencedColumns: ["id"]
          },
        ]
      }
      insurer_enrolment_batches: {
        Row: {
          acres: number
          batch_reference: string
          created_at: string
          created_by: string | null
          crop: string | null
          decided_by: string | null
          decision_note: string | null
          district: string | null
          farmer_premium_inr: number
          fpo_name: string
          id: string
          insurer_tenant_id: string
          internal_notes: string | null
          member_count: number
          policy_id: string | null
          premium_due_inr: number
          registration_number: string
          season: string
          state: Database["public"]["Enums"]["insurer_enrolment_state"]
          state_name: string | null
          submitted_at: string | null
          subsidy_premium_inr: number
          synthetic: boolean
          updated_at: string
          verification_note: string | null
          verified_at: string | null
        }
        Insert: {
          acres?: number
          batch_reference: string
          created_at?: string
          created_by?: string | null
          crop?: string | null
          decided_by?: string | null
          decision_note?: string | null
          district?: string | null
          farmer_premium_inr?: number
          fpo_name: string
          id?: string
          insurer_tenant_id: string
          internal_notes?: string | null
          member_count?: number
          policy_id?: string | null
          premium_due_inr?: number
          registration_number: string
          season?: string
          state?: Database["public"]["Enums"]["insurer_enrolment_state"]
          state_name?: string | null
          submitted_at?: string | null
          subsidy_premium_inr?: number
          synthetic?: boolean
          updated_at?: string
          verification_note?: string | null
          verified_at?: string | null
        }
        Update: {
          acres?: number
          batch_reference?: string
          created_at?: string
          created_by?: string | null
          crop?: string | null
          decided_by?: string | null
          decision_note?: string | null
          district?: string | null
          farmer_premium_inr?: number
          fpo_name?: string
          id?: string
          insurer_tenant_id?: string
          internal_notes?: string | null
          member_count?: number
          policy_id?: string | null
          premium_due_inr?: number
          registration_number?: string
          season?: string
          state?: Database["public"]["Enums"]["insurer_enrolment_state"]
          state_name?: string | null
          submitted_at?: string | null
          subsidy_premium_inr?: number
          synthetic?: boolean
          updated_at?: string
          verification_note?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insurer_enrolment_batches_insurer_tenant_id_fkey"
            columns: ["insurer_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurer_enrolment_batches_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "insurer_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      insurer_fpo_channel: {
        Row: {
          accessibility: string | null
          block_mandal: string | null
          commodity_group: string | null
          created_at: string
          cultivated_acres: number | null
          district: string | null
          fpo_name: string
          id: string
          insured_members: number
          insurer_tenant_id: string
          internal_notes: string | null
          last_reviewed: string | null
          member_count: number | null
          opportunity_score: number
          owner_name: string | null
          policies_count: number
          potential_premium_inr: number
          premium_inr: number
          primary_commodity: string | null
          registration_number: string
          registry_id: string | null
          score_drivers: Json
          state_name: string
          updated_at: string
        }
        Insert: {
          accessibility?: string | null
          block_mandal?: string | null
          commodity_group?: string | null
          created_at?: string
          cultivated_acres?: number | null
          district?: string | null
          fpo_name: string
          id?: string
          insured_members?: number
          insurer_tenant_id: string
          internal_notes?: string | null
          last_reviewed?: string | null
          member_count?: number | null
          opportunity_score?: number
          owner_name?: string | null
          policies_count?: number
          potential_premium_inr?: number
          premium_inr?: number
          primary_commodity?: string | null
          registration_number: string
          registry_id?: string | null
          score_drivers?: Json
          state_name: string
          updated_at?: string
        }
        Update: {
          accessibility?: string | null
          block_mandal?: string | null
          commodity_group?: string | null
          created_at?: string
          cultivated_acres?: number | null
          district?: string | null
          fpo_name?: string
          id?: string
          insured_members?: number
          insurer_tenant_id?: string
          internal_notes?: string | null
          last_reviewed?: string | null
          member_count?: number | null
          opportunity_score?: number
          owner_name?: string | null
          policies_count?: number
          potential_premium_inr?: number
          premium_inr?: number
          primary_commodity?: string | null
          registration_number?: string
          registry_id?: string | null
          score_drivers?: Json
          state_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurer_fpo_channel_insurer_tenant_id_fkey"
            columns: ["insurer_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurer_fpo_channel_registry_id_fkey"
            columns: ["registry_id"]
            isOneToOne: false
            referencedRelation: "fpo_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      insurer_funnel_entries: {
        Row: {
          acres: number
          created_at: string
          district: string | null
          farmer_count: number
          fpo_name: string
          id: string
          insurer_tenant_id: string
          notes: string | null
          owner_name: string | null
          premium_opportunity_inr: number
          registration_number: string
          registry_id: string | null
          stage: Database["public"]["Enums"]["insurer_funnel_stage"]
          state_name: string
          updated_at: string
        }
        Insert: {
          acres?: number
          created_at?: string
          district?: string | null
          farmer_count?: number
          fpo_name: string
          id?: string
          insurer_tenant_id: string
          notes?: string | null
          owner_name?: string | null
          premium_opportunity_inr?: number
          registration_number: string
          registry_id?: string | null
          stage?: Database["public"]["Enums"]["insurer_funnel_stage"]
          state_name: string
          updated_at?: string
        }
        Update: {
          acres?: number
          created_at?: string
          district?: string | null
          farmer_count?: number
          fpo_name?: string
          id?: string
          insurer_tenant_id?: string
          notes?: string | null
          owner_name?: string | null
          premium_opportunity_inr?: number
          registration_number?: string
          registry_id?: string | null
          stage?: Database["public"]["Enums"]["insurer_funnel_stage"]
          state_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurer_funnel_entries_insurer_tenant_id_fkey"
            columns: ["insurer_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurer_funnel_entries_registry_id_fkey"
            columns: ["registry_id"]
            isOneToOne: false
            referencedRelation: "fpo_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      insurer_market_cells: {
        Row: {
          created_at: string
          crop: string
          cultivated_acres: number
          district: string
          id: string
          insured_acres: number
          insured_farmers: number
          last_verified: string | null
          potential_farmers: number
          premium_per_acre: number
          source: string
          state_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          crop: string
          cultivated_acres?: number
          district: string
          id?: string
          insured_acres?: number
          insured_farmers?: number
          last_verified?: string | null
          potential_farmers?: number
          premium_per_acre?: number
          source?: string
          state_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          crop?: string
          cultivated_acres?: number
          district?: string
          id?: string
          insured_acres?: number
          insured_farmers?: number
          last_verified?: string | null
          potential_farmers?: number
          premium_per_acre?: number
          source?: string
          state_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      insurer_policies: {
        Row: {
          actuarial_rate_pct: number
          centre_share_pct: number
          coverage_end: string | null
          coverage_start: string | null
          created_at: string
          created_by: string | null
          crop: string | null
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          district: string | null
          enrolment_cutoff: string | null
          farmer_share_pct: number
          fpo_name: string
          gross_premium_inr: number
          id: string
          insured_acres: number
          insured_members: number
          insurer_tenant_id: string
          internal_notes: string | null
          policy_reference: string
          registration_number: string
          scheme_code: string
          scheme_name: string
          season: string
          state_name: string | null
          state_share_pct: number
          status: Database["public"]["Enums"]["insurer_policy_status"]
          sum_insured_per_acre_inr: number
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          actuarial_rate_pct?: number
          centre_share_pct?: number
          coverage_end?: string | null
          coverage_start?: string | null
          created_at?: string
          created_by?: string | null
          crop?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          district?: string | null
          enrolment_cutoff?: string | null
          farmer_share_pct?: number
          fpo_name: string
          gross_premium_inr?: number
          id?: string
          insured_acres?: number
          insured_members?: number
          insurer_tenant_id: string
          internal_notes?: string | null
          policy_reference: string
          registration_number: string
          scheme_code?: string
          scheme_name?: string
          season?: string
          state_name?: string | null
          state_share_pct?: number
          status?: Database["public"]["Enums"]["insurer_policy_status"]
          sum_insured_per_acre_inr?: number
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          actuarial_rate_pct?: number
          centre_share_pct?: number
          coverage_end?: string | null
          coverage_start?: string | null
          created_at?: string
          created_by?: string | null
          crop?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          district?: string | null
          enrolment_cutoff?: string | null
          farmer_share_pct?: number
          fpo_name?: string
          gross_premium_inr?: number
          id?: string
          insured_acres?: number
          insured_members?: number
          insurer_tenant_id?: string
          internal_notes?: string | null
          policy_reference?: string
          registration_number?: string
          scheme_code?: string
          scheme_name?: string
          season?: string
          state_name?: string | null
          state_share_pct?: number
          status?: Database["public"]["Enums"]["insurer_policy_status"]
          sum_insured_per_acre_inr?: number
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurer_policies_insurer_tenant_id_fkey"
            columns: ["insurer_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      insurer_premium_remittances: {
        Row: {
          adapter_source: string
          amount_inr: number
          batch_id: string
          created_at: string
          created_by: string | null
          id: string
          insurer_tenant_id: string
          method: string
          received_at: string | null
          reconciled_at: string | null
          reconciliation_note: string | null
          remittance_reference: string
          state: Database["public"]["Enums"]["insurer_remittance_state"]
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          adapter_source?: string
          amount_inr?: number
          batch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          insurer_tenant_id: string
          method?: string
          received_at?: string | null
          reconciled_at?: string | null
          reconciliation_note?: string | null
          remittance_reference: string
          state?: Database["public"]["Enums"]["insurer_remittance_state"]
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          adapter_source?: string
          amount_inr?: number
          batch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          insurer_tenant_id?: string
          method?: string
          received_at?: string | null
          reconciled_at?: string | null
          reconciliation_note?: string | null
          remittance_reference?: string
          state?: Database["public"]["Enums"]["insurer_remittance_state"]
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurer_premium_remittances_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "insurer_enrolment_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurer_premium_remittances_insurer_tenant_id_fkey"
            columns: ["insurer_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      insurer_risk_cells: {
        Row: {
          affected_acres: number | null
          affected_fpos: number
          created_at: string
          crop: string
          district: string
          event_type: Database["public"]["Enums"]["insurer_risk_event"]
          id: string
          observed_at: string
          rainfall_deviation_pct: number | null
          season: string
          severity: Database["public"]["Enums"]["insurer_risk_severity"]
          source: string
          state_name: string
          synthetic: boolean
          updated_at: string
        }
        Insert: {
          affected_acres?: number | null
          affected_fpos?: number
          created_at?: string
          crop: string
          district: string
          event_type: Database["public"]["Enums"]["insurer_risk_event"]
          id?: string
          observed_at: string
          rainfall_deviation_pct?: number | null
          season: string
          severity: Database["public"]["Enums"]["insurer_risk_severity"]
          source?: string
          state_name: string
          synthetic?: boolean
          updated_at?: string
        }
        Update: {
          affected_acres?: number | null
          affected_fpos?: number
          created_at?: string
          crop?: string
          district?: string
          event_type?: Database["public"]["Enums"]["insurer_risk_event"]
          id?: string
          observed_at?: string
          rainfall_deviation_pct?: number | null
          season?: string
          severity?: Database["public"]["Enums"]["insurer_risk_severity"]
          source?: string
          state_name?: string
          synthetic?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      insurer_watchlist: {
        Row: {
          created_at: string
          created_by: string | null
          crop: string
          district: string
          id: string
          insurer_tenant_id: string
          notes: string | null
          season: string
          state_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          crop: string
          district: string
          id?: string
          insurer_tenant_id: string
          notes?: string | null
          season: string
          state_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          crop?: string
          district?: string
          id?: string
          insurer_tenant_id?: string
          notes?: string | null
          season?: string
          state_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurer_watchlist_insurer_tenant_id_fkey"
            columns: ["insurer_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_contributions: {
        Row: {
          ai_grounding_enabled: boolean
          author_user_id: string
          body: string
          citations: string[]
          created_at: string
          id: string
          institution_id: string | null
          is_synthetic: boolean
          is_training_content: boolean
          language: string
          published_at: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["knowledge_status"]
          summary: string
          title: string
          topic: string
          updated_at: string
          version: number
        }
        Insert: {
          ai_grounding_enabled?: boolean
          author_user_id: string
          body?: string
          citations?: string[]
          created_at?: string
          id?: string
          institution_id?: string | null
          is_synthetic?: boolean
          is_training_content?: boolean
          language?: string
          published_at?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["knowledge_status"]
          summary?: string
          title: string
          topic?: string
          updated_at?: string
          version?: number
        }
        Update: {
          ai_grounding_enabled?: boolean
          author_user_id?: string
          body?: string
          citations?: string[]
          created_at?: string
          id?: string
          institution_id?: string | null
          is_synthetic?: boolean
          is_training_content?: boolean
          language?: string
          published_at?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["knowledge_status"]
          summary?: string
          title?: string
          topic?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_contributions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "knowledge_institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_institutions: {
        Row: {
          contact_email: string
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          geography_id: string | null
          id: string
          is_synthetic: boolean
          kind: Database["public"]["Enums"]["knowledge_kind"]
          name: string
          state: Database["public"]["Enums"]["service_provider_state"]
          tenant_id: string | null
          topics: string[]
          updated_at: string
        }
        Insert: {
          contact_email: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          geography_id?: string | null
          id?: string
          is_synthetic?: boolean
          kind: Database["public"]["Enums"]["knowledge_kind"]
          name: string
          state?: Database["public"]["Enums"]["service_provider_state"]
          tenant_id?: string | null
          topics?: string[]
          updated_at?: string
        }
        Update: {
          contact_email?: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          geography_id?: string | null
          id?: string
          is_synthetic?: boolean
          kind?: Database["public"]["Enums"]["knowledge_kind"]
          name?: string
          state?: Database["public"]["Enums"]["service_provider_state"]
          tenant_id?: string | null
          topics?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_institutions_geography_id_fkey"
            columns: ["geography_id"]
            isOneToOne: false
            referencedRelation: "geographies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_institutions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_reviews: {
        Row: {
          contribution_id: string
          created_at: string
          decision: string
          id: string
          note: string
          reviewer_user_id: string
        }
        Insert: {
          contribution_id: string
          created_at?: string
          decision: string
          id?: string
          note?: string
          reviewer_user_id: string
        }
        Update: {
          contribution_id?: string
          created_at?: string
          decision?: string
          id?: string
          note?: string
          reviewer_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_reviews_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "knowledge_contributions"
            referencedColumns: ["id"]
          },
        ]
      }
      location_context_snapshots: {
        Row: {
          agro_climatic_zone: string | null
          block_name: string | null
          centroid_lat: number | null
          centroid_lng: number | null
          created_at: string
          district_name: string | null
          farm_id: string
          geography_id: string | null
          id: string
          is_synthetic: boolean
          resolved_at: string
          season_code: string | null
          season_label: string | null
          source_key: string
          state_name: string | null
          subject_user_id: string
          village_code: string | null
          village_name: string | null
        }
        Insert: {
          agro_climatic_zone?: string | null
          block_name?: string | null
          centroid_lat?: number | null
          centroid_lng?: number | null
          created_at?: string
          district_name?: string | null
          farm_id: string
          geography_id?: string | null
          id?: string
          is_synthetic?: boolean
          resolved_at?: string
          season_code?: string | null
          season_label?: string | null
          source_key?: string
          state_name?: string | null
          subject_user_id: string
          village_code?: string | null
          village_name?: string | null
        }
        Update: {
          agro_climatic_zone?: string | null
          block_name?: string | null
          centroid_lat?: number | null
          centroid_lng?: number | null
          created_at?: string
          district_name?: string | null
          farm_id?: string
          geography_id?: string | null
          id?: string
          is_synthetic?: boolean
          resolved_at?: string
          season_code?: string | null
          season_label?: string | null
          source_key?: string
          state_name?: string | null
          subject_user_id?: string
          village_code?: string | null
          village_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_context_snapshots_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farm_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_context_snapshots_geography_id_fkey"
            columns: ["geography_id"]
            isOneToOne: false
            referencedRelation: "geographies"
            referencedColumns: ["id"]
          },
        ]
      }
      market_price_observations: {
        Row: {
          adapter_name: string
          arrivals_quantity: number | null
          arrivals_unit: string | null
          commodity: string
          created_at: string
          district_name: string | null
          grade: string | null
          id: string
          is_synthetic: boolean
          label: Database["public"]["Enums"]["price_label"]
          latitude: number | null
          longitude: number | null
          market_code: string | null
          market_name: string
          max_price: number | null
          min_price: number | null
          modal_price: number | null
          price_date: string
          source_key: string
          state_name: string | null
          unit: string
          variety: string | null
        }
        Insert: {
          adapter_name: string
          arrivals_quantity?: number | null
          arrivals_unit?: string | null
          commodity: string
          created_at?: string
          district_name?: string | null
          grade?: string | null
          id?: string
          is_synthetic?: boolean
          label?: Database["public"]["Enums"]["price_label"]
          latitude?: number | null
          longitude?: number | null
          market_code?: string | null
          market_name: string
          max_price?: number | null
          min_price?: number | null
          modal_price?: number | null
          price_date: string
          source_key: string
          state_name?: string | null
          unit?: string
          variety?: string | null
        }
        Update: {
          adapter_name?: string
          arrivals_quantity?: number | null
          arrivals_unit?: string | null
          commodity?: string
          created_at?: string
          district_name?: string | null
          grade?: string | null
          id?: string
          is_synthetic?: boolean
          label?: Database["public"]["Enums"]["price_label"]
          latitude?: number | null
          longitude?: number | null
          market_code?: string | null
          market_name?: string
          max_price?: number | null
          min_price?: number | null
          modal_price?: number | null
          price_date?: string
          source_key?: string
          state_name?: string | null
          unit?: string
          variety?: string | null
        }
        Relationships: []
      }
      marketplace_disputes: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          evidence: Json
          id: string
          is_synthetic: boolean
          order_id: string
          raised_by: string | null
          resolution_note: string | null
          status: Database["public"]["Enums"]["dispute_status"]
          summary: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          evidence?: Json
          id?: string
          is_synthetic?: boolean
          order_id: string
          raised_by?: string | null
          resolution_note?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          summary: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          evidence?: Json
          id?: string
          is_synthetic?: boolean
          order_id?: string
          raised_by?: string | null
          resolution_note?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_listings: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string
          geography_id: string | null
          id: string
          is_sponsored: boolean
          is_synthetic: boolean
          min_order_qty: number | null
          price_max: number | null
          price_min: number | null
          published_at: string | null
          quality: Json
          quality_score: number
          region_code: string | null
          review_note: string | null
          seller_profile_id: string
          sponsored_slot: string | null
          status: Database["public"]["Enums"]["listing_status"]
          title: string
          unit: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          description?: string
          geography_id?: string | null
          id?: string
          is_sponsored?: boolean
          is_synthetic?: boolean
          min_order_qty?: number | null
          price_max?: number | null
          price_min?: number | null
          published_at?: string | null
          quality?: Json
          quality_score?: number
          region_code?: string | null
          review_note?: string | null
          seller_profile_id: string
          sponsored_slot?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          title: string
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          geography_id?: string | null
          id?: string
          is_sponsored?: boolean
          is_synthetic?: boolean
          min_order_qty?: number | null
          price_max?: number | null
          price_min?: number | null
          published_at?: string | null
          quality?: Json
          quality_score?: number
          region_code?: string | null
          review_note?: string | null
          seller_profile_id?: string
          sponsored_slot?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          title?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listings_geography_id_fkey"
            columns: ["geography_id"]
            isOneToOne: false
            referencedRelation: "geographies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_listings_seller_profile_id_fkey"
            columns: ["seller_profile_id"]
            isOneToOne: false
            referencedRelation: "marketplace_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_orders: {
        Row: {
          agreed_price: number | null
          buyer_profile_id: string
          buyer_user_id: string | null
          created_at: string
          id: string
          is_synthetic: boolean
          quantity: number
          quote_id: string | null
          rfq_id: string | null
          seller_profile_id: string
          seller_user_id: string | null
          status: Database["public"]["Enums"]["market_order_status"]
          status_note: string | null
          terms: Json
          unit: string
          updated_at: string
        }
        Insert: {
          agreed_price?: number | null
          buyer_profile_id: string
          buyer_user_id?: string | null
          created_at?: string
          id?: string
          is_synthetic?: boolean
          quantity: number
          quote_id?: string | null
          rfq_id?: string | null
          seller_profile_id: string
          seller_user_id?: string | null
          status?: Database["public"]["Enums"]["market_order_status"]
          status_note?: string | null
          terms?: Json
          unit?: string
          updated_at?: string
        }
        Update: {
          agreed_price?: number | null
          buyer_profile_id?: string
          buyer_user_id?: string | null
          created_at?: string
          id?: string
          is_synthetic?: boolean
          quantity?: number
          quote_id?: string | null
          rfq_id?: string | null
          seller_profile_id?: string
          seller_user_id?: string | null
          status?: Database["public"]["Enums"]["market_order_status"]
          status_note?: string | null
          terms?: Json
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_orders_buyer_profile_id_fkey"
            columns: ["buyer_profile_id"]
            isOneToOne: false
            referencedRelation: "marketplace_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "marketplace_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_orders_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "marketplace_rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_orders_seller_profile_id_fkey"
            columns: ["seller_profile_id"]
            isOneToOne: false
            referencedRelation: "marketplace_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_profiles: {
        Row: {
          categories: string[]
          contact_email: string
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          display_name: string
          id: string
          is_synthetic: boolean
          organization_id: string | null
          party_kind: Database["public"]["Enums"]["market_party_kind"]
          profile_data: Json
          regions: string[]
          side: Database["public"]["Enums"]["market_side"]
          state: Database["public"]["Enums"]["market_profile_state"]
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          categories?: string[]
          contact_email?: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          display_name: string
          id?: string
          is_synthetic?: boolean
          organization_id?: string | null
          party_kind: Database["public"]["Enums"]["market_party_kind"]
          profile_data?: Json
          regions?: string[]
          side: Database["public"]["Enums"]["market_side"]
          state?: Database["public"]["Enums"]["market_profile_state"]
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          categories?: string[]
          contact_email?: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          display_name?: string
          id?: string
          is_synthetic?: boolean
          organization_id?: string | null
          party_kind?: Database["public"]["Enums"]["market_party_kind"]
          profile_data?: Json
          regions?: string[]
          side?: Database["public"]["Enums"]["market_side"]
          state?: Database["public"]["Enums"]["market_profile_state"]
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_quotes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_synthetic: boolean
          listing_id: string | null
          note: string
          price: number
          rfq_id: string
          seller_profile_id: string
          status: string
          unit: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_synthetic?: boolean
          listing_id?: string | null
          note?: string
          price: number
          rfq_id: string
          seller_profile_id: string
          status?: string
          unit?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_synthetic?: boolean
          listing_id?: string | null
          note?: string
          price?: number
          rfq_id?: string
          seller_profile_id?: string
          status?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_quotes_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_quotes_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "marketplace_rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_quotes_seller_profile_id_fkey"
            columns: ["seller_profile_id"]
            isOneToOne: false
            referencedRelation: "marketplace_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_rfqs: {
        Row: {
          aggregating_tenant_id: string | null
          aggregation_authority_ref: string | null
          buyer_profile_id: string
          category: string
          created_at: string
          created_by: string | null
          delivery_region: string | null
          id: string
          is_aggregated: boolean
          is_synthetic: boolean
          needed_by: string | null
          notes: string
          quantity: number
          status: Database["public"]["Enums"]["rfq_status"]
          title: string
          unit: string
          updated_at: string
        }
        Insert: {
          aggregating_tenant_id?: string | null
          aggregation_authority_ref?: string | null
          buyer_profile_id: string
          category: string
          created_at?: string
          created_by?: string | null
          delivery_region?: string | null
          id?: string
          is_aggregated?: boolean
          is_synthetic?: boolean
          needed_by?: string | null
          notes?: string
          quantity: number
          status?: Database["public"]["Enums"]["rfq_status"]
          title: string
          unit?: string
          updated_at?: string
        }
        Update: {
          aggregating_tenant_id?: string | null
          aggregation_authority_ref?: string | null
          buyer_profile_id?: string
          category?: string
          created_at?: string
          created_by?: string | null
          delivery_region?: string | null
          id?: string
          is_aggregated?: boolean
          is_synthetic?: boolean
          needed_by?: string | null
          notes?: string
          quantity?: number
          status?: Database["public"]["Enums"]["rfq_status"]
          title?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_rfqs_aggregating_tenant_id_fkey"
            columns: ["aggregating_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_rfqs_buyer_profile_id_fkey"
            columns: ["buyer_profile_id"]
            isOneToOne: false
            referencedRelation: "marketplace_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_import_batches: {
        Row: {
          accepted_count: number
          created_at: string
          errors: Json
          id: string
          is_synthetic: boolean
          rejected_count: number
          row_count: number
          source_label: string
          tenant_id: string
          uploaded_by: string
        }
        Insert: {
          accepted_count?: number
          created_at?: string
          errors?: Json
          id?: string
          is_synthetic?: boolean
          rejected_count?: number
          row_count?: number
          source_label: string
          tenant_id: string
          uploaded_by: string
        }
        Update: {
          accepted_count?: number
          created_at?: string
          errors?: Json
          id?: string
          is_synthetic?: boolean
          rejected_count?: number
          row_count?: number
          source_label?: string
          tenant_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_import_batches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      nearby_service_facilities: {
        Row: {
          contact_label: string | null
          created_at: string
          district_name: string | null
          geography_id: string | null
          id: string
          is_synthetic: boolean
          kind: Database["public"]["Enums"]["facility_kind"]
          latitude: number
          longitude: number
          name: string
          organization_id: string | null
          soil_lab_kind: Database["public"]["Enums"]["soil_lab_kind"] | null
          source_key: string
          state_name: string | null
          tenant_id: string | null
        }
        Insert: {
          contact_label?: string | null
          created_at?: string
          district_name?: string | null
          geography_id?: string | null
          id?: string
          is_synthetic?: boolean
          kind: Database["public"]["Enums"]["facility_kind"]
          latitude: number
          longitude: number
          name: string
          organization_id?: string | null
          soil_lab_kind?: Database["public"]["Enums"]["soil_lab_kind"] | null
          source_key: string
          state_name?: string | null
          tenant_id?: string | null
        }
        Update: {
          contact_label?: string | null
          created_at?: string
          district_name?: string | null
          geography_id?: string | null
          id?: string
          is_synthetic?: boolean
          kind?: Database["public"]["Enums"]["facility_kind"]
          latitude?: number
          longitude?: number
          name?: string
          organization_id?: string | null
          soil_lab_kind?: Database["public"]["Enums"]["soil_lab_kind"] | null
          source_key?: string
          state_name?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nearby_service_facilities_geography_id_fkey"
            columns: ["geography_id"]
            isOneToOne: false
            referencedRelation: "geographies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nearby_service_facilities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nearby_service_facilities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrient_recommendations: {
        Row: {
          created_at: string
          crop: string
          dose_per_hectare: number
          growth_stage: string
          id: string
          is_synthetic: boolean
          notes: string | null
          nutrient: string
          product_code: string
          soil_type: string | null
          unit: string
        }
        Insert: {
          created_at?: string
          crop: string
          dose_per_hectare: number
          growth_stage: string
          id?: string
          is_synthetic?: boolean
          notes?: string | null
          nutrient: string
          product_code: string
          soil_type?: string | null
          unit?: string
        }
        Update: {
          created_at?: string
          crop?: string
          dose_per_hectare?: number
          growth_stage?: string
          id?: string
          is_synthetic?: boolean
          notes?: string | null
          nutrient?: string
          product_code?: string
          soil_type?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrient_recommendations_product_code_fkey"
            columns: ["product_code"]
            isOneToOne: false
            referencedRelation: "input_products"
            referencedColumns: ["code"]
          },
        ]
      }
      onboarding_applications: {
        Row: {
          applicant_user_id: string
          assisted_by_user_id: string | null
          channel: Database["public"]["Enums"]["onboarding_channel"]
          created_at: string
          current_step_key: string | null
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          form_data: Json
          geography_id: string | null
          id: string
          is_synthetic: boolean
          role_code: string
          status: Database["public"]["Enums"]["onboarding_status"]
          submitted_at: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          applicant_user_id: string
          assisted_by_user_id?: string | null
          channel?: Database["public"]["Enums"]["onboarding_channel"]
          created_at?: string
          current_step_key?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          form_data?: Json
          geography_id?: string | null
          id?: string
          is_synthetic?: boolean
          role_code: string
          status?: Database["public"]["Enums"]["onboarding_status"]
          submitted_at?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          applicant_user_id?: string
          assisted_by_user_id?: string | null
          channel?: Database["public"]["Enums"]["onboarding_channel"]
          created_at?: string
          current_step_key?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          form_data?: Json
          geography_id?: string | null
          id?: string
          is_synthetic?: boolean
          role_code?: string
          status?: Database["public"]["Enums"]["onboarding_status"]
          submitted_at?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_applications_geography_id_fkey"
            columns: ["geography_id"]
            isOneToOne: false
            referencedRelation: "geographies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_applications_role_code_fkey"
            columns: ["role_code"]
            isOneToOne: false
            referencedRelation: "role_definitions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "onboarding_applications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_effort_metrics: {
        Row: {
          clone_id: string | null
          cost_amount: number
          created_at: string
          currency: string
          id: string
          is_operational: boolean
          is_synthetic: boolean
          notes: string
          onboarded_count: number
          person_days: number
          phase: string
          recorded_by: string | null
          rollout_id: string
        }
        Insert: {
          clone_id?: string | null
          cost_amount?: number
          created_at?: string
          currency?: string
          id?: string
          is_operational?: boolean
          is_synthetic?: boolean
          notes?: string
          onboarded_count?: number
          person_days?: number
          phase: string
          recorded_by?: string | null
          rollout_id: string
        }
        Update: {
          clone_id?: string | null
          cost_amount?: number
          created_at?: string
          currency?: string
          id?: string
          is_operational?: boolean
          is_synthetic?: boolean
          notes?: string
          onboarded_count?: number
          person_days?: number
          phase?: string
          recorded_by?: string | null
          rollout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_effort_metrics_clone_id_fkey"
            columns: ["clone_id"]
            isOneToOne: false
            referencedRelation: "district_template_clones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_effort_metrics_rollout_id_fkey"
            columns: ["rollout_id"]
            isOneToOne: false
            referencedRelation: "district_rollouts"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_funnel_events: {
        Row: {
          actor_user_id: string | null
          application_id: string | null
          channel: Database["public"]["Enums"]["onboarding_channel"]
          created_at: string
          event_code: string
          id: string
          metadata: Json
          role_code: string | null
          subject_user_id: string
        }
        Insert: {
          actor_user_id?: string | null
          application_id?: string | null
          channel?: Database["public"]["Enums"]["onboarding_channel"]
          created_at?: string
          event_code: string
          id?: string
          metadata?: Json
          role_code?: string | null
          subject_user_id: string
        }
        Update: {
          actor_user_id?: string | null
          application_id?: string | null
          channel?: Database["public"]["Enums"]["onboarding_channel"]
          created_at?: string
          event_code?: string
          id?: string
          metadata?: Json
          role_code?: string | null
          subject_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_funnel_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "onboarding_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_funnel_events_role_code_fkey"
            columns: ["role_code"]
            isOneToOne: false
            referencedRelation: "role_definitions"
            referencedColumns: ["code"]
          },
        ]
      }
      onboarding_step_definitions: {
        Row: {
          evidence_required: Json
          fields: Json
          help_text: string | null
          id: string
          is_required: boolean
          label: string
          role_code: string
          sort_order: number
          step_key: string
          updated_at: string
        }
        Insert: {
          evidence_required?: Json
          fields?: Json
          help_text?: string | null
          id?: string
          is_required?: boolean
          label: string
          role_code: string
          sort_order?: number
          step_key: string
          updated_at?: string
        }
        Update: {
          evidence_required?: Json
          fields?: Json
          help_text?: string | null
          id?: string
          is_required?: boolean
          label?: string
          role_code?: string
          sort_order?: number
          step_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_step_definitions_role_code_fkey"
            columns: ["role_code"]
            isOneToOne: false
            referencedRelation: "role_definitions"
            referencedColumns: ["code"]
          },
        ]
      }
      onboarding_step_progress: {
        Row: {
          application_id: string
          data: Json
          id: string
          status: Database["public"]["Enums"]["step_status"]
          step_key: string
          updated_at: string
        }
        Insert: {
          application_id: string
          data?: Json
          id?: string
          status?: Database["public"]["Enums"]["step_status"]
          step_key: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          data?: Json
          id?: string
          status?: Database["public"]["Enums"]["step_status"]
          step_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_step_progress_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "onboarding_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_workflows: {
        Row: {
          created_at: string
          created_by: string | null
          current_state: string
          id: string
          is_synthetic: boolean
          state_history: Json
          status: Database["public"]["Enums"]["workflow_status"]
          subject_id: string
          subject_type: string
          tenant_id: string | null
          updated_at: string
          workflow_key: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_state: string
          id?: string
          is_synthetic?: boolean
          state_history?: Json
          status?: Database["public"]["Enums"]["workflow_status"]
          subject_id: string
          subject_type: string
          tenant_id?: string | null
          updated_at?: string
          workflow_key: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_state?: string
          id?: string
          is_synthetic?: boolean
          state_history?: Json
          status?: Database["public"]["Enums"]["workflow_status"]
          subject_id?: string
          subject_type?: string
          tenant_id?: string | null
          updated_at?: string
          workflow_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_workflows_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_subtypes: {
        Row: {
          code: string
          description: string
          evidence_required: Json
          is_active: boolean
          label: string
          requires_approval: boolean
          sort_order: number
          tenant_type: Database["public"]["Enums"]["tenant_type"]
          updated_at: string
        }
        Insert: {
          code: string
          description?: string
          evidence_required?: Json
          is_active?: boolean
          label: string
          requires_approval?: boolean
          sort_order?: number
          tenant_type: Database["public"]["Enums"]["tenant_type"]
          updated_at?: string
        }
        Update: {
          code?: string
          description?: string
          evidence_required?: Json
          is_active?: boolean
          label?: string
          requires_approval?: boolean
          sort_order?: number
          tenant_type?: Database["public"]["Enums"]["tenant_type"]
          updated_at?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          display_name: string
          geography_id: string | null
          id: string
          is_synthetic: boolean
          legal_name: string
          metadata: Json
          region_code: string | null
          registration_number: string | null
          status: Database["public"]["Enums"]["org_status"]
          subtype_code: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          display_name: string
          geography_id?: string | null
          id?: string
          is_synthetic?: boolean
          legal_name: string
          metadata?: Json
          region_code?: string | null
          registration_number?: string | null
          status?: Database["public"]["Enums"]["org_status"]
          subtype_code: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          display_name?: string
          geography_id?: string | null
          id?: string
          is_synthetic?: boolean
          legal_name?: string
          metadata?: Json
          region_code?: string | null
          registration_number?: string | null
          status?: Database["public"]["Enums"]["org_status"]
          subtype_code?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_geography_id_fkey"
            columns: ["geography_id"]
            isOneToOne: false
            referencedRelation: "geographies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_subtype_code_fkey"
            columns: ["subtype_code"]
            isOneToOne: false
            referencedRelation: "organization_subtypes"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "organizations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_api_calls: {
        Row: {
          app_id: string
          created_at: string
          deny_reason: string | null
          endpoint: string
          environment: Database["public"]["Enums"]["partner_env"]
          id: string
          is_first_party: boolean
          latency_ms: number
          outcome: string
          purpose_code: string | null
          registration_id: string
          status_code: number
          subject_user_id: string | null
          tier: Database["public"]["Enums"]["consumer_tier"]
        }
        Insert: {
          app_id: string
          created_at?: string
          deny_reason?: string | null
          endpoint: string
          environment: Database["public"]["Enums"]["partner_env"]
          id?: string
          is_first_party?: boolean
          latency_ms?: number
          outcome: string
          purpose_code?: string | null
          registration_id: string
          status_code?: number
          subject_user_id?: string | null
          tier?: Database["public"]["Enums"]["consumer_tier"]
        }
        Update: {
          app_id?: string
          created_at?: string
          deny_reason?: string | null
          endpoint?: string
          environment?: Database["public"]["Enums"]["partner_env"]
          id?: string
          is_first_party?: boolean
          latency_ms?: number
          outcome?: string
          purpose_code?: string | null
          registration_id?: string
          status_code?: number
          subject_user_id?: string | null
          tier?: Database["public"]["Enums"]["consumer_tier"]
        }
        Relationships: [
          {
            foreignKeyName: "partner_api_calls_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "partner_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_api_calls_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "partner_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_apps: {
        Row: {
          consumer_id: string | null
          created_at: string
          created_by: string | null
          environment: Database["public"]["Enums"]["partner_env"]
          id: string
          name: string
          rate_limit_per_min: number
          redirect_uris: string[]
          registration_id: string
          scopes: string[]
          status: string
          tier: Database["public"]["Enums"]["consumer_tier"]
          updated_at: string
        }
        Insert: {
          consumer_id?: string | null
          created_at?: string
          created_by?: string | null
          environment?: Database["public"]["Enums"]["partner_env"]
          id?: string
          name: string
          rate_limit_per_min?: number
          redirect_uris?: string[]
          registration_id: string
          scopes?: string[]
          status?: string
          tier?: Database["public"]["Enums"]["consumer_tier"]
          updated_at?: string
        }
        Update: {
          consumer_id?: string | null
          created_at?: string
          created_by?: string | null
          environment?: Database["public"]["Enums"]["partner_env"]
          id?: string
          name?: string
          rate_limit_per_min?: number
          redirect_uris?: string[]
          registration_id?: string
          scopes?: string[]
          status?: string
          tier?: Database["public"]["Enums"]["consumer_tier"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_apps_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "api_consumers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_apps_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "partner_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_certifications: {
        Row: {
          badge_awarded_at: string | null
          badge_expires_at: string | null
          created_at: string
          created_by: string | null
          criteria: Json
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          is_synthetic: boolean
          programme_code: string
          state: Database["public"]["Enums"]["certification_state"]
          subject_id: string
          subject_type: string
          updated_at: string
        }
        Insert: {
          badge_awarded_at?: string | null
          badge_expires_at?: string | null
          created_at?: string
          created_by?: string | null
          criteria?: Json
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          is_synthetic?: boolean
          programme_code: string
          state?: Database["public"]["Enums"]["certification_state"]
          subject_id: string
          subject_type: string
          updated_at?: string
        }
        Update: {
          badge_awarded_at?: string | null
          badge_expires_at?: string | null
          created_at?: string
          created_by?: string | null
          criteria?: Json
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          is_synthetic?: boolean
          programme_code?: string
          state?: Database["public"]["Enums"]["certification_state"]
          subject_id?: string
          subject_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      partner_credentials: {
        Row: {
          app_id: string
          client_id: string
          environment: Database["public"]["Enums"]["partner_env"]
          id: string
          issued_at: string
          issued_by: string | null
          revoked_at: string | null
          scopes: string[]
          secret_hash: string
          secret_prefix: string
          status: string
        }
        Insert: {
          app_id: string
          client_id: string
          environment: Database["public"]["Enums"]["partner_env"]
          id?: string
          issued_at?: string
          issued_by?: string | null
          revoked_at?: string | null
          scopes?: string[]
          secret_hash: string
          secret_prefix: string
          status?: string
        }
        Update: {
          app_id?: string
          client_id?: string
          environment?: Database["public"]["Enums"]["partner_env"]
          id?: string
          issued_at?: string
          issued_by?: string | null
          revoked_at?: string | null
          scopes?: string[]
          secret_hash?: string
          secret_prefix?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_credentials_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "partner_apps"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_production_requests: {
        Row: {
          app_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          justification: string
          registration_id: string
          requested_by: string | null
          requested_scopes: string[]
          requested_tier: Database["public"]["Enums"]["consumer_tier"]
          status: Database["public"]["Enums"]["gate_status"]
          updated_at: string
        }
        Insert: {
          app_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          justification?: string
          registration_id: string
          requested_by?: string | null
          requested_scopes?: string[]
          requested_tier?: Database["public"]["Enums"]["consumer_tier"]
          status?: Database["public"]["Enums"]["gate_status"]
          updated_at?: string
        }
        Update: {
          app_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          justification?: string
          registration_id?: string
          requested_by?: string | null
          requested_scopes?: string[]
          requested_tier?: Database["public"]["Enums"]["consumer_tier"]
          status?: Database["public"]["Enums"]["gate_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_production_requests_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "partner_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_production_requests_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "partner_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_registrations: {
        Row: {
          contact_email: string
          created_at: string
          created_by: string | null
          display_name: string
          id: string
          intended_use: string
          is_synthetic: boolean
          legal_decided_at: string | null
          legal_decided_by: string | null
          legal_note: string | null
          legal_status: Database["public"]["Enums"]["gate_status"]
          organization_id: string | null
          partner_kind: Database["public"]["Enums"]["partner_kind"]
          requested_purposes: string[]
          sandbox_tenant_id: string | null
          security_decided_at: string | null
          security_decided_by: string | null
          security_note: string | null
          security_status: Database["public"]["Enums"]["gate_status"]
          state: Database["public"]["Enums"]["partner_reg_state"]
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          contact_email: string
          created_at?: string
          created_by?: string | null
          display_name: string
          id?: string
          intended_use?: string
          is_synthetic?: boolean
          legal_decided_at?: string | null
          legal_decided_by?: string | null
          legal_note?: string | null
          legal_status?: Database["public"]["Enums"]["gate_status"]
          organization_id?: string | null
          partner_kind: Database["public"]["Enums"]["partner_kind"]
          requested_purposes?: string[]
          sandbox_tenant_id?: string | null
          security_decided_at?: string | null
          security_decided_by?: string | null
          security_note?: string | null
          security_status?: Database["public"]["Enums"]["gate_status"]
          state?: Database["public"]["Enums"]["partner_reg_state"]
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          contact_email?: string
          created_at?: string
          created_by?: string | null
          display_name?: string
          id?: string
          intended_use?: string
          is_synthetic?: boolean
          legal_decided_at?: string | null
          legal_decided_by?: string | null
          legal_note?: string | null
          legal_status?: Database["public"]["Enums"]["gate_status"]
          organization_id?: string | null
          partner_kind?: Database["public"]["Enums"]["partner_kind"]
          requested_purposes?: string[]
          sandbox_tenant_id?: string | null
          security_decided_at?: string | null
          security_decided_by?: string | null
          security_note?: string | null
          security_status?: Database["public"]["Enums"]["gate_status"]
          state?: Database["public"]["Enums"]["partner_reg_state"]
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_registrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_registrations_sandbox_tenant_id_fkey"
            columns: ["sandbox_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_registrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_webhooks: {
        Row: {
          app_id: string
          created_at: string
          created_by: string | null
          environment: Database["public"]["Enums"]["partner_env"]
          event_types: string[]
          id: string
          is_active: boolean
          secret_hash: string
          secret_prefix: string
          target_url: string
          updated_at: string
        }
        Insert: {
          app_id: string
          created_at?: string
          created_by?: string | null
          environment?: Database["public"]["Enums"]["partner_env"]
          event_types?: string[]
          id?: string
          is_active?: boolean
          secret_hash?: string
          secret_prefix?: string
          target_url: string
          updated_at?: string
        }
        Update: {
          app_id?: string
          created_at?: string
          created_by?: string | null
          environment?: Database["public"]["Enums"]["partner_env"]
          event_types?: string[]
          id?: string
          is_active?: boolean
          secret_hash?: string
          secret_prefix?: string
          target_url?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_webhooks_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "partner_apps"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_workflow_cases: {
        Row: {
          app_id: string
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          environment: Database["public"]["Enums"]["partner_env"]
          evidence: Json
          id: string
          kind: Database["public"]["Enums"]["partner_case_kind"]
          payload: Json
          purpose_code: string | null
          registration_id: string
          requires_human_decision: boolean
          signals: Json
          status: Database["public"]["Enums"]["partner_case_status"]
          subject_user_id: string | null
          updated_at: string
        }
        Insert: {
          app_id: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          environment?: Database["public"]["Enums"]["partner_env"]
          evidence?: Json
          id?: string
          kind: Database["public"]["Enums"]["partner_case_kind"]
          payload?: Json
          purpose_code?: string | null
          registration_id: string
          requires_human_decision?: boolean
          signals?: Json
          status?: Database["public"]["Enums"]["partner_case_status"]
          subject_user_id?: string | null
          updated_at?: string
        }
        Update: {
          app_id?: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          environment?: Database["public"]["Enums"]["partner_env"]
          evidence?: Json
          id?: string
          kind?: Database["public"]["Enums"]["partner_case_kind"]
          payload?: Json
          purpose_code?: string | null
          registration_id?: string
          requires_human_decision?: boolean
          signals?: Json
          status?: Database["public"]["Enums"]["partner_case_status"]
          subject_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_workflow_cases_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "partner_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_workflow_cases_purpose_code_fkey"
            columns: ["purpose_code"]
            isOneToOne: false
            referencedRelation: "data_purposes"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "partner_workflow_cases_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "partner_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_config: {
        Row: {
          config_key: string
          config_value: Json
          description: string | null
          id: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          config_key: string
          config_value: Json
          description?: string | null
          id?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          config_key?: string
          config_value?: Json
          description?: string | null
          id?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_metric_snapshots: {
        Row: {
          cohort_size: number
          created_at: string
          geography_id: string | null
          id: string
          is_deidentified: boolean
          is_synthetic: boolean
          metric_code: string
          period: string
          tenant_id: string | null
          value: number
        }
        Insert: {
          cohort_size?: number
          created_at?: string
          geography_id?: string | null
          id?: string
          is_deidentified?: boolean
          is_synthetic?: boolean
          metric_code: string
          period: string
          tenant_id?: string | null
          value?: number
        }
        Update: {
          cohort_size?: number
          created_at?: string
          geography_id?: string | null
          id?: string
          is_deidentified?: boolean
          is_synthetic?: boolean
          metric_code?: string
          period?: string
          tenant_id?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "policy_metric_snapshots_geography_id_fkey"
            columns: ["geography_id"]
            isOneToOne: false
            referencedRelation: "geographies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_metric_snapshots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      postharvest_providers: {
        Row: {
          contact_email: string
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          display_name: string
          geography_id: string | null
          id: string
          is_synthetic: boolean
          kind: Database["public"]["Enums"]["postharvest_kind"]
          service_regions: string[]
          state: Database["public"]["Enums"]["service_provider_state"]
          subtype_code: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          contact_email: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          display_name: string
          geography_id?: string | null
          id?: string
          is_synthetic?: boolean
          kind: Database["public"]["Enums"]["postharvest_kind"]
          service_regions?: string[]
          state?: Database["public"]["Enums"]["service_provider_state"]
          subtype_code?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          contact_email?: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          display_name?: string
          geography_id?: string | null
          id?: string
          is_synthetic?: boolean
          kind?: Database["public"]["Enums"]["postharvest_kind"]
          service_regions?: string[]
          state?: Database["public"]["Enums"]["service_provider_state"]
          subtype_code?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "postharvest_providers_geography_id_fkey"
            columns: ["geography_id"]
            isOneToOne: false
            referencedRelation: "geographies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "postharvest_providers_subtype_code_fkey"
            columns: ["subtype_code"]
            isOneToOne: false
            referencedRelation: "service_subtypes"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "postharvest_providers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_lessons: {
        Row: {
          body: string
          created_at: string
          do_notes: string[]
          dont_notes: string[]
          id: string
          lesson_key: string
          module_id: string
          sort_order: number
          title: string
        }
        Insert: {
          body?: string
          created_at?: string
          do_notes?: string[]
          dont_notes?: string[]
          id?: string
          lesson_key: string
          module_id: string
          sort_order?: number
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          do_notes?: string[]
          dont_notes?: string[]
          id?: string
          lesson_key?: string
          module_id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "practice_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_modules: {
        Row: {
          code: string
          created_at: string
          crop_tags: string[]
          id: string
          is_synthetic: boolean
          published: boolean
          season_codes: string[]
          sort_order: number
          source_attribution: string | null
          stage: string
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          crop_tags?: string[]
          id?: string
          is_synthetic?: boolean
          published?: boolean
          season_codes?: string[]
          sort_order?: number
          source_attribution?: string | null
          stage: string
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          crop_tags?: string[]
          id?: string
          is_synthetic?: boolean
          published?: boolean
          season_codes?: string[]
          sort_order?: number
          source_attribution?: string | null
          stage?: string
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      practice_progress: {
        Row: {
          completed_at: string
          id: string
          lesson_key: string
          module_id: string
          subject_user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          lesson_key: string
          module_id: string
          subject_user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          lesson_key?: string
          module_id?: string
          subject_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_progress_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "practice_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      privileged_access_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          expires_at: string | null
          id: string
          justification: string
          mfa_provider: string | null
          mfa_verified: boolean
          requested_role: Database["public"]["Enums"]["app_role"]
          requester_user_id: string
          status: Database["public"]["Enums"]["privilege_request_status"]
          tenant_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          justification: string
          mfa_provider?: string | null
          mfa_verified?: boolean
          requested_role: Database["public"]["Enums"]["app_role"]
          requester_user_id: string
          status?: Database["public"]["Enums"]["privilege_request_status"]
          tenant_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          justification?: string
          mfa_provider?: string | null
          mfa_verified?: boolean
          requested_role?: Database["public"]["Enums"]["app_role"]
          requester_user_id?: string
          status?: Database["public"]["Enums"]["privilege_request_status"]
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "privileged_access_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_path_definitions: {
        Row: {
          assumption_source: string
          code: string
          commodity: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          is_synthetic: boolean
          label: string
          notes: string | null
          organization_id: string | null
          owner_scope: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          assumption_source?: string
          code: string
          commodity: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_synthetic?: boolean
          label: string
          notes?: string | null
          organization_id?: string | null
          owner_scope?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          assumption_source?: string
          code?: string
          commodity?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_synthetic?: boolean
          label?: string
          notes?: string | null
          organization_id?: string | null
          owner_scope?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "processing_path_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_path_definitions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_path_steps: {
        Row: {
          assumption_note: string | null
          byproducts: Json
          cost_breakdown: Json
          cost_per_quintal: number
          created_at: string
          from_product: string
          id: string
          path_id: string
          recovery_pct: number
          step_order: number
          to_product: string
        }
        Insert: {
          assumption_note?: string | null
          byproducts?: Json
          cost_breakdown?: Json
          cost_per_quintal?: number
          created_at?: string
          from_product: string
          id?: string
          path_id: string
          recovery_pct: number
          step_order: number
          to_product: string
        }
        Update: {
          assumption_note?: string | null
          byproducts?: Json
          cost_breakdown?: Json
          cost_per_quintal?: number
          created_at?: string
          from_product?: string
          id?: string
          path_id?: string
          recovery_pct?: number
          step_order?: number
          to_product?: string
        }
        Relationships: [
          {
            foreignKeyName: "processing_path_steps_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "processing_path_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      processor_contracts: {
        Row: {
          commodity: string
          counterparty_profile_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          delivery_window: string
          id: string
          is_synthetic: boolean
          price_per_tonne: number
          provider_id: string
          quantity_tonnes: number
          requires_human_decision: boolean
          status: Database["public"]["Enums"]["contract_status"]
          terms: Json
          updated_at: string
        }
        Insert: {
          commodity: string
          counterparty_profile_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          delivery_window?: string
          id?: string
          is_synthetic?: boolean
          price_per_tonne: number
          provider_id: string
          quantity_tonnes: number
          requires_human_decision?: boolean
          status?: Database["public"]["Enums"]["contract_status"]
          terms?: Json
          updated_at?: string
        }
        Update: {
          commodity?: string
          counterparty_profile_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          delivery_window?: string
          id?: string
          is_synthetic?: boolean
          price_per_tonne?: number
          provider_id?: string
          quantity_tonnes?: number
          requires_human_decision?: boolean
          status?: Database["public"]["Enums"]["contract_status"]
          terms?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "processor_contracts_counterparty_profile_id_fkey"
            columns: ["counterparty_profile_id"]
            isOneToOne: false
            referencedRelation: "marketplace_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processor_contracts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "postharvest_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          locale: string
          phone: string | null
          preferred_locale: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          locale?: string
          phone?: string | null
          preferred_locale?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          locale?: string
          phone?: string | null
          preferred_locale?: string
          updated_at?: string
        }
        Relationships: []
      }
      research_exports: {
        Row: {
          aggregation_min_applied: number
          allowed: boolean
          cohort_size: number
          created_at: string
          dataset_code: string
          denial_reason: string | null
          geography_id: string | null
          id: string
          payload: Json
          request_id: string
          requested_by: string
        }
        Insert: {
          aggregation_min_applied?: number
          allowed?: boolean
          cohort_size?: number
          created_at?: string
          dataset_code: string
          denial_reason?: string | null
          geography_id?: string | null
          id?: string
          payload?: Json
          request_id: string
          requested_by: string
        }
        Update: {
          aggregation_min_applied?: number
          allowed?: boolean
          cohort_size?: number
          created_at?: string
          dataset_code?: string
          denial_reason?: string | null
          geography_id?: string | null
          id?: string
          payload?: Json
          request_id?: string
          requested_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_exports_geography_id_fkey"
            columns: ["geography_id"]
            isOneToOne: false
            referencedRelation: "geographies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_exports_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "research_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      research_requests: {
        Row: {
          abstract: string
          aggregation_min_cohort: number
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          dua_reference: string | null
          ethics_reference: string | null
          expires_at: string | null
          id: string
          institution_id: string | null
          is_synthetic: boolean
          purpose_code: string | null
          raw_row_access: boolean
          requested_datasets: string[]
          researcher_user_id: string
          status: Database["public"]["Enums"]["research_request_status"]
          title: string
          updated_at: string
        }
        Insert: {
          abstract?: string
          aggregation_min_cohort?: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          dua_reference?: string | null
          ethics_reference?: string | null
          expires_at?: string | null
          id?: string
          institution_id?: string | null
          is_synthetic?: boolean
          purpose_code?: string | null
          raw_row_access?: boolean
          requested_datasets?: string[]
          researcher_user_id: string
          status?: Database["public"]["Enums"]["research_request_status"]
          title: string
          updated_at?: string
        }
        Update: {
          abstract?: string
          aggregation_min_cohort?: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          dua_reference?: string | null
          ethics_reference?: string | null
          expires_at?: string | null
          id?: string
          institution_id?: string | null
          is_synthetic?: boolean
          purpose_code?: string | null
          raw_row_access?: boolean
          requested_datasets?: string[]
          researcher_user_id?: string
          status?: Database["public"]["Enums"]["research_request_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_requests_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "knowledge_institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_requests_purpose_code_fkey"
            columns: ["purpose_code"]
            isOneToOne: false
            referencedRelation: "data_purposes"
            referencedColumns: ["code"]
          },
        ]
      }
      role_definitions: {
        Row: {
          app_role_binding: Database["public"]["Enums"]["app_role"] | null
          authority_note: string | null
          code: string
          created_by: string | null
          description: string
          feature_flag_key: string | null
          is_active: boolean
          is_custom: boolean
          is_public_selectable: boolean
          journey_kind: string
          label: string
          sort_order: number
          tenant_type_scope: Database["public"]["Enums"]["tenant_type"] | null
          updated_at: string
        }
        Insert: {
          app_role_binding?: Database["public"]["Enums"]["app_role"] | null
          authority_note?: string | null
          code: string
          created_by?: string | null
          description: string
          feature_flag_key?: string | null
          is_active?: boolean
          is_custom?: boolean
          is_public_selectable?: boolean
          journey_kind?: string
          label: string
          sort_order?: number
          tenant_type_scope?: Database["public"]["Enums"]["tenant_type"] | null
          updated_at?: string
        }
        Update: {
          app_role_binding?: Database["public"]["Enums"]["app_role"] | null
          authority_note?: string | null
          code?: string
          created_by?: string | null
          description?: string
          feature_flag_key?: string | null
          is_active?: boolean
          is_custom?: boolean
          is_public_selectable?: boolean
          journey_kind?: string
          label?: string
          sort_order?: number
          tenant_type_scope?: Database["public"]["Enums"]["tenant_type"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_definitions_feature_flag_key_fkey"
            columns: ["feature_flag_key"]
            isOneToOne: false
            referencedRelation: "feature_flags"
            referencedColumns: ["key"]
          },
        ]
      }
      scheme_applications: {
        Row: {
          applicant_user_id: string
          created_at: string
          decided_at: string | null
          decision_note: string | null
          form_data: Json
          id: string
          is_synthetic: boolean
          prefill_consent_ok: boolean
          prefill_source: string
          reviewer_user_id: string | null
          rule_evaluation: Json
          scheme_id: string
          scheme_version: number
          status: Database["public"]["Enums"]["scheme_application_status"]
          submitted_via_tenant_id: string | null
          updated_at: string
        }
        Insert: {
          applicant_user_id: string
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          form_data?: Json
          id?: string
          is_synthetic?: boolean
          prefill_consent_ok?: boolean
          prefill_source?: string
          reviewer_user_id?: string | null
          rule_evaluation?: Json
          scheme_id: string
          scheme_version: number
          status?: Database["public"]["Enums"]["scheme_application_status"]
          submitted_via_tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          applicant_user_id?: string
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          form_data?: Json
          id?: string
          is_synthetic?: boolean
          prefill_consent_ok?: boolean
          prefill_source?: string
          reviewer_user_id?: string | null
          rule_evaluation?: Json
          scheme_id?: string
          scheme_version?: number
          status?: Database["public"]["Enums"]["scheme_application_status"]
          submitted_via_tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheme_applications_scheme_id_fkey"
            columns: ["scheme_id"]
            isOneToOne: false
            referencedRelation: "schemes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheme_applications_submitted_via_tenant_id_fkey"
            columns: ["submitted_via_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      scheme_versions: {
        Row: {
          changelog: string
          created_at: string
          created_by: string | null
          form_fields: Json
          id: string
          published_at: string | null
          rules: Json
          scheme_id: string
          version: number
        }
        Insert: {
          changelog: string
          created_at?: string
          created_by?: string | null
          form_fields?: Json
          id?: string
          published_at?: string | null
          rules?: Json
          scheme_id: string
          version: number
        }
        Update: {
          changelog?: string
          created_at?: string
          created_by?: string | null
          form_fields?: Json
          id?: string
          published_at?: string | null
          rules?: Json
          scheme_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "scheme_versions_scheme_id_fkey"
            columns: ["scheme_id"]
            isOneToOne: false
            referencedRelation: "schemes"
            referencedColumns: ["id"]
          },
        ]
      }
      schemes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          current_version: number
          geography_id: string | null
          id: string
          is_synthetic: boolean
          requires_human_decision: boolean
          status: Database["public"]["Enums"]["scheme_status"]
          summary: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          current_version?: number
          geography_id?: string | null
          id?: string
          is_synthetic?: boolean
          requires_human_decision?: boolean
          status?: Database["public"]["Enums"]["scheme_status"]
          summary: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          current_version?: number
          geography_id?: string | null
          id?: string
          is_synthetic?: boolean
          requires_human_decision?: boolean
          status?: Database["public"]["Enums"]["scheme_status"]
          summary?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schemes_geography_id_fkey"
            columns: ["geography_id"]
            isOneToOne: false
            referencedRelation: "geographies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schemes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_disputes: {
        Row: {
          category: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          engagement_id: string
          id: string
          raised_by: string | null
          resolution_note: string | null
          status: string
          subtype_code: string
          summary: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          engagement_id: string
          id?: string
          raised_by?: string | null
          resolution_note?: string | null
          status?: string
          subtype_code: string
          summary: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          engagement_id?: string
          id?: string
          raised_by?: string | null
          resolution_note?: string | null
          status?: string
          subtype_code?: string
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_disputes_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "service_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_disputes_subtype_code_fkey"
            columns: ["subtype_code"]
            isOneToOne: false
            referencedRelation: "service_subtypes"
            referencedColumns: ["code"]
          },
        ]
      }
      service_engagements: {
        Row: {
          created_at: string
          details: Json
          id: string
          is_synthetic: boolean
          provider_id: string
          requester_tenant_id: string | null
          requester_user_id: string | null
          scheduled_for: string | null
          status: string
          status_note: string | null
          subtype_code: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: Json
          id?: string
          is_synthetic?: boolean
          provider_id: string
          requester_tenant_id?: string | null
          requester_user_id?: string | null
          scheduled_for?: string | null
          status?: string
          status_note?: string | null
          subtype_code: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: Json
          id?: string
          is_synthetic?: boolean
          provider_id?: string
          requester_tenant_id?: string | null
          requester_user_id?: string | null
          scheduled_for?: string | null
          status?: string
          status_note?: string | null
          subtype_code?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_engagements_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_engagements_requester_tenant_id_fkey"
            columns: ["requester_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_engagements_subtype_code_fkey"
            columns: ["subtype_code"]
            isOneToOne: false
            referencedRelation: "service_subtypes"
            referencedColumns: ["code"]
          },
        ]
      }
      service_provider_checks: {
        Row: {
          adapter_name: string
          check_code: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          evidence_ref: string | null
          id: string
          label: string
          note: string | null
          provider_id: string
          status: string
        }
        Insert: {
          adapter_name?: string
          check_code: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          evidence_ref?: string | null
          id?: string
          label: string
          note?: string | null
          provider_id: string
          status?: string
        }
        Update: {
          adapter_name?: string
          check_code?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          evidence_ref?: string | null
          id?: string
          label?: string
          note?: string | null
          provider_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_provider_checks_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      service_providers: {
        Row: {
          capacity: Json
          contact_email: string
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          display_name: string
          geography_id: string | null
          id: string
          is_synthetic: boolean
          organization_id: string | null
          service_regions: Json
          state: Database["public"]["Enums"]["service_provider_state"]
          subtype_code: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          capacity?: Json
          contact_email: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          display_name: string
          geography_id?: string | null
          id?: string
          is_synthetic?: boolean
          organization_id?: string | null
          service_regions?: Json
          state?: Database["public"]["Enums"]["service_provider_state"]
          subtype_code: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          capacity?: Json
          contact_email?: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          display_name?: string
          geography_id?: string | null
          id?: string
          is_synthetic?: boolean
          organization_id?: string | null
          service_regions?: Json
          state?: Database["public"]["Enums"]["service_provider_state"]
          subtype_code?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_providers_geography_id_fkey"
            columns: ["geography_id"]
            isOneToOne: false
            referencedRelation: "geographies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_providers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_providers_subtype_code_fkey"
            columns: ["subtype_code"]
            isOneToOne: false
            referencedRelation: "service_subtypes"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "service_providers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_subtypes: {
        Row: {
          activation_trigger: string | null
          code: string
          description: string
          dispute_categories: Json
          domain: Database["public"]["Enums"]["service_domain"]
          evidence_decided_at: string | null
          evidence_decided_by: string | null
          evidence_gate: Database["public"]["Enums"]["evidence_gate_state"]
          evidence_note: string | null
          feature_flag_key: string | null
          is_active: boolean
          label: string
          profile_fields: Json
          requires_human_decision: boolean
          sort_order: number
          updated_at: string
          validate_note: string | null
          verification_checks: Json
        }
        Insert: {
          activation_trigger?: string | null
          code: string
          description?: string
          dispute_categories?: Json
          domain: Database["public"]["Enums"]["service_domain"]
          evidence_decided_at?: string | null
          evidence_decided_by?: string | null
          evidence_gate?: Database["public"]["Enums"]["evidence_gate_state"]
          evidence_note?: string | null
          feature_flag_key?: string | null
          is_active?: boolean
          label: string
          profile_fields?: Json
          requires_human_decision?: boolean
          sort_order?: number
          updated_at?: string
          validate_note?: string | null
          verification_checks?: Json
        }
        Update: {
          activation_trigger?: string | null
          code?: string
          description?: string
          dispute_categories?: Json
          domain?: Database["public"]["Enums"]["service_domain"]
          evidence_decided_at?: string | null
          evidence_decided_by?: string | null
          evidence_gate?: Database["public"]["Enums"]["evidence_gate_state"]
          evidence_note?: string | null
          feature_flag_key?: string | null
          is_active?: boolean
          label?: string
          profile_fields?: Json
          requires_human_decision?: boolean
          sort_order?: number
          updated_at?: string
          validate_note?: string | null
          verification_checks?: Json
        }
        Relationships: [
          {
            foreignKeyName: "service_subtypes_feature_flag_key_fkey"
            columns: ["feature_flag_key"]
            isOneToOne: false
            referencedRelation: "feature_flags"
            referencedColumns: ["key"]
          },
        ]
      }
      soil_retention_practices: {
        Row: {
          body: string
          code: string
          cost_max_minor: number
          cost_min_minor: number
          created_at: string
          currency: string
          effort: string
          expected_benefit: string
          id: string
          is_synthetic: boolean
          name: string
          soil_types: string[]
          sort_order: number
          updated_at: string
        }
        Insert: {
          body?: string
          code: string
          cost_max_minor?: number
          cost_min_minor?: number
          created_at?: string
          currency?: string
          effort?: string
          expected_benefit?: string
          id?: string
          is_synthetic?: boolean
          name: string
          soil_types?: string[]
          sort_order?: number
          updated_at?: string
        }
        Update: {
          body?: string
          code?: string
          cost_max_minor?: number
          cost_min_minor?: number
          created_at?: string
          currency?: string
          effort?: string
          expected_benefit?: string
          id?: string
          is_synthetic?: boolean
          name?: string
          soil_types?: string[]
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      sponsored_placements: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          is_active: boolean
          listing_id: string
          slot: string
          starts_at: string | null
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          listing_id: string
          slot: string
          starts_at?: string | null
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          listing_id?: string
          slot?: string
          starts_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsored_placements_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      state_configurations: {
        Row: {
          aggregation_min_cohort: number
          allows_raw_farmer_access: boolean
          created_at: string
          created_by: string | null
          default_locale: string
          enabled_flags: string[]
          geography_id: string | null
          governance: Json
          id: string
          is_synthetic: boolean
          label: string
          locales: string[]
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          aggregation_min_cohort?: number
          allows_raw_farmer_access?: boolean
          created_at?: string
          created_by?: string | null
          default_locale?: string
          enabled_flags?: string[]
          geography_id?: string | null
          governance?: Json
          id?: string
          is_synthetic?: boolean
          label: string
          locales?: string[]
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          aggregation_min_cohort?: number
          allows_raw_farmer_access?: boolean
          created_at?: string
          created_by?: string | null
          default_locale?: string
          enabled_flags?: string[]
          geography_id?: string | null
          governance?: Json
          id?: string
          is_synthetic?: boolean
          label?: string
          locales?: string[]
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "state_configurations_geography_id_fkey"
            columns: ["geography_id"]
            isOneToOne: false
            referencedRelation: "geographies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "state_configurations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_capacity_listings: {
        Row: {
          available_tonnes: number
          capacity_tonnes: number
          commodity: string
          created_at: string
          created_by: string | null
          currency: string
          geography_id: string | null
          id: string
          is_synthetic: boolean
          price_per_tonne_month: number | null
          provider_id: string
          quality_score: number
          review_note: string | null
          status: Database["public"]["Enums"]["listing_status"]
          temperature_max_c: number | null
          temperature_min_c: number | null
          updated_at: string
        }
        Insert: {
          available_tonnes?: number
          capacity_tonnes: number
          commodity: string
          created_at?: string
          created_by?: string | null
          currency?: string
          geography_id?: string | null
          id?: string
          is_synthetic?: boolean
          price_per_tonne_month?: number | null
          provider_id: string
          quality_score?: number
          review_note?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          temperature_max_c?: number | null
          temperature_min_c?: number | null
          updated_at?: string
        }
        Update: {
          available_tonnes?: number
          capacity_tonnes?: number
          commodity?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          geography_id?: string | null
          id?: string
          is_synthetic?: boolean
          price_per_tonne_month?: number | null
          provider_id?: string
          quality_score?: number
          review_note?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          temperature_max_c?: number | null
          temperature_min_c?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "storage_capacity_listings_geography_id_fkey"
            columns: ["geography_id"]
            isOneToOne: false
            referencedRelation: "geographies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storage_capacity_listings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "postharvest_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      support_cases: {
        Row: {
          assigned_to: string | null
          case_type: string
          created_at: string
          id: string
          is_synthetic: boolean
          queue: string
          requester_user_id: string | null
          resolution_note: string | null
          rollout_id: string | null
          severity: string
          sla_hours: number
          status: Database["public"]["Enums"]["support_case_status"]
          subject_id: string
          subject_type: string
          summary: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          case_type?: string
          created_at?: string
          id?: string
          is_synthetic?: boolean
          queue?: string
          requester_user_id?: string | null
          resolution_note?: string | null
          rollout_id?: string | null
          severity?: string
          sla_hours?: number
          status?: Database["public"]["Enums"]["support_case_status"]
          subject_id: string
          subject_type: string
          summary: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          case_type?: string
          created_at?: string
          id?: string
          is_synthetic?: boolean
          queue?: string
          requester_user_id?: string | null
          resolution_note?: string | null
          rollout_id?: string | null
          severity?: string
          sla_hours?: number
          status?: Database["public"]["Enums"]["support_case_status"]
          subject_id?: string
          subject_type?: string
          summary?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_cases_rollout_id_fkey"
            columns: ["rollout_id"]
            isOneToOne: false
            referencedRelation: "district_rollouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_cases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      synthetic_actors: {
        Row: {
          created_at: string
          display_name: string
          id: string
          notes: string | null
          persona_key: string
          role_code: string
          tenant_slug: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          notes?: string | null
          persona_key: string
          role_code: string
          tenant_slug?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          notes?: string | null
          persona_key?: string
          role_code?: string
          tenant_slug?: string | null
        }
        Relationships: []
      }
      talent_candidate_profiles: {
        Row: {
          created_at: string
          district_geo_id: string | null
          full_name: string
          headline: string
          id: string
          is_synthetic: boolean
          qualifications: Json
          seeking: boolean
          skills: string[]
          updated_at: string
          user_id: string
          visibility: Database["public"]["Enums"]["talent_visibility"]
          visibility_consent_at: string | null
        }
        Insert: {
          created_at?: string
          district_geo_id?: string | null
          full_name: string
          headline?: string
          id?: string
          is_synthetic?: boolean
          qualifications?: Json
          seeking?: boolean
          skills?: string[]
          updated_at?: string
          user_id: string
          visibility?: Database["public"]["Enums"]["talent_visibility"]
          visibility_consent_at?: string | null
        }
        Update: {
          created_at?: string
          district_geo_id?: string | null
          full_name?: string
          headline?: string
          id?: string
          is_synthetic?: boolean
          qualifications?: Json
          seeking?: boolean
          skills?: string[]
          updated_at?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["talent_visibility"]
          visibility_consent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "talent_candidate_profiles_district_geo_id_fkey"
            columns: ["district_geo_id"]
            isOneToOne: false
            referencedRelation: "geographies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_candidate_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_certifications: {
        Row: {
          candidate_id: string
          credential_ref: string
          enrollment_id: string
          id: string
          issued_at: string
          issuer_name: string
          issuer_partner_id: string
          provenance: Json
          updated_at: string
          verification_status: Database["public"]["Enums"]["certification_verification"]
          verified_by: string | null
        }
        Insert: {
          candidate_id: string
          credential_ref: string
          enrollment_id: string
          id?: string
          issued_at?: string
          issuer_name: string
          issuer_partner_id: string
          provenance?: Json
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["certification_verification"]
          verified_by?: string | null
        }
        Update: {
          candidate_id?: string
          credential_ref?: string
          enrollment_id?: string
          id?: string
          issued_at?: string
          issuer_name?: string
          issuer_partner_id?: string
          provenance?: Json
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["certification_verification"]
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "talent_certifications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "talent_candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_certifications_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "talent_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_certifications_issuer_partner_id_fkey"
            columns: ["issuer_partner_id"]
            isOneToOne: false
            referencedRelation: "talent_training_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_certifications_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_courses: {
        Row: {
          certification_issuer_name: string
          code: string
          created_at: string
          created_by: string | null
          currency: string
          description: string
          fee_amount: number
          hours: number
          id: string
          is_published: boolean
          partner_id: string
          skills: string[]
          title: string
          updated_at: string
        }
        Insert: {
          certification_issuer_name: string
          code: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          fee_amount?: number
          hours?: number
          id?: string
          is_published?: boolean
          partner_id: string
          skills?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          certification_issuer_name?: string
          code?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          fee_amount?: number
          hours?: number
          id?: string
          is_published?: boolean
          partner_id?: string
          skills?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_courses_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "talent_training_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_employers: {
        Row: {
          agreement_ref: string
          contact_email: string
          created_at: string
          created_by: string | null
          data_scope: string[]
          data_scope_approved: boolean
          decision_note: string
          id: string
          kind: Database["public"]["Enums"]["talent_employer_kind"]
          name: string
          organization_id: string | null
          state: Database["public"]["Enums"]["talent_entity_state"]
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          agreement_ref?: string
          contact_email: string
          created_at?: string
          created_by?: string | null
          data_scope?: string[]
          data_scope_approved?: boolean
          decision_note?: string
          id?: string
          kind: Database["public"]["Enums"]["talent_employer_kind"]
          name: string
          organization_id?: string | null
          state?: Database["public"]["Enums"]["talent_entity_state"]
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          agreement_ref?: string
          contact_email?: string
          created_at?: string
          created_by?: string | null
          data_scope?: string[]
          data_scope_approved?: boolean
          decision_note?: string
          id?: string
          kind?: Database["public"]["Enums"]["talent_employer_kind"]
          name?: string
          organization_id?: string | null
          state?: Database["public"]["Enums"]["talent_entity_state"]
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_employers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_employers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_employers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_enrollments: {
        Row: {
          candidate_id: string
          completed_at: string | null
          course_id: string
          enrolled_at: string
          fee_paid: boolean
          id: string
          status: Database["public"]["Enums"]["enrollment_status"]
          updated_at: string
        }
        Insert: {
          candidate_id: string
          completed_at?: string | null
          course_id: string
          enrolled_at?: string
          fee_paid?: boolean
          id?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          completed_at?: string | null
          course_id?: string
          enrolled_at?: string
          fee_paid?: boolean
          id?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_enrollments_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "talent_candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "talent_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_entitlements: {
        Row: {
          approved_by: string | null
          created_at: string
          currency: string
          ends_at: string | null
          fee_amount: number
          grants_ranking_advantage: boolean
          id: string
          plan_code: string
          starts_at: string
          status: Database["public"]["Enums"]["membership_status"]
          subject_id: string
          subject_kind: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          currency?: string
          ends_at?: string | null
          fee_amount?: number
          grants_ranking_advantage?: boolean
          id?: string
          plan_code?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["membership_status"]
          subject_id: string
          subject_kind: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          currency?: string
          ends_at?: string | null
          fee_amount?: number
          grants_ranking_advantage?: boolean
          id?: string
          plan_code?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["membership_status"]
          subject_id?: string
          subject_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_entitlements_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_evidence_gates: {
        Row: {
          code: string
          commercial_validated: boolean
          created_at: string
          decided_at: string | null
          decided_by: string | null
          demand_validated: boolean
          label: string
          notes: string
          policy_validated: boolean
          status: Database["public"]["Enums"]["gate_status"]
          updated_at: string
        }
        Insert: {
          code: string
          commercial_validated?: boolean
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          demand_validated?: boolean
          label: string
          notes?: string
          policy_validated?: boolean
          status?: Database["public"]["Enums"]["gate_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          commercial_validated?: boolean
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          demand_validated?: boolean
          label?: string
          notes?: string
          policy_validated?: boolean
          status?: Database["public"]["Enums"]["gate_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_evidence_gates_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_job_listings: {
        Row: {
          compensation_max: number | null
          compensation_min: number | null
          created_at: string
          created_by: string | null
          description: string
          employer_id: string
          id: string
          is_sponsored: boolean
          location_geo_id: string | null
          no_placement_guarantee: boolean
          positions: number
          skills: string[]
          sponsored_label: string
          status: Database["public"]["Enums"]["job_listing_status"]
          title: string
          updated_at: string
        }
        Insert: {
          compensation_max?: number | null
          compensation_min?: number | null
          created_at?: string
          created_by?: string | null
          description?: string
          employer_id: string
          id?: string
          is_sponsored?: boolean
          location_geo_id?: string | null
          no_placement_guarantee?: boolean
          positions?: number
          skills?: string[]
          sponsored_label?: string
          status?: Database["public"]["Enums"]["job_listing_status"]
          title: string
          updated_at?: string
        }
        Update: {
          compensation_max?: number | null
          compensation_min?: number | null
          created_at?: string
          created_by?: string | null
          description?: string
          employer_id?: string
          id?: string
          is_sponsored?: boolean
          location_geo_id?: string | null
          no_placement_guarantee?: boolean
          positions?: number
          skills?: string[]
          sponsored_label?: string
          status?: Database["public"]["Enums"]["job_listing_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_job_listings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_job_listings_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "talent_employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_job_listings_location_geo_id_fkey"
            columns: ["location_geo_id"]
            isOneToOne: false
            referencedRelation: "geographies"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_referrals: {
        Row: {
          candidate_decision_at: string | null
          candidate_id: string
          created_at: string
          id: string
          job_id: string
          match_reason: string
          requested_by: string | null
          shared_fields: string[]
          status: Database["public"]["Enums"]["referral_status"]
          updated_at: string
        }
        Insert: {
          candidate_decision_at?: string | null
          candidate_id: string
          created_at?: string
          id?: string
          job_id: string
          match_reason?: string
          requested_by?: string | null
          shared_fields?: string[]
          status?: Database["public"]["Enums"]["referral_status"]
          updated_at?: string
        }
        Update: {
          candidate_decision_at?: string | null
          candidate_id?: string
          created_at?: string
          id?: string
          job_id?: string
          match_reason?: string
          requested_by?: string | null
          shared_fields?: string[]
          status?: Database["public"]["Enums"]["referral_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_referrals_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "talent_candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_referrals_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "talent_job_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_referrals_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_training_partners: {
        Row: {
          accreditation_ref: string
          certification_issuer_name: string
          contact_email: string
          created_at: string
          created_by: string | null
          decision_note: string
          id: string
          name: string
          state: Database["public"]["Enums"]["talent_entity_state"]
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          accreditation_ref?: string
          certification_issuer_name: string
          contact_email: string
          created_at?: string
          created_by?: string | null
          decision_note?: string
          id?: string
          name: string
          state?: Database["public"]["Enums"]["talent_entity_state"]
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          accreditation_ref?: string
          certification_issuer_name?: string
          contact_email?: string
          created_at?: string
          created_by?: string | null
          decision_note?: string
          id?: string
          name?: string
          state?: Database["public"]["Enums"]["talent_entity_state"]
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_training_partners_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_training_partners_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_entitlements: {
        Row: {
          ends_at: string | null
          features: Json
          id: string
          plan_code: string
          starts_at: string
          status: Database["public"]["Enums"]["membership_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ends_at?: string | null
          features?: Json
          id?: string
          plan_code: string
          starts_at?: string
          status?: Database["public"]["Enums"]["membership_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ends_at?: string | null
          features?: Json
          id?: string
          plan_code?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["membership_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_entitlements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          expires_at: string
          id: string
          invited_by: string
          invited_email: string
          invited_role: Database["public"]["Enums"]["app_role"]
          is_synthetic: boolean
          note: string | null
          status: Database["public"]["Enums"]["invitation_status"]
          tenant_id: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          invited_by: string
          invited_email: string
          invited_role: Database["public"]["Enums"]["app_role"]
          is_synthetic?: boolean
          note?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
          tenant_id: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          invited_by?: string
          invited_email?: string
          invited_role?: Database["public"]["Enums"]["app_role"]
          is_synthetic?: boolean
          note?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
          tenant_id?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          created_at: string
          id: string
          status: Database["public"]["Enums"]["membership_status"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["membership_status"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["membership_status"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_relationships: {
        Row: {
          created_at: string
          created_by: string | null
          from_tenant_id: string
          id: string
          note: string | null
          relationship_type: Database["public"]["Enums"]["tenant_relationship_type"]
          status: Database["public"]["Enums"]["membership_status"]
          to_tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_tenant_id: string
          id?: string
          note?: string | null
          relationship_type: Database["public"]["Enums"]["tenant_relationship_type"]
          status?: Database["public"]["Enums"]["membership_status"]
          to_tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_tenant_id?: string
          id?: string
          note?: string | null
          relationship_type?: Database["public"]["Enums"]["tenant_relationship_type"]
          status?: Database["public"]["Enums"]["membership_status"]
          to_tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_relationships_from_tenant_id_fkey"
            columns: ["from_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_relationships_to_tenant_id_fkey"
            columns: ["to_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          name: string
          region_code: string | null
          slug: string
          status: Database["public"]["Enums"]["membership_status"]
          tenant_type: Database["public"]["Enums"]["tenant_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          region_code?: string | null
          slug: string
          status?: Database["public"]["Enums"]["membership_status"]
          tenant_type: Database["public"]["Enums"]["tenant_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          region_code?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["membership_status"]
          tenant_type?: Database["public"]["Enums"]["tenant_type"]
          updated_at?: string
        }
        Relationships: []
      }
      terms_acceptances: {
        Row: {
          accepted_at: string
          context: Json
          id: string
          terms_code: string
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          context?: Json
          id?: string
          terms_code: string
          user_id: string
          version: string
        }
        Update: {
          accepted_at?: string
          context?: Json
          id?: string
          terms_code?: string
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      training_completions: {
        Row: {
          checklist_code: string
          completed_at: string
          id: string
          item_key: string
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          checklist_code: string
          completed_at?: string
          id?: string
          item_key: string
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          checklist_code?: string
          completed_at?: string
          id?: string
          item_key?: string
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_completions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      value_add_scenarios: {
        Row: {
          assumptions: Json
          byproduct_value: number
          commodity: string
          created_at: string
          created_by: string | null
          estimated_realization: number | null
          farm_id: string
          id: string
          label: Database["public"]["Enums"]["price_label"]
          path_id: string | null
          processing_cost: number
          raw_price_label: Database["public"]["Enums"]["price_label"] | null
          raw_price_per_quintal: number | null
          raw_price_source: string | null
          steps_result: Json
        }
        Insert: {
          assumptions?: Json
          byproduct_value?: number
          commodity: string
          created_at?: string
          created_by?: string | null
          estimated_realization?: number | null
          farm_id: string
          id?: string
          label?: Database["public"]["Enums"]["price_label"]
          path_id?: string | null
          processing_cost?: number
          raw_price_label?: Database["public"]["Enums"]["price_label"] | null
          raw_price_per_quintal?: number | null
          raw_price_source?: string | null
          steps_result?: Json
        }
        Update: {
          assumptions?: Json
          byproduct_value?: number
          commodity?: string
          created_at?: string
          created_by?: string | null
          estimated_realization?: number | null
          farm_id?: string
          id?: string
          label?: Database["public"]["Enums"]["price_label"]
          path_id?: string | null
          processing_cost?: number
          raw_price_label?: Database["public"]["Enums"]["price_label"] | null
          raw_price_per_quintal?: number | null
          raw_price_source?: string | null
          steps_result?: Json
        }
        Relationships: [
          {
            foreignKeyName: "value_add_scenarios_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farm_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "value_add_scenarios_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "processing_path_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_cases: {
        Row: {
          assigned_to: string | null
          case_type: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          evidence: Json
          id: string
          is_synthetic: boolean
          opened_by: string | null
          status: Database["public"]["Enums"]["case_status"]
          subject_id: string
          subject_type: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          case_type: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          evidence?: Json
          id?: string
          is_synthetic?: boolean
          opened_by?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          subject_id: string
          subject_type: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          case_type?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          evidence?: Json
          id?: string
          is_synthetic?: boolean
          opened_by?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          subject_id?: string
          subject_type?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_cases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_read_farm: { Args: { _farm_id: string }; Returns: boolean }
      has_consent: {
        Args: {
          _consumer_id: string
          _purpose_code: string
          _subject_user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_tenant_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      is_partner_staff: {
        Args: { _registration_id: string; _user_id: string }
        Returns: boolean
      }
      is_tenant_member: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "platform_admin"
        | "auditor"
        | "tenant_admin"
        | "onboarding_officer"
        | "field_agent"
        | "consumer_api_manager"
        | "viewer"
        | "scheme_publisher"
        | "scheme_reviewer"
        | "partner_developer"
        | "market_operator"
        | "expansion_manager"
        | "support_agent"
        | "service_provider_admin"
        | "state_admin"
        | "knowledge_contributor"
        | "knowledge_reviewer"
        | "researcher"
        | "policymaker"
        | "postharvest_provider_admin"
        | "talent_candidate"
        | "training_partner_admin"
        | "employer_recruiter"
        | "employment_exchange_admin"
        | "talent_operator"
      case_status: "open" | "in_review" | "approved" | "rejected" | "escalated"
      certification_state:
        | "draft"
        | "submitted"
        | "in_review"
        | "certified"
        | "declined"
        | "revoked"
      certification_verification: "pending" | "verified" | "failed" | "revoked"
      consent_kind: "baseline_platform" | "optional_partner"
      consumer_tier: "sandbox" | "standard" | "premium"
      contact_channel: "email" | "sms" | "whatsapp"
      contact_verification_status: "pending" | "verified" | "failed" | "expired"
      contract_status:
        | "draft"
        | "proposed"
        | "accepted"
        | "active"
        | "completed"
        | "cancelled"
        | "disputed"
      dispute_status: "open" | "human_review" | "resolved" | "rejected"
      enrollment_status:
        | "enrolled"
        | "in_progress"
        | "completed"
        | "dropped"
        | "cancelled"
      escalation_kind:
        | "talk_to_fpo"
        | "talk_to_kvk"
        | "talk_to_agronomist"
        | "book_soil_test"
        | "request_processor_quote"
      escalation_status:
        | "requested"
        | "acknowledged"
        | "in_progress"
        | "closed"
        | "cancelled"
      evidence_gate_state:
        | "not_evaluated"
        | "evidence_pending"
        | "approved"
        | "rejected"
      extraction_state: "pending" | "extracted" | "failed" | "confirmed"
      facility_kind:
        | "fpo"
        | "kvk"
        | "soil_lab"
        | "chc"
        | "warehouse"
        | "cold_storage"
        | "processor"
        | "logistics"
        | "extension_centre"
        | "drone_service"
        | "farm_machinery"
      farm_sync_state: "local_draft" | "synced" | "conflict"
      farmer_doc_kind:
        | "photo"
        | "bank_passbook"
        | "land_record"
        | "id_proof"
        | "other"
      field_provenance: "farmer_entered" | "ai_extracted" | "farmer_confirmed"
      fpo_access_review_decision:
        | "retained"
        | "role_changed"
        | "scope_changed"
        | "suspended"
        | "removed"
      fpo_application_status:
        | "draft"
        | "documents_pending"
        | "ready_to_submit"
        | "submitted"
        | "under_review"
        | "additional_info_requested"
        | "approved"
        | "rejected"
        | "benefit_pending"
        | "benefit_received"
        | "closed"
      fpo_campaign_status: "draft" | "active" | "paused" | "closed"
      fpo_delivery_state: "queued" | "delivered" | "withheld" | "failed"
      fpo_doc_status:
        | "uploaded"
        | "under_review"
        | "verified"
        | "rejected"
        | "expired"
      fpo_eligibility_bucket:
        | "likely_eligible"
        | "needs_verification"
        | "not_eligible"
        | "applied"
        | "approved"
        | "rejected"
        | "benefit_received"
        | "closed"
      fpo_enquiry_status:
        | "received"
        | "under_review"
        | "negotiating"
        | "accepted"
        | "declined"
        | "withdrawn"
        | "expired"
      fpo_facilitation_state:
        | "identified"
        | "notified"
        | "authorization_pending"
        | "authorized"
        | "application_started"
        | "application_submitted"
        | "declined"
        | "not_eligible"
      fpo_input_category:
        | "seed"
        | "fertilizer"
        | "crop_protection"
        | "equipment"
        | "irrigation"
        | "packaging"
        | "farm_service"
      fpo_ledger_category:
        | "procurement"
        | "produce_sale"
        | "membership_fee"
        | "scheme_grant"
        | "expense"
        | "loan"
        | "other"
      fpo_ledger_direction: "inflow" | "outflow"
      fpo_logistics_kind:
        | "transport"
        | "cold_storage"
        | "warehouse"
        | "grading"
        | "processing"
      fpo_notice_audience: "all_members" | "segment" | "staff" | "single_member"
      fpo_notice_category:
        | "scheme"
        | "procurement"
        | "produce"
        | "payment"
        | "meeting"
        | "compliance"
        | "general"
      fpo_notice_channel: "in_app" | "sms" | "whatsapp" | "voice"
      fpo_notice_state: "draft" | "scheduled" | "sending" | "sent" | "cancelled"
      fpo_opportunity_category:
        | "scheme"
        | "input_procurement"
        | "collective_sale"
        | "credit"
        | "insurance"
        | "training"
        | "infrastructure"
        | "processing"
        | "storage"
        | "equipment"
        | "export"
        | "certification"
        | "market_linkage"
      fpo_opportunity_track_status:
        | "new"
        | "reviewing"
        | "shortlisted"
        | "applied"
        | "not_relevant"
        | "closed"
      fpo_payment_state: "pending" | "partial" | "paid" | "waived"
      fpo_permission_level: "none" | "read" | "write" | "manage"
      fpo_price_basis: "observed" | "forecast" | "derived_scenario"
      fpo_procurement_status:
        | "draft"
        | "collecting_demand"
        | "aggregated"
        | "rfq_open"
        | "quotes_received"
        | "supplier_selected"
        | "member_authorization"
        | "ordered"
        | "distributing"
        | "payment_pending"
        | "closed"
        | "cancelled"
      fpo_produce_lot_status:
        | "planned"
        | "collecting"
        | "aggregated"
        | "listed"
        | "offers_received"
        | "buyer_selected"
        | "dispatched"
        | "delivered"
        | "settled"
        | "closed"
        | "cancelled"
      fpo_profile_state:
        | "draft"
        | "in_progress"
        | "submitted"
        | "verified"
        | "active"
        | "suspended"
      fpo_staff_status: "invited" | "active" | "suspended" | "removed"
      fpo_task_priority: "low" | "normal" | "high" | "urgent"
      fpo_task_status: "open" | "in_progress" | "blocked" | "done" | "cancelled"
      fpo_uc_state:
        | "not_due"
        | "pending"
        | "submitted"
        | "accepted"
        | "rejected"
      gate_status: "pending" | "approved" | "rejected"
      geo_level: "country" | "state" | "district" | "block" | "village"
      identity_check_status:
        | "pending"
        | "verified"
        | "failed"
        | "manual_review"
        | "duplicate_hold"
      insurer_alert_status: "open" | "acknowledged" | "dismissed"
      insurer_campaign_state:
        | "draft"
        | "active"
        | "paused"
        | "completed"
        | "cancelled"
      insurer_claim_doc_status: "pending" | "received" | "verified" | "rejected"
      insurer_claim_stage:
        | "reported"
        | "documents_pending"
        | "survey_assigned"
        | "assessment_review"
        | "approved"
        | "rejected"
        | "payout_initiated"
        | "settled"
        | "withdrawn"
      insurer_enrolment_state:
        | "draft"
        | "submitted"
        | "under_verification"
        | "verified"
        | "rejected"
        | "withdrawn"
        | "policy_linked"
      insurer_funnel_stage:
        | "lead"
        | "contacted"
        | "interested"
        | "documents_initiated"
        | "verified"
        | "quote_generated"
        | "premium_pending"
        | "enrolled"
        | "dropped"
      insurer_policy_status:
        | "draft"
        | "pending_enrolment"
        | "issued"
        | "active"
        | "expired"
        | "cancelled"
      insurer_remittance_state:
        | "expected"
        | "received"
        | "reconciled"
        | "short"
        | "excess"
        | "refunded"
      insurer_risk_event:
        | "drought"
        | "excess_rain"
        | "flood"
        | "hail"
        | "pest_outbreak"
        | "heatwave"
        | "cyclone"
      insurer_risk_severity: "watch" | "advisory" | "severe"
      invitation_status: "pending" | "accepted" | "revoked" | "expired"
      job_listing_status: "draft" | "open" | "closed" | "filled" | "withdrawn"
      knowledge_kind:
        | "university"
        | "kvk"
        | "extension_centre"
        | "state_training_cell"
      knowledge_status:
        | "draft"
        | "submitted"
        | "in_review"
        | "approved"
        | "published"
        | "rejected"
        | "withdrawn"
      land_ownership_type:
        | "owner"
        | "leased"
        | "share_cropped"
        | "mixed"
        | "landless"
      listing_status: "draft" | "pending_review" | "published" | "delisted"
      market_order_status:
        | "created"
        | "accepted"
        | "fulfilled"
        | "cancelled"
        | "disputed"
        | "closed"
      market_party_kind:
        | "input_supplier"
        | "equipment_supplier"
        | "buyer_trader"
        | "processor"
        | "fpo_aggregator"
      market_profile_state:
        | "draft"
        | "submitted"
        | "approved"
        | "rejected"
        | "suspended"
      market_side: "seller" | "buyer"
      member_status:
        | "invited"
        | "active"
        | "suspended"
        | "removed"
        | "approval_pending"
        | "exited"
      membership_status: "active" | "suspended" | "revoked"
      observation_kind:
        | "weather"
        | "agromet"
        | "soil_general"
        | "soil_health_card"
        | "price"
        | "facility"
        | "district_profile"
      onboarding_channel:
        | "self_service"
        | "fpo_assisted"
        | "govt_camp_assisted"
        | "field_agent_assisted"
      onboarding_status:
        | "draft"
        | "pending"
        | "activated"
        | "rejected"
        | "withdrawn"
      org_status: "draft" | "pending" | "approved" | "rejected" | "suspended"
      partner_case_kind: "credit_signal" | "loan" | "claim" | "advisory"
      partner_case_status:
        | "open"
        | "awaiting_evidence"
        | "awaiting_human_decision"
        | "approved"
        | "declined"
        | "withdrawn"
      partner_env: "sandbox" | "production"
      partner_kind: "bank" | "insurer" | "agritech"
      partner_reg_state:
        | "draft"
        | "submitted"
        | "legal_review"
        | "security_review"
        | "approved"
        | "rejected"
        | "suspended"
      postharvest_kind: "warehouse" | "cold_storage" | "processor"
      price_label: "observed" | "forecast" | "derived_scenario"
      privilege_request_status:
        | "pending"
        | "approved"
        | "denied"
        | "expired"
        | "revoked"
      record_status: "pending" | "active" | "verified" | "rejected" | "revoked"
      referral_status:
        | "proposed"
        | "candidate_consent_pending"
        | "shared"
        | "declined_by_candidate"
        | "withdrawn"
        | "closed"
      research_request_status:
        | "draft"
        | "submitted"
        | "ethics_review"
        | "approved"
        | "rejected"
        | "expired"
        | "revoked"
      rfq_status: "draft" | "open" | "quoted" | "ordered" | "cancelled"
      rollout_status: "planned" | "configuring" | "piloting" | "live" | "paused"
      scheme_application_status:
        | "draft"
        | "submitted"
        | "in_review"
        | "approved"
        | "rejected"
        | "withdrawn"
      scheme_status: "draft" | "published" | "closed"
      service_domain:
        | "chc_equipment_rental"
        | "logistics"
        | "ngo_csr_program"
        | "advisory_service"
        | "custom_hiring_labour"
      service_provider_state:
        | "draft"
        | "submitted"
        | "verification"
        | "approved"
        | "rejected"
        | "suspended"
      social_category: "general" | "obc" | "sc" | "st" | "ews" | "not_disclosed"
      soil_basis: "inferred_from_location" | "lab_tested"
      soil_lab_kind:
        | "government"
        | "mobile"
        | "mini"
        | "village"
        | "registered_private"
        | "icar_kvk"
      step_status: "not_started" | "in_progress" | "complete"
      support_case_status:
        | "new"
        | "triaged"
        | "in_progress"
        | "waiting_customer"
        | "resolved"
        | "closed"
      talent_employer_kind: "employer" | "recruiter" | "government_exchange"
      talent_entity_state:
        | "draft"
        | "submitted"
        | "in_review"
        | "approved"
        | "rejected"
        | "suspended"
      talent_visibility: "hidden" | "platform_only" | "employers_optin"
      tenant_relationship_type:
        | "parent"
        | "affiliation"
        | "service_provider"
        | "data_partner"
      tenant_type:
        | "fpo"
        | "govt_dept"
        | "bank"
        | "insurer"
        | "agri_business"
        | "platform_ops"
      workflow_status: "active" | "completed" | "cancelled"
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
      app_role: [
        "platform_admin",
        "auditor",
        "tenant_admin",
        "onboarding_officer",
        "field_agent",
        "consumer_api_manager",
        "viewer",
        "scheme_publisher",
        "scheme_reviewer",
        "partner_developer",
        "market_operator",
        "expansion_manager",
        "support_agent",
        "service_provider_admin",
        "state_admin",
        "knowledge_contributor",
        "knowledge_reviewer",
        "researcher",
        "policymaker",
        "postharvest_provider_admin",
        "talent_candidate",
        "training_partner_admin",
        "employer_recruiter",
        "employment_exchange_admin",
        "talent_operator",
      ],
      case_status: ["open", "in_review", "approved", "rejected", "escalated"],
      certification_state: [
        "draft",
        "submitted",
        "in_review",
        "certified",
        "declined",
        "revoked",
      ],
      certification_verification: ["pending", "verified", "failed", "revoked"],
      consent_kind: ["baseline_platform", "optional_partner"],
      consumer_tier: ["sandbox", "standard", "premium"],
      contact_channel: ["email", "sms", "whatsapp"],
      contact_verification_status: ["pending", "verified", "failed", "expired"],
      contract_status: [
        "draft",
        "proposed",
        "accepted",
        "active",
        "completed",
        "cancelled",
        "disputed",
      ],
      dispute_status: ["open", "human_review", "resolved", "rejected"],
      enrollment_status: [
        "enrolled",
        "in_progress",
        "completed",
        "dropped",
        "cancelled",
      ],
      escalation_kind: [
        "talk_to_fpo",
        "talk_to_kvk",
        "talk_to_agronomist",
        "book_soil_test",
        "request_processor_quote",
      ],
      escalation_status: [
        "requested",
        "acknowledged",
        "in_progress",
        "closed",
        "cancelled",
      ],
      evidence_gate_state: [
        "not_evaluated",
        "evidence_pending",
        "approved",
        "rejected",
      ],
      extraction_state: ["pending", "extracted", "failed", "confirmed"],
      facility_kind: [
        "fpo",
        "kvk",
        "soil_lab",
        "chc",
        "warehouse",
        "cold_storage",
        "processor",
        "logistics",
        "extension_centre",
        "drone_service",
        "farm_machinery",
      ],
      farm_sync_state: ["local_draft", "synced", "conflict"],
      farmer_doc_kind: [
        "photo",
        "bank_passbook",
        "land_record",
        "id_proof",
        "other",
      ],
      field_provenance: ["farmer_entered", "ai_extracted", "farmer_confirmed"],
      fpo_access_review_decision: [
        "retained",
        "role_changed",
        "scope_changed",
        "suspended",
        "removed",
      ],
      fpo_application_status: [
        "draft",
        "documents_pending",
        "ready_to_submit",
        "submitted",
        "under_review",
        "additional_info_requested",
        "approved",
        "rejected",
        "benefit_pending",
        "benefit_received",
        "closed",
      ],
      fpo_campaign_status: ["draft", "active", "paused", "closed"],
      fpo_delivery_state: ["queued", "delivered", "withheld", "failed"],
      fpo_doc_status: [
        "uploaded",
        "under_review",
        "verified",
        "rejected",
        "expired",
      ],
      fpo_eligibility_bucket: [
        "likely_eligible",
        "needs_verification",
        "not_eligible",
        "applied",
        "approved",
        "rejected",
        "benefit_received",
        "closed",
      ],
      fpo_enquiry_status: [
        "received",
        "under_review",
        "negotiating",
        "accepted",
        "declined",
        "withdrawn",
        "expired",
      ],
      fpo_facilitation_state: [
        "identified",
        "notified",
        "authorization_pending",
        "authorized",
        "application_started",
        "application_submitted",
        "declined",
        "not_eligible",
      ],
      fpo_input_category: [
        "seed",
        "fertilizer",
        "crop_protection",
        "equipment",
        "irrigation",
        "packaging",
        "farm_service",
      ],
      fpo_ledger_category: [
        "procurement",
        "produce_sale",
        "membership_fee",
        "scheme_grant",
        "expense",
        "loan",
        "other",
      ],
      fpo_ledger_direction: ["inflow", "outflow"],
      fpo_logistics_kind: [
        "transport",
        "cold_storage",
        "warehouse",
        "grading",
        "processing",
      ],
      fpo_notice_audience: ["all_members", "segment", "staff", "single_member"],
      fpo_notice_category: [
        "scheme",
        "procurement",
        "produce",
        "payment",
        "meeting",
        "compliance",
        "general",
      ],
      fpo_notice_channel: ["in_app", "sms", "whatsapp", "voice"],
      fpo_notice_state: ["draft", "scheduled", "sending", "sent", "cancelled"],
      fpo_opportunity_category: [
        "scheme",
        "input_procurement",
        "collective_sale",
        "credit",
        "insurance",
        "training",
        "infrastructure",
        "processing",
        "storage",
        "equipment",
        "export",
        "certification",
        "market_linkage",
      ],
      fpo_opportunity_track_status: [
        "new",
        "reviewing",
        "shortlisted",
        "applied",
        "not_relevant",
        "closed",
      ],
      fpo_payment_state: ["pending", "partial", "paid", "waived"],
      fpo_permission_level: ["none", "read", "write", "manage"],
      fpo_price_basis: ["observed", "forecast", "derived_scenario"],
      fpo_procurement_status: [
        "draft",
        "collecting_demand",
        "aggregated",
        "rfq_open",
        "quotes_received",
        "supplier_selected",
        "member_authorization",
        "ordered",
        "distributing",
        "payment_pending",
        "closed",
        "cancelled",
      ],
      fpo_produce_lot_status: [
        "planned",
        "collecting",
        "aggregated",
        "listed",
        "offers_received",
        "buyer_selected",
        "dispatched",
        "delivered",
        "settled",
        "closed",
        "cancelled",
      ],
      fpo_profile_state: [
        "draft",
        "in_progress",
        "submitted",
        "verified",
        "active",
        "suspended",
      ],
      fpo_staff_status: ["invited", "active", "suspended", "removed"],
      fpo_task_priority: ["low", "normal", "high", "urgent"],
      fpo_task_status: ["open", "in_progress", "blocked", "done", "cancelled"],
      fpo_uc_state: ["not_due", "pending", "submitted", "accepted", "rejected"],
      gate_status: ["pending", "approved", "rejected"],
      geo_level: ["country", "state", "district", "block", "village"],
      identity_check_status: [
        "pending",
        "verified",
        "failed",
        "manual_review",
        "duplicate_hold",
      ],
      insurer_alert_status: ["open", "acknowledged", "dismissed"],
      insurer_campaign_state: [
        "draft",
        "active",
        "paused",
        "completed",
        "cancelled",
      ],
      insurer_claim_doc_status: ["pending", "received", "verified", "rejected"],
      insurer_claim_stage: [
        "reported",
        "documents_pending",
        "survey_assigned",
        "assessment_review",
        "approved",
        "rejected",
        "payout_initiated",
        "settled",
        "withdrawn",
      ],
      insurer_enrolment_state: [
        "draft",
        "submitted",
        "under_verification",
        "verified",
        "rejected",
        "withdrawn",
        "policy_linked",
      ],
      insurer_funnel_stage: [
        "lead",
        "contacted",
        "interested",
        "documents_initiated",
        "verified",
        "quote_generated",
        "premium_pending",
        "enrolled",
        "dropped",
      ],
      insurer_policy_status: [
        "draft",
        "pending_enrolment",
        "issued",
        "active",
        "expired",
        "cancelled",
      ],
      insurer_remittance_state: [
        "expected",
        "received",
        "reconciled",
        "short",
        "excess",
        "refunded",
      ],
      insurer_risk_event: [
        "drought",
        "excess_rain",
        "flood",
        "hail",
        "pest_outbreak",
        "heatwave",
        "cyclone",
      ],
      insurer_risk_severity: ["watch", "advisory", "severe"],
      invitation_status: ["pending", "accepted", "revoked", "expired"],
      job_listing_status: ["draft", "open", "closed", "filled", "withdrawn"],
      knowledge_kind: [
        "university",
        "kvk",
        "extension_centre",
        "state_training_cell",
      ],
      knowledge_status: [
        "draft",
        "submitted",
        "in_review",
        "approved",
        "published",
        "rejected",
        "withdrawn",
      ],
      land_ownership_type: [
        "owner",
        "leased",
        "share_cropped",
        "mixed",
        "landless",
      ],
      listing_status: ["draft", "pending_review", "published", "delisted"],
      market_order_status: [
        "created",
        "accepted",
        "fulfilled",
        "cancelled",
        "disputed",
        "closed",
      ],
      market_party_kind: [
        "input_supplier",
        "equipment_supplier",
        "buyer_trader",
        "processor",
        "fpo_aggregator",
      ],
      market_profile_state: [
        "draft",
        "submitted",
        "approved",
        "rejected",
        "suspended",
      ],
      market_side: ["seller", "buyer"],
      member_status: [
        "invited",
        "active",
        "suspended",
        "removed",
        "approval_pending",
        "exited",
      ],
      membership_status: ["active", "suspended", "revoked"],
      observation_kind: [
        "weather",
        "agromet",
        "soil_general",
        "soil_health_card",
        "price",
        "facility",
        "district_profile",
      ],
      onboarding_channel: [
        "self_service",
        "fpo_assisted",
        "govt_camp_assisted",
        "field_agent_assisted",
      ],
      onboarding_status: [
        "draft",
        "pending",
        "activated",
        "rejected",
        "withdrawn",
      ],
      org_status: ["draft", "pending", "approved", "rejected", "suspended"],
      partner_case_kind: ["credit_signal", "loan", "claim", "advisory"],
      partner_case_status: [
        "open",
        "awaiting_evidence",
        "awaiting_human_decision",
        "approved",
        "declined",
        "withdrawn",
      ],
      partner_env: ["sandbox", "production"],
      partner_kind: ["bank", "insurer", "agritech"],
      partner_reg_state: [
        "draft",
        "submitted",
        "legal_review",
        "security_review",
        "approved",
        "rejected",
        "suspended",
      ],
      postharvest_kind: ["warehouse", "cold_storage", "processor"],
      price_label: ["observed", "forecast", "derived_scenario"],
      privilege_request_status: [
        "pending",
        "approved",
        "denied",
        "expired",
        "revoked",
      ],
      record_status: ["pending", "active", "verified", "rejected", "revoked"],
      referral_status: [
        "proposed",
        "candidate_consent_pending",
        "shared",
        "declined_by_candidate",
        "withdrawn",
        "closed",
      ],
      research_request_status: [
        "draft",
        "submitted",
        "ethics_review",
        "approved",
        "rejected",
        "expired",
        "revoked",
      ],
      rfq_status: ["draft", "open", "quoted", "ordered", "cancelled"],
      rollout_status: ["planned", "configuring", "piloting", "live", "paused"],
      scheme_application_status: [
        "draft",
        "submitted",
        "in_review",
        "approved",
        "rejected",
        "withdrawn",
      ],
      scheme_status: ["draft", "published", "closed"],
      service_domain: [
        "chc_equipment_rental",
        "logistics",
        "ngo_csr_program",
        "advisory_service",
        "custom_hiring_labour",
      ],
      service_provider_state: [
        "draft",
        "submitted",
        "verification",
        "approved",
        "rejected",
        "suspended",
      ],
      social_category: ["general", "obc", "sc", "st", "ews", "not_disclosed"],
      soil_basis: ["inferred_from_location", "lab_tested"],
      soil_lab_kind: [
        "government",
        "mobile",
        "mini",
        "village",
        "registered_private",
        "icar_kvk",
      ],
      step_status: ["not_started", "in_progress", "complete"],
      support_case_status: [
        "new",
        "triaged",
        "in_progress",
        "waiting_customer",
        "resolved",
        "closed",
      ],
      talent_employer_kind: ["employer", "recruiter", "government_exchange"],
      talent_entity_state: [
        "draft",
        "submitted",
        "in_review",
        "approved",
        "rejected",
        "suspended",
      ],
      talent_visibility: ["hidden", "platform_only", "employers_optin"],
      tenant_relationship_type: [
        "parent",
        "affiliation",
        "service_provider",
        "data_partner",
      ],
      tenant_type: [
        "fpo",
        "govt_dept",
        "bank",
        "insurer",
        "agri_business",
        "platform_ops",
      ],
      workflow_status: ["active", "completed", "cancelled"],
    },
  },
} as const
