import type {Metadata} from 'next';
import MobileApp from '@/components/mobile/MobileApp';
const base=process.env.NEXT_PUBLIC_BASE_PATH||'';
export const metadata:Metadata={title:'Nature Lens | 내 관찰 보드',manifest:`${base}/board.webmanifest`};
export default function BoardPage(){return <MobileApp webBoard/>;}
