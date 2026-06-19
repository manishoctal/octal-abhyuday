import { getAppState } from '@/lib/db';
import LoginClient from '@/components/LoginClient';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return <LoginClient eventName={getAppState().event_name} />;
}
