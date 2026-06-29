export interface AdminModule {
  id: string;
  name: string;
  emoji: string;
  description: string;
  /** Route of the module's admin page — only for live modules */
  href?: string;
  status: 'live' | 'coming_soon';
}

/**
 * Registry of admin modules. Next-phase modules (sli.do-style interactions)
 * are listed as coming_soon — give them a page under app/admin/<id>/ and
 * flip status to 'live' to activate.
 */
export const adminModules: AdminModule[] = [
  {
    id: 'employees',
    name: 'Employee Roster',
    emoji: '👥',
    description: 'Manage the employee master list — add, edit, upload photos and set employee codes. Only listed employees can log in.',
    href: '/admin/employees',
    status: 'live',
  },
  {
    id: 'voting',
    name: 'Popularity Voting',
    emoji: '🗳️',
    description: 'Most Popular Male & Female — candidates, voting lifecycle, results announcement',
    href: '/admin/voting',
    status: 'live',
  },
  {
    id: 'qna',
    name: 'Live Q&A',
    emoji: '💬',
    description:
      'Present quiz, funny open-text and rating questions live — audience answers on their phones, reveal with fanfare',
    href: '/admin/qna',
    status: 'live',
  },
  {
    id: 'polls',
    name: 'Live Polls',
    emoji: '📊',
    description: 'Instant multiple-choice polls — launch in one tap, voters see live result charts',
    href: '/admin/polls',
    status: 'live',
  },
  {
    id: 'ranking',
    name: 'Rankings',
    emoji: '🏅',
    description: 'Crowd-ranked lists — everyone orders the options, the combined ranking forms live',
    href: '/admin/ranking',
    status: 'live',
  },
  {
    id: 'schedule',
    name: 'Event Schedule',
    emoji: '📅',
    description: 'Add and manage the event agenda — changes appear instantly on all attendees\' phones',
    href: '/admin/schedule',
    status: 'live',
  },
  {
    id: 'notifications',
    name: 'Push Notifications',
    emoji: '🔔',
    description: 'Send instant alerts to all attendees — quick buttons for lunch, ceremonies, and custom messages',
    href: '/admin/notifications',
    status: 'live',
  },
  {
    id: 'scan',
    name: 'Attendance',
    emoji: '📍',
    description: 'Set venue GPS coordinates and radius. Employees self check-in from their profile — only accepted within the configured distance.',
    href: '/admin/scan',
    status: 'live',
  },
  {
    id: 'event-info',
    name: 'Venue & Info',
    emoji: '📍',
    description: 'Manage venue details, FAQs, emergency contacts, and event instructions for attendees',
    href: '/admin/event-info',
    status: 'live',
  },
  {
    id: 'awards',
    name: 'Awards',
    emoji: '🏅',
    description: 'Manage award categories, nominees, and reveal winners with confetti during the ceremony',
    href: '/admin/awards',
    status: 'live',
  },
  {
    id: 'photos',
    name: 'Photo Gallery',
    emoji: '📷',
    description: 'Review and approve employee-uploaded event photos before they appear in the gallery',
    href: '/admin/photos',
    status: 'live',
  },
  {
    id: 'feedback',
    name: 'Feedback',
    emoji: '⭐',
    description: 'View all attendee feedback, average ratings, and export responses as CSV',
    href: '/admin/feedback',
    status: 'live',
  },
  {
    id: 'leaderboard',
    name: 'Leaderboard',
    emoji: '🏆',
    description: 'View top participants and points earned from voting, check-in, and feedback activities',
    href: '/admin/leaderboard',
    status: 'live',
  },
  {
    id: 'app-release',
    name: 'App Release',
    emoji: '📦',
    description: 'Manage the Android APK download link, version info, and force-update minimum version for attendees',
    href: '/admin/app-release',
    status: 'live',
  },
  {
    id: 'rooms',
    name: 'Room Allocation',
    emoji: '🏨',
    description: 'Assign employees to hotel rooms, upload Aadhar cards (front & back), and download a ZIP grouped by room for hotel reception',
    href: '/admin/rooms',
    status: 'live',
  },
];
