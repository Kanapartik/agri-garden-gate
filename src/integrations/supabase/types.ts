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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
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
      fpo_members: {
        Row: {
          added_by: string | null
          contact_hint: string | null
          created_at: string
          display_name: string
          farmer_user_id: string | null
          geography_id: string | null
          id: string
          import_batch_id: string | null
          is_synthetic: boolean
          member_ref: string
          status: Database["public"]["Enums"]["member_status"]
          tenant_id: string
          updated_at: string
          village_code: string | null
        }
        Insert: {
          added_by?: string | null
          contact_hint?: string | null
          created_at?: string
          display_name: string
          farmer_user_id?: string | null
          geography_id?: string | null
          id?: string
          import_batch_id?: string | null
          is_synthetic?: boolean
          member_ref: string
          status?: Database["public"]["Enums"]["member_status"]
          tenant_id: string
          updated_at?: string
          village_code?: string | null
        }
        Update: {
          added_by?: string | null
          contact_hint?: string | null
          created_at?: string
          display_name?: string
          farmer_user_id?: string | null
          geography_id?: string | null
          id?: string
          import_batch_id?: string | null
          is_synthetic?: boolean
          member_ref?: string
          status?: Database["public"]["Enums"]["member_status"]
          tenant_id?: string
          updated_at?: string
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
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          locale: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      role_definitions: {
        Row: {
          authority_note: string | null
          code: string
          description: string
          feature_flag_key: string | null
          is_public_selectable: boolean
          journey_kind: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          authority_note?: string | null
          code: string
          description: string
          feature_flag_key?: string | null
          is_public_selectable?: boolean
          journey_kind?: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          authority_note?: string | null
          code?: string
          description?: string
          feature_flag_key?: string | null
          is_public_selectable?: boolean
          journey_kind?: string
          label?: string
          sort_order?: number
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
      case_status: "open" | "in_review" | "approved" | "rejected" | "escalated"
      consent_kind: "baseline_platform" | "optional_partner"
      consumer_tier: "sandbox" | "standard" | "premium"
      contact_channel: "email" | "sms" | "whatsapp"
      contact_verification_status: "pending" | "verified" | "failed" | "expired"
      dispute_status: "open" | "human_review" | "resolved" | "rejected"
      farm_sync_state: "local_draft" | "synced" | "conflict"
      gate_status: "pending" | "approved" | "rejected"
      geo_level: "country" | "state" | "district" | "block" | "village"
      identity_check_status:
        | "pending"
        | "verified"
        | "failed"
        | "manual_review"
        | "duplicate_hold"
      invitation_status: "pending" | "accepted" | "revoked" | "expired"
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
      member_status: "invited" | "active" | "suspended" | "removed"
      membership_status: "active" | "suspended" | "revoked"
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
      privilege_request_status:
        | "pending"
        | "approved"
        | "denied"
        | "expired"
        | "revoked"
      record_status: "pending" | "active" | "verified" | "rejected" | "revoked"
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
      step_status: "not_started" | "in_progress" | "complete"
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
      ],
      case_status: ["open", "in_review", "approved", "rejected", "escalated"],
      consent_kind: ["baseline_platform", "optional_partner"],
      consumer_tier: ["sandbox", "standard", "premium"],
      contact_channel: ["email", "sms", "whatsapp"],
      contact_verification_status: ["pending", "verified", "failed", "expired"],
      dispute_status: ["open", "human_review", "resolved", "rejected"],
      farm_sync_state: ["local_draft", "synced", "conflict"],
      gate_status: ["pending", "approved", "rejected"],
      geo_level: ["country", "state", "district", "block", "village"],
      identity_check_status: [
        "pending",
        "verified",
        "failed",
        "manual_review",
        "duplicate_hold",
      ],
      invitation_status: ["pending", "accepted", "revoked", "expired"],
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
      member_status: ["invited", "active", "suspended", "removed"],
      membership_status: ["active", "suspended", "revoked"],
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
      privilege_request_status: [
        "pending",
        "approved",
        "denied",
        "expired",
        "revoked",
      ],
      record_status: ["pending", "active", "verified", "rejected", "revoked"],
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
      step_status: ["not_started", "in_progress", "complete"],
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
