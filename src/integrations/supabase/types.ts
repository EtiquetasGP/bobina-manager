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
      bobinas: {
        Row: {
          cantidad_actual: number
          codigo_etiqueta: string
          descripcion: string
          estado: string | null
          fecha_ingreso: string
          fecha_vencimiento: string
          id_bobina: string
          origen_alta: string | null
          proveedor: string | null
          ubicacion: string | null
          ultima_fecha_devolucion: string | null
          ultima_linea: string | null
          ultimo_operario_devolucion: string | null
          vigencia: string
        }
        Insert: {
          cantidad_actual: number
          codigo_etiqueta: string
          descripcion: string
          estado?: string | null
          fecha_ingreso: string
          fecha_vencimiento: string
          id_bobina?: string
          origen_alta?: string | null
          proveedor?: string | null
          ubicacion?: string | null
          ultima_fecha_devolucion?: string | null
          ultima_linea?: string | null
          ultimo_operario_devolucion?: string | null
          vigencia: string
        }
        Update: {
          cantidad_actual?: number
          codigo_etiqueta?: string
          descripcion?: string
          estado?: string | null
          fecha_ingreso?: string
          fecha_vencimiento?: string
          id_bobina?: string
          origen_alta?: string | null
          proveedor?: string | null
          ubicacion?: string | null
          ultima_fecha_devolucion?: string | null
          ultima_linea?: string | null
          ultimo_operario_devolucion?: string | null
          vigencia?: string
        }
        Relationships: [
          {
            foreignKeyName: "bobinas_codigo_etiqueta_fkey"
            columns: ["codigo_etiqueta"]
            isOneToOne: false
            referencedRelation: "etiquetas"
            referencedColumns: ["codigo_etiqueta"]
          },
        ]
      }
      etiquetas: {
        Row: {
          codigo_etiqueta: string
          descripcion: string
        }
        Insert: {
          codigo_etiqueta: string
          descripcion: string
        }
        Update: {
          codigo_etiqueta?: string
          descripcion?: string
        }
        Relationships: []
      }
      movimientos: {
        Row: {
          cantidad: number
          fecha: string
          id_bobina: string
          id_movimiento: number
          linea: string | null
          observacion: string | null
          operario: string | null
          tipo_movimiento: string
          ubicacion: string | null
        }
        Insert: {
          cantidad: number
          fecha?: string
          id_bobina: string
          id_movimiento?: number
          linea?: string | null
          observacion?: string | null
          operario?: string | null
          tipo_movimiento: string
          ubicacion?: string | null
        }
        Update: {
          cantidad?: number
          fecha?: string
          id_bobina?: string
          id_movimiento?: number
          linea?: string | null
          observacion?: string | null
          operario?: string | null
          tipo_movimiento?: string
          ubicacion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_id_bobina_fkey"
            columns: ["id_bobina"]
            isOneToOne: false
            referencedRelation: "bobinas"
            referencedColumns: ["id_bobina"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      actualizar_vigencias: { Args: never; Returns: undefined }
      consultar_bobina: {
        Args: { p_id_bobina: string }
        Returns: {
          cantidad_actual: number
          codigo_etiqueta: string
          descripcion: string
          estado: string
          fecha_ingreso: string
          fecha_vencimiento: string
          id_bobina: string
          operario_ingreso: string
          origen_alta: string
          proveedor: string
          ubicacion: string
          ultima_fecha_devolucion: string
          ultima_linea: string
          ultimo_operario_devolucion: string
          vigencia: string
        }[]
      }
      registrar_alta_inventario: {
        Args: {
          p_cantidad: number
          p_codigo_etiqueta: string
          p_descripcion: string
          p_fecha_ingreso: string
          p_observacion?: string
          p_operario: string
          p_proveedor: string
          p_ubicacion: string
        }
        Returns: string
      }
      registrar_devolucion: {
        Args: {
          p_cantidad: number
          p_id_bobina: string
          p_linea: string
          p_observacion?: string
          p_operario: string
          p_ubicacion: string
        }
        Returns: string
      }
      registrar_inventario_existente: {
        Args: {
          p_cantidad: number
          p_id_bobina: string
          p_observacion?: string
          p_operario: string
          p_ubicacion: string
        }
        Returns: string
      }
      registrar_recepcion: {
        Args: {
          p_cantidad: number
          p_codigo_etiqueta: string
          p_descripcion: string
          p_operario: string
          p_proveedor: string
          p_ubicacion: string
        }
        Returns: string
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
