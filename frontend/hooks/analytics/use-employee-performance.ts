import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { EmployeePerformanceData } from "@/components/analytics/employee-performance/types";

export function useEmployeePerformance() {
  const [employees, setEmployees] = useState<EmployeePerformanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sortBy, setSortBy] = useState("efficiency");

  useEffect(() => {
    const fetchEmployeePerformance = async () => {
      setLoading(true);
      try {
        const { apiClient } = await import("@/lib/api/client");
        const today = new Date().toISOString().split('T')[0];
        
        const { data } = await apiClient.get(`/analytics/employee-performance?date=${today}`);
        
        if (data && Array.isArray(data)) {
          setEmployees(data);
        } else {
          setEmployees([]);
        }
      } catch (error) {
        console.error("Error fetching employee performance:", error);
        setEmployees([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployeePerformance();
    const interval = setInterval(fetchEmployeePerformance, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredEmployees = useMemo(() => {
    return employees.filter(employee => {
      const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.role.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === "all" || employee.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [employees, searchTerm, roleFilter]);

  const sortedEmployees = useMemo(() => {
    return [...filteredEmployees].sort((a, b) => {
      switch (sortBy) {
        case "efficiency":
          return b.efficiency - a.efficiency;
        case "revenue":
          return b.revenue - a.revenue;
        case "rating":
          return b.rating - a.rating;
        case "checkIns":
          return b.checkIns - a.checkIns;
        default:
          return 0;
      }
    });
  }, [filteredEmployees, sortBy]);

  return {
    employees,
    sortedEmployees,
    loading,
    searchTerm,
    setSearchTerm,
    roleFilter,
    setRoleFilter,
    sortBy,
    setSortBy
  };
}
