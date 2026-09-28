export async function preparePhoto(file: File): Promise<string> {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('JPEG, PNG, WebP 사진을 선택해 주세요. HEIC는 JPEG로 변환해 주세요.');
  if (file.size > 15*1024*1024) throw new Error('사진은 15MB 이하로 선택해 주세요.');
  const bitmap = await createImageBitmap(file);
  try {
    if (!bitmap.width || !bitmap.height) throw new Error('사진을 읽을 수 없습니다.');
    const scale = Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width*scale); canvas.height = Math.round(bitmap.height*scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('이 브라우저에서 사진 처리를 지원하지 않습니다.');
    context.fillStyle = '#ffffff'; context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/jpeg',0.85);
  } finally { bitmap.close(); }
}
