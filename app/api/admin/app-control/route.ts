import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/api-helpers';
import {
  getModuleConfig, setModuleConfig, getModuleOrder, setModuleOrder, getPushSubscriptionStats,
  resetVotes, resetAttendance, resetPoints, resetFeedback, resetGallery,
  resetRoomAllocations, resetAadharCards, resetAwardWinners, resetPushSubscriptions,
  getSetting, setSetting,
} from '@/lib/db';
import { sendModuleEnabledPush } from '@/lib/push';
import { isSmtpReady } from '@/lib/email';

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
  const authConfig = {
    otp_email_enabled: getSetting('otp_email_enabled') === '1',
    smtp_ready: isSmtpReady(),
    static_otp_code: process.env.OTP_CODE ?? '1234',
  };

  const faceSearchEnabled = getSetting('face_search_enabled') !== '0';

  return NextResponse.json({ moduleConfig, moduleOrder, pushStats, pushConfig, authConfig, faceSearchEnabled });
}

export async function POST(req: Request) {
  const adminOrErr = await requireAdmin();
  if (isErrorResponse(adminOrErr)) return adminOrErr;

  const body = await req.json().catch(() => ({}));

  // Toggle OTP email mode
  if ('otp_email_enabled' in body) {
    setSetting('otp_email_enabled', body.otp_email_enabled ? '1' : '0');
    return NextResponse.json({ ok: true });
  }

  // Toggle AI face search
  if ('face_search_enabled' in body) {
    setSetting('face_search_enabled', body.face_search_enabled ? '1' : '0');
    return NextResponse.json({ ok: true });
  }

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
