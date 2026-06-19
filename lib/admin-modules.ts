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
];
