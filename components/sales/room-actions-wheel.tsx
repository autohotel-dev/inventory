"use client";

import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DollarSign, DoorOpen, Sparkles, Lock, FileText, Clock, UserPlus, UserMinus, CreditCard, UserCheck, Receipt, ListChecks, ShoppingBag, Zap, Car, ArrowRightLeft, XCircle, Users } from "lucide-react";
import { Room } from "@/components/sales/room-types";

export interface RoomActionsWheelProps {
  room: Room | null;
  isOpen: boolean;
  isVisible: boolean;
  actionLoading: boolean;
  statusBadge: ReactNode;
  hasExtraCharges?: boolean; // Indica si hay cargos extra pendientes
  isHotelRoom?: boolean; // Si es habitación de hotel/torre (sin tolerancia)
  onClose: () => void;
  onStartStay: () => void;
  onCheckout: () => void;
  onPayExtra: () => void; // Pagar solo extras sin checkout
  onViewSale: () => void;
  onViewDetails: () => void; // Ver detalles de pagos y consumos
  onGranularPayment: () => void; // Cobrar por concepto individual
  onAddConsumption: () => void; // Agregar consumo/producto
  onAddPerson: () => void; // Entra persona nueva (siempre cobra extra si >2)
  onRemovePerson: () => void; // Sale persona (sin tolerancia, se fue definitivamente)
  onPersonLeftReturning: () => void; // Salió pero va a regresar (inicia tolerancia 1h, solo motel)
  onAddHour: () => void;
  onMarkClean: () => void;
  onBlock: () => void;
  onUnblock: () => void;
  onQuickCheckin: () => void; // Entrada rápida sin pago
  onEditVehicle: () => void; // Editar datos del vehículo
  onChangeRoom: () => void; // Cambiar de habitación
  onCancelStay: () => void; // Cancelar estancia
  onManagePeople: () => void; // Gestión de personas (modal unificado)
  onMarkDirty: () => void; // Marcar como sucia/mantenimiento
}

// Tipo para las acciones
type ActionKey = 'onStartStay' | 'onCheckout' | 'onPayExtra' | 'onViewSale' | 'onViewDetails' | 'onGranularPayment' | 'onAddConsumption' | 'onAddPerson' | 'onRemovePerson' | 'onPersonLeftReturning' | 'onAddHour' | 'onMarkClean' | 'onBlock' | 'onUnblock' | 'onQuickCheckin' | 'onEditVehicle' | 'onChangeRoom' | 'onCancelStay' | 'onManagePeople' | 'onMarkDirty';

interface ActionConfig {
  id: string;
  label: string;
  icon: ReactNode;
  color: string;
  hoverBg: string;
  action: ActionKey;
  showOnlyWithExtra?: boolean; // Solo mostrar si hay cargos extra
  hideForHotel?: boolean; // Ocultar para habitaciones de hotel/torre
}

