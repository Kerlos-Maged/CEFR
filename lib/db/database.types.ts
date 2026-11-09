/**
 * GENERATED FILE — do not edit by hand.
 *
 * Source of truth: supabase/migrations/*.sql
 * Regenerate with: npm run db:types:pglite  (Docker: npm run db:types)
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          id: number;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          details: Json;
          created_at: string;
        };
        Insert: {
          id?: number;
          actor_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          details?: Json;
          created_at?: string;
        };
        Update: {
          id?: number;
          actor_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          details?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      analytics_daily: {
        Row: {
          day: string;
          object_id: string | null;
          church_id: string | null;
          language_code: string | null;
          event_type: Database["public"]["Enums"]["analytics_event_type"];
          count: number;
        };
        Insert: {
          day: string;
          object_id?: string | null;
          church_id?: string | null;
          language_code?: string | null;
          event_type: Database["public"]["Enums"]["analytics_event_type"];
          count?: number;
        };
        Update: {
          day?: string;
          object_id?: string | null;
          church_id?: string | null;
          language_code?: string | null;
          event_type?: Database["public"]["Enums"]["analytics_event_type"];
          count?: number;
        };
        Relationships: [];
      };
      analytics_events: {
        Row: {
          id: number;
          event_type: Database["public"]["Enums"]["analytics_event_type"];
          object_id: string | null;
          church_id: string | null;
          language_code: string | null;
          session_hash: string | null;
          referrer_type: string | null;
          occurred_at: string;
          aggregated_at: string | null;
        };
        Insert: {
          id?: number;
          event_type: Database["public"]["Enums"]["analytics_event_type"];
          object_id?: string | null;
          church_id?: string | null;
          language_code?: string | null;
          session_hash?: string | null;
          referrer_type?: string | null;
          occurred_at?: string;
          aggregated_at?: string | null;
        };
        Update: {
          id?: number;
          event_type?: Database["public"]["Enums"]["analytics_event_type"];
          object_id?: string | null;
          church_id?: string | null;
          language_code?: string | null;
          session_hash?: string | null;
          referrer_type?: string | null;
          occurred_at?: string;
          aggregated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "analytics_events_church_id_fkey";
            columns: ["church_id"];
            isOneToOne: false;
            referencedRelation: "churches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "analytics_events_language_code_fkey";
            columns: ["language_code"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "analytics_events_object_id_fkey";
            columns: ["object_id"];
            isOneToOne: false;
            referencedRelation: "objects";
            referencedColumns: ["id"];
          },
        ];
      };
      church_memberships: {
        Row: {
          id: string;
          user_id: string;
          church_id: string;
          role: Database["public"]["Enums"]["membership_role"];
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          church_id: string;
          role: Database["public"]["Enums"]["membership_role"];
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          church_id?: string;
          role?: Database["public"]["Enums"]["membership_role"];
          created_at?: string;
          created_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "church_memberships_church_id_fkey";
            columns: ["church_id"];
            isOneToOne: false;
            referencedRelation: "churches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "church_memberships_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "church_memberships_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      church_translations: {
        Row: {
          id: number;
          church_id: string;
          language_code: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          church_id: string;
          language_code: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          church_id?: string;
          language_code?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "church_translations_church_id_fkey";
            columns: ["church_id"];
            isOneToOne: false;
            referencedRelation: "churches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "church_translations_language_code_fkey";
            columns: ["language_code"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["code"];
          },
        ];
      };
      churches: {
        Row: {
          id: string;
          slug: string;
          status: Database["public"]["Enums"]["entity_status"];
          city: string | null;
          district: string | null;
          latitude: number | null;
          longitude: number | null;
          dedication_date: string | null;
          rite: string | null;
          cover_media_id: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          status?: Database["public"]["Enums"]["entity_status"];
          city?: string | null;
          district?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          dedication_date?: string | null;
          rite?: string | null;
          cover_media_id?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          status?: Database["public"]["Enums"]["entity_status"];
          city?: string | null;
          district?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          dedication_date?: string | null;
          rite?: string | null;
          cover_media_id?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "churches_cover_media_id_fkey";
            columns: ["cover_media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
        ];
      };
      claim_sources: {
        Row: {
          claim_id: string;
          source_id: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          claim_id: string;
          source_id: string;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          claim_id?: string;
          source_id?: string;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "claim_sources_claim_id_fkey";
            columns: ["claim_id"];
            isOneToOne: false;
            referencedRelation: "claims";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claim_sources_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      claims: {
        Row: {
          id: string;
          object_id: string;
          claim_text: string;
          claimed_value: string | null;
          verification: Database["public"]["Enums"]["verification_status"];
          is_public: boolean;
          sort_order: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          object_id: string;
          claim_text: string;
          claimed_value?: string | null;
          verification?: Database["public"]["Enums"]["verification_status"];
          is_public?: boolean;
          sort_order?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          object_id?: string;
          claim_text?: string;
          claimed_value?: string | null;
          verification?: Database["public"]["Enums"]["verification_status"];
          is_public?: boolean;
          sort_order?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "claims_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claims_object_id_fkey";
            columns: ["object_id"];
            isOneToOne: false;
            referencedRelation: "objects";
            referencedColumns: ["id"];
          },
        ];
      };
      languages: {
        Row: {
          code: string;
          name: string;
          native_name: string;
          direction: string;
          is_active: boolean;
          created_at: string;
          is_default: boolean;
        };
        Insert: {
          code: string;
          name: string;
          native_name: string;
          direction?: string;
          is_active?: boolean;
          created_at?: string;
          is_default?: boolean;
        };
        Update: {
          code?: string;
          name?: string;
          native_name?: string;
          direction?: string;
          is_active?: boolean;
          created_at?: string;
          is_default?: boolean;
        };
        Relationships: [];
      };
      media: {
        Row: {
          id: string;
          object_id: string;
          media_type: Database["public"]["Enums"]["media_type"];
          storage_path: string;
          bucket: string;
          mime_type: string;
          size_bytes: number;
          width: number | null;
          height: number | null;
          duration_seconds: number | null;
          checksum: string | null;
          copyright_holder: string | null;
          attribution: string | null;
          permission_status: Database["public"]["Enums"]["permission_status"];
          is_public: boolean;
          sort_order: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          object_id: string;
          media_type: Database["public"]["Enums"]["media_type"];
          storage_path: string;
          bucket?: string;
          mime_type: string;
          size_bytes: number;
          width?: number | null;
          height?: number | null;
          duration_seconds?: number | null;
          checksum?: string | null;
          copyright_holder?: string | null;
          attribution?: string | null;
          permission_status?: Database["public"]["Enums"]["permission_status"];
          is_public?: boolean;
          sort_order?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          object_id?: string;
          media_type?: Database["public"]["Enums"]["media_type"];
          storage_path?: string;
          bucket?: string;
          mime_type?: string;
          size_bytes?: number;
          width?: number | null;
          height?: number | null;
          duration_seconds?: number | null;
          checksum?: string | null;
          copyright_holder?: string | null;
          attribution?: string | null;
          permission_status?: Database["public"]["Enums"]["permission_status"];
          is_public?: boolean;
          sort_order?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "media_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "media_object_id_fkey";
            columns: ["object_id"];
            isOneToOne: false;
            referencedRelation: "objects";
            referencedColumns: ["id"];
          },
        ];
      };
      media_translations: {
        Row: {
          id: number;
          media_id: string;
          language_code: string;
          caption: string | null;
          alt_text: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          media_id: string;
          language_code: string;
          caption?: string | null;
          alt_text?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          media_id?: string;
          language_code?: string;
          caption?: string | null;
          alt_text?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "media_translations_language_code_fkey";
            columns: ["language_code"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "media_translations_media_id_fkey";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
        ];
      };
      object_aliases: {
        Row: {
          alias: string;
          object_id: string;
          created_at: string;
        };
        Insert: {
          alias: string;
          object_id: string;
          created_at?: string;
        };
        Update: {
          alias?: string;
          object_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "object_aliases_object_id_fkey";
            columns: ["object_id"];
            isOneToOne: false;
            referencedRelation: "objects";
            referencedColumns: ["id"];
          },
        ];
      };
      object_relations: {
        Row: {
          id: string;
          church_id: string;
          object_id: string;
          related_object_id: string;
          relationship_type: string;
          description: string | null;
          is_public: boolean;
          sort_order: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          church_id: string;
          object_id: string;
          related_object_id: string;
          relationship_type: string;
          description?: string | null;
          is_public?: boolean;
          sort_order?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          church_id?: string;
          object_id?: string;
          related_object_id?: string;
          relationship_type?: string;
          description?: string | null;
          is_public?: boolean;
          sort_order?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "object_relations_church_id_fkey";
            columns: ["church_id"];
            isOneToOne: false;
            referencedRelation: "churches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "object_relations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "object_relations_object_church_fkey";
            columns: ["object_id", "church_id"];
            isOneToOne: false;
            referencedRelation: "objects";
            referencedColumns: ["id", "church_id"];
          },
          {
            foreignKeyName: "object_relations_related_church_fkey";
            columns: ["related_object_id", "church_id"];
            isOneToOne: false;
            referencedRelation: "objects";
            referencedColumns: ["id", "church_id"];
          },
        ];
      };
      object_sources: {
        Row: {
          object_id: string;
          source_id: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          object_id: string;
          source_id: string;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          object_id?: string;
          source_id?: string;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "object_sources_object_id_fkey";
            columns: ["object_id"];
            isOneToOne: false;
            referencedRelation: "objects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "object_sources_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      object_translations: {
        Row: {
          id: number;
          object_id: string;
          language_code: string;
          title: string;
          description: string | null;
          is_complete: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          object_id: string;
          language_code: string;
          title: string;
          description?: string | null;
          is_complete?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          object_id?: string;
          language_code?: string;
          title?: string;
          description?: string | null;
          is_complete?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "object_translations_language_code_fkey";
            columns: ["language_code"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "object_translations_object_id_fkey";
            columns: ["object_id"];
            isOneToOne: false;
            referencedRelation: "objects";
            referencedColumns: ["id"];
          },
        ];
      };
      objects: {
        Row: {
          id: string;
          church_id: string;
          public_id: string;
          object_type: string;
          approximate_date: string | null;
          location_in_church: string | null;
          default_language: string;
          status: Database["public"]["Enums"]["object_status"];
          materials: string | null;
          dimensions: string | null;
          condition_notes: string | null;
          published_at: string | null;
          archived_at: string | null;
          archive_reason: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          church_id: string;
          public_id: string;
          object_type: string;
          approximate_date?: string | null;
          location_in_church?: string | null;
          default_language?: string;
          status?: Database["public"]["Enums"]["object_status"];
          materials?: string | null;
          dimensions?: string | null;
          condition_notes?: string | null;
          published_at?: string | null;
          archived_at?: string | null;
          archive_reason?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          church_id?: string;
          public_id?: string;
          object_type?: string;
          approximate_date?: string | null;
          location_in_church?: string | null;
          default_language?: string;
          status?: Database["public"]["Enums"]["object_status"];
          materials?: string | null;
          dimensions?: string | null;
          condition_notes?: string | null;
          published_at?: string | null;
          archived_at?: string | null;
          archive_reason?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "objects_church_id_fkey";
            columns: ["church_id"];
            isOneToOne: false;
            referencedRelation: "churches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "objects_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "objects_default_language_fkey";
            columns: ["default_language"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["code"];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string;
          is_platform_admin: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          is_platform_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          is_platform_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      publication_history: {
        Row: {
          id: number;
          object_id: string;
          actor_id: string | null;
          from_status: Database["public"]["Enums"]["object_status"] | null;
          to_status: Database["public"]["Enums"]["object_status"];
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          object_id: string;
          actor_id?: string | null;
          from_status?: Database["public"]["Enums"]["object_status"] | null;
          to_status: Database["public"]["Enums"]["object_status"];
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          object_id?: string;
          actor_id?: string | null;
          from_status?: Database["public"]["Enums"]["object_status"] | null;
          to_status?: Database["public"]["Enums"]["object_status"];
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "publication_history_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "publication_history_object_id_fkey";
            columns: ["object_id"];
            isOneToOne: false;
            referencedRelation: "objects";
            referencedColumns: ["id"];
          },
        ];
      };
      review_records: {
        Row: {
          id: number;
          object_id: string;
          actor_id: string;
          review_type: Database["public"]["Enums"]["review_type"];
          decision: Database["public"]["Enums"]["review_decision"];
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          object_id: string;
          actor_id: string;
          review_type: Database["public"]["Enums"]["review_type"];
          decision: Database["public"]["Enums"]["review_decision"];
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          object_id?: string;
          actor_id?: string;
          review_type?: Database["public"]["Enums"]["review_type"];
          decision?: Database["public"]["Enums"]["review_decision"];
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "review_records_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_records_object_id_fkey";
            columns: ["object_id"];
            isOneToOne: false;
            referencedRelation: "objects";
            referencedColumns: ["id"];
          },
        ];
      };
      sources: {
        Row: {
          id: string;
          title: string;
          author: string | null;
          year: string | null;
          citation: string | null;
          url: string | null;
          source_type: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          author?: string | null;
          year?: string | null;
          citation?: string | null;
          url?: string | null;
          source_type?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          author?: string | null;
          year?: string | null;
          citation?: string | null;
          url?: string | null;
          source_type?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sources_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      object_translation_status: {
        Row: {
          object_id: string | null;
          language_code: string | null;
          has_row: boolean | null;
          is_complete: boolean | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      aggregate_and_purge_analytics: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      archive_church: {
        Args: {
          p_church_id: string;
          p_notes: string;
        };
        Returns: undefined;
      };
      audit_admin_mutation: {
        Args: Record<PropertyKey, never>;
        Returns: unknown;
      };
      can_write_object_content: {
        Args: {
          p_object_id: string;
        };
        Returns: boolean;
      };
      claim_object_id: {
        Args: {
          p_claim_id: string;
        };
        Returns: string;
      };
      enforce_object_immutables: {
        Args: Record<PropertyKey, never>;
        Returns: unknown;
      };
      handle_new_user: {
        Args: Record<PropertyKey, never>;
        Returns: unknown;
      };
      has_church_role: {
        Args: {
          p_church: string;
          p_role: Database["public"]["Enums"]["membership_role"];
        };
        Returns: boolean;
      };
      is_any_church_member: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_church_member: {
        Args: {
          p_church: string;
        };
        Returns: boolean;
      };
      is_object_published: {
        Args: {
          p_object_id: string;
        };
        Returns: boolean;
      };
      is_platform_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      media_object_id: {
        Args: {
          p_media_id: string;
        };
        Returns: string;
      };
      object_church_id: {
        Args: {
          p_object_id: string;
        };
        Returns: string;
      };
      record_review: {
        Args: {
          p_object_id: string;
          p_review_type: Database["public"]["Enums"]["review_type"];
          p_decision: Database["public"]["Enums"]["review_decision"];
          p_notes?: string;
        };
        Returns: undefined;
      };
      resolve_public_id: {
        Args: {
          p_public_id: string;
        };
        Returns: {
          object_id: string;
          canonical_public_id: string;
          status: Database["public"]["Enums"]["object_status"];
        }[];
      };
      set_platform_default_language: {
        Args: {
          p_code: string;
        };
        Returns: undefined;
      };
      set_updated_at: {
        Args: Record<PropertyKey, never>;
        Returns: unknown;
      };
      transition_object_status: {
        Args: {
          p_object_id: string;
          p_to: Database["public"]["Enums"]["object_status"];
          p_notes?: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      analytics_event_type: "page_view" | "language_select" | "audio_play" | "audio_complete";
      entity_status: "active" | "archived";
      media_type: "image" | "audio";
      membership_role: "editor" | "historical_reviewer" | "church_approver";
      object_status: "draft" | "historical_review" | "church_review" | "published" | "archived";
      permission_status: "granted" | "public_domain" | "pending" | "restricted";
      review_decision: "approved" | "rejected" | "changes_requested";
      review_type: "historical_review" | "church_approval";
      verification_status: "verified" | "uncertain" | "disputed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DefaultSchema = Database[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof Database },
  TableName extends (DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof Database },
  TableName extends (DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof Database },
  TableName extends (DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof Database },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof Database },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      analytics_event_type: ["page_view", "language_select", "audio_play", "audio_complete"],
      entity_status: ["active", "archived"],
      media_type: ["image", "audio"],
      membership_role: ["editor", "historical_reviewer", "church_approver"],
      object_status: ["draft", "historical_review", "church_review", "published", "archived"],
      permission_status: ["granted", "public_domain", "pending", "restricted"],
      review_decision: ["approved", "rejected", "changes_requested"],
      review_type: ["historical_review", "church_approval"],
      verification_status: ["verified", "uncertain", "disputed"],
    },
  },
} as const;
