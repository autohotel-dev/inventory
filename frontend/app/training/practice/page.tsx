"use client";

import { useState, useEffect } from 'react';
import { useTraining } from '@/contexts/training-context';
import { useTrainingSimulator } from '@/hooks/use-training-simulator';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LogOut, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { mockRooms, mockOperations } from '@/lib/training/mock-data';
import { toast } from 'sonner';
import { RoomCard } from '@/components/sales/room-card';
import { RoomActionsWheel } from '@/components/sales/room-actions-wheel';

// Modal imports
import { RoomStartStayModal } from '@/components/sales/room-start-stay-modal';
import { RoomHourManagementModal } from '@/components/sales/room-hour-management-modal';
import { RoomCheckoutModal } from '@/components/sales/room-checkout-modal';
import { EditVehicleModal } from '@/components/sales/edit-vehicle-modal';
import { CancelStayModal } from '@/components/sales/cancel-stay-modal';
import { MockAddConsumptionModal } from '@/components/training/modals/mock-add-consumption-modal';
import { MockQuickCheckinModal } from '@/components/training/modals/mock-quick-checkin-modal';
import { MockEditValetModal } from '@/components/training/modals/mock-edit-valet-modal';
import { MockRoomDetailsModal } from '@/components/training/modals/mock-room-details-modal';
import { ChangeRoomModal } from '@/components/sales/change-room-modal';
import { ManagePeopleModal } from '@/components/sales/manage-people-modal';
import { PracticeGenericModule } from '@/components/training/practice/practice-generic-module';
import { PracticeIntro } from '@/components/training/practice-intro';
import { MockGranularPaymentModal, MockOrderItem } from '@/components/training/modals/mock-granular-payment-modal';
import { MockExpenseModal } from '@/components/training/modals/mock-expense-modal';
import { MockBlockRoomModal } from '@/components/training/modals/mock-block-room-modal';
import { MockShiftClosingModal } from '@/components/training/modals/mock-shift-closing-modal';
import {
    MockInventoryPanel,
    MockSensorsPanel,
    MockAdminPanel,
    MockShiftPanel,
    MockReportPanel,
    MockConfigPanel,
    MockPurchasesPanel
} from '@/components/training/mock-panels';
import { TutorialOverlay } from '@/components/training/tutorial-overlay';
import { BookOpen } from 'lucide-react';

const ROOM_STATUS_BG: Record<string, string> = {
    FREE: 'bg-green-900/80',
    LIBRE: 'bg-green-900/80',
    OCCUPIED: 'bg-red-900/80',
    OCUPADA: 'bg-red-900/80',
    RESERVED: 'bg-yellow-900/80',
    RESERVADA: 'bg-yellow-900/80',
};

// Mocks Visuales importados de @/components/training/mock-panels

const ROOM_STATUS_ACCENT: Record<string, string> = {
    FREE: 'border-l-4 border-green-400',
    LIBRE: 'border-l-4 border-green-400',
    OCCUPIED: 'border-l-4 border-red-400',
    OCUPADA: 'border-l-4 border-red-400',
    RESERVED: 'border-l-4 border-yellow-400',
    RESERVADA: 'border-l-4 border-yellow-400',
};

// Mapping of Step IDs to DOM Element IDs for Tutorial Overlay
const stepTargetIds: Record<string, string> = {
    // Inventory
    'register-movement': 'tutorial-btn-new-movement',
    'kardex-check': 'tutorial-tab-kardex',
    // Purchases
    'suppliers': 'tutorial-tab-suppliers',
    'new-purchase': 'tutorial-btn-new-purchase',
    // Sensors
    'sensor-states': 'tutorial-btn-sensor-detail',
    'discrepancies': 'tutorial-btn-verify-alert',
    // Financial
    'sales-analysis': 'tutorial-btn-analyze-sales',
    'profitability': 'tutorial-btn-view-margins',
    // Customer
    'register-customer': 'tutorial-btn-new-customer',
    'billing-data': 'tutorial-tab-customers',
};

