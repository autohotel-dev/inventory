"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  UserCircle,
  Mail,
  Phone,
  Shield,
  Calendar,
  Loader2,
  Users,
  UserCheck,
  UserX,
  ArrowUpDown,
  User,
  Lock,
  Key,
  BadgeCheck,
  Fingerprint,
  Eye,
  EyeOff
} from "lucide-react";
import { Employee, EMPLOYEE_ROLES } from "./types";

export function EmployeesTable() {
  const { success, error: showError } = useToast();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Employee | 'name'; // 'name' is a virtual column for first + last
    direction: 'asc' | 'desc';
  }>({ key: 'first_name', direction: 'asc' });

  // Form state
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    role: "receptionist" as Employee["role"],
    pin_code: "",
    is_active: true,
    create_auth_user: true,
    password: "",
  });

  // Cargar empleados
  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/hr/employees/", { params: { limit: 10000 } });
      const raw = res.data;
      const data = Array.isArray(raw) ? raw : (raw?.items || raw?.results || []);
      // Filter out soft-deleted employees
      setEmployees(data.filter((e: any) => !e.deleted_at));
    } catch (err: any) {
      console.error("Error loading employees:", err);
      showError("Error", err?.response?.data?.detail || err?.message || "No se pudieron cargar los empleados");
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  // Filtrar empleados
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        emp.first_name.toLowerCase().includes(searchLower) ||
        emp.last_name.toLowerCase().includes(searchLower) ||
        emp.email.toLowerCase().includes(searchLower) ||
        emp.role.toLowerCase().includes(searchLower)
      );
    });
  }, [employees, searchTerm]);

  // Ordenar empleados
  const sortedEmployees = useMemo(() => {
    return [...filteredEmployees].sort((a, b) => {
      const { key, direction } = sortConfig;
      let comparison = 0;

      if (key === 'name') {
        const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
        const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
        comparison = nameA.localeCompare(nameB);
      } else if (typeof a[key] === 'string') {
        comparison = (a[key] as string).localeCompare(b[key] as string);
      } else if (typeof a[key] === 'boolean') {
        comparison = (a[key] === b[key]) ? 0 : a[key] ? -1 : 1;
      }

      return direction === 'asc' ? comparison : -comparison;
    });
  }, [filteredEmployees, sortConfig]);

  const handleSort = (key: keyof Employee | 'name') => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Estadísticas
  const stats = {
    total: employees.length,
    active: employees.filter((e) => e.is_active).length,
    inactive: employees.filter((e) => !e.is_active).length,
  };

  // Abrir modal para crear
  const handleCreate = () => {
    setEditingEmployee(null);
    setFormData({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      role: "receptionist",
      pin_code: "",
      is_active: true,
      create_auth_user: true,
      password: "",
    });
    setIsModalOpen(true);
  };

  // Abrir modal para editar
  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      first_name: employee.first_name,
      last_name: employee.last_name,
      email: employee.email,
      phone: employee.phone || "",
      role: employee.role,
      pin_code: employee.pin_code || "",
      is_active: employee.is_active,
      create_auth_user: false,
      password: "",
    });
    setIsModalOpen(true);
  };

  // Guardar empleado
  const handleSave = async () => {
    if (!formData.first_name.trim() || !formData.last_name.trim() || !formData.email.trim()) {
      showError("Error", "Nombre, apellido y email son requeridos");
      return;
    }

    // Validar contraseña de AWS Cognito si se requiere
    const requiresPassword = (!editingEmployee && formData.create_auth_user) || 
                             (editingEmployee && !editingEmployee.auth_user_id && formData.create_auth_user);
                             
    if (requiresPassword) {
      const pwd = formData.password;
      if (!pwd || pwd.length < 8 || !/[A-Z]/.test(pwd) || !/[a-z]/.test(pwd) || !/\d/.test(pwd) || !/[\W_]/.test(pwd)) {
        showError("Contraseña Insegura", "La contraseña debe tener mínimo 8 caracteres, incluir mayúscula, minúscula, número y símbolo especial.");
        return;
      }
    }

    setSaving(true);
    try {
      if (editingEmployee) {
        // Actualizar via FastAPI
        await apiClient.patch(`/hr/employees/${editingEmployee.id}`, {
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || null,
          role: formData.role,
          pin_code: formData.pin_code.trim() || null,
          is_active: formData.is_active,
        });

        // Crear usuario de auth si se solicitó y no tiene uno
        if (formData.create_auth_user && !editingEmployee.auth_user_id) {

          try {
            await apiClient.post("/hr/employees/create-auth-user", {
              email: formData.email.trim(),
              password: formData.password,
              employee_id: editingEmployee.id,
            });
            success("Éxito", "Empleado actualizado y acceso al sistema creado");
            setIsModalOpen(false);
            loadEmployees();
            return;
          } catch (authError: any) {
            const errorMsg = authError?.response?.data?.detail || authError.message || "Error al crear acceso";
            showError("Advertencia", `Empleado actualizado, pero error al crear acceso: ${errorMsg}`);
          }
        }

        success("Éxito", "Empleado actualizado correctamente");
      } else {
        // Crear empleado via FastAPI
        const res = await apiClient.post("/hr/employees/", {
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || null,
          role: formData.role,
          pin_code: formData.pin_code.trim() || null,
          is_active: formData.is_active,
        });

        const newEmployee = res.data;

        // Crear usuario de auth si está habilitado
        if (formData.create_auth_user && newEmployee) {
          try {
            await apiClient.post("/hr/employees/create-auth-user", {
              email: formData.email.trim(),
              password: formData.password,
              employee_id: newEmployee.id,
            });
            success("Éxito", "Empleado y usuario de acceso creados correctamente");
          } catch (authError: any) {
            const errorMsg = authError?.response?.data?.detail || authError.message || "Error al crear acceso";
            showError(
              "Advertencia",
              `Empleado creado, pero error al crear usuario: ${errorMsg}. El empleado deberá iniciar sesión manualmente.`
            );
          }
        } else {
          success("Éxito", "Empleado creado correctamente");
        }
      }

      setIsModalOpen(false);
      loadEmployees();
    } catch (err: any) {
      console.error("Error saving employee:", err);
      const msg = err?.response?.data?.detail || err.message || "No se pudo guardar el empleado";
      if (typeof msg === 'string' && (msg.includes('duplicate') || msg.includes('unique'))) {
        showError("Error", "Ya existe un empleado con ese email");
      } else {
        showError("Error", msg);
      }
    } finally {
      setSaving(false);
    }
  };

  // Eliminar empleado (Soft Delete)
  const handleDelete = async () => {
    if (!editingEmployee) return;

    setSaving(true);
    try {
      // Soft delete via FastAPI - mark as deleted and free the email
      const timestamp = new Date().getTime();
      const deletedEmail = `deleted_${timestamp}_${editingEmployee.email}`;

      await apiClient.patch(`/hr/employees/${editingEmployee.id}`, {
        deleted_at: new Date().toISOString(),
        is_active: false,
        email: deletedEmail,
      });

      success("Éxito", "Empleado eliminado correctamente");
      setIsDeleteModalOpen(false);
      setEditingEmployee(null);
      loadEmployees();
    } catch (err: any) {
      console.error("Error deleting employee:", err);
      showError("Error", err?.response?.data?.detail || err.message || "No se pudo eliminar el empleado");
    } finally {
      setSaving(false);
    }
  };

  // Obtener color del rol
  const getRoleBadge = (role: Employee["role"]) => {
    const roleConfig = EMPLOYEE_ROLES.find((r) => r.value === role);
    return (
      <Badge className={`${roleConfig?.color || "bg-gray-500"} text-white`}>
        {roleConfig?.label || role}
      </Badge>
    );
  };

  // Prevenir re-renders masivos de la tabla al escribir en el formulario
  const renderTableRows = useMemo(() => {
    if (loading) {
      return (
        <TableRow>
          <TableCell colSpan={5} className="text-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            <p className="text-muted-foreground mt-2">Cargando empleados...</p>
          </TableCell>
        </TableRow>
      );
    }
    if (sortedEmployees.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={5} className="text-center py-8">
            <UserCircle className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground mt-2">
              {searchTerm ? "No se encontraron empleados" : "No hay empleados registrados"}
            </p>
          </TableCell>
        </TableRow>
      );
    }
    
    return sortedEmployees.map((employee) => (
      <TableRow key={employee.id}>
        <TableCell>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-medium">
                {employee.first_name[0]}
                {employee.last_name[0]}
              </span>
            </div>
            <div>
              <p className="font-medium">
                {employee.first_name} {employee.last_name}
              </p>
              {employee.hired_at && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Desde {new Date(employee.hired_at).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </TableCell>
        <TableCell>
          <div className="space-y-1">
            <p className="text-sm flex items-center gap-1">
              <Mail className="h-3 w-3 text-muted-foreground" />
              {employee.email}
            </p>
            {employee.phone && (
              <p className="text-sm flex items-center gap-1">
                <Phone className="h-3 w-3 text-muted-foreground" />
                {employee.phone}
              </p>
            )}
          </div>
        </TableCell>
        <TableCell>{getRoleBadge(employee.role)}</TableCell>
        <TableCell>
          <div className="flex flex-col gap-1">
            <Badge variant={employee.is_active ? "default" : "secondary"}>
              {employee.is_active ? "Activo" : "Inactivo"}
            </Badge>
            {employee.auth_user_id ? (
              <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">
                <Shield className="h-3 w-3 mr-1" />
                Vinculado
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
                Sin vincular
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleEdit(employee)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-red-500 hover:text-red-600"
              onClick={() => {
                setEditingEmployee(employee);
                setIsDeleteModalOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    ));
  }, [loading, sortedEmployees, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Header con estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border rounded-lg p-4 flex items-center gap-4">
          <div className="p-3 rounded-full bg-blue-500/10">
            <Users className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Empleados</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4 flex items-center gap-4">
          <div className="p-3 rounded-full bg-green-500/10">
            <UserCheck className="h-6 w-6 text-green-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Activos</p>
            <p className="text-2xl font-bold">{stats.active}</p>
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4 flex items-center gap-4">
          <div className="p-3 rounded-full bg-red-500/10">
            <UserX className="h-6 w-6 text-red-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Inactivos</p>
            <p className="text-2xl font-bold">{stats.inactive}</p>
          </div>
        </div>
      </div>

      {/* Barra de acciones */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar empleados..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Empleado
        </Button>
      </div>

      {/* Tabla */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('name')} className="flex items-center gap-1 p-0 hover:bg-transparent -ml-2">
                  Empleado <ArrowUpDown className="h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('email')} className="flex items-center gap-1 p-0 hover:bg-transparent">
                  Contacto <ArrowUpDown className="h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('role')} className="flex items-center gap-1 p-0 hover:bg-transparent">
                  Rol <ArrowUpDown className="h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('is_active')} className="flex items-center gap-1 p-0 hover:bg-transparent">
                  Estado <ArrowUpDown className="h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {renderTableRows}
          </TableBody>
        </Table>
      </div>

      {/* Modal de crear/editar */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-[95vw] sm:w-full max-w-lg p-0 overflow-hidden bg-background/95 backdrop-blur-xl border-zinc-800/60 shadow-2xl">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 via-blue-500 to-purple-600"></div>
          
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-white/5 bg-white/5">
            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-primary" />
              {editingEmployee ? "Editar Perfil del Empleado" : "Registrar Nuevo Empleado"}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              {editingEmployee
                ? "Actualiza la información de contacto, rol y acceso al sistema."
                : "Ingresa los datos para registrar un empleado y concederle acceso."}
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
            {/* Información Básica */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name" className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Nombre</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    placeholder="Juan"
                    className="pl-9 bg-zinc-900/50 border-zinc-800 focus:border-primary/50 transition-colors"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name" className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Apellido</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    placeholder="Pérez"
                    className="pl-9 bg-zinc-900/50 border-zinc-800 focus:border-primary/50 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Contacto */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="email" className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Correo Electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="juan@ejemplo.com"
                    className="pl-9 bg-zinc-900/50 border-zinc-800 focus:border-primary/50 transition-colors"
                  />
                </div>
              </div>
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="phone" className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Teléfono</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+52 123 456 7890"
                    className="pl-9 bg-zinc-900/50 border-zinc-800 focus:border-primary/50 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Configuración de Puesto */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role" className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Rol Asignado</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: Employee["role"]) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger className="bg-zinc-900/50 border-zinc-800 focus:ring-primary/50 transition-colors">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {EMPLOYEE_ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pin_code" className="text-xs font-medium text-zinc-400 uppercase tracking-wider">PIN Rápido (Opcional)</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    id="pin_code"
                    type={showPin ? "text" : "password"}
                    maxLength={6}
                    value={formData.pin_code}
                    onChange={(e) => setFormData({ ...formData, pin_code: e.target.value.replace(/\D/g, "") })}
                    placeholder="••••••"
                    className="pl-9 pr-9 bg-zinc-900/50 border-zinc-800 focus:border-primary/50 transition-colors text-center font-mono tracking-widest text-zinc-100 placeholder:text-zinc-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Estado de Cuenta */}
            <div className="flex items-center justify-between bg-zinc-900/40 p-4 rounded-xl border border-white/5">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Estado Operativo</Label>
                <p className="text-xs text-muted-foreground">Define si el empleado está activo en la nómina.</p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>

            {/* Accesos al Sistema (AWS Cognito) */}
            <div className="bg-primary/5 border border-primary/20 p-5 rounded-xl space-y-5">
              <div className="flex items-center gap-3 border-b border-primary/10 pb-3">
                <div className="p-2 bg-primary/20 rounded-lg">
                  <Fingerprint className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Acceso al Sistema</h3>
                  <p className="text-xs text-primary/70">Credenciales AWS Cognito</p>
                </div>
              </div>

              {editingEmployee && (
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Estado actual:</span>
                  {editingEmployee.auth_user_id ? (
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                      <BadgeCheck className="h-3 w-3 mr-1" />
                      Vinculado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                      Sin vincular
                    </Badge>
                  )}
                </div>
              )}

              {(!editingEmployee || !editingEmployee.auth_user_id) && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5 pr-4">
                      <Label className="text-sm font-medium text-zinc-200">Generar Acceso Digital</Label>
                      <p className="text-xs text-zinc-500">Permitirá iniciar sesión usando su email y contraseña.</p>
                    </div>
                    <Switch
                      checked={formData.create_auth_user}
                      onCheckedChange={(checked) => setFormData({ ...formData, create_auth_user: checked })}
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>

                  {formData.create_auth_user && (
                    <div className="space-y-2 animate-in slide-in-from-top-2 fade-in duration-200">
                      <Label htmlFor="password" className="text-xs font-medium text-primary/80 uppercase tracking-wider">Contraseña Maestra</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          placeholder="Mayúscula, minúscula, número y símbolo"
                          className="pl-9 pr-9 bg-black/40 border-primary/30 focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all text-zinc-100 placeholder:text-zinc-600"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-primary transition-colors"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1">
                        <Shield className="h-3 w-3" /> Política de seguridad obligatoria (Mín. 8 caracteres)
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="px-6 py-4 bg-zinc-900/40 border-t border-white/5 sm:justify-between">
            <Button variant="ghost" className="hover:bg-white/5" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingEmployee ? "Guardar Cambios" : "Confirmar Registro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación de eliminación */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="w-[95vw] sm:w-full max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar Empleado</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar a{" "}
              <strong>
                {editingEmployee?.first_name} {editingEmployee?.last_name}
              </strong>
              ? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
