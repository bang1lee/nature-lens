'use client';
import {useEffect,useRef,useState} from 'react';
import type {Map as LibreMap, GeoJSONSource} from 'maplibre-gl';
import type {SupabaseClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {cloudConfig} from '@/lib/cloud/config';
import {getSupabase} from '@/lib/cloud/client';
import {feedItemSchema, FEED_COLUMNS, type FeedItem} from '@/lib/cloud/contract';
import {mapFeatures,mapPointSchema,mapSelection,type MapPoint} from '@/lib/cloud/map';
import 'maplibre-gl/dist/maplibre-gl.css';
import './community-map.css';

const EMPTY=mapFeatures([]);
export default function CommunityMap({onJoin}:{onJoin:()=>void}){
 const container=useRef<HTMLDivElement>(null), map=useRef<LibreMap|null>(null), pointsRef=useRef<MapPoint[]>([]), client=useRef<SupabaseClient|null>(null), request=useRef(0), detailRequest=useRef(0), refreshRef=useRef<()=>void>(()=>{});
 const [points,setPoints]=useState<MapPoint[]>([]),[selected,setSelected]=useState(''),[detail,setDetail]=useState<FeedItem|null>(null);
 const [state,setState]=useState<'loading'|'ready'|'error'>(cloudConfig.enabled?'loading':'error'),[realtime,setRealtime]=useState(false),[mapError,setMapError]=useState(false),[detailError,setDetailError]=useState(''),[checked,setChecked]=useState<Date|null>(null);
 useEffect(()=>{let alive=true;let cleanup=()=>{};
 void import('maplibre-gl').then(({default:lib})=>{if(!alive||!container.current)return;
  const m=new lib.Map({container:container.current,center:[127.334,37.013],zoom:13,maxZoom:16,style:{version:8,sources:{osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'}},layers:[{id:'base',type:'raster',source:'osm'}]}});map.current=m;
  m.addControl(new lib.NavigationControl({showCompass:false}),'top-right');
  m.on('error',()=>setMapError(true));
  // A later successful base tile means the map recovered from a transient tile failure.
  m.on('sourcedata',e=>{if(e.sourceId==='osm'&&e.tile)setMapError(false);});
  m.on('style.load',()=>{m.addSource('observations',{type:'geojson',data:mapFeatures(pointsRef.current),cluster:true,clusterMaxZoom:14,clusterRadius:45});
   m.addLayer({id:'clusters',type:'circle',source:'observations',filter:['has','point_count'],paint:{'circle-color':'#416d4d','circle-radius':['step',['get','point_count'],19,20,24,100,30],'circle-stroke-color':'#fff','circle-stroke-width':2}});
   m.addLayer({id:'single',type:'circle',source:'observations',filter:['!', ['has','point_count']],paint:{'circle-color':'#416d4d','circle-radius':9,'circle-stroke-color':'#fff','circle-stroke-width':2}});
   m.on('render',()=>{if(container.current&&m.getLayer('clusters')&&m.getLayer('single')){container.current.dataset.mapRenderedPoints=String(m.queryRenderedFeatures({layers:['clusters','single']}).length);container.current.dataset.mapZoom=String(m.getZoom());}});
   m.on('click','clusters',async e=>{try{const f=e.features?.[0];if(!f||f.geometry.type!=='Point')return;const source=m.getSource('observations') as GeoJSONSource;const cluster=Number(f.properties.cluster_id);const leaves=await source.getClusterLeaves(cluster,500,0);const ids=new Set(leaves.map(x=>String(x.properties?.area_id)));if(ids.size===1){chooseArea([...ids][0]);return;}const zoom=await source.getClusterExpansionZoom(cluster);if(alive)m.easeTo({center:f.geometry.coordinates as [number,number],zoom,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:500});}catch{if(alive)setMapError(true);}});
   m.on('click','single',e=>{const id=e.features?.[0]?.properties?.area_id;if(id)chooseArea(String(id));});
  });cleanup=()=>{m.remove();map.current=null;};
 }).catch(()=>{if(alive)setMapError(true);});
 return()=>{alive=false;cleanup();};},[]);
 useEffect(()=>{pointsRef.current=points;const source=map.current?.getSource('observations') as GeoJSONSource|undefined;source?.setData(points.length?mapFeatures(points):EMPTY);},[points]);
 useEffect(()=>{if(!cloudConfig.enabled)return;let alive=true;let channel:ReturnType<SupabaseClient['channel']>|undefined;let timer:ReturnType<typeof setTimeout>|undefined;let interval:ReturnType<typeof setInterval>|undefined;
 const refresh=async()=>{const ticket=++request.current;const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15_000);try{const c=client.current;if(!c)return;const {data,error}=await c.from('community_map_points').select('id,area_id,area_label,latitude,longitude').order('approved_at',{ascending:false}).order('id').limit(500).abortSignal(controller.signal);if(error)throw error;const parsed=z.array(mapPointSchema).parse(data??[]);if(alive&&ticket===request.current){setPoints(parsed);pointsRef.current=parsed;setChecked(new Date());setDetail(d=>{if(d&&!parsed.some(p=>p.id===d.id)){++detailRequest.current;return null;}return d;});setState('ready');}}catch{if(alive&&ticket===request.current){++detailRequest.current;setPoints([]);pointsRef.current=[];setDetail(null);setState('error');}}finally{clearTimeout(timeout);}};
 refreshRef.current=()=>void refresh();
 const schedule=()=>{clearTimeout(timer);timer=setTimeout(()=>void refresh(),300);};
 const wake=()=>{if(document.visibilityState==='visible')void refresh();};
 void getSupabase().then(c=>{if(!alive)return;client.current=c;void refresh();channel=c.channel('public-community-map').on('postgres_changes',{event:'*',schema:'public',table:'community_map_points'},schedule).subscribe(status=>{if(!alive)return;setRealtime(status==='SUBSCRIBED');if(status==='SUBSCRIBED')void refresh();});interval=setInterval(wake,30_000);document.addEventListener('visibilitychange',wake);window.addEventListener('focus',wake);window.addEventListener('online',wake);}).catch(()=>{if(alive)setState('error');});
 return()=>{alive=false;++request.current;++detailRequest.current;clearTimeout(timer);clearInterval(interval);document.removeEventListener('visibilitychange',wake);window.removeEventListener('focus',wake);window.removeEventListener('online',wake);if(channel&&client.current)void client.current.removeChannel(channel);};},[]);
 function chooseArea(id:string){++detailRequest.current;setSelected(id);setDetail(null);setDetailError('');}
 function closeDetail(){++detailRequest.current;setDetail(null);setDetailError('');}
 async function open(id:string){const ticket=++detailRequest.current;setDetail(null);setDetailError('');try{const c=client.current;if(!c)throw Error();const {data,error}=await c.from('community_feed').select(FEED_COLUMNS).eq('id',id).maybeSingle();if(error||!data)throw Error();const parsed=feedItemSchema.parse(data);if(ticket!==detailRequest.current)return;if(pointsRef.current.some(p=>p.id===parsed.id))setDetail(parsed);else throw Error();}catch{if(ticket===detailRequest.current)setDetailError('기록을 불러오지 못했어요. 공개가 철회되었거나 연결이 끊겼을 수 있어요.');}}

 const same=mapSelection(points,selected);const label=same[0]?.area_label;
 return <section className="community-map" aria-labelledby="community-map-heading"><span className="community-map-kicker">OUR SHARED NATURE</span><h2 id="community-map-heading">함께 발견한 자연</h2><p>우리 주변에서 만난 생명들을 살펴보세요. 지도 위치는 직접 고른 공개 구역의 대표 지점이며 실제 발견 지점이 아니에요. 묶인 기록 수는 아래 구역별 목록에서 확인할 수 있어요. 지도는 안성 청량산의 양복리·오흥리 일대를 중심으로 보여드려요.</p>
 <div ref={container} className="community-map-canvas" aria-label="공개 관찰 구역 지도" role="region"/>
 {mapError&&<p>지도를 표시하지 못했어요. 아래 목록으로 구역을 살펴보세요.</p>}
 {state==='loading'?<p role="status">공개 기록을 불러오는 중이에요.</p>:state==='error'?<p role="status">지도 기록을 불러올 수 없어요. 연결 또는 지도 공개 준비 상태를 확인해 주세요.</p>:<p role="status">{points.length===500?'최대 500개 표시 · ':`${points.length}개 기록 · `}{realtime?'변경사항 연결됨':'주기적으로 새로 확인 중'}{checked&&` · ${checked.toLocaleTimeString('ko-KR')} 확인`}</p>}
 {cloudConfig.enabled&&<button className="m-text" onClick={()=>refreshRef.current()}>지도 기록 새로고침</button>}
 {state==='ready'&&points.length===0&&<p>아직 지도에 공개된 기록이 없어요.</p>}
 {points.length>0&&<div className="community-map-areas"><h3>구역별로 보기</h3>{[...new Map(points.map(p=>[p.area_id,p.area_label])).entries()].map(([id,name])=><button key={id} onClick={()=>chooseArea(id)}>{name} · {mapSelection(points,id).length}개</button>)}</div>}
 {selected&&same.length>0&&<div className="community-map-selection"><h3>{label}의 기록 {same.length}개</h3><p>모두 같은 대표 지점에 표시됩니다.</p>{same.map((p,i)=><button key={p.id} onClick={()=>void open(p.id)}>공개 기록 {i+1} 보기</button>)}</div>}
 {detailError&&<p role="alert">{detailError}</p>}{detail&&<article className="community-map-detail"><button onClick={closeDetail} aria-label="상세 닫기">닫기 ×</button><img src={detail.photo} alt={`${detail.species} 관찰 사진`}/><h3>{detail.title}</h3><p>{detail.species} · {detail.observed_on} · {detail.author_alias}</p><p>{detail.notes}</p></article>}
 <button className="m-secondary" onClick={onJoin}>내 기록으로 참여하기</button></section>;
}