// Configuración de acciones por estado
const ACTIONS_BY_STATUS: Record<string, ActionConfig[]> = {
  LIBRE: [
    { id: "start", label: "Entrada", icon: <DoorOpen className="h-5 w-5" />, color: "text-blue-400", hoverBg: "hover:bg-blue-500/30", action: "onStartStay" },
    { id: "quickcheckin", label: "Rápida", icon: <Zap className="h-5 w-5" />, color: "text-amber-400", hoverBg: "hover:bg-amber-500/30", action: "onQuickCheckin" },
    { id: "block", label: "Bloquear", icon: <Lock className="h-5 w-5" />, color: "text-gray-400", hoverBg: "hover:bg-gray-500/30", action: "onBlock" },
    { id: "dirty", label: "Mantenimiento", icon: <Sparkles className="h-5 w-5" />, color: "text-purple-400", hoverBg: "hover:bg-purple-500/30", action: "onMarkDirty" },
  ],
  OCUPADA: [
    { id: "checkout", label: "Salida", icon: <DoorOpen className="h-5 w-5" />, color: "text-emerald-400", hoverBg: "hover:bg-emerald-500/30", action: "onCheckout" },
    { id: "granular", label: "Cobrar", icon: <ListChecks className="h-5 w-5" />, color: "text-lime-400", hoverBg: "hover:bg-lime-500/30", action: "onGranularPayment" },
    { id: "consumption", label: "Consumo", icon: <ShoppingBag className="h-5 w-5" />, color: "text-green-400", hoverBg: "hover:bg-green-500/30", action: "onAddConsumption" },
    { id: "payextra", label: "Pagar Todo", icon: <CreditCard className="h-5 w-5" />, color: "text-yellow-400", hoverBg: "hover:bg-yellow-500/30", action: "onPayExtra", showOnlyWithExtra: true },
    { id: "details", label: "Detalles", icon: <Receipt className="h-5 w-5" />, color: "text-sky-400", hoverBg: "hover:bg-sky-500/30", action: "onViewDetails" },
    { id: "vehicle", label: "Vehículo", icon: <Car className="h-5 w-5" />, color: "text-blue-400", hoverBg: "hover:bg-blue-500/30", action: "onEditVehicle" },
    { id: "changeroom", label: "Cambiar", icon: <ArrowRightLeft className="h-5 w-5" />, color: "text-indigo-400", hoverBg: "hover:bg-indigo-500/30", action: "onChangeRoom" },
    { id: "managePeople", label: "Personas", icon: <Users className="h-5 w-5" />, color: "text-purple-400", hoverBg: "hover:bg-purple-500/30", action: "onManagePeople" },
    { id: "hour", label: "+Hora", icon: <Clock className="h-5 w-5" />, color: "text-pink-400", hoverBg: "hover:bg-pink-500/30", action: "onAddHour" },
    { id: "cancelstay", label: "Cancelar", icon: <XCircle className="h-5 w-5" />, color: "text-red-400", hoverBg: "hover:bg-red-500/30", action: "onCancelStay" },
  ],
  SUCIA: [
    { id: "clean", label: "Limpiar", icon: <Sparkles className="h-5 w-5" />, color: "text-emerald-400", hoverBg: "hover:bg-emerald-500/30", action: "onMarkClean" },
  ],
  BLOQUEADA: [
    { id: "unblock", label: "Liberar", icon: <DoorOpen className="h-5 w-5" />, color: "text-blue-400", hoverBg: "hover:bg-blue-500/30", action: "onUnblock" },
    { id: "dirty", label: "Mantenimiento", icon: <Sparkles className="h-5 w-5" />, color: "text-purple-400", hoverBg: "hover:bg-purple-500/30", action: "onMarkDirty" },
  ],
};

// Genera el path SVG para un sector circular
function getSectorPath(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  const startAngleRad = (startAngle - 90) * (Math.PI / 180);
  const endAngleRad = (endAngle - 90) * (Math.PI / 180);

  const x1Outer = cx + outerRadius * Math.cos(startAngleRad);
  const y1Outer = cy + outerRadius * Math.sin(startAngleRad);
  const x2Outer = cx + outerRadius * Math.cos(endAngleRad);
  const y2Outer = cy + outerRadius * Math.sin(endAngleRad);

  const x1Inner = cx + innerRadius * Math.cos(endAngleRad);
  const y1Inner = cy + innerRadius * Math.sin(endAngleRad);
  const x2Inner = cx + innerRadius * Math.cos(startAngleRad);
  const y2Inner = cy + innerRadius * Math.sin(startAngleRad);

  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

  return `
    M ${x1Outer} ${y1Outer}
    A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2Outer} ${y2Outer}
    L ${x1Inner} ${y1Inner}
    A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x2Inner} ${y2Inner}
    Z
  `;
}