export default function PracticePage() {
    const {
        completedExercises, setCompletedExercises,
        practiceRooms,
        isTutorialOpen, setIsTutorialOpen,
        isWheelOpen,
        isWheelVisible,
        selectedRoom,
        actionLoading,
        isClosingModalOpen, setIsClosingModalOpen,
        isStartStayOpen, setIsStartStayOpen,
        isQuickCheckinOpen, setIsQuickCheckinOpen,
        isCheckoutOpen, setIsCheckoutOpen,
        isConsumptionOpen, setIsConsumptionOpen,
        isHourManagementOpen, setIsHourManagementOpen,
        isEditVehicleOpen, setIsEditVehicleOpen,
        isCancelStayOpen, setIsCancelStayOpen,
        isChangeRoomOpen, setIsChangeRoomOpen,
        isManagePeopleOpen, setIsManagePeopleOpen,
        isEditValetOpen, setIsEditValetOpen,
        isDetailsOpen, setIsDetailsOpen,
        isGranularPaymentOpen, setIsGranularPaymentOpen,
        isExpenseModalOpen, setIsExpenseModalOpen,
        isBlockRoomOpen, setIsBlockRoomOpen,
        mockExpense,
        
        handleExit,
        openActionsWheel, closeWheel,
        handleStartStay, handleQuickCheckin, handlePracticeCheckout,
        handleGranularPayment, handleAddConsumption, handleAddHours,
        handleEditVehicle, handleCancelStay, handleManagePeople,
        handleEditValet, handleChangeRoom, handleViewDetails,
        handleMarkClean, handleMarkDirty, handleBlockRoom,
        handleUnblockRoom, handleNoOp, handleConfirmClosing,
        
        confirmStartStay, confirmQuickCheckin, confirmCheckout,
        confirmConsumption, confirmAddHours, confirmRenewShift,
        confirmPromo4H, confirmCancelStay, confirmGranularPayment,
        confirmEditVehicle, confirmRegisterExpense, confirmChangeRoom,
        confirmEditValet, handleAddPersonNew, handleAddPersonReturning,
        handleRemovePerson, confirmBlockRoom,
        renderStatusBadge
    } = useTrainingSimulator();

    const { activeModule } = useTraining();

    if (!activeModule) {
        return null;
    }

    return (
        <div className="min-h-screen">
            {/* Practice mode banner */}
            <div className="bg-orange-100 dark:bg-orange-900 border-b-4 border-orange-500 sticky top-0 z-50">
                <div className="container mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <AlertCircle className="h-5 w-5 text-orange-700 dark:text-orange-300" />
                            <div>
                                <div className="font-bold text-orange-900 dark:text-orange-100">
                                    🎮 MODO PRÁCTICA - {activeModule.title}
                                </div>
                                <div className="text-sm text-orange-700 dark:text-orange-300">
                                    Ambiente seguro con datos ficticios. ¡Practica sin preocupaciones!
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant={isTutorialOpen ? "default" : "outline"}
                                size="sm"
                                className="gap-2"
                                onClick={() => setIsTutorialOpen(!isTutorialOpen)}
                            >
                                <BookOpen className="h-4 w-4" />
                                {isTutorialOpen ? "Ocultar Guía" : "Tutorial Interactivo"}
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleExit}
                            >
                                <LogOut className="h-4 w-4 mr-2" />
                                Salir
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Practice content */}
            <div className="container mx-auto py-6 space-y-6">
                {/* Progress */}
                <Card>
                    <CardHeader>
                        <CardTitle>Progreso de Ejercicios</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {activeModule.steps.map((step, idx) => {
                                // FIXED: Use ID check instead of index check
                                const isCompleted = completedExercises.includes(step.id);
                                return (
                                    <Badge
                                        key={step.id}
                                        variant={isCompleted ? "default" : "outline"}
                                        className={isCompleted ? "bg-green-600 hover:bg-green-700" : "bg-secondary/50 text-muted-foreground hover:bg-secondary/70"}
                                    >
                                        {isCompleted ? <CheckCircle2 className="h-3 w-3 mr-1" /> : (idx + 1 + ". ")}
                                        {step.title}
                                    </Badge>
                                );
                            })}
                        </div>
                        <p className="text-sm text-muted-foreground mt-3">
                            Completa los ejercicios para dominar este módulo
                        </p>
                    </CardContent>
                </Card>

                {/* Instructions */}
                <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200">
                    <CardContent className="p-6">
                        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
                            📋 Ejercicios de Práctica:
                        </h3>
                        <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                            {activeModule.steps.map((step, idx) => (
                                <li key={step.id} className="flex items-start gap-2">
                                    <span className="font-bold">{idx + 1}.</span>
                                    <span><strong>{step.title}:</strong> {step.description}</span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>

                {/* Practice Rooms Grid or Intro */}
                {['intro-basica', 'intro-interfaz'].includes(activeModule.id) ? (
                    <PracticeIntro
                        completedSteps={completedExercises}
                        onCompleteStep={(stepId) => {
                            if (!completedExercises.includes(stepId)) {
                                setCompletedExercises(prev => [...prev, stepId]);
                                toast.success(`Lección completada: ${stepId}`);
                            }
                        }}
                        moduleId={activeModule.id}
                    />
                ) : ['shift-control', 'reports-basic', 'inventory-stock', 'inventory-movements', 'inventory-purchases', 'sensors-monitoring', 'customer-management', 'analytics-financial'].includes(activeModule.id) ? (
                    <PracticeGenericModule
                        module={activeModule}
                        completedSteps={completedExercises}
                        onCompleteStep={(stepId: string) => {
                            if (stepId === 'close-shift') {
                                setIsClosingModalOpen(true);
                                return;
                            }
                            if (!completedExercises.includes(stepId)) {
                                setCompletedExercises(prev => [...prev, stepId]);
                                toast.success("Paso completado");
                            }
                        }}
                        onOpenExpense={() => setIsExpenseModalOpen(true)}
                        mockExpense={mockExpense}
                    />
                ) : (
                    <Card>
                        <CardContent className="pt-4">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                                {practiceRooms.map((room) => {
                                    const status = room.status || 'LIBRE';
                                    // Mapear status a colores del badge
                                    let accentColor = '';
                                    if (status === 'SUCIA') accentColor = 'border-l-4 border-purple-400';
                                    else if (status === 'BLOQUEADA') accentColor = 'border-l-4 border-gray-400';
                                    else accentColor = ROOM_STATUS_ACCENT[status] || '';

                                    return (
                                        <RoomCard
                                            key={room.id}
                                            id={room.id}
                                            number={room.number}
                                            status={status}
                                            bgClass={ROOM_STATUS_BG[status] || (status === 'SUCIA' ? 'bg-purple-900/80' : status === 'BLOQUEADA' ? 'bg-gray-800/80' : 'bg-slate-900/80')}
                                            accentClass={accentColor}
                                            statusBadge={renderStatusBadge(status)}
                                            hasPendingPayment={false}
                                            roomTypeName={room.room_types?.name}
                                            notes={room.notes}
                                            sensorStatus={null}
                                            onInfo={() => {
                                                toast.info(`Habitación ${room.number} - ${room.room_types?.name || 'Práctica'}`);
                                            }}
                                            onActions={() => openActionsWheel(room)}
                                        />
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Rueda de Acciones Circular */}
                <RoomActionsWheel
                    room={selectedRoom}
                    hasExtraCharges={(selectedRoom?.room_stays?.[0]?.sales_orders?.remaining_amount || 0) > 0}
                    isOpen={isWheelOpen}
                    isVisible={isWheelVisible}
                    actionLoading={actionLoading}
                    statusBadge={selectedRoom ? renderStatusBadge(selectedRoom.status) : null}
                    onClose={closeWheel}
                    onStartStay={handleStartStay}
                    onQuickCheckin={handleQuickCheckin}
                    onCheckout={handlePracticeCheckout}
                    onAddHour={handleAddHours}
                    onAddPerson={handleManagePeople}
                    onMarkClean={handleMarkClean}
                    onMarkDirty={handleMarkDirty}
                    onBlock={handleBlockRoom}
                    onUnblock={handleUnblockRoom}
                    onEditVehicle={handleEditVehicle}
                    onEditValet={handleEditValet}
                    onChangeRoom={handleChangeRoom}
                    onCancelStay={handleCancelStay}
                    onViewDetails={handleViewDetails}
                    onViewSale={handleNoOp}
                    onGranularPayment={handleGranularPayment}
                    onManagePeople={handleManagePeople}
                    onRemovePerson={handleManagePeople}
                    onPersonLeftReturning={handleNoOp}
                    onShowGuestPortal={handleNoOp}
                    onRequestVehicle={handleNoOp}
                    onAddDamageCharge={handleNoOp}
                    onNotifyCheckout={handleNoOp}
                    onOpenPrintCenter={handleNoOp}
                />

                {/* MODALES DE PRÁCTICA */}
                {selectedRoom && (
                    <>
                        <RoomStartStayModal
                            isOpen={isStartStayOpen}
                            roomNumber={selectedRoom.number}
                            roomType={selectedRoom.room_types}
                            expectedCheckout={new Date(Date.now() + (selectedRoom.room_types.weekday_hours || 4) * 60 * 60 * 1000)}
                            actionLoading={actionLoading}
                            onClose={() => setIsStartStayOpen(false)}
                            onConfirm={confirmStartStay}
                        />

                        <MockQuickCheckinModal
                            isOpen={isQuickCheckinOpen}
                            roomNumber={selectedRoom.number}
                            roomType={selectedRoom.room_types}
                            actionLoading={actionLoading}
                            onClose={() => setIsQuickCheckinOpen(false)}
                            onConfirm={confirmQuickCheckin}
                        />

                        <RoomCheckoutModal
                            isOpen={isCheckoutOpen}
                            roomNumber={selectedRoom.number}
                            roomTypeName={selectedRoom.room_types.name}
                            remainingAmount={selectedRoom.room_stays?.[0]?.sales_orders?.remaining_amount || 0}
                            checkoutAmount={selectedRoom.room_stays?.[0]?.sales_orders?.remaining_amount || 0}
                            actionLoading={actionLoading}
                            onAmountChange={() => { }}
                            onClose={() => setIsCheckoutOpen(false)}
                            onConfirm={confirmCheckout}
                        />

                        <MockAddConsumptionModal
                            isOpen={isConsumptionOpen}
                            roomNumber={selectedRoom.number}
                            onClose={() => setIsConsumptionOpen(false)}
                            onComplete={confirmConsumption}
                        />

                        <RoomHourManagementModal
                            isOpen={isHourManagementOpen}
                            room={{ ...selectedRoom, room_types: selectedRoom.room_types }}
                            actionLoading={actionLoading}
                            onClose={() => setIsHourManagementOpen(false)}
                            onConfirmCustomHours={confirmAddHours}
                            onConfirmRenew={confirmRenewShift}
                            onConfirmPromo4H={confirmPromo4H}
                        />

                        <EditVehicleModal
                            isOpen={isEditVehicleOpen}
                            roomNumber={selectedRoom.number}
                            currentVehicle={{
                                plate: selectedRoom.room_stays?.[0]?.vehicle_plate || '',
                                brand: '',
                                model: ''
                            }}
                            actionLoading={actionLoading}
                            onClose={() => setIsEditVehicleOpen(false)}
                            onSave={confirmEditVehicle}
                        />

                        <CancelStayModal
                            isOpen={isCancelStayOpen}
                            salesOrderId={`mock-order-${selectedRoom.id}`}
                            roomNumber={selectedRoom.number}
                            roomTypeName={selectedRoom.room_types.name}
                            elapsedMinutes={45} // Simulado
                            actionLoading={actionLoading}
                            onClose={() => setIsCancelStayOpen(false)}
                            onConfirm={(data) => confirmCancelStay(data.reason, 'Cancelación simulada')}
                        />
                        <ManagePeopleModal
                            isOpen={isManagePeopleOpen}
                            roomNumber={selectedRoom.number}
                            currentPeople={selectedRoom.room_stays?.[0]?.current_people || 1}
                            totalPeople={selectedRoom.room_stays?.[0]?.total_people || 1}
                            maxPeople={selectedRoom.room_types.max_people || 4}
                            hasActiveTolerance={(selectedRoom.room_stays?.[0] as any)?.hasActiveTolerance || false}
                            toleranceMinutesLeft={(selectedRoom.room_stays?.[0] as any)?.toleranceMinutesLeft}
                            extraPersonPrice={selectedRoom.room_types.extra_person_price || 0}
                            isHotelRoom={false}
                            actionLoading={actionLoading}
                            onClose={() => setIsManagePeopleOpen(false)}
                            onAddPersonNew={handleAddPersonNew}
                            onAddPersonReturning={handleAddPersonReturning}
                            onRemovePerson={handleRemovePerson}
                        />

                        <ChangeRoomModal
                            isOpen={isChangeRoomOpen}
                            currentRoom={selectedRoom}
                            currentStay={selectedRoom.room_stays?.[0]}
                            availableRooms={practiceRooms.filter(r => r.id !== selectedRoom.id && ['LIBRE', 'FREE'].includes(r.status))}
                            actionLoading={actionLoading}
                            onClose={() => setIsChangeRoomOpen(false)}
                            onConfirm={confirmChangeRoom}
                        />

                        <MockEditValetModal
                            isOpen={isEditValetOpen}
                            roomNumber={selectedRoom.number}
                            currentValetId={selectedRoom.room_stays?.[0]?.valet_employee_id || null}
                            onClose={() => setIsEditValetOpen(false)}
                            onSuccess={confirmEditValet}
                        />

                        <MockRoomDetailsModal
                            isOpen={isDetailsOpen}
                            roomNumber={selectedRoom.number}
                            roomType={selectedRoom.room_types.name}
                            status={selectedRoom.status}
                            checkInTime={selectedRoom.room_stays?.[0]?.check_in_at}
                            totalAmount={selectedRoom.room_stays?.[0]?.sales_orders?.remaining_amount || 0}
                            paidAmount={0}
                            remainingAmount={selectedRoom.room_stays?.[0]?.sales_orders?.remaining_amount || 0}
                            onClose={() => setIsDetailsOpen(false)}
                        />

                        <MockGranularPaymentModal
                            isOpen={isGranularPaymentOpen}
                            roomNumber={selectedRoom.number}
                            items={(selectedRoom.room_stays?.[0] as any)?.mockItems || []}
                            onClose={() => setIsGranularPaymentOpen(false)}
                            onConfirm={confirmGranularPayment}
                        />



                        <MockBlockRoomModal
                            isOpen={isBlockRoomOpen}
                            roomNumber={selectedRoom.number}
                            actionLoading={actionLoading}
                            onClose={() => setIsBlockRoomOpen(false)}
                            onConfirm={confirmBlockRoom}
                        />
                    </>
                )}

                {/* Tips */}
                <Card className="bg-green-50 dark:bg-green-950 border-green-200">
                    <CardContent className="p-4">
                        <p className="text-sm text-green-800 dark:text-green-200">
                            💡 <strong>Consejo:</strong> Practica cada operación varias veces hasta que te sientas cómodo.
                            Los datos son ficticios, así que no te preocupes por cometer errores. ¡Ese es el objetivo de practicar!
                            <br /><br />
                            <strong>Cómo practicar:</strong> Haz click en el botón de acciones (tres puntos) de cualquier habitación
                            para ver la rueda circular con todas las opciones disponibles.
                        </p>
                    </CardContent>
                </Card>
            </div>
            {/* Mock Expense Modal for Shift Practice */}
            {isExpenseModalOpen && (
                <MockExpenseModal
                    open={isExpenseModalOpen}
                    onClose={() => setIsExpenseModalOpen(false)}
                    availableCash={1500}
                    onConfirm={confirmRegisterExpense}
                />
            )}
            {/* Mock Shift Closing Modal - Needs to be outside selectedRoom check */}
            <MockShiftClosingModal
                open={isClosingModalOpen}
                onClose={() => setIsClosingModalOpen(false)}
                onConfirm={handleConfirmClosing}
                // Mock values
                initialFund={2000}
                totalSalesCash={5450}
                totalExpenses={mockExpense?.amount || 0}
            />

            <TutorialOverlay
                currentStepId={activeModule.steps.find(s => !completedExercises.includes(s.id))?.id || null}
                steps={activeModule.steps}
                targetIds={stepTargetIds}
                isEnabled={isTutorialOpen}
                onClose={() => setIsTutorialOpen(false)}
            />
        </div>
    );
}
