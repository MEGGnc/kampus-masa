import React, { useEffect, useMemo, useState } from "react";
import { Library, Moon, Sun, LogOut, Search, Armchair, Clock3, Coffee, QrCode, X, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { supabase } from "./supabase";

const LIBRARIES = [
  { id: "merkez", name: "Merkez Kütüphane", count: 50 },
  { id: "celik", name: "Çelik", count: 30 },
  { id: "ambar", name: "Ambar", count: 20 },
  { id: "fabrika", name: "Fabrika", count: 20 },
  { id: "lab", name: "Lab", count: 20 },
];
const TEST_STUDENTS = { "2026123456": "test1@agu.edu.tr", "2026987654": "test2@agu.edu.tr" };
const maskNo = n => n ? `${n.slice(0,2)}******${n.slice(-2)}` : "-";
const maskEmail = e => { const [n,d]=e.split("@"); return `${n[0]}${"*".repeat(Math.max(3,n.length-2))}${n.at(-1)}@${d}`; };
const remain = ms => `${String(Math.floor(ms/60000)).padStart(2,"0")}:${String(Math.floor((ms%60000)/1000)).padStart(2,"0")}`;
const elapsed = (iso, now) => { if(!iso) return "-"; const m=Math.max(0,Math.floor((now-new Date(iso))/60000)); return m>59?`${Math.floor(m/60)} sa ${m%60} dk`:`${m} dk`; };

export default function App(){
  const [dark,setDark]=useState(true), [now,setNow]=useState(Date.now());
  const [studentInput,setStudentInput]=useState(""), [studentNo,setStudentNo]=useState("");
  const [step,setStep]=useState("student"), [pending,setPending]=useState(null), [otp,setOtp]=useState(""), [otpInput,setOtpInput]=useState(""), [error,setError]=useState("");
  const [desks,setDesks]=useState([]), [active,setActive]=useState(null), [penaltyUntil,setPenaltyUntil]=useState(null), [loading,setLoading]=useState(true);
  const [library,setLibrary]=useState("all"), [query,setQuery]=useState(""), [selected,setSelected]=useState(null), [qrDesk,setQrDesk]=useState(null), [returnQr,setReturnQr]=useState(false), [qrInput,setQrInput]=useState(""), [toast,setToast]=useState(null);

  useEffect(()=>{ const t=setInterval(()=>setNow(Date.now()),1000); return()=>clearInterval(t); },[]);
  const notify=(message,type="ok")=>{ setToast({message,type}); setTimeout(()=>setToast(null),3500); };

  async function loadDesks(){
    setLoading(true);
    const {data,error}=await supabase.from("desks").select("id,code,status,is_active,library_id,libraries(code,name,prefix)").order("code");
    if(error) notify(error.message,"bad");
    else setDesks((data||[]).map(d=>({id:d.id,code:d.code,status:d.status,libraryId:d.libraries?.code,libraryName:d.libraries?.name})));
    setLoading(false);
  }
  async function loadStudentState(no){
    if(!no) return;
    const {data,error}=await supabase.rpc("get_student_state",{p_student_no:no});
    if(error) return notify(error.message,"bad");
    setActive(data?.active_reservation||null); setPenaltyUntil(data?.penalty_until||null);
  }
  useEffect(()=>{
    loadDesks();
    const channel=supabase.channel("desk-live").on("postgres_changes",{event:"*",schema:"public",table:"desks"},()=>{loadDesks(); if(studentNo) loadStudentState(studentNo);}).subscribe();
    return()=>{supabase.removeChannel(channel)};
  },[studentNo]);

  const login=()=>{
    if(!/^\d{10}$/.test(studentInput)) return setError("Öğrenci numarası tam olarak 10 rakam olmalıdır.");
    const email=TEST_STUDENTS[studentInput]; if(!email) return setError("Bu öğrenci numarası test listesinde kayıtlı değil.");
    const code=String(Math.floor(100000+Math.random()*900000)); setPending({no:studentInput,email}); setOtp(code); setOtpInput(""); setError(""); setStep("otp");
  };
  const verifyOtp=async()=>{ if(otpInput!==otp) return setError("Doğrulama kodu hatalı."); setStudentNo(pending.no); setError(""); await loadStudentState(pending.no); notify("Canlı sisteme giriş yapıldı."); };
  const reserve=async()=>{ const {error}=await supabase.rpc("reserve_desk",{p_student_no:studentNo,p_qr_token:qrInput.trim().toUpperCase()}); if(error)return notify(error.message,"bad"); const code=qrDesk.code; setQrDesk(null);setQrInput("");await Promise.all([loadDesks(),loadStudentState(studentNo)]);notify(`${code} masası alındı.`); };
  const release=async()=>{ const {error}=await supabase.rpc("release_desk",{p_student_no:studentNo,p_desk_code:active.desk_code});if(error)return notify(error.message,"bad");await Promise.all([loadDesks(),loadStudentState(studentNo)]);notify("Masa boşaltıldı."); };
  const startBreak=async()=>{const {error}=await supabase.rpc("start_break",{p_student_no:studentNo});if(error)return notify(error.message,"bad");await Promise.all([loadDesks(),loadStudentState(studentNo)]);notify("15 dakikalık teneffüs başladı.");};
  const endBreak=async()=>{const {error}=await supabase.rpc("end_break",{p_student_no:studentNo,p_qr_token:qrInput.trim().toUpperCase()});if(error)return notify(error.message,"bad");setReturnQr(false);setQrInput("");await Promise.all([loadDesks(),loadStudentState(studentNo)]);notify("Masaya dönüş doğrulandı.");};
  const logout=()=>{setStudentNo("");setStudentInput("");setStep("student");setPending(null);setActive(null);setError("");};

  const filtered=useMemo(()=>desks.filter(d=>(library==="all"||d.libraryId===library)&&(!query.trim()||d.code.includes(query.trim().toUpperCase()))),[desks,library,query]);
  const stats=LIBRARIES.map(l=>{const list=desks.filter(d=>d.libraryId===l.id),used=list.filter(d=>d.status!=="available").length;return{...l,used,free:l.count-used,pct:Math.round(used/l.count*100)}});
  const penaltyMs=penaltyUntil?Math.max(0,new Date(penaltyUntil)-now):0, breakMs=active?.break_deadline?Math.max(0,new Date(active.break_deadline)-now):0;

  if(!studentNo) return <div className={dark?"app dark":"app"}><button className="theme" onClick={()=>setDark(!dark)}>{dark?<Sun/>:<Moon/>}</button><main className="loginWrap"><section className="loginCard"><div className="brandIcon"><Library/></div><small>GÜVENLİ KAMPÜS GİRİŞİ</small><h1>{step==="student"?"Kimliğini doğrula.":"E-postanı kontrol et."}</h1>{step==="student"?<><p>Veritabanında kayıtlı test öğrencisiyle giriş yap.</p><label>Öğrenci numarası</label><input value={studentInput} onChange={e=>setStudentInput(e.target.value.replace(/\D/g,"").slice(0,10))} onKeyDown={e=>e.key==="Enter"&&login()} placeholder="10 haneli numaran"/><button className="primary" onClick={login}>Kayıt kontrolü yap</button><div className="demo">Test: 2026123456</div></>:<><p>Kod <b>{maskEmail(pending.email)}</b> adresine gönderildi.</p><div className="demo warning">Demo kodu: <b>{otp}</b></div><label>6 haneli kod</label><input className="otp" value={otpInput} onChange={e=>setOtpInput(e.target.value.replace(/\D/g,"").slice(0,6))} onKeyDown={e=>e.key==="Enter"&&verifyOtp()} placeholder="000000"/><button className="primary" onClick={verifyOtp}>Kodu doğrula</button><button className="ghost" onClick={()=>{setStep("student");setError("")}}>Geri dön</button></>}{error&&<div className="error"><AlertTriangle/>{error}</div>}</section></main></div>;

  return <div className={dark?"app dark":"app"}><header><div className="headerIn"><div className="brand"><span><Library/></span><div><b>Kampüs Masa</b><small>Canlı Kütüphane Yönetimi</small></div></div><div className="clock"><Clock3/>{new Date(now).toLocaleTimeString("tr-TR")}</div><div className="actions"><button onClick={loadDesks}><RefreshCw/></button><button onClick={()=>setDark(!dark)}>{dark?<Sun/>:<Moon/>}</button><button onClick={logout}><LogOut/></button></div></div></header><main className="container"><section className="hero"><div><small>DOĞRULANMIŞ ÖĞRENCİ, {maskNo(studentNo)}</small><h1>Bugün nerede çalışacaksın?</h1></div>{penaltyMs>0&&<div className="status danger"><AlertTriangle/><div><small>MASA ALMA CEZASI</small><b>{remain(penaltyMs)} kaldı</b></div></div>}{active&&<div className={`status ${active.status==="on_break"?"break":"active"}`}><Coffee/><div><small>{active.status==="on_break"?"TENEFFÜSTESİN":"AKTİF MASAN"}</small><b>{active.desk_code} · {active.status==="on_break"?remain(breakMs):elapsed(active.started_at,now)}</b></div>{active.status==="on_break"?<button onClick={()=>{setQrInput("");setReturnQr(true)}}>Masaya döndüm</button>:<button onClick={startBreak}>15 dk teneffüs</button>}<button className="release" onClick={release}>Masayı bırak</button></div>}</section><section className="stats">{stats.map(s=><article key={s.id}><div><b>{s.name}</b><strong>%{s.pct}</strong></div><small>{s.count} masa</small><div className="bar"><i style={{width:`${s.pct}%`}}/></div><footer><span>{s.used} dolu</span><em>{s.free} boş</em></footer></article>)}</section><section className="deskPanel"><div className="tools"><nav>{[{id:"all",name:"Tümü"},...LIBRARIES].map(l=><button className={library===l.id?"chosen":""} key={l.id} onClick={()=>setLibrary(l.id)}>{l.name}</button>)}</nav><label className="search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Masa ara: M-12"/></label></div>{loading?<p>Masalar yükleniyor...</p>:<div className="grid">{filtered.map(d=><button key={d.id} onClick={()=>setSelected(d)} className={d.status==="on_break"?"desk breakDesk":d.status!=="available"?"desk busy":"desk free"}><Armchair/><b>{d.code}</b><small>{d.status==="on_break"?"TENEFFÜSTE":d.status==="available"?"BOŞ":"DOLU"}</small></button>)}</div>}</section></main>{selected&&<Modal close={()=>setSelected(null)}><p className="muted">{selected.libraryName}</p><h2>{selected.code}</h2><div className={`deskState ${selected.status==="on_break"?"orange":selected.status!=="available"?"red":"green"}`}><small>MASA DURUMU</small><b>{selected.status==="available"?"Boş ve kullanılabilir":selected.status==="on_break"?"Teneffüste":"Dolu"}</b></div>{selected.status==="available"?<button className="primary" onClick={()=>{if(active)return notify(`Zaten ${active.desk_code} masasını kullanıyorsun.`,"bad");if(penaltyMs)return notify("Ceza süren devam ediyor.","bad");setQrDesk(selected);setSelected(null);setQrInput("")}}><QrCode/> QR ile masayı doğrula</button>:<p>Bu masa şu anda kullanılamıyor.</p>}</Modal>}{qrDesk&&<Modal close={()=>setQrDesk(null)}><h2>{qrDesk.code} QR kodu</h2><div className="qr"><QrCode/><b>Masadaki kodu okut</b><small>Demo: AGU-{qrDesk.code}</small></div><input value={qrInput} onChange={e=>setQrInput(e.target.value.toUpperCase())} placeholder={`AGU-${qrDesk.code}`}/><button className="primary" onClick={reserve}>Doğrula ve kullan</button></Modal>}{returnQr&&active&&<Modal close={()=>setReturnQr(false)}><h2>{active.desk_code} dönüş doğrulaması</h2><div className="qr orange"><Coffee/><b>Masadaki kodu yeniden okut</b><small>Demo: AGU-{active.desk_code}</small></div><input value={qrInput} onChange={e=>setQrInput(e.target.value.toUpperCase())} placeholder={`AGU-${active.desk_code}`}/><button className="primary amber" onClick={endBreak}>Dönüşü doğrula</button></Modal>}{toast&&<div className={`toast ${toast.type==="bad"?"bad":""}`}>{toast.type==="bad"?<AlertTriangle/>:<CheckCircle2/>}{toast.message}</div>}</div>;
}
function Modal({children,close}){return <div className="overlay" onMouseDown={close}><section className="modal" onMouseDown={e=>e.stopPropagation()}><button className="close" onClick={close}><X/></button>{children}</section></div>}