// Calcula la posición del icono en el centro del sector
function getSectorCenter(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
): { x: number; y: number } {
  const midAngle = (startAngle + endAngle) / 2;
  const midAngleRad = (midAngle - 90) * (Math.PI / 180);
  const midRadius = (innerRadius + outerRadius) / 2;

  return {
    x: cx + midRadius * Math.cos(midAngleRad),
    y: cy + midRadius * Math.sin(midAngleRad),
  };
}

export function RoomActionsWheel({
  room,
  isOpen,
  isVisible,
  actionLoading,
  statusBadge,
  hasExtraCharges = false,
  isHotelRoom = false,
  onClose,
  onStartStay,
  onCheckout,
  onPayExtra,
  onViewSale,
  onViewDetails,
  onGranularPayment,
  onAddConsumption,
  onAddPerson,
  onRemovePerson,
  onPersonLeftReturning,
  onAddHour,
  onMarkClean,
  onBlock,
  onUnblock,
  onQuickCheckin,
  onEditVehicle,
  onChangeRoom,
  onCancelStay,
  onManagePeople,
  onMarkDirty,
}: RoomActionsWheelProps) {
  if (!isOpen || !room) return null;

  // Filtrar acciones según condiciones
  const allActions = ACTIONS_BY_STATUS[room.status] || [];
  const actions = allActions.filter(action => {
    // Mostrar "Pagar" solo si hay cargos extra pendientes
    if (action.showOnlyWithExtra && !hasExtraCharges) return false;
    // Ocultar acciones marcadas como hideForHotel si es hotel
    if (action.hideForHotel && isHotelRoom) return false;
    return true;
  });
  const actionCount = actions.length;

  // Dimensiones del SVG
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = 130;
  const innerRadius = 70;

  // Callbacks map
  const callbacks: Record<string, () => void> = {
    onStartStay,
    onCheckout,
    onPayExtra,
    onViewSale,
    onViewDetails,
    onGranularPayment,
    onAddConsumption,
    onAddPerson,
    onRemovePerson,
    onPersonLeftReturning,
    onAddHour,
    onMarkClean,
    onBlock,
    onUnblock,
    onQuickCheckin,
    onEditVehicle,
    onChangeRoom,
    onCancelStay,
    onManagePeople,
    onMarkDirty,
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className={`relative transform transition-all duration-300 ease-out ${isVisible ? "scale-100 opacity-100" : "scale-75 opacity-0"
          }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* SVG de la rueda */}
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="drop-shadow-2xl"
        >
          {/* Fondo del círculo exterior */}
          <circle
            cx={cx}
            cy={cy}
            r={outerRadius}
            fill="rgba(15, 23, 42, 0.95)"
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth="1"
          />

          {/* Sectores de acciones */}
          {actionCount === 1 ? (
            // Caso especial: un solo elemento - usar un anillo completo
            <g className="cursor-pointer">
              {/* Anillo completo como área clickeable */}
              <circle
                cx={cx}
                cy={cy}
                r={(innerRadius + outerRadius) / 2}
                fill="transparent"
                stroke="transparent"
                strokeWidth={outerRadius - innerRadius}
                className="transition-all duration-200"
                onMouseEnter={(e) => {
                  const action = actions[0];
                  (e.target as SVGCircleElement).style.stroke = action.hoverBg.includes('blue') ? 'rgba(59, 130, 246, 0.3)' :
                    action.hoverBg.includes('emerald') ? 'rgba(16, 185, 129, 0.3)' :
                      action.hoverBg.includes('cyan') ? 'rgba(6, 182, 212, 0.3)' :
                        action.hoverBg.includes('purple') ? 'rgba(168, 85, 247, 0.3)' :
                          action.hoverBg.includes('pink') ? 'rgba(236, 72, 153, 0.3)' :
                            action.hoverBg.includes('amber') ? 'rgba(245, 158, 11, 0.3)' :
                              'rgba(255, 255, 255, 0.1)';
                }}
                onMouseLeave={(e) => {
                  (e.target as SVGCircleElement).style.stroke = 'transparent';
                }}
                onClick={() => !actionLoading && callbacks[actions[0].action]?.()}
              />
              {/* Icono y label en la parte superior */}
              <g
                transform={`translate(${cx}, ${cy - (innerRadius + outerRadius) / 2})`}
                className={`pointer-events-none ${actions[0].color}`}
              >
                <g transform="translate(-10, -10)">
                  {actions[0].icon}
                </g>
                <text
                  y="18"
                  textAnchor="middle"
                  className="text-[10px] fill-white/70 font-medium"
                >
                  {actions[0].label}
                </text>
              </g>
            </g>
          ) : (
            // Caso normal: múltiples elementos
            actions.map((action, index) => {
              const anglePerSector = 360 / actionCount;
              const startAngle = index * anglePerSector;
              const endAngle = (index + 1) * anglePerSector;
              const path = getSectorPath(cx, cy, innerRadius, outerRadius, startAngle, endAngle);
              const center = getSectorCenter(cx, cy, innerRadius, outerRadius, startAngle, endAngle);

              return (
                <g key={action.id} className="cursor-pointer">
                  {/* Sector path */}
                  <path
                    d={path}
                    fill="transparent"
                    stroke="rgba(255, 255, 255, 0.1)"
                    strokeWidth="1"
                    className={`transition-all duration-200 ${action.hoverBg.replace('hover:', '')} hover:fill-current`}
                    style={{ fill: 'transparent' }}
                    onMouseEnter={(e) => {
                      (e.target as SVGPathElement).style.fill = action.hoverBg.includes('blue') ? 'rgba(59, 130, 246, 0.3)' :
                        action.hoverBg.includes('emerald') ? 'rgba(16, 185, 129, 0.3)' :
                          action.hoverBg.includes('cyan') ? 'rgba(6, 182, 212, 0.3)' :
                            action.hoverBg.includes('purple') ? 'rgba(168, 85, 247, 0.3)' :
                              action.hoverBg.includes('pink') ? 'rgba(236, 72, 153, 0.3)' :
                                action.hoverBg.includes('amber') ? 'rgba(245, 158, 11, 0.3)' :
                                  'rgba(255, 255, 255, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      (e.target as SVGPathElement).style.fill = 'transparent';
                    }}
                    onClick={() => !actionLoading && callbacks[action.action]?.()}
                  />
                  {/* Icono y label */}
                  <g
                    transform={`translate(${center.x}, ${center.y})`}
                    className={`pointer-events-none ${action.color}`}
                  >
                    <g transform="translate(-10, -26)">
                      {action.icon}
                    </g>
                    <text
                      y="12"
                      textAnchor="middle"
                      className="text-[10px] fill-white/70 font-medium"
                    >
                      {action.label}
                    </text>
                  </g>
                </g>
              );
            })
          )}

          {/* Círculo central */}
          <circle
            cx={cx}
            cy={cy}
            r={innerRadius - 5}
            fill="rgba(15, 23, 42, 0.98)"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="1"
          />
        </svg>

        {/* Contenido del círculo central */}
        <div
          className="absolute flex flex-col items-center justify-center text-center"
          style={{
            top: cy - (innerRadius - 10),
            left: cx - (innerRadius - 10),
            width: (innerRadius - 10) * 2,
            height: (innerRadius - 10) * 2,
          }}
        >
          <div className="text-[10px] text-muted-foreground leading-none mb-1">Hab.</div>
          <div className="text-2xl font-bold leading-none mb-1 truncate max-w-[5rem]">
            {room.number}
          </div>
          <div className="mt-1 scale-90">
            {statusBadge}
          </div>
        </div>

        {/* Botón de cierre */}
        <Button
          variant="outline"
          size="icon"
          className="absolute -top-2 -right-2 h-8 w-8 rounded-full border-white/50 bg-slate-900 text-white/80 hover:bg-slate-800 hover:text-white shadow-lg"
          onClick={onClose}
          disabled={actionLoading}
          title="Cerrar"
        >
          ✕
        </Button>
      </div>
    </div>
  );
}
