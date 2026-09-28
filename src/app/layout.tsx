import type { Metadata, Viewport } from 'next';
import './globals.css';
const base=process.env.NEXT_PUBLIC_BASE_PATH||'';
export const metadata:Metadata={title:'Nature Lens | 가까이 볼수록, 새로운 세계',description:'자연의 작은 발견을 기록하고, 검수된 관찰을 한 권의 기록집으로 엮으세요. 뉴리프의 로컬 우선 관찰 작업실.',manifest:`${base}/manifest.webmanifest`,icons:{icon:`${base}/icon.svg`,apple:`${base}/icon-192.png`}};
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#254f3b'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ko"><body><a className="skip-link" href="#main">본문으로 건너뛰기</a>{children}</body></html>;}
