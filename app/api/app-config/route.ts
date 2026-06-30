import { NextResponse } from 'next/server';
import { getModuleConfig, getModuleOrder } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Public endpoint — no auth required.
// Returns only what the homepage needs to apply module visibility/enabled state.
export async function GET() {
  const { visibility, enabled } = getModuleConfig();
  const order = getModuleOrder();
  return NextResponse.json({ visibility, enabled, order });
}
