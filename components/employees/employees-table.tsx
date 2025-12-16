"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
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
} from "lucide-react";
import { Employee, EMPLOYEE_ROLES } from "./types";

export function EmployeesTable() {
  const supabase = createClient();
  const { success, error: showError } = useToast();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);

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
  const loadEmployees = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("*, auth_user_id")
        .order("first_name", { ascending: true });

      if (error) throw error;
      setEmployees(data || []);
    } catch (err: any) {
      console.error("Error loading employees:", err);
      if (err?.code === "42P01" || err?.message?.includes("does not exist")) {
        showError("Tablas no encontradas", "Ejecuta el script SQL create-shifts-system.sql en Supabase");
      } else {
        showError("Error", err?.message || "No se pudieron cargar los empleados");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  // Filtrar empleados
  const filteredEmployees = employees.filter((emp) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      emp.first_name.toLowerCase().includes(searchLower) ||
      emp.last_name.toLowerCase().includes(searchLower) ||
      emp.email.toLowerCase().includes(searchLower) ||
      emp.role.toLowerCase().includes(searchLower)
    );
  });

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

    // Validar contraseña si se va a crear usuario
    if (!editingEmployee && formData.create_auth_user) {
      if (!formData.password || formData.password.length < 6) {
        showError("Error", "La contraseña debe tener al menos 6 caracteres");
        return;
      }
    }

    setSaving(true);
    try {
      if (editingEmployee) {
        // Actualizar
        const { error } = await supabase
          .from("employees")
          .update({
            first_name: formData.first_name.trim(),
            last_name: formData.last_name.trim(),
            email: formData.email.trim(),
            phone: formData.phone.trim() || null,
            role: formData.role,
            pin_code: formData.pin_code.trim() || null,
            is_active: formData.is_active,
          })
          .eq("id", editingEmployee.id);

        if (error) throw error;

        // Crear usuario de auth si se solicitó y no tiene uno
        if (formData.create_auth_user && !editingEmployee.auth_user_id) {
          if (!formData.password || formData.password.length < 6) {
            showError("Error", "La contraseña debe tener al menos 6 caracteres");
            setSaving(false);
            return;
          }

          const authResponse = await fetch("/api/employees/create-auth-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: formData.email.trim(),
              password: formData.password,
              employeeId: editingEmployee.id,
            }),
          });

          const authResult = await authResponse.json();

          if (!authResponse.ok) {
            showError("Advertencia", `Empleado actualizado, pero error al crear acceso: ${authResult.error}`);
          } else {
            success("Éxito", "Empleado actualizado y acceso al sistema creado");
            setIsModalOpen(false);
            loadEmployees();
            return;
          }
        }

        success("Éxito", "Empleado actualizado correctamente");
      } else {
        // Crear empleado
        const { data: newEmployee, error } = await supabase
          .from("employees")
          .insert({
            first_name: formData.first_name.trim(),
            last_name: formData.last_name.trim(),
            email: formData.email.trim(),
            phone: formData.phone.trim() || null,
            role: formData.role,
            pin_code: formData.pin_code.trim() || null,
            is_active: formData.is_active,
          })
          .select("id")
          .single();

        if (error) {
          if (error.code === "23505" || error.message?.includes("duplicate") || error.message?.includes("unique")) {
            throw new Error("Ya existe un empleado con ese email");
          }
          throw error;
        }

        // Crear usuario en Supabase Auth si está habilitado
        if (formData.create_auth_user && newEmployee) {
          const authResponse = await fetch("/api/employees/create-auth-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: formData.email.trim(),
              password: formData.password,
              employeeId: newEmployee.id,
            }),
          });

          const authResult = await authResponse.json();

          if (!authResponse.ok) {
            // El empleado se creó pero el usuario de auth falló
            showError(
              "Advertencia",
              `Empleado creado, pero error al crear usuario: ${authResult.error}. El empleado deberá iniciar sesión manualmente.`
            );
          } else {
            success("Éxito", "Empleado y usuario de acceso creados correctamente");
          }
        } else {
          success("Éxito", "Empleado creado correctamente");
        }
      }

      setIsModalOpen(false);
      loadEmployees();
    } catch (err: any) {
      console.error("Error saving employee:", err);
      showError("Error", err.message || "No se pudo guardar el empleado");
    } finally {
      setSaving(false);
    }
  };

  // Eliminar empleado
  const handleDelete = async () => {
    if (!editingEmployee) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("employees")
        .delete()
        .eq("id", editingEmployee.id);

      if (error) throw error;
      success("Éxito", "Empleado eliminado correctamente");
      setIsDeleteModalOpen(false);
      setEditingEmployee(null);
      loadEmployees();
    } catch (err: any) {
      console.error("Error deleting employee:", err);
      showError("Error", err.message || "No se pudo eliminar el empleado");
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
              <TableHead>Empleado</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  <p className="text-muted-foreground mt-2">Cargando empleados...</p>
                </TableCell>
              </TableRow>
            ) : filteredEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <UserCircle className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <p className="text-muted-foreground mt-2">
                    {searchTerm ? "No se encontraron empleados" : "No hay empleados registrados"}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredEmployees.map((employee) => (
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
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal de crear/editar */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingEmployee ? "Editar Empleado" : "Nuevo Empleado"}
            </DialogTitle>
            <DialogDescription>
              {editingEmployee
                ? "Modifica los datos del empleado"
                : "Ingresa los datos del nuevo empleado"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">Nombre *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) =>
                    setFormData({ ...formData, first_name: e.target.value })
                  }
                  placeholder="Juan"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Apellido *</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) =>
                    setFormData({ ...formData, last_name: e.target.value })
                  }
                  placeholder="Pérez"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="juan@ejemplo.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="+52 123 456 7890"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">Rol *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: Employee["role"]) =>
                    setFormData({ ...formData, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPLOYEE_ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pin_code">PIN (opcional)</Label>
                <Input
                  id="pin_code"
                  type="password"
                  maxLength={6}
                  value={formData.pin_code}
                  onChange={(e) =>
                    setFormData({ ...formData, pin_code: e.target.value.replace(/\D/g, "") })
                  }
                  placeholder="••••••"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                Empleado activo
              </Label>
            </div>

            {/* Sección de acceso al sistema - solo al crear */}
            {!editingEmployee && (
              <div className="border-t pt-4 mt-4 space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="create_auth_user"
                    checked={formData.create_auth_user}
                    onChange={(e) =>
                      setFormData({ ...formData, create_auth_user: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="create_auth_user" className="cursor-pointer font-medium">
                    Crear acceso al sistema
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground -mt-2">
                  Permite que el empleado inicie sesión en el sistema con su email y contraseña
                </p>

                {formData.create_auth_user && (
                  <div className="space-y-2 pl-6 border-l-2 border-primary/20">
                    <Label htmlFor="password">Contraseña *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      placeholder="Mínimo 6 caracteres"
                      minLength={6}
                    />
                    <p className="text-xs text-muted-foreground">
                      El empleado usará esta contraseña para iniciar sesión
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Mostrar estado de vinculación al editar */}
            {editingEmployee && (
              <div className="border-t pt-4 mt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Acceso al sistema:</span>
                  {editingEmployee.auth_user_id ? (
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                      Vinculado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                      Sin vincular
                    </Badge>
                  )}
                </div>
                
                {/* Opción para crear acceso a empleados existentes */}
                {!editingEmployee.auth_user_id && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="create_auth_user_edit"
                        checked={formData.create_auth_user}
                        onChange={(e) =>
                          setFormData({ ...formData, create_auth_user: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor="create_auth_user_edit" className="cursor-pointer">
                        Crear acceso al sistema ahora
                      </Label>
                    </div>
                    
                    {formData.create_auth_user && (
                      <div className="space-y-2 pl-6 border-l-2 border-primary/20">
                        <Label htmlFor="password_edit">Contraseña *</Label>
                        <Input
                          id="password_edit"
                          type="password"
                          value={formData.password}
                          onChange={(e) =>
                            setFormData({ ...formData, password: e.target.value })
                          }
                          placeholder="Mínimo 6 caracteres"
                          minLength={6}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingEmployee ? "Guardar Cambios" : "Crear Empleado"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación de eliminación */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="max-w-sm">
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
