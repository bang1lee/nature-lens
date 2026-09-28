import { newObservation, type Observation } from './domain';
function botanical(seed:number){
 const c=document.createElement('canvas');c.width=800;c.height=1000;const x=c.getContext('2d')!;
 x.fillStyle=['#e8ebdf','#eee7d9','#e3e9e5'][seed];x.fillRect(0,0,800,1000);
 x.translate(400,860);x.rotate((seed-1)*.15);x.strokeStyle='#506449';x.lineWidth=5;x.beginPath();x.moveTo(0,0);x.quadraticCurveTo(-35,-310,15,-690);x.stroke();
 for(let i=0;i<9;i++){const yy=-70-i*65;for(const sign of [-1,1]){x.save();x.translate(0,yy);x.rotate(sign*.83);x.fillStyle=['#60734d','#7b8053','#3d6953'][seed];x.beginPath();x.ellipse(0,-75,28+(i%3)*7,87,0,0,Math.PI*2);x.fill();x.strokeStyle='#c6cbb3';x.lineWidth=1.3;x.beginPath();x.moveTo(0,-5);x.lineTo(0,-148);x.stroke();x.restore();}}
 x.setTransform(1,0,0,1,0,0);x.fillStyle='#45533e';x.font='18px sans-serif';x.fillText('NATURE LENS / ILLUSTRATION',45,955);return c.toDataURL('image/jpeg',.85);
}
export function demoRecords():Observation[]{return ['겹겹이 펼쳐진 초록','빛을 머금은 잎','숲의 작은 무늬'].map((title,i)=>({...newObservation(),id:`demo-${i}`,title,species:'예제 식물 (종 미확정)',notes:'잎의 모양과 배열을 살펴보았습니다. 이 카드는 사용법을 보여 주는 가상 기록이며, 이미지는 식물 삽화입니다. 실제 종 관찰 자료로 사용하지 마세요.',habitat:'숲',photo:botanical(i),demo:true}));}
