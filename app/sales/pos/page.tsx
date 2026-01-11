import { RoomsBoard } from "@/components/sales/rooms-board";
import { TourAutoStart } from "@/components/training/tour-auto-start";

export const dynamic = "force-dynamic";

export default function SalesPosPage() {
  return (
    <>
      <TourAutoStart />
      <div className="p-6">
        <RoomsBoard />
      </div>
    </>
  );
}
