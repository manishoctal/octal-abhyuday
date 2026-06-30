import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import {
  getModuleConfig, setModuleConfig, getModuleOrder, setModuleOrder, getPushSubscriptionStats,
  resetVotes, resetAttendance, resetPoints, resetFeedback, resetGallery,
  resetRoomAllocations, resetAadharCards, resetAwardWinners, resetPushSubscriptions,
} from '@/lib/db';
import { sendModuleEnabledPush } from '@/lib/push';

export const dynamic = 'force-dynamic';

const RESET_MAP: Record<string, () => void> = {
  votes:        resetVotes,
  attendance:   resetAttendance,
  points:       resetPoints,
  feedback:     resetFeedback,
  gallery:      resetGallery,
  rooms:        resetRoomAllocations,
  aadhar:       resetAadharCards,
  award_winners: resetAwardWinners,
  push_subs:    resetPushSubscriptions,
};

export async function GET() {
  const adminOrErr = await requireAdmin();
  if (isErrorResponse(adminOrErr)) return adminOrErr;

  const moduleConfig  = getModuleConfig();
  const moduleOrder   = getModuleOrder();
  const pushStats     = getPushSubscriptionStats();
  const pushConfig = {
    vapid: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    fcm:   !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY),
  };

  return NextResponse.json({ moduleConfig, moduleOrder, pushStats, pushConfig });
}

export async function POST(req: Request) {
  const adminOrErr = await requireAdmin();
  if (isErrorResponse(adminOrErr)) return adminOrErr;

  const body = await req.json().catch(() => ({}));

  // Reset action
  if (body.reset) {
    const fn = RESET_MAP[body.reset as string];
    if (!fn) return NextResponse.json({ error: 'Unknown reset target' }, { status: 400 });
    fn();
    return NextResponse.json({ ok: true });
  }

  // Save module order
  if (Array.isArray(body.order)) {
    setModuleOrder(body.order as string[]);
    return NextResponse.json({ ok: true });
  }

  // Save module config
  const { visibility, enabled } = body;
  if (!visibility || !enabled) return NextResponse.json({ error: 'visibility and enabled required' }, { status: 400 });

  // Detect newly-enabled modules and push to users
  const prev = getModuleConfig();
  setModuleConfig(visibility, enabled);
  for (const key of Object.keys(enabled)) {
    if (enabled[key] === true && prev.enabled[key as keyof typeof prev.enabled] === false) {
      sendModuleEnabledPush(key).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}
