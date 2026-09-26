/* Google Visualization JSONP works from file:// and GitHub Pages without CORS. */
const REPORT_SOURCES=[
 {cd:961,id:'1eh0xd3i_ZWCqP-xoH5h--K76jE4lE59BvHtVGZHfBfM'},
 {cd:969,id:'1rxtJOqOvDuE_OGznvklIo8lzG5o5ActE'},
 {cd:962,id:'1pqnr6JucXuP2h6cuBspwEb-0WSNUiQKR'}
];
function reportDate(value,year){
 if(value instanceof Date)return [value.getFullYear(),String(value.getMonth()+1).padStart(2,'0'),String(value.getDate()).padStart(2,'0')].join('-');
 if(value==null||value==='-'||value==='')return null;
 const text=String(value).trim();
 if(/^\d{4}-\d{2}-\d{2}/.test(text))return text.slice(0,10);
 const googleDate=text.match(/^Date\((\d{4}),(\d{1,2}),(\d{1,2})/);
 if(googleDate)return [googleDate[1],String(Number(googleDate[2])+1).padStart(2,'0'),googleDate[3].padStart(2,'0')].join('-');
 const months={ene:1,feb:2,mar:3,abr:4,may:5,jun:6,jul:7,ago:8,set:9,sep:9,oct:10,nov:11,dic:12};
 const match=text.toLowerCase().match(/^(\d{1,2})[-/ ]([a-z]+|\d{1,2})(?:[-/ ](\d{2,4}))?$/);
 if(!match)throw new Error('Fecha no reconocida: '+text);
 const month=months[match[2]]||Number(match[2]);let y=match[3]?Number(match[3]):year;if(y<100)y+=2000;
 const d=new Date(y,month-1,Number(match[1]));
 if(d.getMonth()!==month-1||d.getDate()!==Number(match[1]))throw new Error('Fecha no válida: '+text);
 return [y,String(month).padStart(2,'0'),match[1].padStart(2,'0')].join('-');
}
function requestGoogleTable(source,sheet,signal){
 return new Promise((resolve,reject)=>{
  const callback='ancGviz_'+source.cd+'_'+sheet.replace(/\W/g,'_')+'_'+Date.now()+'_'+Math.random().toString(36).slice(2);
  const script=document.createElement('script');let finished=false,timer;
  const cleanup=()=>{if(finished)return;finished=true;clearTimeout(timer);signal?.removeEventListener('abort',onAbort);script.remove();try{delete window[callback]}catch(error){window[callback]=undefined}};
  const fail=message=>{cleanup();reject(new Error(message))};
  const onAbort=()=>fail('Tiempo de espera agotado');
  window[callback]=result=>{
   if(result?.status==='error'){const detail=(result.errors||[]).map(error=>error.detailed_message||error.message).filter(Boolean).join('; ');fail(detail||'Google no pudo leer '+sheet);return}
   if(!result?.table){fail('Respuesta vacía en '+sheet);return}
   const table=result.table;cleanup();resolve(table);
  };
  const params=new URLSearchParams({sheet,headers:'1',tq:'select *',tqx:'responseHandler:'+callback,cacheBust:String(Date.now())});
  script.src='https://docs.google.com/spreadsheets/d/'+source.id+'/gviz/tq?'+params;
  script.async=true;script.onerror=()=>fail('No se pudo conectar con Google');
  timer=setTimeout(()=>fail('Google demoró demasiado'),30000);
  signal?.addEventListener('abort',onAbort,{once:true});document.head.appendChild(script);
 });
}
async function readPublicWorkbook(source,names,signal){
 try{
  const tables=await Promise.all(names.map(async name=>[name,await requestGoogleTable(source,name,signal)]));
  const years=tables.flatMap(([,table])=>table.rows.flatMap(row=>(row.c||[]).map(cell=>cell?.v))).filter(value=>value instanceof Date).map(value=>value.getFullYear());
  const year=years.length?Math.max(...years):new Date().getFullYear(),data={};
  for(const [name,table] of tables){
   const headers=table.cols.map(column=>String(column.label||column.id||'').trim());
   if(!headers.includes('COD_CD'))throw new Error('Falta COD_CD en '+name);
   data[name]=table.rows.map(row=>{const values=(row.c||[]).map(cell=>cell?.v??null),item={};headers.forEach((key,index)=>{if(key)item[key]=key==='FECHA'?reportDate(values[index],year):values[index]});if(item.COD_CD==null)return null;if(Number(item.COD_CD)!==source.cd)throw new Error('COD_CD no coincide en '+name);item.COD_CD=source.cd;return item}).filter(Boolean);
  }
  return data;
 }catch(error){throw new Error('CD '+source.cd+': '+error.message)}
}
async function loadReportSheets(names,signal){
 const results=await Promise.allSettled(REPORT_SOURCES.map(source=>readPublicWorkbook(source,names,signal))),failed=results.filter(result=>result.status==='rejected');
 if(failed.length)throw new Error(failed.map(result=>result.reason.message).join(' · '));
 return {data:Object.fromEntries(names.map(name=>[name,results.flatMap(result=>result.value[name])])),updatedAt:new Date().toISOString()};
}
