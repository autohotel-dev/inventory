"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient, fetchAuthUserDeduped } from "@/lib/api/client";
import { useLuxorRealtime } from "./use-luxor-realtime";
import { Hub } from "aws-amplify/utils";

export type UserRole = "admin" | "manager" | "supervisor" | "receptionist" | "cochero" | "camarista" | "mantenimiento" | null;

interface UserRoleData {
  role: UserRole;
  employeeId: string | null;
  employeeName: string | null;
  userId: string | null;
  userEmail: string | null;
  isLoading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isSupervisor: boolean;
  isReceptionist: boolean;
  isValet: boolean;
  isHousekeeping: boolean;
  isMaintenance: boolean;
  canAccessAdmin: boolean;
  canAccessReports: boolean;
  canAccessEmployees: boolean;
  canAccessInventory: boolean;
  canAccessPOS: boolean;
  canAccessRooms: boolean;
  canAccessShiftClosing: boolean;
  hasActiveShift: boolean;
}

export function useUserRole(): UserRoleData {
  const [role, setRole] = useState<UserRole>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [hasActiveShift, setHasActiveShift] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserRole = useCallback(async () => {
    try {
      // Intentamos obtener el usuario actual mediante el BFF API
      const res = await fetchAuthUserDeduped();
      const data = res?.data;

      if (data) {
        setRole(data.role as UserRole);
        setEmployeeId(data.employeeId);
        setEmployeeName(data.employeeName);
        setUserId(data.userId);
        setUserEmail(data.userEmail);
        setHasActiveShift(data.hasActiveShift);
      } else {
        // Usuario no autenticado (ej: 401) o sin datos
        setRole(null);
        setEmployeeId(null);
        setEmployeeName(null);
        setUserId(null);
        setUserEmail(null);
        setHasActiveShift(false);
      }
    } catch (err: any) {
      console.error("Error fetching user role:", err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        setRole(null);
        setEmployeeId(null);
        setEmployeeName(null);
        setUserId(null);
        setUserEmail(null);
      } else {
        // Network error o 5xx (ej: reinicio del servidor)
        // Mantenemos el rol actual si existe, o usamos admin por defecto para evitar
        // degradar la sesión durante un reinicio transitorio.
        setRole(prev => prev || "admin");
      }
      setHasActiveShift(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserRole();

    // Escuchar cambios de autenticación de Amplify
    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedIn' || payload.event === 'signedOut') {
        fetchUserRole();
      }
    });

    return () => unsubscribe();
  }, [fetchUserRole]);

  // Suscripción realtime para cambios en shift_sessions del empleado
  // Usamos el hook de WebSockets ya implementado
  useLuxorRealtime('shift_sessions', (payload) => {
    // Si la sesión de turno del empleado actual cambió, recargar su info
    if (payload.record?.employee_id === employeeId || payload.old_record?.employee_id === employeeId) {
      console.log('[WEB SHIFT SYNC] Shift change detected for employee:', employeeId);
      fetchUserRole();
    }
  });

  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isSupervisor = role === "supervisor";
  const isReceptionist = role === "receptionist";
  const isValet = role === "cochero";
  const isHousekeeping = role === "camarista";
  const isMaintenance = role === "mantenimiento";
  const canAccessAdmin = isAdmin || isManager || isSupervisor;

  return {
    role,
    employeeId,
    employeeName,
    userId,
    userEmail,
    isLoading,
    isAdmin,
    isManager,
    isSupervisor,
    isReceptionist,
    isValet,
    isHousekeeping,
    isMaintenance,
    canAccessAdmin,
    canAccessReports: canAccessAdmin,
    canAccessEmployees: canAccessAdmin,
    canAccessInventory: canAccessAdmin,
    canAccessPOS: true,
    canAccessRooms: true,
    canAccessShiftClosing: !isValet && !isHousekeeping && !isMaintenance,
    hasActiveShift,
  };
}
