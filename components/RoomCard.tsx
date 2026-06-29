import { Hotel } from 'lucide-react';

interface Roommate { id: number; name: string; employee_code: string }
interface RoomInfo {
  id: number; room_number: string; notes: string | null;
  roommates: Roommate[];
}

export default function RoomCard({ room }: { room: RoomInfo }) {
  return (
    <div className="card mt-4 px-5 py-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg,#FE9234,#FF6B35)' }}>
          <Hotel size={18} className="text-white" />
        </div>
        <div>
          <p className="font-extrabold text-slate-900 text-[15px]">Room {room.room_number}</p>
          <p className="text-xs text-slate-400">{room.notes ?? 'Hotel room allocation'}</p>
        </div>
      </div>

      {room.roommates.length > 0 && (
        <div className="bg-slate-50 rounded-2xl px-4 py-3 space-y-2">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sharing with</p>
          {room.roommates.map(r => (
            <div key={r.id} className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-xs shrink-0">
                {r.name[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 leading-none">{r.name}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{r.employee_code}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {room.roommates.length === 0 && (
        <p className="text-xs text-slate-400 bg-slate-50 rounded-2xl px-4 py-3">
          No roommates assigned yet
        </p>
      )}
    </div>
  );
}
