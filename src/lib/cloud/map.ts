import {z} from 'zod';
import type {FeatureCollection,Point} from 'geojson';

// Only these fields enter map state or GeoJSON; unknown server fields are discarded.
export const mapPointSchema=z.object({id:z.uuid(),area_id:z.string().min(1).max(80),area_label:z.string().min(1).max(100),latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180)}).strip();
export type MapPoint=z.infer<typeof mapPointSchema>;
export function mapFeatures(points:MapPoint[]):FeatureCollection<Point,{id:string;area_id:string}> {
 return {type:'FeatureCollection',features:points.map(p=>({type:'Feature',geometry:{type:'Point',coordinates:[p.longitude,p.latitude]},properties:{id:p.id,area_id:p.area_id}}))};
}
export function mapSelection(points:MapPoint[],areaId:string){return points.filter(p=>p.area_id===areaId);}
