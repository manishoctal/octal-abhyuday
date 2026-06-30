import { BedDouble, Users } from 'lucide-react';

interface Roommate {
  id: number;
  name: string;
  employee_code: string;
  profile_photo_url: string | null;
}
interface RoomInfo {
  id: number;
  room_number: string;
  notes: string | null;
  roommates: Roommate[];
}

function RoommateAvatar({ r }: { r: Roommate }) {
  const colors = [
    ['#FFF4E8', '#FE9234'],
    ['#EEF2FF', '#6366F1'],
    ['#ECFDF5', '#10B981'],
    ['#FFF1F2', '#F43F5E'],
    ['#F5F3FF', '#8B5CF6'],
  ];
  const [bg, fg] = colors[r.id % colors.length];
  return (
    <div className="flex items-center gap-3 py-3">
      {r.profile_photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={r.profile_photo_url}
          alt={r.name}
          className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-white shadow-sm"
        />
      ) : (
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ring-2 ring-white shadow-sm"
          style={{ background: bg, color: fg }}
        >
          {r.name[0]?.toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-900 text-[14px] leading-tight truncate">{r.name}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">{r.employee_code}</p>
      </div>
    </div>
  );
}

export default function RoomCard({ room }: { room: RoomInfo }) {
  const count = room.roommates.length;

  return (
    <div className="mt-4 rounded-[22px] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-slate-100">
      {/* Banner */}
      <div
        className="relative px-5 py-5"
        style={{
          background: 'linear-gradient(135deg,#0F172A 0%,#1E293B 60%,#0F2027 100%)',
        }}
      >
        {/* Decorative circles */}
        <div
          className="absolute -right-8 -top-8 w-32 h-32 rounded-full pointer-events-none"
          style={{ background: 'rgba(254,146,52,0.12)' }}
        />
        <div
          className="absolute -right-2 -bottom-6 w-20 h-20 rounded-full pointer-events-none"
          style={{ background: 'rgba(254,146,52,0.08)' }}
        />

        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/50 mb-1">
              Hotel Room
            </p>
            <p className="text-[34px] font-black text-white leading-none tracking-tight">
              {room.room_number}
            </p>
            {room.notes && (
              <p className="text-[12px] text-white/60 mt-1.5 font-medium">{room.notes}</p>
            )}
          </div>

          <div
            className="flex flex-col items-center justify-center w-14 h-14 rounded-2xl shrink-0"
            style={{ background: 'rgba(254,146,52,0.18)' }}
          >
            <BedDouble size={22} strokeWidth={1.6} className="text-orange-400" />
          </div>
        </div>

        {/* Occupancy pill */}
        <div className="relative mt-4 flex items-center gap-1.5">
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold"
            style={{ background: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.75)' }}
          >
            <Users size={12} strokeWidth={2} />
            {count === 0
              ? 'Solo room'
              : `Sharing with ${count} person${count === 1 ? '' : 's'}`}
          </div>
        </div>
      </div>

      {/* Roommates */}
      <div className="bg-white px-5">
        {count > 0 ? (
          <>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 pt-4 pb-1">
              Your roommates
            </p>
            <div className="divide-y divide-slate-50">
              {room.roommates.map(r => (
                <RoommateAvatar key={r.id} r={r} />
              ))}
            </div>
            <div className="pb-2" />
          </>
        ) : (
          <div className="py-5 text-center">
            <p className="text-[13px] font-semibold text-slate-500">No roommates assigned yet</p>
            <p className="text-[11px] text-slate-400 mt-0.5">You may be in a solo room</p>
          </div>
        )}
      </div>
    </div>
  );
}
