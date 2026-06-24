'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { Vote, MessageSquare, BarChart3, Zap, ArrowRight } from 'lucide-react';

const fetcher = (u: string) => fetch(u).then(r => r.json());

interface LiveData {
  votingLive: boolean;
  votingPaused: boolean;
  liveQa: {
    id: number;
    title: string;
    kind: 'qna' | 'poll' | 'ranking';
    activeQuestion: string | null;
  } | null;
}

interface LiveItem {
  key: string;
  href: string;
  icon: React.ReactNode;
  label: string;
  subtitle: string;
  color: string;
  bg: string;
  cta: string;
}

function buildItems(data: LiveData): LiveItem[] {
  const items: LiveItem[] = [];
  const isPoll    = data.liveQa?.kind === 'poll' || data.liveQa?.kind === 'ranking';

  if (data.votingLive || data.votingPaused) {
    items.push({
      key: 'voting',
      href: '/vote',
      icon: <Vote size={26} strokeWidth={1.8} color="white" />,
      label: data.votingPaused ? 'Voting is paused' : 'Voting is open',
      subtitle: 'Cast your votes for awards and recognition',
      color: '#FE9234',
      bg: 'linear-gradient(135deg,#FFF4E8,#FFEDD5)',
      cta: 'Vote now',
    });
  }

  if (data.liveQa && !isPoll) {
    items.push({
      key: 'qna',
      href: '/qna',
      icon: <MessageSquare size={26} strokeWidth={1.8} color="white" />,
      label: data.liveQa.title,
      subtitle: data.liveQa.activeQuestion
        ? `Now: ${data.liveQa.activeQuestion}`
        : 'Live Q&A session in progress',
      color: '#10B981',
      bg: 'linear-gradient(135deg,#ECFDF5,#D1FAE5)',
      cta: 'Join Q&A',
    });
  }

  if (data.liveQa && isPoll) {
    const isRanking = data.liveQa.kind === 'ranking';
    items.push({
      key: 'poll',
      href: '/qna',
      icon: <BarChart3 size={26} strokeWidth={1.8} color="white" />,
      label: isRanking ? 'Live Ranking' : 'Live Poll',
      subtitle: data.liveQa.activeQuestion ?? data.liveQa.title,
      color: '#8B5CF6',
      bg: 'linear-gradient(135deg,#F5F3FF,#EDE9FE)',
      cta: 'Participate',
    });
  }

  return items;
}

export default function LiveClient({ initial }: { initial: LiveData }) {
  const { data } = useSWR<LiveData>('/api/live', fetcher, {
    fallbackData: initial,
    refreshInterval: 8000,
  });

  const liveData = data ?? initial;
  const items    = buildItems(liveData);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-center">
        <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center mb-5">
          <Zap size={36} strokeWidth={1.6} className="text-slate-300" />
        </div>
        <p className="font-bold text-slate-900 text-lg">Nothing live right now</p>
        <p className="text-sm text-slate-400 mt-2 max-w-xs">
          When voting, Q&A, polls, or rankings go live the admin will notify you.
        </p>
        <Link href="/" className="mt-8 btn-primary inline-flex w-auto px-8">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <>
      <p className="text-sm text-slate-400 font-medium mb-4">
        {items.length} active right now
      </p>
      <div className="space-y-3">
        {items.map(item => (
          <Link
            key={item.key}
            href={item.href}
            className="block rounded-3xl overflow-hidden active:scale-[0.98] transition-transform"
            style={{ background: item.bg }}
          >
            <div className="p-5 flex items-start gap-4">
              <div
                className="w-14 h-14 rounded-2xl shrink-0 flex items-center justify-center"
                style={{ background: item.color }}
              >
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                    style={{ background: '#EF4444' }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse inline-block" />
                    LIVE
                  </span>
                </div>
                <p className="font-bold text-slate-900 text-[16px] leading-tight">{item.label}</p>
                <p className="text-[12px] text-slate-500 mt-1 line-clamp-2">{item.subtitle}</p>
              </div>
            </div>
            <div className="px-5 py-3 flex items-center justify-between border-t border-black/5">
              <span className="font-semibold text-sm" style={{ color: item.color }}>{item.cta}</span>
              <ArrowRight size={16} strokeWidth={1.8} style={{ color: item.color }} />
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
