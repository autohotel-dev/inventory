import { useState, useEffect, useCallback } from "react";
import { apiClient } from '../lib/api/client';
import { getCurrentUser, fetchUserAttributes } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import { useRealtimeSubscription } from '../lib/api/websocket';

export type UserRole = "admin" | "manager" | "receptionist" | "cochero" | "camarista" | "mantenimiento" | null;

interface UserRoleData {
  role: UserRole;
  employeeId: string | null;
  employeeName: string | null;
  userId: string | null;
  userEmail: string | null;
  isLoading: boolean;
  isValet: boolean;
  hasActiveShift: boolean;
  refresh: () => Promise<void>;
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
    setIsLoading(true); // CRITICAL: signal consumers to wait for fresh data
    try {
      let authUser;
      try {
        authUser = await getCurrentUser();
      } catch (userError) {
        setRole(null);
        setUserId(null);
        setUserEmail(null);
        setHasActiveShift(false);
        setIsLoading(false);
        return;
      }

      let email = null;
      try {
        const attrs = await fetchUserAttributes();
        email = attrs.email || null;
      } catch (e) {
        // Ignorar si no podemos traer el email
      }

      setUserId(authUser.userId);
      setUserEmail(email);

      // Search for linked employee
      let employee = null;
      try {
        const { data: emps } = await apiClient.get('/system/crud/employees', {
            params: {
                select: 'id,first_name,last_name,role',
                auth_user_id: authUser.userId,
                is_active: 'true',
                limit: 1
            }
        });
        employee = emps?.[0];

        if (!employee && email) {
            console.log("[SHIFT DEBUG] No direct employee link, trying email fallback...");
            const { data: empsByEmail } = await apiClient.get('/system/crud/employees', {
                params: {
                    select: 'id,first_name,last_name,role',
                    email: email,
                    is_active: 'true',
                    limit: 1
                }
            });
            employee = empsByEmail?.[0];
        }
      } catch (err) {
        console.log("[SHIFT DEBUG] Error fetching employee", err);
      }

      if (!employee) {
        console.log("[SHIFT DEBUG] Employee not found for user:", email);
        setRole(null); // Valet app only for linked employees
        setHasActiveShift(false);
      } else {
        console.log("[SHIFT DEBUG] Employee found:", employee.id, employee.role);
        setRole(employee.role as UserRole);
        setEmployeeId(employee.id);
        setEmployeeName(`${employee.first_name} ${employee.last_name}`);

        // Check for active shift
        try {
          const { data: sessions } = await apiClient.get('/system/crud/shift_sessions', {
            params: {
              select: 'id,status',
              employee_id: employee.id,
              status: 'active',
              limit: 1
            }
          });
          const session = sessions?.[0];
          console.log("[SHIFT DEBUG] Shift session result:", session);
          setHasActiveShift(!!session);
        } catch (shiftError) {
          console.error("[SHIFT DEBUG] Error checking shift:", shiftError);
          setHasActiveShift(false);
        }
      }
    } catch (err) {
      console.error("Error fetching user role:", err);
      setHasActiveShift(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserRole();

    const unsubscribe = Hub.listen('auth', (data) => {
      if (data.payload.event === 'signedIn' || data.payload.event === 'signedOut') {
        fetchUserRole();
      }
    });

    return () => unsubscribe();
  }, [fetchUserRole]);

  // Subscripción en tiempo real para cambios de turno
  const unsubscribeWS = useRealtimeSubscription(`employee:${employeeId}`, () => {
    console.log("[SHIFT SYNC] Shift change detected");
    fetchUserRole();
  });

  useEffect(() => {
    return () => {
      unsubscribeWS();
    };
  }, [unsubscribeWS]);

  return {
    role,
    employeeId,
    employeeName,
    userId,
    userEmail,
    isLoading,
    isValet: role === "cochero",
    hasActiveShift,
    refresh: fetchUserRole,
  };
}
