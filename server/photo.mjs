import sharp from 'sharp';
export async function sanitizePhoto(dataUrl) {
 const bytes=Buffer.from(dataUrl.split(',')[1]||'','base64');
 if(!bytes.length||bytes.length>4*1024*1024)throw new Error('invalid-image');
 const decoder=sharp(bytes,{limitInputPixels:16_000_000,failOn:'warning'});
 const meta=await decoder.metadata();
 if(!['jpeg','png'].includes(meta.format)||!meta.width||!meta.height||(meta.pages||1)>1)throw new Error('invalid-image');
 // Decode actual bytes and strip all metadata before external transmission.
 return decoder.rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).flatten({background:'#fff'}).jpeg({quality:85}).toBuffer();
}
