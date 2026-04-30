export interface EmployeePerformanceData {
  id: string;
  name: string;
  role: string;
  department: string;
  checkIns: number;
  checkOuts: number;
  revenue: number;
  avgStayTime: number;
  efficiency: number;
  rating: number;
  attendance: number;
  status: "active" | "on_break" | "off";
  lastActivity: string;
  trend: "up" | "down" | "stable";
  shiftHours?: number;
}
