import type {Metadata} from 'next';
import ObservationBoard from '@/components/mobile/ObservationBoard';
const base=process.env.NEXT_PUBLIC_BASE_PATH||'';
export const metadata:Metadata={title:'Nature Lens | 내 관찰 보드',manifest:`${base}/board.webmanifest`};
export default function BoardPage(){return <ObservationBoard/>;}
