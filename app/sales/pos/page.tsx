import { RoomsBoard } from "@/components/sales/rooms-board";
import {RoomReminderDemo} from "@/components/sales/room-reminder-demo";

export const dynamic = "force-dynamic";

export default function SalesPosPage() {
  return (
    <div className="p-6">
      <RoomsBoard />
      <RoomReminderDemo />
    </div>
  );
}
