"use strict";
/* =====================================================================
   PORTAL DO COLABORADOR (RH) — módulo isolado
   Carregado pelo index.html antes do script principal. Usa as funções
   e o estado globais do portal (S, sb, h, render, go...) só quando é
   chamado, nunca durante o carregamento.

   BANCO DE HORAS — ponto de integração para o desenvolvimento próprio:
   defina, em um script carregado DEPOIS do rh.js, um objeto
     window.RH_BANCO_HORAS = {
       render(el, ctx) { ... }   // desenha a área dentro de "el"
     };
   ctx traz: supabase (cliente já autenticado), user, profile, isRH.
   O portal chama render() uma vez sempre que a página é aberta.
   ===================================================================== */

const RH_DOC_CATS = ["Políticas internas","Código de conduta","Políticas de RH","Benefícios","Procedimentos internos","Formulários","Comunicados oficiais","Outros"];
const RH_FER_STATUS = { rascunho:"Rascunho", pendente:"Pendente de aprovação", aprovada:"Aprovada", rejeitada:"Rejeitada", cancelada:"Cancelada" };
const RH_ACTION = { ferias_rascunho:"salvou um rascunho de férias", ferias_pendente:"pediu férias", ferias_aprovada:"aprovou as férias", ferias_rejeitada:"rejeitou as férias", ferias_cancelada:"cancelou as férias" };
const RH_HIST = { rascunho:"Salvou como rascunho", pendente:"Enviou para aprovação", aprovada:"Aprovou", rejeitada:"Rejeitou", cancelada:"Cancelou" };
const RH_AUD = { todos:"Todos os colaboradores", rh:"Somente RH", admin:"Somente administração" };
const RH_DOC_ST = { rascunho:"Rascunho", publicado:"Publicado", arquivado:"Arquivado" };
const RH_TABS = [["visao","Visão geral"],["horas","Meu banco de horas"],["ferias","Férias"],["aniversarios","Aniversariantes"],["eventos","Calendário de eventos"],["vr","Vale-refeição"],["beneficios","Benefícios"],["documentos","Documentos e políticas"]];
const RH_ADMIN_TABS = [["a-ferias","Férias"],["a-colab","Colaboradores"],["a-eventos","Eventos"],["a-vr","Vale-refeição"],["a-benef","Benefícios"],["a-docs","Documentos"],["a-regras","Regras de férias"]];
const RH_MONTHS = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const RH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5"/><path d="M16 5.5a3 3 0 0 1 0 5.6M18.5 14.5c1.4.8 2.3 2.4 2.5 4.5"/></svg>';

(function injectCss(){
  const css = `
  .rh-sub{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 20px;padding-bottom:12px;border-bottom:1px solid var(--rule)}
  .rh-sub button{border:1px solid var(--field);background:#fff;border-radius:16px;padding:5px 14px;font-size:14px;cursor:pointer;color:var(--ink)}
  .rh-sub button[aria-current="page"]{background:var(--brand);border-color:var(--brand);color:#fff}
  .rh-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}
  .rh-card{background:#fff;border:1px solid var(--card-line);border-radius:4px;padding:18px;display:flex;flex-direction:column;gap:8px;min-width:0}
  .rh-card h3{margin:0;font-size:16px}
  .rh-card .more{margin-top:auto}
  .rh-kpi{font-size:24px;font-weight:700;color:var(--navy);font-variant-numeric:tabular-nums}
  .rh-person{display:flex;justify-content:space-between;gap:12px;align-items:baseline;padding:10px 0;border-bottom:1px solid var(--rule)}
  .rh-person:last-child{border-bottom:0}
  .rh-person .who2{font-weight:600}
  .rh-person .det{font-size:14px;color:var(--ink-2)}
  .rh-person .dt{font-weight:600;color:var(--navy);white-space:nowrap;font-variant-numeric:tabular-nums}
  .rh-person.today .dt{color:var(--red)}
  .rh-ev{display:grid;grid-template-columns:62px 1fr;gap:14px;padding:12px 0;border-bottom:1px solid var(--rule)}
  .rh-ev:last-child{border-bottom:0}
  .rh-date{border:1px solid var(--rule);border-top:4px solid var(--red);border-radius:4px;text-align:center;padding:4px 0;line-height:1.1}
  .rh-date b{display:block;font-size:22px;color:var(--navy)}
  .rh-date span{font-size:12px;color:var(--ink-2);text-transform:uppercase}
  .rh-item{background:#fff;border:1px solid var(--rule);border-radius:4px;margin-bottom:10px}
  .rh-item-h{display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%;padding:14px 16px;border:0;background:none;text-align:left;cursor:pointer;color:var(--ink)}
  .rh-item-h .t{font-weight:600}
  .rh-item-h .s{font-size:14px;color:var(--ink-2)}
  .rh-item-b{padding:0 16px 16px;border-top:1px solid var(--rule)}
  .rh-item-b dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px 24px;margin:14px 0}
  .rh-item-b dt{font-size:13px;color:var(--ink-2)}
  .rh-item-b dd{margin:2px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}
  .rh-st{font-size:12px;font-weight:600;padding:2px 8px;border-radius:3px;border:1px solid currentColor;white-space:nowrap}
  .rh-st.rascunho,.rh-st.arquivado{color:var(--ink-3)}
  .rh-st.pendente{color:var(--brand-2)}
  .rh-st.aprovada,.rh-st.publicado{color:var(--ok)}
  .rh-st.rejeitada{color:var(--bad)}
  .rh-st.cancelada{color:var(--ink-3);text-decoration:line-through}
  .rh-table{width:100%;border-collapse:collapse;font-size:14px;min-width:720px}
  .rh-table th{text-align:left;font-weight:600;color:var(--navy);border-bottom:1px solid var(--rule);padding:8px}
  .rh-table td{border-bottom:1px solid var(--rule);padding:8px;vertical-align:middle}
  .rh-table input{min-height:34px;padding:5px 8px;font-size:14px}
  .rh-month{display:flex;align-items:center;gap:10px}
  .rh-month strong{min-width:150px;text-align:center;text-transform:capitalize}
  .rh-vr{font-size:32px;font-weight:700;color:var(--navy);font-variant-numeric:tabular-nums}
  .rh-search{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px}
  .rh-search input{flex:1;min-width:200px}
  .rh-search select{width:auto}
  .rh-checks{display:flex;flex-direction:column;gap:6px;max-height:180px;overflow:auto;border:1px solid var(--field);border-radius:4px;padding:8px 12px}
  .rh-checks label{font-weight:400;display:flex;gap:8px;align-items:center}
  `;
  const st=document.createElement("style"); st.textContent=css; document.head.appendChild(st);
})();

const RH = {
  tab:"visao", atab:"a-ferias", loaded:false, err:null,
  cfg:{}, ferias:[], aniv:[], eventos:[], beneficios:[], docs:[], versoes:[], colabs:[], people:[],
  form:{}, ferr:{}, busy:{}, steps:{}, open:{}, note:{}, q:"", cat:"", ym:null, showPast:false, filt:"pendente",
  ev:null, bf:null, dc:null, nv:{}, vr:null, rg:null, ce:{}, files:{}
};

