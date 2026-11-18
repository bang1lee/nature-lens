import type { Metadata } from 'next';
import MobileApp from '@/components/mobile/MobileApp';
import './embed.css';

export const metadata: Metadata = { title: 'Nature Lens | 자연 관찰' };

export default function EmbedPage() {
  return <MobileApp embed />;
}
