'use strict'

const readline = require('readline')
const { performance } = require('perf_hooks')
const { BarcodeFormat, BinaryBitmap, DecodeHintType, HybridBinarizer, MultiFormatReader, RGBLuminanceSource } = require('@zxing/library')
const readers = new Map()
for (const sym of ['CODE_128','QR_CODE']) {
  const code = BarcodeFormat[sym]
  if (code == null) throw new Error(`ZXing does not expose ${sym}`)
  const reader = new MultiFormatReader()
  reader.setHints(new Map([[DecodeHintType.TRY_HARDER,true],[DecodeHintType.POSSIBLE_FORMATS,[code]]]))
  readers.set(sym,reader)
}
function once(reader,bgr,width,height) {
  const started=performance.now(),luminance=new Uint8ClampedArray(width*height)
  for(let p=0,i=0;p<luminance.length;p++,i+=3)luminance[p]=Math.round(bgr[i+2]*.299+bgr[i+1]*.587+bgr[i]*.114)
  let text='',format='',error_type='',error_message='',status='no_return'
  try {
    const bitmap=new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(luminance,width,height)))
    const result=reader.decodeWithState(bitmap);text=result?.getText?.()||''
    const raw=result?.getBarcodeFormat?.();format=typeof raw==='number'&&BarcodeFormat[raw]?BarcodeFormat[raw]:(raw==null?'':String(raw))
    status=text?'returned':'no_return'
  } catch(e) {
    error_type=e?.constructor?.name||e?.name||'Error';error_message=e?.message||String(e)
    if(!['NotFoundException','ChecksumException','FormatException'].includes(error_type))status='error'
  } finally { reader.reset() }
  return {text,format,status,error_type,error_message,decoder_ms:performance.now()-started}
}
function handle(req) {
  if(!Number.isInteger(req.width)||!Number.isInteger(req.height)||req.width<1||req.height<1)throw new Error('Invalid dimensions')
  if(req.width*req.height>12000000)throw new Error('Image exceeds QR worker pixel limit')
  if(!readers.has(req.symbology))throw new Error(`Unknown single target symbology: ${req.symbology}`)
  const pixels=Buffer.from(req.pixels_b64,'base64');if(pixels.length!==req.width*req.height*3)throw new Error(`BGR byte count mismatch: ${pixels.length}`)
  const reader=readers.get(req.symbology),warmups=Number(req.warmups??0),repeats=Number(req.repeats??1)
  for(let i=0;i<warmups;i++)once(reader,pixels,req.width,req.height)
  const measurements=[];for(let i=1;i<=repeats;i++)measurements.push({repeat_id:i,...once(reader,pixels,req.width,req.height)})
  return {id:req.id,width:req.width,height:req.height,symbology:req.symbology,warmups,repeats,measurements}
}
const input=readline.createInterface({input:process.stdin,crlfDelay:Infinity})
input.on('line',line=>{try{process.stdout.write(JSON.stringify({ok:true,response:handle(JSON.parse(line))})+'\n')}catch(e){process.stdout.write(JSON.stringify({ok:false,error_type:e?.constructor?.name||'Error',error_message:e?.message||String(e)})+'\n')}})
process.stdout.write(JSON.stringify({ready:true,decoder:'@zxing/library',decoder_version:require('@zxing/library/package.json').version,node_version:process.version,try_harder:true,supported_single_format_requests:['CODE_128','QR_CODE']})+'\n')
