/* Reads the three public workbooks directly in the browser. No backend. */
const REPORT_SOURCES = [
  {cd:961,id:'1eh0xd3i_ZWCqP-xoH5h--K76jE4lE59BvHtVGZHfBfM'},
  {cd:969,id:'1rxtJOqOvDuE_OGznvklIo8lzG5o5ActE'},
  {cd:962,id:'1pqnr6JucXuP2h6cuBspwEb-0WSNUiQKR'}
];
function reportDate(value,year){
  if(value instanceof Date)return [value.getFullYear(),String(value.getMonth()+1).padStart(2,'0'),String(value.getDate()).padStart(2,'0')].join('-');
  if(value==null||value==='-'||value==='')return null;
  const text=String(value).trim();
  if(/^\d{4}-\d{2}-\d{2}/.test(text))return text.slice(0,10);
  const months={ene:1,feb:2,mar:3,abr:4,may:5,jun:6,jul:7,ago:8,set:9,sep:9,oct:10,nov:11,dic:12};
  const match=text.toLowerCase().match(/^(\d{1,2})[-/ ]([a-z]+|\d{1,2})(?:[-/ ](\d{2,4}))?$/);
  if(!match)throw new Error('Fecha no reconocida: '+text);
  const month=months[match[2]]||Number(match[2]);
  let y=match[3]?Number(match[3]):year;if(y<100)y+=2000;
  const d=new Date(y,month-1,Number(match[1]));
  if(d.getMonth()!==month-1||d.getDate()!==Number(match[1]))throw new Error('Fecha no válida: '+text);
  return [y,String(month).padStart(2,'0'),match[1].padStart(2,'0')].join('-');
}
async function readPublicWorkbook(source,names,signal){
  try{
    const url='https://docs.google.com/spreadsheets/d/'+source.id+'/export?format=xlsx&_='+Date.now();
    const response=await fetch(url,{credentials:'omit',cache:'no-store',signal});
    if(!response.ok)throw new Error('Google respondió '+response.status);
    const book=XLSX.read(await response.arrayBuffer(),{type:'array',cellDates:true});
    const grids=Object.fromEntries(names.map(name=>{
      if(!book.Sheets[name])throw new Error('Falta la hoja '+name);
      return [name,XLSX.utils.sheet_to_json(book.Sheets[name],{header:1,raw:true,defval:null,blankrows:false})];
    }));
    const years=Object.values(grids).flat().flat().filter(v=>v instanceof Date).map(v=>v.getFullYear());
    const year=years.length?Math.max(...years):new Date().getFullYear();
    const data={};
    for(const [name,grid] of Object.entries(grids)){
      const headers=(grid[0]||[]).map(v=>v==null?'':String(v).trim());
      if(!headers.includes('COD_CD'))throw new Error('Falta COD_CD en '+name);
      data[name]=grid.slice(1).filter(row=>row.some(v=>v!==null&&v!=='')).map(values=>{
        const row={};headers.forEach((key,i)=>{if(key)row[key]=key==='FECHA'?reportDate(values[i],year):(values[i]??null)});
        if(row.COD_CD==null)return null;
        if(Number(row.COD_CD)!==source.cd)throw new Error('COD_CD no coincide en '+name);
        row.COD_CD=source.cd;return row;
      }).filter(Boolean);
    }
    return data;
  }catch(error){throw new Error('CD '+source.cd+': '+error.message)}
}
async function loadReportSheets(names,signal){
  if(typeof XLSX==='undefined')throw new Error('Falta el archivo xlsx.full.min.js en la publicación');
  const results=await Promise.allSettled(REPORT_SOURCES.map(source=>readPublicWorkbook(source,names,signal)));
  const failed=results.filter(r=>r.status==='rejected');
  if(failed.length)throw new Error(failed.map(r=>r.reason.message).join(' · '));
  return {data:Object.fromEntries(names.map(name=>[name,results.flatMap(r=>r.value[name])])),updatedAt:new Date().toISOString()};
}
