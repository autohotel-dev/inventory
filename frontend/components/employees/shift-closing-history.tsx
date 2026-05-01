"use client";

import { Loader2 } from "lucide-react";
import { useShiftClosingHistory } from "@/hooks/use-shift-closing-history";

import { ShiftClosingAlerts } from "./shift-closing-history/shift-closing-alerts";
import { ShiftClosingFilters } from "./shift-closing-history/shift-closing-filters";
import { ShiftClosingTable } from "./shift-closing-history/shift-closing-table";
import { ShiftClosingPagination } from "./shift-closing-history/shift-closing-pagination";
import { ShiftClosingDetailModal } from "./shift-closing-history/shift-closing-detail-modal";
import { ShiftClosingRejectModal } from "./shift-closing-history/shift-closing-reject-modal";
import { ShiftClosingCorrectionModal } from "./shift-closing-history/shift-closing-correction-modal";

export function ShiftClosingHistory() {
  const {
    closings, loading, isAdmin, selectedClosing,
    closingDetails, closingSalesOrders, closingReviews, loadingDetails,
    statusFilter, processingAction, currentPage, pageSize, totalCount,
    showRejectModal, rejectionReason, showCorrectionModal, correctionClosing,
    correctionCountedCash, correctionDeclaredBBVA, correctionDeclaredGetnet,
    correctionNotes, savingCorrection, currentEmployeeId,
    setSelectedClosing, setStatusFilter, setCurrentPage, setPageSize,
    setShowRejectModal, setRejectionReason, setShowCorrectionModal,
    setCorrectionClosing, setCorrectionCountedCash, setCorrectionDeclaredBBVA,
    setCorrectionDeclaredGetnet, setCorrectionNotes,
    openDetail, approveClosing, openRejectModal, confirmRejectClosing,
    openCorrectionModal, saveCorrectionClosing, exportClosing, calculateCorrectionCashTotal,
    rejectedClosings
  } = useShiftClosingHistory();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ShiftClosingAlerts
        rejectedClosings={rejectedClosings}
        isAdmin={isAdmin}
        openDetail={openDetail}
      />

      <ShiftClosingFilters
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        pageSize={pageSize}
        setPageSize={setPageSize}
        setCurrentPage={setCurrentPage}
        totalCount={totalCount}
        currentPage={currentPage}
      />

      <ShiftClosingTable
        closings={closings}
        openDetail={openDetail}
        exportClosing={exportClosing}
      />

      <ShiftClosingPagination
        totalCount={totalCount}
        pageSize={pageSize}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
      />

      <ShiftClosingDetailModal
        selectedClosing={selectedClosing}
        setSelectedClosing={setSelectedClosing}
        closingDetails={closingDetails}
        closingSalesOrders={closingSalesOrders}
        closingReviews={closingReviews}
        loadingDetails={loadingDetails}
        isAdmin={isAdmin}
        processingAction={processingAction}
        currentEmployeeId={currentEmployeeId}
        openRejectModal={openRejectModal}
        approveClosing={approveClosing}
        exportClosing={exportClosing}
        openCorrectionModal={openCorrectionModal}
      />

      <ShiftClosingRejectModal
        showRejectModal={showRejectModal}
        setShowRejectModal={setShowRejectModal}
        rejectionReason={rejectionReason}
        setRejectionReason={setRejectionReason}
        confirmRejectClosing={confirmRejectClosing}
        processingAction={processingAction}
        selectedClosing={selectedClosing}
      />

      <ShiftClosingCorrectionModal
        showCorrectionModal={showCorrectionModal}
        setShowCorrectionModal={setShowCorrectionModal}
        correctionClosing={correctionClosing}
        setCorrectionClosing={setCorrectionClosing}
        correctionCountedCash={correctionCountedCash}
        setCorrectionCountedCash={setCorrectionCountedCash}
        correctionDeclaredBBVA={correctionDeclaredBBVA}
        setCorrectionDeclaredBBVA={setCorrectionDeclaredBBVA}
        correctionDeclaredGetnet={correctionDeclaredGetnet}
        setCorrectionDeclaredGetnet={setCorrectionDeclaredGetnet}
        correctionNotes={correctionNotes}
        setCorrectionNotes={setCorrectionNotes}
        savingCorrection={savingCorrection}
        saveCorrectionClosing={saveCorrectionClosing}
        calculateCorrectionCashTotal={calculateCorrectionCashTotal}
      />
    </div>
  );
}
