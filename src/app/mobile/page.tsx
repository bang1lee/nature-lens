import type { Metadata } from 'next';
import MobileApp from '@/components/mobile/MobileApp';
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const metadata: Metadata = { title: 'Nature Lens | 손안의 자연 기록장', manifest: `${base}/mobile.webmanifest` };
export default function MobilePage() { return <MobileApp/>; }