/* ---------- utilidades ---------- */
RH.isRH = () => !!(S.profile && (S.profile.rh || isAdmin()));
const rhAddDays = (iso,n) => { const d=new Date(iso+"T12:00:00"); d.setDate(d.getDate()+n); return isoLocal(d); };
const rhDays = (a,b) => Math.round((new Date(b+"T12:00:00")-new Date(a+"T12:00:00"))/86400000);
function rhTempo(adm){
  if(!adm) return "";
  const a=new Date(adm+"T12:00:00"), t=new Date(todayISO()+"T12:00:00");
  let m=(t.getFullYear()-a.getFullYear())*12+(t.getMonth()-a.getMonth()); if(t.getDate()<a.getDate()) m--;
  if(m<0) return "Admissão futura";
  const y=Math.floor(m/12), r=m%12;
  if(!y && !r) return "Menos de 1 mês";
  return [y?`${y} ${y===1?"ano":"anos"}`:"", r?`${r} ${r===1?"mês":"meses"}`:""].filter(Boolean).join(" e ");
}
function rhErr(e){
  const m=(e&&e.message)||"";
  if(/does not exist|schema cache|Could not find the (table|function)/i.test(m)) return "O Portal do Colaborador ainda não está ativo no banco. Rode o arquivo rh.sql no SQL Editor do Supabase.";
  return dbMessage(e);
}
const rhV = (o,k) => h((o||{})[k] ?? "");
const rhSt = (st,map) => `<span class="rh-st ${h(st)}">${h(map[st]||st)}</span>`;
const rhPre = s => h(s||"").replace(/(https?:\/\/[^\s<]+)/g, u=>`<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
const rhEnd = f => (f.start && Number(f.days)>0) ? rhAddDays(f.start, Number(f.days)-1) : "";

/* ---------- carregamento ---------- */
RH.load = async function(){
  if(!S.profile || S.profile.status!=="aprovado") return;
  const errs=[];
  const run = async (fn) => { try{ await fn(); }catch(e){ errs.push(e); } };
  await Promise.all([
    run(async()=>{ const {data,error}=await sb.from("rh_settings").select("*").eq("id",1).maybeSingle(); if(error) throw error; RH.cfg=data||{}; }),
    run(async()=>{ const {data,error}=await sb.from("ferias").select("*, requester:profiles!ferias_requester_id_fkey(full_name,email)").order("created_at",{ascending:false}); if(error) throw error; RH.ferias=data||[]; }),
    run(async()=>{ const {data,error}=await sb.rpc("rh_aniversarios"); if(error) throw error; RH.aniv=data||[]; }),
    run(async()=>{ const {data,error}=await sb.from("eventos").select("*").order("event_date",{ascending:true}); if(error) throw error; RH.eventos=data||[]; }),
    run(async()=>{ const {data,error}=await sb.from("beneficios").select("*").order("sort_order",{ascending:true}).order("name",{ascending:true}); if(error) throw error; RH.beneficios=data||[]; }),
    run(async()=>{ const {data,error}=await sb.from("documentos").select("*").order("title",{ascending:true}); if(error) throw error; RH.docs=data||[]; }),
    run(async()=>{ const {data,error}=await sb.from("documento_versoes").select("*").order("version",{ascending:false}); if(error) throw error; RH.versoes=data||[]; }),
    RH.isRH() ? run(async()=>{
      const [p,c]=await Promise.all([
        sb.from("profiles").select("id,full_name,email,status,rh").eq("status","aprovado").order("full_name",{ascending:true}),
        sb.from("colaboradores").select("*")
      ]);
      if(p.error) throw p.error; if(c.error) throw c.error;
      RH.people=p.data||[]; RH.colabs=c.data||[];
    }) : null
  ]);
  RH.err = errs.length ? rhErr(errs[0]) : null;
  RH.loaded = true;
};
RH.leave = function(){ RH.form={}; RH.ferr={}; RH.ev=null; RH.bf=null; RH.dc=null; RH.nv={}; RH.vr=null; RH.rg=null; RH.ce={}; RH.files={}; };

/* ---------- integração com o portal ---------- */
RH.crumb = () => RH.tab==="admin" ? "Gestão do RH" : ((RH_TABS.find(t=>t[0]===RH.tab)||[])[1] || "");
RH.nav = function(item){
  const inR=S.module==="rh";
  const pend = RH.isRH() ? RH.ferias.filter(f=>f.status==="pendente").length : 0;
  const tabs = RH_TABS.map(([k,l])=>item("rh:"+k, l, "", inR && RH.tab===k, 0)).join("");
  return `${item("rh:visao","Portal do Colaborador",RH_ICON,false, inR?0:pend)}
    <div class="nav-sub">${tabs}${RH.isRH()?item("rh:admin","Gestão do RH","",inR&&RH.tab==="admin",pend):""}</div>`;
};
RH.status = function(){
  if(!RH.loaded) return "";
  const parts=[], today=todayISO(), md=today.slice(5);
  if(RH.isRH()){ const n=RH.ferias.filter(f=>f.status==="pendente").length; if(n) parts.push(`<span class="pill hot">${n} ${n===1?"pedido de férias para analisar":"pedidos de férias para analisar"}</span>`); }
  const mine=RH.ferias.filter(f=>f.requester_id===myId());
  const p=mine.filter(f=>f.status==="pendente").length; if(p) parts.push(`<span class="pill">${p===1?"1 pedido de férias pendente":`${p} pedidos de férias pendentes`}</span>`);
  const bd=RH.aniv.filter(a=>a.birth_month && `${String(a.birth_month).padStart(2,"0")}-${String(a.birth_day).padStart(2,"0")}`===md).length;
  if(bd) parts.push(`<span class="pill warn">${bd===1?"1 aniversariante hoje":`${bd} aniversariantes hoje`}</span>`);
  return parts.join("");
};
RH.openNotif = function(n){
  const f=RH.ferias.find(x=>x.id===n.ref_id);
  if(f && f.requester_id!==myId() && RH.isRH()){ RH.tab="admin"; RH.atab="a-ferias"; RH.filt=f.status; }
  else RH.tab="ferias";
  RH.open["f"+n.ref_id]=true;
};

/* ---------- renderização ---------- */
RH.render = function(v){
  if(!RH.loaded){ v.innerHTML=`<div class="empty">Carregando o Portal do Colaborador…</div>`; return; }
  if(RH.err && !RH.cfg.id){ v.innerHTML=`<div class="bar"><h2>Portal do Colaborador</h2></div><div class="notice err">${h(RH.err)} <button class="btn link" data-action="refresh">Tentar de novo</button></div>`; return; }
  if(RH.tab==="admin" && !RH.isRH()) RH.tab="visao";
  if(RH.tab==="vr") RH.tab="visao"; // o vale-refeição aparece só na página inicial
  const fn = { visao:rhVisao, horas:rhHoras, ferias:rhFerias, aniversarios:rhAniv, eventos:rhEventos, vr:rhVr, beneficios:rhBenef, documentos:rhDocs, admin:rhAdmin }[RH.tab] || rhVisao;
  fn(v);
};

function rhVisao(v){
  const today=todayISO(), d=new Date(today+"T12:00:00"), m=d.getMonth()+1;
  const evs=RH.eventos.filter(e=>e.event_date>=today).slice(0,4);
  const bms=RH.aniv.filter(a=>a.birth_month===m).sort((a,b)=>a.birth_day-b.birth_day);
  const ams=RH.aniv.filter(a=>a.admission_date && Number(a.admission_date.slice(5,7))===m && Number(a.admission_date.slice(0,4))<d.getFullYear());
  const mine=RH.ferias.filter(f=>f.requester_id===myId()).slice(0,3);
  const hasHoras = !!(window.RH_BANCO_HORAS && window.RH_BANCO_HORAS.render);
  v.innerHTML=`<div class="bar"><h2>Portal do Colaborador</h2></div>
  <div class="rh-grid">
    <div class="rh-card"><h3>Próximos eventos</h3>
      ${evs.length?evs.map(e=>`<div class="rh-person"><span class="who2">${h(e.title)}</span><span class="dt">${h(fmtDate(e.event_date).slice(0,5))}</span></div>`).join(""):`<p class="muted small">Nenhum evento programado.</p>`}
      <button class="btn link more" data-rhgo="eventos">Ver calendário</button></div>
    <div class="rh-card"><h3>Aniversariantes de ${RH_MONTHS[m-1]}</h3>
      ${bms.length?bms.slice(0,6).map(a=>`<div class="rh-person${a.birth_day===d.getDate()?" today":""}"><span class="who2">${h(a.full_name)}</span><span class="dt">${a.birth_day===d.getDate()?"Hoje":String(a.birth_day).padStart(2,"0")+"/"+String(m).padStart(2,"0")}</span></div>`).join(""):`<p class="muted small">Nenhum aniversariante cadastrado neste mês.</p>`}
      <button class="btn link more" data-rhgo="aniversarios">Ver todos</button></div>
    <div class="rh-card"><h3>Aniversários de empresa</h3>
      ${ams.length?ams.slice(0,6).map(a=>{ const y=d.getFullYear()-Number(a.admission_date.slice(0,4)); return `<div class="rh-person"><span class="who2">${h(a.full_name)}</span><span class="dt">${y} ${y===1?"ano":"anos"}</span></div>`; }).join(""):`<p class="muted small">Ninguém completa ano de casa neste mês.</p>`}
      <button class="btn link more" data-rhgo="aniversarios">Ver todos</button></div>
    <div class="rh-card"><h3>Minhas férias</h3>
      ${mine.length?mine.map(f=>`<div class="rh-person"><span class="det">${h(fmtDate(f.start_date))} a ${h(fmtDate(f.end_date))}</span>${rhSt(f.status,RH_FER_STATUS)}</div>`).join(""):`<p class="muted small">Você ainda não pediu férias pelo portal.</p>`}
      <button class="btn link more" data-rhgo="ferias">Solicitar ou acompanhar</button></div>
    <div class="rh-card"><h3>Banco de horas</h3>
      <p class="muted small">${hasHoras?"Consulte seu saldo e o histórico de movimentações.":"Seu saldo será exibido aqui quando a integração for concluída."}</p>
      <button class="btn link more" data-rhgo="horas">Abrir banco de horas</button></div>
    <div class="rh-card"><h3>Acesso rápido</h3>
      <button class="btn link" data-rhgo="beneficios" style="justify-content:flex-start">Benefícios (${RH.beneficios.filter(b=>b.active).length})</button>
      <button class="btn link" data-rhgo="documentos" style="justify-content:flex-start">Documentos e políticas (${RH.docs.filter(x=>x.status==="publicado").length})</button>
</div>
  </div>`;
}

function rhHoras(v){
  if(v.querySelector("#rh-banco-horas")) return;
  v.innerHTML=`<div class="bar"><h2>Meu banco de horas</h2></div><div id="rh-banco-horas"></div>`;
  const el=$("#rh-banco-horas");
  const ext=window.RH_BANCO_HORAS;
  if(ext && typeof ext.render==="function"){
    try{ ext.render(el, { supabase:sb, user:S.session.user, profile:S.profile, isRH:RH.isRH() }); }
    catch(e){ el.innerHTML=`<div class="notice err">Não foi possível carregar o banco de horas: ${h(e.message||e)}</div>`; }
  } else {
    el.innerHTML=`<div class="empty">Esta área vai mostrar o seu saldo e o histórico do banco de horas. A integração está em andamento e as informações serão disponibilizadas pelo RH.</div>`;
  }
}

/* --- férias (colaborador) --- */
function rhRegrasTxt(){
  const c=RH.cfg, r=[];
  if(c.ferias_min_dias) r.push(`mínimo de ${c.ferias_min_dias} dias por solicitação`);
  if(c.ferias_max_dias) r.push(`máximo de ${c.ferias_max_dias} dias por solicitação`);
  if(c.ferias_antecedencia) r.push(`pedido com pelo menos ${c.ferias_antecedencia} dias de antecedência`);
  return r;
}
function rhFeriasHist(f){
  return `<ol class="timeline">${(f.history||[]).map(e=>`<li><span class="when">${h(fmtWhen(e.at))}</span>, ${h(e.by_name||"Alguém")}: ${h(RH_HIST[e.action]||e.action)}${e.comment?`<span class="cmt">“${h(e.comment)}”</span>`:""}</li>`).join("")}</ol>`;
}
function rhFeriasItem(f, admin){
  const k="f"+f.id, open=!!RH.open[k], b=RH.busy[k]?"disabled":"", mine=f.requester_id===myId();
  let act="";
  if(admin && f.status==="pendente"){
    act=`<div class="field"><label for="rhn-${h(f.id)}">Justificativa${" "}(obrigatória para rejeitar)</label><textarea id="rhn-${h(f.id)}" data-rhnote="${h(k)}">${h(RH.note[k]||"")}</textarea></div>
      <div class="btns"><button class="btn ok" data-rhf="aprovada" data-id="${h(f.id)}" ${b}>Aprovar</button><button class="btn bad" data-rhf="rejeitada" data-id="${h(f.id)}" ${b}>Rejeitar</button></div>`;
  } else if(admin && f.status==="aprovada"){
    act=`<div class="field"><label for="rhn-${h(f.id)}">Motivo do cancelamento</label><textarea id="rhn-${h(f.id)}" data-rhnote="${h(k)}">${h(RH.note[k]||"")}</textarea></div>
      <div class="btns"><button class="btn bad" data-rhf="cancelada" data-id="${h(f.id)}" ${b}>Cancelar férias aprovadas</button></div>`;
  } else if(!admin && mine && f.status==="rascunho"){
    act=`<div class="btns"><button class="btn primary" data-rhf="enviar" data-id="${h(f.id)}" ${b}>Enviar para aprovação</button><button class="btn" data-rhf="editar" data-id="${h(f.id)}" ${b}>Editar</button><button class="btn bad" data-rhf="cancelada" data-id="${h(f.id)}" ${b}>Descartar</button></div>`;
  } else if(!admin && mine && f.status==="pendente"){
    act=`<div class="btns"><button class="btn bad" data-rhf="cancelada" data-id="${h(f.id)}" ${b}>Cancelar solicitação</button></div>`;
  }
  return `<div class="rh-item"><button class="rh-item-h" data-rhopen="${h(k)}" aria-expanded="${open}">
      <span><span class="t">${h(fmtDate(f.start_date))} a ${h(fmtDate(f.end_date))}</span>
      <span class="s"> · ${f.days} ${f.days===1?"dia":"dias"}${admin?` · ${h((f.requester&&f.requester.full_name)||"")}`:""} · ${h(f.code)}</span></span>${rhSt(f.status,RH_FER_STATUS)}</button>
    ${open?`<div class="rh-item-b"><dl>
      ${admin?`<div><dt>Colaborador</dt><dd>${h((f.requester&&f.requester.full_name)||"")}</dd></div>`:""}
      <div><dt>Período</dt><dd>${h(fmtDate(f.start_date))} a ${h(fmtDate(f.end_date))} (${f.days} dias)</dd></div>
      <div><dt>Solicitado em</dt><dd>${h(fmtWhen(f.created_at))}</dd></div>
      ${f.notes?`<div><dt>Observações</dt><dd>${h(f.notes)}</dd></div>`:""}
      ${f.decision_note?`<div><dt>${f.status==="rejeitada"?"Justificativa da rejeição":"Observação do RH"}</dt><dd>${h(f.decision_note)}</dd></div>`:""}
    </dl>${rhFeriasHist(f)}${act?`<div class="actions">${act}${stepsHTML(RH.steps[k]||[])}</div>`:""}</div>`:""}</div>`;
}
function rhFerias(v){
  const f=RH.form, e=RH.ferr, busy=RH.busy.form?"disabled":"", regras=rhRegrasTxt();
  const mine=RH.ferias.filter(x=>x.requester_id===myId());
  const er=k=>e[k]?`<span class="err">${h(e[k])}</span>`:"";
  const end=rhEnd(f);
  v.innerHTML=`<div class="bar"><h2>Férias</h2>${f.open?"":`<button class="btn primary" data-rhact="ferias-new">Solicitar férias</button>`}</div>
    <div class="notice" style="border-left-color:var(--brand-2)">${regras.length?`<strong>Regras definidas pelo RH:</strong> ${h(regras.join("; "))}.`:`O RH ainda não cadastrou regras de férias no portal. Confirme as condições com o RH antes de pedir.`}
      ${RH.cfg.ferias_observacao?`<div style="margin-top:6px;white-space:pre-wrap">${rhPre(RH.cfg.ferias_observacao)}</div>`:""}</div>
    ${f.open?`<form class="sheet" id="rh-ferias-form" novalidate>
      <div class="bar"><h2>${f.id?"Editar rascunho":"Solicitar férias"}</h2></div>
      <div class="fields">
        <div class="field"><label for="rhf-start">Data de início</label><input type="date" id="rhf-start" data-rhff="start" min="${todayISO()}" value="${rhV(f,"start")}" ${busy}>${er("start")}</div>
        <div class="field"><label for="rhf-days">Quantidade de dias</label><input type="number" id="rhf-days" data-rhff="days" min="1" max="60" value="${rhV(f,"days")}" ${busy}>
          <span class="hint" id="rhf-end">${end?`Término: ${h(fmtDate(end))}`:"O término é calculado automaticamente"}</span>${er("days")}</div>
        <div class="field wide"><label for="rhf-notes">Observações (opcional)</label><textarea id="rhf-notes" data-rhff="notes" ${busy}>${rhV(f,"notes")}</textarea></div>
      </div>
      ${e.submit?`<div class="notice err" style="margin:16px 0 0">${h(e.submit)}</div>`:""}
      <div class="formfoot"><button type="button" class="btn" data-rhact="ferias-cancel" ${busy}>Cancelar</button>
        <button type="button" class="btn" data-rhact="ferias-draft" ${busy}>Salvar rascunho</button>
        <button type="submit" class="btn primary" ${busy}>${RH.busy.form?"Enviando…":"Enviar para aprovação"}</button></div>
    </form>`:""}
    <h3>Minhas solicitações</h3>
    ${mine.length?mine.map(x=>rhFeriasItem(x,false)).join(""):`<div class="empty">Você ainda não pediu férias pelo portal.</div>`}`;
}

/* --- aniversariantes --- */
function rhAniv(v){
  const now=new Date(todayISO()+"T12:00:00");
  if(!RH.ym) RH.ym={y:now.getFullYear(), m:now.getMonth()+1};
  const {y,m}=RH.ym, isCur = y===now.getFullYear() && m===now.getMonth()+1;
  const bms=RH.aniv.filter(a=>a.birth_month===m).sort((a,b)=>a.birth_day-b.birth_day || a.full_name.localeCompare(b.full_name));
  const ams=RH.aniv.filter(a=>a.admission_date && Number(a.admission_date.slice(5,7))===m && Number(a.admission_date.slice(0,4))<y)
    .sort((a,b)=>Number(a.admission_date.slice(8,10))-Number(b.admission_date.slice(8,10)));
  const semDados = RH.aniv.length===0;
  v.innerHTML=`<div class="bar"><h2>Aniversariantes</h2>
      <div class="rh-month"><button class="btn" data-rhmonth="-1" aria-label="Mês anterior">‹</button><strong>${RH_MONTHS[m-1]} de ${y}</strong><button class="btn" data-rhmonth="1" aria-label="Próximo mês">›</button>${isCur?"":`<button class="btn link" data-rhmonth="0">Hoje</button>`}</div></div>
    ${semDados?`<div class="notice">As datas de aniversário e de admissão ainda não foram cadastradas pelo RH.</div>`:""}
    <div class="rh-grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">
      <div class="rh-card"><h3>Aniversariantes do mês</h3>
        ${bms.length?bms.map(a=>{ const today=isCur&&a.birth_day===now.getDate();
          return `<div class="rh-person${today?" today":""}"><span><span class="who2">${h(a.full_name)}</span>${a.department?`<br><span class="det">${h(a.department)}</span>`:""}</span><span class="dt">${today?"Hoje":String(a.birth_day).padStart(2,"0")+"/"+String(m).padStart(2,"0")}</span></div>`; }).join("")
          :`<p class="muted small">Ninguém faz aniversário em ${RH_MONTHS[m-1]}.</p>`}</div>
      <div class="rh-card"><h3>Aniversários de empresa</h3>
        ${ams.length?ams.map(a=>{ const n=y-Number(a.admission_date.slice(0,4));
          return `<div class="rh-person"><span><span class="who2">${h(a.full_name)}</span><br><span class="det">${a.department?h(a.department)+" · ":""}Admissão em ${h(fmtDate(a.admission_date))} · ${h(rhTempo(a.admission_date))} de casa</span></span><span class="dt">${n} ${n===1?"ano":"anos"} em ${a.admission_date.slice(8,10)}/${String(m).padStart(2,"0")}</span></div>`; }).join("")
          :`<p class="muted small">Ninguém completa ano de casa em ${RH_MONTHS[m-1]}.</p>`}</div>
    </div>`;
}

/* --- eventos --- */
function rhEventoRow(e){
  const d=new Date(e.event_date+"T12:00:00");
  const hr=[e.start_time&&e.start_time.slice(0,5), e.end_time&&e.end_time.slice(0,5)].filter(Boolean).join(" às ");
  return `<div class="rh-ev"><div class="rh-date"><b>${d.getDate()}</b><span>${RH_MONTHS[d.getMonth()].slice(0,3)}</span></div>
    <div><div style="font-weight:600">${h(e.title)}</div><div class="small muted">${h(d.toLocaleDateString("pt-BR",{weekday:"long"}))}${hr?` · ${h(hr)}`:""}${e.location?` · ${h(e.location)}`:""}</div>
    ${e.description?`<div class="small" style="margin-top:4px;white-space:pre-wrap">${rhPre(e.description)}</div>`:""}</div></div>`;
}
function rhEventos(v){
  const today=todayISO();
  const list = RH.showPast ? [...RH.eventos].filter(e=>e.event_date<today).reverse() : RH.eventos.filter(e=>e.event_date>=today);
  const groups={}; list.forEach(e=>{ const k=e.event_date.slice(0,7); (groups[k]=groups[k]||[]).push(e); });
  v.innerHTML=`<div class="bar"><h2>Calendário de eventos</h2><button class="btn" data-rhact="past">${RH.showPast?"Ver próximos eventos":"Ver eventos passados"}</button></div>
    ${list.length?Object.entries(groups).map(([k,evs])=>`<h3>${RH_MONTHS[Number(k.slice(5))-1]} de ${k.slice(0,4)}</h3><div class="rh-card" style="padding:4px 18px">${evs.map(rhEventoRow).join("")}</div>`).join("")
      :`<div class="empty">${RH.showPast?"Nenhum evento passado.":"Nenhum evento programado. O RH publica os eventos aqui."}</div>`}`;
}

/* --- VR --- */
function rhVr(v){
  const c=RH.cfg, has = c.vr_valor!=null || c.vr_criterios || c.vr_regras;
  v.innerHTML=`<div class="bar"><h2>Vale-refeição</h2></div>
    ${has?`<div class="rh-card" style="max-width:720px">
      ${c.vr_valor!=null?`<div><div class="small muted">Valor do benefício</div><div class="rh-vr">${h(brl(c.vr_valor))}</div>${c.vr_periodicidade?`<div class="muted">${h(c.vr_periodicidade)}</div>`:""}</div>`:""}
      <div class="rh-item-b" style="padding:0;border:0"><dl>
        ${c.vr_criterios?`<div><dt>Critérios de concessão</dt><dd>${rhPre(c.vr_criterios)}</dd></div>`:""}
        ${c.vr_regras?`<div><dt>Regras de utilização</dt><dd>${rhPre(c.vr_regras)}</dd></div>`:""}
        ${c.vr_vigencia?`<div><dt>Vigente desde</dt><dd>${h(fmtDate(c.vr_vigencia))}</dd></div>`:""}
        ${c.vr_observacoes?`<div><dt>Observações</dt><dd>${rhPre(c.vr_observacoes)}</dd></div>`:""}
      </dl></div>
      <p class="small muted" style="margin:0">A regra vale para todos os colaboradores.</p></div>`
    :`<div class="empty">As informações do vale-refeição serão disponibilizadas pelo RH.</div>`}`;
}

/* --- benefícios --- */
function rhDocLink(id){ const d=RH.docs.find(x=>x.id===id); return d?`<button class="btn link" data-rhdoc="${h(d.id)}">${h(d.title)}</button>`:""; }
function rhBenefItem(b){
  const k="b"+b.id, open=!!RH.open[k];
  const links=(b.links||"").split(/\n+/).map(s=>s.trim()).filter(Boolean);
  const docs=(b.doc_ids||[]).map(rhDocLink).filter(Boolean);
  return `<div class="rh-item"><button class="rh-item-h" data-rhopen="${h(k)}" aria-expanded="${open}"><span><span class="t">${h(b.name)}</span>${b.category?`<span class="s"> · ${h(b.category)}</span>`:""}</span><span aria-hidden="true">${open?"−":"+"}</span></button>
    ${open?`<div class="rh-item-b">${b.description?`<p style="white-space:pre-wrap">${rhPre(b.description)}</p>`:""}<dl>
      ${b.eligibility?`<div><dt>Quem tem direito</dt><dd>${rhPre(b.eligibility)}</dd></div>`:""}
      ${b.usage_info?`<div><dt>Como usar</dt><dd>${rhPre(b.usage_info)}</dd></div>`:""}
      ${b.conditions?`<div><dt>Valores e condições</dt><dd>${rhPre(b.conditions)}</dd></div>`:""}
      ${b.contacts?`<div><dt>Contatos para dúvidas</dt><dd>${rhPre(b.contacts)}</dd></div>`:""}
      ${b.valid_from?`<div><dt>Vigente desde</dt><dd>${h(fmtDate(b.valid_from))}</dd></div>`:""}
      ${links.length?`<div><dt>Links</dt><dd>${links.map(rhPre).join("<br>")}</dd></div>`:""}
      ${docs.length?`<div><dt>Documentos relacionados</dt><dd>${docs.join("<br>")}</dd></div>`:""}
    </dl></div>`:""}</div>`;
}
function rhBenef(v){
  const list=RH.beneficios.filter(b=>b.active);
  v.innerHTML=`<div class="bar"><h2>Benefícios</h2></div>
    ${list.length?list.map(rhBenefItem).join(""):`<div class="empty">Os benefícios serão cadastrados pelo RH.</div>`}`;
}

/* --- documentos --- */
const rhCurVer = d => RH.versoes.find(x=>x.documento_id===d.id && x.version===d.current_version);
async function rhOpenDoc(id, versionId){
  const d=RH.docs.find(x=>x.id===id); if(!d) return;
  const ver = versionId ? RH.versoes.find(x=>x.id===versionId) : rhCurVer(d);
  if(!ver){ S.flash={kind:"warn", text:"Este documento ainda não tem arquivo."}; render(); return; }
  const w=window.open("", "_blank");
  const { data, error } = await sb.storage.from("rh-documentos").createSignedUrl(ver.file_path, 600, { download: ver.file_name });
  if(error || !data){ if(w) w.close(); S.flash={kind:"warn", text:"Não foi possível abrir o documento: "+dbMessage(error)}; render(); return; }
  if(w) w.location=data.signedUrl; else location.href=data.signedUrl;
}
function rhDocs(v){
  const q=normTxt(RH.q), cat=RH.cat;
  const vis=RH.docs.filter(d=>d.status==="publicado" && (!cat || d.category===cat) && (!q || normTxt(d.title+" "+(d.description||"")).includes(q)));
  const groups={}; vis.forEach(d=>{ (groups[d.category]=groups[d.category]||[]).push(d); });
  const cats=[...new Set(RH.docs.filter(d=>d.status==="publicado").map(d=>d.category))];
  preserveFocus(()=>{ v.innerHTML=`<div class="bar"><h2>Documentos e políticas</h2></div>
    <div class="rh-search"><label class="sr" for="rh-q">Buscar</label><input type="text" id="rh-q" data-rhq placeholder="Buscar por título ou descrição" value="${h(RH.q)}">
      <label class="sr" for="rh-cat">Categoria</label><select id="rh-cat" data-rhcat><option value="">Todas as categorias</option>${cats.map(c=>`<option ${c===cat?"selected":""}>${h(c)}</option>`).join("")}</select></div>
    ${vis.length?Object.entries(groups).map(([c,ds])=>`<h3>${h(c)}</h3>${ds.map(d=>{ const cv=rhCurVer(d), k="d"+d.id, open=!!RH.open[k];
      return `<div class="rh-item"><button class="rh-item-h" data-rhopen="${h(k)}" aria-expanded="${open}"><span><span class="t">${h(d.title)}</span><span class="s"> · atualizado em ${h(fmtDate((cv?cv.created_at:d.updated_at).slice(0,10)))}</span></span><span aria-hidden="true">${open?"−":"+"}</span></button>
        ${open?`<div class="rh-item-b">${d.description?`<p style="white-space:pre-wrap">${rhPre(d.description)}</p>`:""}
          <p class="small muted">Versão ${d.current_version}${cv?` · ${h(cv.file_name)}`:""}</p>
          <button class="btn primary" data-rhdoc="${h(d.id)}" ${cv?"":"disabled"}>Abrir documento</button></div>`:""}</div>`; }).join("")}`).join("")
      :`<div class="empty">${RH.docs.length?"Nenhum documento encontrado com esses filtros.":"O RH ainda não publicou documentos."}</div>`}`; });
}

/* ---------- área do RH ---------- */
function rhAdmin(v){
  const sub=`<div class="rh-sub" role="tablist">${RH_ADMIN_TABS.map(([k,l])=>`<button data-rhatab="${k}" ${RH.atab===k?'aria-current="page"':""}>${h(l)}${k==="a-ferias"&&RH.ferias.filter(f=>f.status==="pendente").length?` <span class="count">${RH.ferias.filter(f=>f.status==="pendente").length}</span>`:""}</button>`).join("")}</div>`;
  const body = { "a-ferias":rhAFerias, "a-colab":rhAColab, "a-eventos":rhAEventos, "a-vr":rhAVr, "a-benef":rhABenef, "a-docs":rhADocs, "a-regras":rhARegras }[RH.atab]();
  preserveFocus(()=>{ v.innerHTML=`<div class="bar"><h2>Gestão do RH</h2><button class="btn" data-action="refresh">Atualizar</button></div>${sub}${body}`; });
}
function rhAFerias(){
  const fl=RH.filt, list=RH.ferias.filter(f=>fl==="todas" ? f.status!=="rascunho" : f.status===fl);
  const opts=[["pendente","Pendentes"],["aprovada","Aprovadas"],["rejeitada","Rejeitadas"],["cancelada","Canceladas"],["todas","Todas"]];
  return `<div class="rh-sub" style="border:0;padding:0">${opts.map(([k,l])=>`<button data-rhfilt="${k}" ${fl===k?'aria-current="page"':""}>${l}</button>`).join("")}</div>
    ${list.length?list.map(f=>rhFeriasItem(f,true)).join(""):`<div class="empty">Nenhuma solicitação neste filtro.</div>`}`;
}
function rhAColab(){
  const byId={}; RH.colabs.forEach(c=>byId[c.user_id]=c);
  return `<p class="muted small" style="margin-top:0">Esses dados alimentam os aniversariantes e o tempo de casa. O ano de nascimento nunca aparece para os colaboradores.</p>
  <div class="tablewrap"><table class="rh-table"><thead><tr><th>Colaborador</th><th>Nascimento</th><th>Admissão</th><th>Setor</th><th>Tempo de casa</th><th></th></tr></thead><tbody>
  ${RH.people.map(p=>{ const c=byId[p.id]||{}, e=RH.ce[p.id], b=RH.busy["c"+p.id]?"disabled":"";
    if(e) return `<tr><td><strong>${h(p.full_name)}</strong><br><span class="small muted">${h(p.email)}</span></td>
      <td><input type="date" data-rhce="${h(p.id)}" data-k="birth_date" value="${rhV(e,"birth_date")}" aria-label="Nascimento" ${b}></td>
      <td><input type="date" data-rhce="${h(p.id)}" data-k="admission_date" value="${rhV(e,"admission_date")}" aria-label="Admissão" ${b}></td>
      <td><input type="text" data-rhce="${h(p.id)}" data-k="department" value="${rhV(e,"department")}" aria-label="Setor" ${b}></td>
      <td>${h(rhTempo(e.admission_date))}</td>
      <td style="white-space:nowrap"><button class="btn primary" data-rhcsave="${h(p.id)}" ${b}>Salvar</button> <button class="btn" data-rhcno="${h(p.id)}" ${b}>Voltar</button>${RH.steps["c"+p.id]&&RH.steps["c"+p.id].length?`<div class="err">${h(RH.steps["c"+p.id][0])}</div>`:""}</td></tr>`;
    return `<tr><td><strong>${h(p.full_name)}</strong><br><span class="small muted">${h(p.email)}</span></td><td>${h(fmtDate(c.birth_date))}</td><td>${h(fmtDate(c.admission_date))}</td><td>${h(c.department||"")}</td><td>${h(rhTempo(c.admission_date))}</td>
      <td><button class="btn" data-rhcedit="${h(p.id)}">Editar</button></td></tr>`; }).join("")}
  </tbody></table></div>`;
}
function rhFld(scope, k, label, type, val, extra){
  const id=`rh-${scope}-${k}`;
  if(type==="area") return `<div class="field wide"><label for="${id}">${label}</label><textarea id="${id}" data-rhin="${scope}" data-k="${k}" ${extra||""}>${h(val??"")}</textarea></div>`;
  return `<div class="field"><label for="${id}">${label}</label><input type="${type}" id="${id}" data-rhin="${scope}" data-k="${k}" value="${h(val??"")}" ${extra||""}></div>`;
}
function rhSel(scope,k,label,opts,val){
  return `<div class="field"><label for="rh-${scope}-${k}">${label}</label><select id="rh-${scope}-${k}" data-rhin="${scope}" data-k="${k}">${opts.map(([v,l])=>`<option value="${h(v)}" ${String(val)===String(v)?"selected":""}>${h(l)}</option>`).join("")}</select></div>`;
}
function rhAEventos(){
  const e=RH.ev, today=todayISO();
  const form = e ? `<div class="panel"><h3 style="margin-top:0">${e.id?"Editar evento":"Novo evento"}</h3><div class="fields">
      ${rhFld("ev","title","Título","text",e.title)}${rhFld("ev","event_date","Data","date",e.event_date)}
      ${rhFld("ev","start_time","Início (opcional)","time",e.start_time&&e.start_time.slice(0,5))}${rhFld("ev","end_time","Término (opcional)","time",e.end_time&&e.end_time.slice(0,5))}
      ${rhFld("ev","location","Local ou link (opcional)","text",e.location)}${rhFld("ev","description","Descrição (opcional)","area",e.description)}</div>
      ${stepsHTML(RH.steps.ev||[])}<div class="formfoot"><button class="btn" data-rhact="ev-cancel">Cancelar</button><button class="btn primary" data-rhact="ev-save" ${RH.busy.ev?"disabled":""}>Salvar evento</button></div></div>`
    : `<div class="formfoot" style="justify-content:flex-start;margin:0 0 16px"><button class="btn primary" data-rhact="ev-new">Novo evento</button></div>`;
  const list=[...RH.eventos].sort((a,b)=>(a.event_date<today)-(b.event_date<today) || (a.event_date<today ? b.event_date.localeCompare(a.event_date) : a.event_date.localeCompare(b.event_date)));
  return form + (list.length ? list.map(x=>`<div class="rh-item"><div class="rh-item-h" style="cursor:default"><span><span class="t">${h(x.title)}</span><span class="s"> · ${h(fmtDate(x.event_date))}${x.event_date<today?" (passado)":""}</span></span>
    <span style="display:flex;gap:8px"><button class="btn" data-rheved="${h(x.id)}">Editar</button><button class="btn bad" data-rhevdel="${h(x.id)}">Excluir</button></span></div></div>`).join("") : `<div class="empty">Nenhum evento cadastrado.</div>`);
}
function rhAVr(){
  const c=RH.vr || (RH.vr={ vr_valor: RH.cfg.vr_valor!=null?String(RH.cfg.vr_valor).replace(".",","):"", vr_periodicidade:RH.cfg.vr_periodicidade||"", vr_criterios:RH.cfg.vr_criterios||"", vr_regras:RH.cfg.vr_regras||"", vr_vigencia:RH.cfg.vr_vigencia||"", vr_observacoes:RH.cfg.vr_observacoes||"" });
  return `<div class="panel"><p class="muted small" style="margin-top:0">A mesma regra vale para todos os colaboradores. Deixe o valor vazio enquanto não houver informação oficial.</p><div class="fields">
    ${rhFld("vr","vr_valor","Valor (R$)","text",c.vr_valor,'inputmode="decimal" placeholder="0,00"')}${rhFld("vr","vr_periodicidade","Periodicidade","text",c.vr_periodicidade,'placeholder="Ex.: mensal, por dia útil trabalhado"')}
    ${rhFld("vr","vr_vigencia","Vigente desde","date",c.vr_vigencia)}<div></div>
    ${rhFld("vr","vr_criterios","Critérios de concessão","area",c.vr_criterios)}${rhFld("vr","vr_regras","Regras de utilização","area",c.vr_regras)}${rhFld("vr","vr_observacoes","Observações","area",c.vr_observacoes)}</div>
    ${stepsHTML(RH.steps.vr||[])}<div class="formfoot"><button class="btn primary" data-rhact="vr-save" ${RH.busy.vr?"disabled":""}>Salvar vale-refeição</button></div></div>`;
}
function rhABenef(){
  const b=RH.bf, pubDocs=RH.docs.filter(d=>d.status==="publicado");
  const form = b ? `<div class="panel"><h3 style="margin-top:0">${b.id?"Editar benefício":"Novo benefício"}</h3><div class="fields">
      ${rhFld("bf","name","Nome","text",b.name)}${rhFld("bf","category","Tipo (ex.: saúde, convênio)","text",b.category)}
      ${rhFld("bf","description","Descrição","area",b.description)}${rhFld("bf","eligibility","Quem tem direito","area",b.eligibility)}
      ${rhFld("bf","usage_info","Como usar","area",b.usage_info)}${rhFld("bf","conditions","Valores e condições","area",b.conditions)}
      ${rhFld("bf","links","Links para portais externos (um por linha)","area",b.links)}${rhFld("bf","contacts","Contatos para dúvidas","area",b.contacts)}
      ${rhFld("bf","valid_from","Vigente desde","date",b.valid_from)}${rhFld("bf","sort_order","Ordem de exibição","number",b.sort_order??0)}
      ${rhSel("bf","active","Situação",[["true","Visível para os colaboradores"],["false","Oculto"]],String(b.active!==false))}
      <div class="field wide"><span class="lbl">Documentos relacionados</span>${pubDocs.length?`<div class="rh-checks">${pubDocs.map(d=>`<label><input type="checkbox" data-rhbfdoc="${h(d.id)}" ${(b.doc_ids||[]).includes(d.id)?"checked":""}> ${h(d.title)}</label>`).join("")}</div>`:`<span class="hint">Publique documentos na aba Documentos para relacioná-los aqui.</span>`}</div>
    </div>${stepsHTML(RH.steps.bf||[])}<div class="formfoot"><button class="btn" data-rhact="bf-cancel">Cancelar</button><button class="btn primary" data-rhact="bf-save" ${RH.busy.bf?"disabled":""}>Salvar benefício</button></div></div>`
    : `<div class="formfoot" style="justify-content:flex-start;margin:0 0 16px"><button class="btn primary" data-rhact="bf-new">Novo benefício</button></div>`;
  return form + (RH.beneficios.length ? RH.beneficios.map(x=>`<div class="rh-item"><div class="rh-item-h" style="cursor:default"><span><span class="t">${h(x.name)}</span><span class="s"> · ${x.active?"visível":"oculto"}</span></span>
    <span style="display:flex;gap:8px"><button class="btn" data-rhbfed="${h(x.id)}">Editar</button><button class="btn bad" data-rhbfdel="${h(x.id)}">Excluir</button></span></div></div>`).join("") : `<div class="empty">Nenhum benefício cadastrado.</div>`);
}
function rhADocs(){
  const d=RH.dc;
  const form = d ? `<div class="panel"><h3 style="margin-top:0">${d.id?"Editar dados do documento":"Novo documento"}</h3><div class="fields">
      ${rhFld("dc","title","Título","text",d.title)}${rhSel("dc","category","Categoria",RH_DOC_CATS.map(c=>[c,c]),d.category||RH_DOC_CATS[0])}
      ${rhFld("dc","description","Descrição do conteúdo","area",d.description)}
      ${rhSel("dc","audience","Quem pode ver",Object.entries(RH_AUD),d.audience||"todos")}${rhSel("dc","status","Situação",Object.entries(RH_DOC_ST),d.status||"rascunho")}
      ${d.id?"":`<div class="field wide"><label for="rh-dc-file">Arquivo</label><input type="file" id="rh-dc-file" data-rhfile="new"><span class="hint">${RH.files.new?h(RH.files.new.name):"PDF, Word, Excel, imagem etc., até 50 MB"}</span></div>`}
    </div>${stepsHTML(RH.steps.dc||[])}<div class="formfoot"><button class="btn" data-rhact="dc-cancel">Cancelar</button><button class="btn primary" data-rhact="dc-save" ${RH.busy.dc?"disabled":""}>Salvar documento</button></div></div>`
    : `<div class="formfoot" style="justify-content:flex-start;margin:0 0 16px"><button class="btn primary" data-rhact="dc-new">Novo documento</button></div>`;
  const list=[...RH.docs].sort((a,b)=>a.category.localeCompare(b.category)||a.title.localeCompare(b.title));
  return form + (list.length ? list.map(x=>{ const k="d"+x.id, open=!!RH.open[k], vs=RH.versoes.filter(v=>v.documento_id===x.id), nv=RH.nv[x.id], b=RH.busy["v"+x.id]?"disabled":"";
    return `<div class="rh-item"><button class="rh-item-h" data-rhopen="${h(k)}" aria-expanded="${open}"><span><span class="t">${h(x.title)}</span><span class="s"> · ${h(x.category)} · ${h(RH_AUD[x.audience])} · versão ${x.current_version}</span></span>${rhSt(x.status,RH_DOC_ST)}</button>
      ${open?`<div class="rh-item-b">${x.description?`<p style="white-space:pre-wrap">${h(x.description)}</p>`:""}
        <div class="btns" style="margin:12px 0"><button class="btn" data-rhdced="${h(x.id)}">Editar dados</button>
          ${x.status!=="publicado"?`<button class="btn ok" data-rhdcst="publicado" data-id="${h(x.id)}" ${x.current_version?"":"disabled"}>Publicar</button>`:""}
          ${x.status!=="arquivado"?`<button class="btn" data-rhdcst="arquivado" data-id="${h(x.id)}">Arquivar</button>`:""}
          <button class="btn" data-rhnv="${h(x.id)}">Enviar nova versão</button></div>
        ${nv?`<div class="commentbox"><div class="fields"><div class="field"><label for="rh-nv-${h(x.id)}">Arquivo da nova versão</label><input type="file" id="rh-nv-${h(x.id)}" data-rhfile="${h(x.id)}" ${b}><span class="hint">${RH.files[x.id]?h(RH.files[x.id].name):"A versão atual fica guardada no histórico."}</span></div>
          <div class="field"><label for="rh-nvn-${h(x.id)}">O que mudou (opcional)</label><input type="text" id="rh-nvn-${h(x.id)}" data-rhnvnote="${h(x.id)}" value="${h(nv.note||"")}" ${b}></div></div>
          <div class="btns"><button class="btn primary" data-rhnvsave="${h(x.id)}" ${b}>${RH.busy["v"+x.id]?"Enviando…":"Enviar versão"}</button><button class="btn" data-rhnvno="${h(x.id)}" ${b}>Voltar</button></div>${stepsHTML(RH.steps["v"+x.id]||[])}</div>`:""}
        <h3>Versões</h3>${vs.length?`<ol class="timeline">${vs.map(v=>`<li><span class="when">${h(fmtWhen(v.created_at))}</span>, ${h(v.uploaded_by||"RH")}: versão ${v.version}${v.version===x.current_version?" (atual)":""} · <button class="btn link" data-rhdoc="${h(x.id)}" data-ver="${h(v.id)}">${h(v.file_name)}</button>${v.note?`<span class="cmt">“${h(v.note)}”</span>`:""}</li>`).join("")}</ol>`:`<p class="small muted">Nenhum arquivo enviado ainda.</p>`}
      </div>`:""}</div>`; }).join("") : `<div class="empty">Nenhum documento cadastrado.</div>`);
}
function rhARegras(){
  const r=RH.rg || (RH.rg={ ferias_min_dias:RH.cfg.ferias_min_dias??"", ferias_max_dias:RH.cfg.ferias_max_dias??"", ferias_antecedencia:RH.cfg.ferias_antecedencia??"", ferias_observacao:RH.cfg.ferias_observacao||"" });
  return `<div class="panel"><p class="muted small" style="margin-top:0">Deixe em branco o que a empresa ainda não definiu. As regras preenchidas são conferidas pelo sistema quando o colaborador envia o pedido.</p><div class="fields">
    ${rhFld("rg","ferias_min_dias","Mínimo de dias por solicitação","number",r.ferias_min_dias,'min="1"')}${rhFld("rg","ferias_max_dias","Máximo de dias por solicitação","number",r.ferias_max_dias,'min="1"')}
    ${rhFld("rg","ferias_antecedencia","Antecedência mínima (dias)","number",r.ferias_antecedencia,'min="0"')}<div></div>
    ${rhFld("rg","ferias_observacao","Política de férias (texto exibido aos colaboradores)","area",r.ferias_observacao)}</div>
    ${stepsHTML(RH.steps.rg||[])}<div class="formfoot"><button class="btn primary" data-rhact="rg-save" ${RH.busy.rg?"disabled":""}>Salvar regras</button></div></div>`;
}

/* ---------- ações ---------- */
async function rhAfter(msg){ if(msg) S.flash={kind:"ok", text:msg}; await RH.load(); render(); }
async function rhSaveFerias(status){
  const f=RH.form, err={}, days=parseInt(f.days,10), regras=RH.cfg;
  if(!f.start) err.start="Informe a data de início.";
  else if(f.start<todayISO()) err.start="A data de início não pode estar no passado.";
  else if(status==="pendente" && regras.ferias_antecedencia && rhDays(todayISO(), f.start)<regras.ferias_antecedencia) err.start=`Peça com pelo menos ${regras.ferias_antecedencia} dias de antecedência.`;
  if(!(days>0)) err.days="Informe a quantidade de dias.";
  else if(status==="pendente" && regras.ferias_min_dias && days<regras.ferias_min_dias) err.days=`O mínimo é de ${regras.ferias_min_dias} dias.`;
  else if(status==="pendente" && regras.ferias_max_dias && days>regras.ferias_max_dias) err.days=`O máximo é de ${regras.ferias_max_dias} dias.`;
  RH.ferr=err; if(Object.keys(err).length){ render(); return; }
  RH.busy.form=true; render();
  const entry={at:new Date().toISOString(), by_name:S.profile.full_name, action:status, comment:""};
  let res;
  if(f.id){ const old=RH.ferias.find(x=>x.id===f.id);
    res=await sb.from("ferias").update({start_date:f.start, days, notes:(f.notes||"").trim()||null, status, history:[...((old&&old.history)||[]), entry]}).eq("id",f.id);
  } else res=await sb.from("ferias").insert({start_date:f.start, days, notes:(f.notes||"").trim()||null, status, history:[entry]});
  RH.busy.form=false;
  if(res.error){ RH.ferr={submit:rhErr(res.error)}; render(); return; }
  RH.form={}; RH.ferr={};
  await rhAfter(status==="pendente" ? "Pedido de férias enviado ao RH. Você será avisado quando for analisado." : "Rascunho salvo.");
}
async function rhFeriasAct(id, kind){
  const f=RH.ferias.find(x=>x.id===id); if(!f) return;
  const k="f"+id;
  if(kind==="editar"){ RH.form={open:true, id:f.id, start:f.start_date, days:String(f.days), notes:f.notes||""}; RH.ferr={}; render(); window.scrollTo({top:0}); return; }
  if(kind==="enviar"){ RH.form={id:f.id, start:f.start_date, days:String(f.days), notes:f.notes||""}; return rhSaveFerias("pendente"); }
  const note=(RH.note[k]||"").trim(), admin=f.requester_id!==myId() || (RH.isRH() && RH.tab==="admin");
  if(kind==="rejeitada" && note.length<3){ RH.steps[k]=["Escreva a justificativa da rejeição."]; render(); return; }
  if(kind==="cancelada" && admin && f.status==="aprovada" && note.length<3){ RH.steps[k]=["Explique o motivo do cancelamento."]; render(); return; }
  if(kind==="cancelada" && !admin && !confirm(f.status==="rascunho"?"Descartar este rascunho?":"Cancelar esta solicitação de férias?")) return;
  RH.busy[k]=true; RH.steps[k]=["Salvando…"]; render();
  const upd={status:kind, history:[...(f.history||[]), {at:new Date().toISOString(), by_name:S.profile.full_name, action:kind, comment:note}]};
  if(admin && (kind==="aprovada"||kind==="rejeitada"||kind==="cancelada")) upd.decision_note=note||null;
  const { error } = await sb.from("ferias").update(upd).eq("id",id);
  RH.busy[k]=false;
  if(error){ RH.steps[k]=[rhErr(error)]; render(); return; }
  RH.steps[k]=[]; RH.note[k]="";
  await rhAfter({aprovada:"Férias aprovadas.", rejeitada:"Férias rejeitadas.", cancelada:"Solicitação cancelada."}[kind]);
}
async function rhSaveColab(uid){
  const e=RH.ce[uid], k="c"+uid; RH.busy[k]=true; RH.steps[k]=[]; render();
  const { error } = await sb.from("colaboradores").upsert({ user_id:uid, birth_date:e.birth_date||null, admission_date:e.admission_date||null, department:(e.department||"").trim()||null, updated_at:new Date().toISOString() });
  RH.busy[k]=false;
  if(error){ RH.steps[k]=[rhErr(error)]; render(); return; }
  delete RH.ce[uid]; await rhAfter("Dados do colaborador salvos.");
}
async function rhSaveEvento(){
  const e=RH.ev;
  if(!(e.title||"").trim() || !e.event_date){ RH.steps.ev=["Informe pelo menos o título e a data."]; render(); return; }
  RH.busy.ev=true; render();
  const row={ title:e.title.trim(), event_date:e.event_date, start_time:e.start_time||null, end_time:e.end_time||null, location:(e.location||"").trim()||null, description:(e.description||"").trim()||null, updated_at:new Date().toISOString() };
  const res = e.id ? await sb.from("eventos").update(row).eq("id",e.id) : await sb.from("eventos").insert(row);
  RH.busy.ev=false;
  if(res.error){ RH.steps.ev=[rhErr(res.error)]; render(); return; }
  RH.ev=null; RH.steps.ev=[]; await rhAfter("Evento salvo.");
}
async function rhSaveVr(){
  const c=RH.vr, val=String(c.vr_valor||"").trim(), n=parseMoney(val);
  if(val && !(n>=0)){ RH.steps.vr=["Valor inválido. Use o formato 0,00."]; render(); return; }
  RH.busy.vr=true; render();
  const { error } = await sb.from("rh_settings").update({ vr_valor: val?n:null, vr_periodicidade:c.vr_periodicidade.trim()||null, vr_criterios:c.vr_criterios.trim()||null, vr_regras:c.vr_regras.trim()||null, vr_vigencia:c.vr_vigencia||null, vr_observacoes:c.vr_observacoes.trim()||null, updated_at:new Date().toISOString() }).eq("id",1);
  RH.busy.vr=false;
  if(error){ RH.steps.vr=[rhErr(error)]; render(); return; }
  RH.vr=null; RH.steps.vr=[]; await rhAfter("Vale-refeição atualizado.");
}
async function rhSaveRegras(){
  const r=RH.rg, num=v=>{ const s=String(v??"").trim(); return s===""?null:parseInt(s,10); };
  const row={ ferias_min_dias:num(r.ferias_min_dias), ferias_max_dias:num(r.ferias_max_dias), ferias_antecedencia:num(r.ferias_antecedencia), ferias_observacao:(r.ferias_observacao||"").trim()||null, updated_at:new Date().toISOString() };
  if([row.ferias_min_dias,row.ferias_max_dias,row.ferias_antecedencia].some(x=>x!==null && (isNaN(x)||x<0))){ RH.steps.rg=["Use apenas números inteiros."]; render(); return; }
  if(row.ferias_min_dias && row.ferias_max_dias && row.ferias_min_dias>row.ferias_max_dias){ RH.steps.rg=["O mínimo não pode ser maior que o máximo."]; render(); return; }
  RH.busy.rg=true; render();
  const { error } = await sb.from("rh_settings").update(row).eq("id",1);
  RH.busy.rg=false;
  if(error){ RH.steps.rg=[rhErr(error)]; render(); return; }
  RH.rg=null; RH.steps.rg=[]; await rhAfter("Regras de férias salvas.");
}
async function rhSaveBenef(){
  const b=RH.bf;
  if(!(b.name||"").trim()){ RH.steps.bf=["Informe o nome do benefício."]; render(); return; }
  RH.busy.bf=true; render();
  const t=k=>(b[k]||"").trim()||null;
  const row={ name:b.name.trim(), category:t("category"), description:t("description"), eligibility:t("eligibility"), usage_info:t("usage_info"), conditions:t("conditions"), links:t("links"), contacts:t("contacts"),
    valid_from:b.valid_from||null, sort_order:parseInt(b.sort_order,10)||0, active:String(b.active)!=="false", doc_ids:b.doc_ids||[], updated_at:new Date().toISOString() };
  const res = b.id ? await sb.from("beneficios").update(row).eq("id",b.id) : await sb.from("beneficios").insert(row);
  RH.busy.bf=false;
  if(res.error){ RH.steps.bf=[rhErr(res.error)]; render(); return; }
  RH.bf=null; RH.steps.bf=[]; await rhAfter("Benefício salvo.");
}
async function rhUploadVersion(docId, file, version, note){
  const ext=(file.name.split(".").pop()||"").toLowerCase();
  const base=asciiName(file.name.replace(/\.[^.]+$/,""))||"documento";
  const path=`${docId}/v${version}-${Date.now().toString(36)}-${base}${ext?"."+ext:""}`;
  if(file.size>50*1048576) throw new Error("O arquivo passa de 50 MB.");
  const up=await sb.storage.from("rh-documentos").upload(path, file, { contentType:file.type||"application/octet-stream", upsert:false });
  if(up.error) throw up.error;
  const ins=await sb.from("documento_versoes").insert({ documento_id:docId, version, file_path:path, file_name:file.name, file_type:file.type||null, file_size:file.size, note:note||null, uploaded_by:S.profile.full_name });
  if(ins.error) throw ins.error;
  const upd=await sb.from("documentos").update({ current_version:version, updated_at:new Date().toISOString() }).eq("id",docId);
  if(upd.error) throw upd.error;
}
async function rhSaveDoc(){
  const d=RH.dc;
  if(!(d.title||"").trim()){ RH.steps.dc=["Informe o título."]; render(); return; }
  if(!d.id && !RH.files.new){ RH.steps.dc=["Escolha o arquivo do documento."]; render(); return; }
  RH.busy.dc=true; RH.steps.dc=["Salvando…"]; render();
  try{
    const row={ title:d.title.trim(), category:d.category||RH_DOC_CATS[0], description:(d.description||"").trim()||null, audience:d.audience||"todos", updated_at:new Date().toISOString() };
    if(d.id){
      const { error } = await sb.from("documentos").update({...row, status:d.status||"rascunho"}).eq("id",d.id); if(error) throw error;
    } else {
      const id=crypto.randomUUID();
      const { error } = await sb.from("documentos").insert({...row, id, status:"rascunho"}); if(error) throw error;
      RH.steps.dc=["Enviando arquivo…"]; render();
      await rhUploadVersion(id, RH.files.new, 1, "Versão inicial");
      if((d.status||"rascunho")!=="rascunho"){ const r2=await sb.from("documentos").update({status:d.status}).eq("id",id); if(r2.error) throw r2.error; }
    }
    RH.dc=null; RH.files.new=null; RH.steps.dc=[]; RH.busy.dc=false;
    await rhAfter("Documento salvo.");
  }catch(e){ RH.busy.dc=false; RH.steps.dc=[e instanceof Error && !e.code ? e.message : rhErr(e)]; render(); }
}
async function rhSaveVersion(docId){
  const d=RH.docs.find(x=>x.id===docId), f=RH.files[docId], k="v"+docId;
  if(!f){ RH.steps[k]=["Escolha o arquivo."]; render(); return; }
  RH.busy[k]=true; RH.steps[k]=["Enviando arquivo…"]; render();
  try{
    await rhUploadVersion(docId, f, (d.current_version||0)+1, (RH.nv[docId]&&RH.nv[docId].note||"").trim());
    delete RH.nv[docId]; delete RH.files[docId]; RH.busy[k]=false; RH.steps[k]=[];
    await rhAfter(`Nova versão de “${d.title}” enviada.`);
  }catch(e){ RH.busy[k]=false; RH.steps[k]=[e instanceof Error && !e.code ? e.message : rhErr(e)]; render(); }
}

/* ---------- eventos da tela ---------- */
RH.click = function(t){
  const d=t.dataset;
  if(d.rhgo){ RH.tab=d.rhgo; render(); window.scrollTo({top:0}); return true; }
  if(d.rhatab){ RH.atab=d.rhatab; render(); return true; }
  if(d.rhfilt){ RH.filt=d.rhfilt; render(); return true; }
  if(d.rhopen){ RH.open[d.rhopen]=!RH.open[d.rhopen]; render(); return true; }
  if(d.rhf){ rhFeriasAct(d.id, d.rhf); return true; }
  if(d.rhdoc){ rhOpenDoc(d.rhdoc, d.ver); return true; }
  if(d.rhmonth!=null){ const n=Number(d.rhmonth); if(n===0) RH.ym=null; else { let {y,m}=RH.ym; m+=n; if(m<1){m=12;y--;} if(m>12){m=1;y++;} RH.ym={y,m}; } render(); return true; }
  if(d.rhcedit){ const c=RH.colabs.find(x=>x.user_id===d.rhcedit)||{}; RH.ce[d.rhcedit]={birth_date:c.birth_date||"", admission_date:c.admission_date||"", department:c.department||""}; render(); return true; }
  if(d.rhcno){ delete RH.ce[d.rhcno]; render(); return true; }
  if(d.rhcsave){ rhSaveColab(d.rhcsave); return true; }
  if(d.rheved){ RH.ev={...RH.eventos.find(x=>x.id===d.rheved)}; RH.steps.ev=[]; render(); window.scrollTo({top:0}); return true; }
  if(d.rhevdel){ const e=RH.eventos.find(x=>x.id===d.rhevdel); if(e && confirm(`Excluir o evento “${e.title}”?`)) sb.from("eventos").delete().eq("id",e.id).then(r=>r.error?(S.flash={kind:"warn",text:rhErr(r.error)},render()):rhAfter("Evento excluído.")); return true; }
  if(d.rhbfed){ const b=RH.beneficios.find(x=>x.id===d.rhbfed); RH.bf={...b, doc_ids:[...(b.doc_ids||[])]}; RH.steps.bf=[]; render(); window.scrollTo({top:0}); return true; }
  if(d.rhbfdel){ const b=RH.beneficios.find(x=>x.id===d.rhbfdel); if(b && confirm(`Excluir o benefício “${b.name}”? Para só esconder, edite e marque como oculto.`)) sb.from("beneficios").delete().eq("id",b.id).then(r=>r.error?(S.flash={kind:"warn",text:rhErr(r.error)},render()):rhAfter("Benefício excluído.")); return true; }
  if(d.rhdced){ RH.dc={...RH.docs.find(x=>x.id===d.rhdced)}; RH.steps.dc=[]; render(); window.scrollTo({top:0}); return true; }
  if(d.rhdcst){ sb.from("documentos").update({status:d.rhdcst, updated_at:new Date().toISOString()}).eq("id",d.id).then(r=>r.error?(S.flash={kind:"warn",text:rhErr(r.error)},render()):rhAfter(d.rhdcst==="publicado"?"Documento publicado.":"Documento arquivado.")); return true; }
  if(d.rhnv){ RH.nv[d.rhnv]=RH.nv[d.rhnv]||{note:""}; RH.open["d"+d.rhnv]=true; render(); return true; }
  if(d.rhnvno){ delete RH.nv[d.rhnvno]; delete RH.files[d.rhnvno]; render(); return true; }
  if(d.rhnvsave){ rhSaveVersion(d.rhnvsave); return true; }
  const a=d.rhact; if(!a) return false;
  if(a==="ferias-new"){ RH.form={open:true}; RH.ferr={}; render(); const x=$("#rhf-start"); if(x) x.focus(); }
  else if(a==="ferias-cancel"){ RH.form={}; RH.ferr={}; render(); }
  else if(a==="ferias-draft"){ rhSaveFerias("rascunho"); }
  else if(a==="past"){ RH.showPast=!RH.showPast; render(); }
  else if(a==="ev-new"){ RH.ev={}; RH.steps.ev=[]; render(); }
  else if(a==="ev-cancel"){ RH.ev=null; render(); }
  else if(a==="ev-save"){ rhSaveEvento(); }
  else if(a==="vr-save"){ rhSaveVr(); }
  else if(a==="rg-save"){ rhSaveRegras(); }
  else if(a==="bf-new"){ RH.bf={active:true, sort_order:0, doc_ids:[]}; RH.steps.bf=[]; render(); }
  else if(a==="bf-cancel"){ RH.bf=null; render(); }
  else if(a==="bf-save"){ rhSaveBenef(); }
  else if(a==="dc-new"){ RH.dc={category:RH_DOC_CATS[0], audience:"todos", status:"publicado"}; RH.files.new=null; RH.steps.dc=[]; render(); }
  else if(a==="dc-cancel"){ RH.dc=null; RH.files.new=null; render(); }
  else if(a==="dc-save"){ rhSaveDoc(); }
  return true;
};
RH.input = function(t){
  const d=t.dataset;
  if(d.rhff){ RH.form[d.rhff]=t.value; if(RH.ferr[d.rhff]) delete RH.ferr[d.rhff];
    if(d.rhff==="start"||d.rhff==="days"){ const e=$("#rhf-end"), end=rhEnd(RH.form); if(e) e.textContent= end?`Término: ${fmtDate(end)}`:"O término é calculado automaticamente"; }
    return true; }
  if(d.rhnote){ RH.note[d.rhnote]=t.value; return true; }
  if(d.rhq!=null){ RH.q=t.value; render(); return true; }
  if(d.rhce){ RH.ce[d.rhce][d.k]=t.value; return true; }
  if(d.rhin){ const o={ev:RH.ev, vr:RH.vr, rg:RH.rg, bf:RH.bf, dc:RH.dc}[d.rhin]; if(o) o[d.k]=t.value; return true; }
  if(d.rhnvnote){ RH.nv[d.rhnvnote].note=t.value; return true; }
  return false;
};
RH.change = function(t){
  const d=t.dataset;
  if(d.rhcat!=null){ RH.cat=t.value; render(); return true; }
  if(d.rhfile){ RH.files[d.rhfile]=t.files&&t.files[0]||null; render(); return true; }
  if(d.rhbfdoc){ const s=new Set(RH.bf.doc_ids||[]); t.checked?s.add(d.rhbfdoc):s.delete(d.rhbfdoc); RH.bf.doc_ids=[...s]; return true; }
  if(d.rhin && t.tagName==="SELECT"){ const o={bf:RH.bf, dc:RH.dc}[d.rhin]; if(o) o[d.k]=t.value; return true; }
  return false;
};
RH.submit = function(form){
  if(form.id==="rh-ferias-form"){ if(!RH.busy.form) rhSaveFerias("pendente"); return true; }
  return false;
};
