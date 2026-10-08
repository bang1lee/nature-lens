import type {Metadata} from 'next';
import TransferReceive from '@/components/TransferReceive';
export const metadata:Metadata={title:'Nature Lens | 암호화 임시 전달 받기',referrer:'no-referrer'};
export default function TransferPage(){return <TransferReceive/>;}
