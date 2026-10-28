import type { Metadata } from 'next';
import ForestNameplate from '@/components/mobile/ForestNameplate';
export const metadata: Metadata = {
  title: '숲의 이름표 · 시연 | 네이처렌즈',
  description: 'QR 이름표에서 시작하는 재관찰과 계절의 기록. 실제 지정 나무와 연결되지 않은 시연 화면입니다.',
};
export default function DemoTreePage() { return <ForestNameplate />; }
