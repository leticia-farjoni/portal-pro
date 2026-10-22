/* =====================================================================
   BANCO DE HORAS — Pró Negócios
   Módulo isolado. Liga-se ao Portal do Colaborador pelo ponto de
   integração window.RH_BANCO_HORAS (definido pelo rh.js) e não altera
   nenhum outro módulo. Toda regra de permissão e de negócio é validada
   no banco (banco-horas.sql); a tela só reflete essas regras.
   ===================================================================== */
(function(){
"use strict";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const ORIGEM = { funcionario:"Funcionário", gestor:"Gestor", rh:"RH", importacao:"Importação" };
const NOTIF_TIPO = { novo_lancamento:"Novo lançamento", abertura_mes:"Mês aberto", ajuste:"Ajuste", falha_importacao:"Falha de importação" };

(function css(){
  const st=document.createElement("style");
  st.textContent=`
  .bh-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 18px}
  .bh-tabs button{border:1px solid var(--field);background:#fff;border-radius:16px;padding:6px 14px;font-size:14px;cursor:pointer;color:var(--ink)}
  .bh-tabs button[aria-current="page"]{background:var(--brand);border-color:var(--brand);color:#fff}
  .bh-period{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:14px 18px;border-radius:4px;margin:0 0 18px;border:1px solid var(--rule);border-left:5px solid var(--ok);background:#F4FAF6}
  .bh-period.closed{border-left-color:var(--warn);background:var(--warn-soft)}
  .bh-period strong{font-size:18px;color:var(--navy)}
  .bh-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px;margin:0 0 20px}
  .bh-kpi{background:#fff;border:1px solid var(--card-line);border-radius:4px;padding:14px 16px}
  .bh-kpi span{display:block;font-size:13px;color:var(--ink-2)}
  .bh-kpi strong{display:block;font-size:26px;font-variant-numeric:tabular-nums;color:var(--navy)}
  .bh-kpi.pos strong{color:var(--ok)} .bh-kpi.neg strong{color:var(--bad)}
  .bh-tbl{width:100%;border-collapse:collapse;font-size:14px;min-width:640px}
  .bh-tbl th{text-align:left;font-weight:600;color:var(--navy);border-bottom:1px solid var(--rule);padding:8px;white-space:nowrap}
  .bh-tbl td{border-bottom:1px solid var(--rule);padding:8px;vertical-align:top}
  .bh-tbl .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  .bh-tbl tr.anul td{color:var(--ink-3);text-decoration:line-through}
  .bh-tbl tr.anul td.keep{text-decoration:none}
  .bh-p{color:var(--ok);font-weight:600} .bh-m{color:var(--bad);font-weight:600}
  .bh-filters{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin:0 0 16px}
  .bh-filters .field{min-width:150px;flex:0 1 auto}
  .bh-bars{display:flex;align-items:flex-end;gap:6px;height:140px;padding:8px 0;border-bottom:1px solid var(--rule)}
  .bh-bar{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;min-width:18px}
  .bh-bar i{display:block;width:100%;max-width:34px;border-radius:3px 3px 0 0;background:var(--icon)}
  .bh-bar i.neg{background:var(--bad)}
  .bh-bar small{font-size:11px;color:var(--ink-2);margin-top:4px}
  .bh-confirm{border:1px solid var(--brand-2);background:#F3F8FD;border-radius:4px;padding:16px;margin-top:16px}
  .bh-confirm dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px 20px;margin:0 0 12px}
  .bh-confirm dt{font-size:13px;color:var(--ink-2)} .bh-confirm dd{margin:2px 0 0;font-weight:600}
  .bh-radio{display:flex;gap:18px;padding:8px 0}
  .bh-radio label{font-weight:400;display:flex;gap:6px;align-items:center;cursor:pointer}
  .bh-ok{color:var(--ok);font-weight:600} .bh-er{color:var(--bad);font-weight:600}
  .bh-muted{color:var(--ink-2);font-size:13px}
  `;
  document.head.appendChild(st);
})();

/* ---------- utilidades ---------- */
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad = n => String(n).padStart(2,"0");
const isoD = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const hoje = () => isoD(new Date());
const fD = iso => { if(!iso) return ""; const [y,m,d]=String(iso).slice(0,10).split("-"); return `${d}/${m}/${y}`; };
const fDT = iso => iso ? new Date(iso).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "";
const hhmm = m => { const a=Math.abs(m|0); return `${pad(Math.floor(a/60))}:${pad(a%60)}`; };
const sinal = m => (m<0?"-":m>0?"+":"")+hhmm(m);
function parseHHMM(s){
  s=String(s||"").trim().replace(/h/i,":");
  let m=s.match(/^(\d{1,3}):([0-5]\d)$/); if(m) return Number(m[1])*60+Number(m[2]);
  m=s.match(/^(\d{1,3})$/); if(m) return Number(m[1])*60;
  return NaN;
}
const norm = s => String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const val = l => l.anulado ? 0 : (l.tipo==="positivo" ? l.minutos : -l.minutos);
const periodoTxt = p => p ? `${MESES[p.mes-1]}/${p.ano} — lançamentos permitidos de ${fD(p.data_inicio)} a ${fD(p.data_fim)}` : "";

/* ---------- estado ---------- */
const B = {
  el:null, sb:null, ctx:null, loaded:false, err:null, loadedAt:null,
  me:null, cfg:{}, periodos:[], motivos:[], areas:[], funcs:[], lancs:[],
  tab:"inicio", atab:"periodos",
  form:{}, fstep:null, ferr:null, busy:{}, msg:null,
  fx:{ func:null, de:"", ate:"", motivo:"", tipo:"" }, adj:{}, hist:{},
  eqArea:"", dirAno:new Date().getFullYear(), dir:null,
  fEdit:null, fq:"", arNew:"", moNew:"", perAno:new Date().getFullYear(), perMes:new Date().getMonth()+1,
  imp:{ file:null, linhas:null, rep:null, done:null, err:null }, imps:[], aud:[], audf:{ ev:"", res:"", de:"", ate:"" }, notifs:[], notf:"pendente"
};
const isAdmin = () => !!(B.ctx && B.ctx.isRH);
const myId = () => B.me && B.me.id;
const team = () => B.funcs.filter(f=>f.gestor_id && f.gestor_id===myId() && !f.excluido);
const isGestor = () => team().length>0;
const isDir = () => isAdmin() || !!(B.me && B.me.diretoria);
const aberto = () => B.periodos.find(p=>p.status==="aberto") || null;
const fById = id => B.funcs.find(f=>f.id===id);
const motNome = id => (B.motivos.find(m=>m.id===id)||{}).nome || "";
const areaNome = id => (B.areas.find(a=>a.id===id)||{}).nome || "";
function canLaunchFor(){
  const out=[];
  if(B.me) out.push(B.me);
  if(isAdmin()) B.funcs.filter(f=>f.ativo && !f.excluido && f.id!==myId()).forEach(f=>out.push(f));
  else if(B.cfg.gestor_pode_lancar) team().filter(f=>f.ativo).forEach(f=>out.push(f));
  return out;
}
const canAdjust = l => isAdmin() || (fById(l.funcionario_id)||{}).gestor_id===myId() && !!myId();
const canImport = () => isAdmin() || (B.cfg.gestor_pode_importar && isGestor());

async function fetchAll(q){
  const out=[]; let from=0; const size=1000;
  for(;;){ const { data, error } = await q().range(from, from+size-1); if(error) throw error; out.push(...(data||[])); if(!data || data.length<size) break; from+=size; }
  return out;
}
function dbErr(e){
  const m=(e&&e.message)||String(e||"");
  if(/does not exist|schema cache|Could not find the (table|function)/i.test(m)) return "O banco de horas ainda não está ativo no banco de dados. Rode o arquivo banco-horas.sql no SQL Editor do Supabase.";
  if(/row-level security|permission denied/i.test(m)) return "Você não tem permissão para esta ação.";
  return m || "Algo deu errado. Tente de novo.";
}

/* ---------- carregamento ---------- */
async function load(){
  const sb=B.sb;
  try{
    await sb.rpc("bh_vincular");
    if(isAdmin()) await sb.rpc("bh_sincronizar_usuarios");
    const [cfg, per, mot, ar, fs] = await Promise.all([
      sb.from("bh_config").select("*").eq("id",1).maybeSingle(),
      sb.from("bh_periodos").select("*").order("ano",{ascending:false}).order("mes",{ascending:false}),
      sb.from("bh_motivos").select("*").order("nome"),
      sb.from("bh_areas").select("*").order("nome"),
      sb.from("bh_funcionarios").select("*").order("nome")
    ]);
    for(const r of [cfg,per,mot,ar,fs]) if(r.error) throw r.error;
    B.cfg=cfg.data||{}; B.periodos=per.data||[]; B.motivos=mot.data||[]; B.areas=ar.data||[]; B.funcs=fs.data||[];
    B.me = B.funcs.find(f=>f.user_id===B.ctx.user.id && f.ativo && !f.excluido) || null;
    B.lancs = await fetchAll(()=>sb.from("bh_lancamentos").select("*").order("data",{ascending:false}).order("criado_em",{ascending:false}));
    if(!B.fx.func) B.fx.func = B.me ? B.me.id : "";
    B.err=null;
  }catch(e){ B.err=dbErr(e); }
  B.loaded=true; B.loadedAt=new Date();
}
async function loadAdmin(){
  const sb=B.sb;
  const [i,a,n]=await Promise.all([
    sb.from("bh_importacoes").select("id,arquivo,usuario_nome,criado_em,status,total,sucesso,erro").order("criado_em",{ascending:false}).limit(50),
    isAdmin()?sb.from("bh_auditoria").select("*").order("criado_em",{ascending:false}).limit(500):Promise.resolve({data:[]}),
    isAdmin()?sb.from("bh_notificacoes").select("*").order("criado_em",{ascending:false}).limit(300):Promise.resolve({data:[]})
  ]);
  B.imps=i.data||[]; B.aud=a.data||[]; B.notifs=n.data||[];
}
async function reload(msg){ if(msg) B.msg={ok:true,text:msg}; await load(); if(B.tab==="admin"||B.tab==="importar") await loadAdmin(); draw(); }

/* ---------- desenho ---------- */
function draw(){
  const el=B.el; if(!el || !document.body.contains(el)) return;
  const a=document.activeElement, id=a&&el.contains(a)?a.id:null, ss=a&&a.selectionStart, se=a&&a.selectionEnd;
  el.innerHTML = view();
  if(id){ const n=document.getElementById(id); if(n){ n.focus(); try{ if(ss!=null) n.setSelectionRange(ss,se); }catch(_){} } }
}
function tabsBar(){
  const t=[["inicio","Início"]];
  if(B.me || canLaunchFor().length) t.push(["novo","Novo lançamento"]);
  t.push(["extrato", B.me && !isGestor() && !isAdmin() ? "Meu extrato" : "Extrato"]);
  if(isGestor() || isAdmin()) t.push(["equipe", isAdmin() ? "Funcionários" : "Minha equipe"]);
  if(isDir()) t.push(["consolidado","Visão consolidada"]);
  if(canImport() && !isAdmin()) t.push(["importar","Importação"]);
  if(isAdmin()) t.push(["admin","Administração"]);
  if(!t.some(x=>x[0]===B.tab)) B.tab="inicio";
  return `<nav class="bh-tabs" aria-label="Seções do banco de horas">${t.map(([k,l])=>`<button type="button" data-bh-tab="${k}" ${B.tab===k?'aria-current="page"':""}>${l}</button>`).join("")}</nav>`;
}
function periodBanner(){
  const p=aberto();
  return p ? `<div class="bh-period" role="status"><div><span class="bh-muted">Mês aberto para lançamentos</span><br><strong>${esc(MESES[p.mes-1])}/${p.ano}</strong> — lançamentos permitidos de ${fD(p.data_inicio)} a ${fD(p.data_fim)}</div></div>`
           : `<div class="bh-period closed" role="status"><div><strong>Nenhum mês aberto</strong><br>O RH ainda não abriu um mês para lançamentos.</div></div>`;
}
function msgBox(){
  if(!B.msg) return "";
  const m=B.msg; return `<div class="notice ${m.ok?"ok":"err"}" role="status">${esc(m.text)} <button type="button" class="btn link" data-bh-a="msg-x">Fechar</button></div>`;
}
function view(){
  if(!B.loaded) return `<div class="empty">Carregando o banco de horas…</div>`;
  if(B.err) return `<div class="notice err">${esc(B.err)} <button type="button" class="btn link" data-bh-a="reload">Tentar de novo</button></div>`;
  if(!B.me && !isAdmin() && !isDir())
    return `${periodBanner()}<div class="empty">Você ainda não está cadastrado no banco de horas. Procure o RH para que cadastrem sua matrícula com o e-mail <strong>${esc(B.ctx.profile.email||"")}</strong>.</div>`;
  const body = ({ inicio:vInicio, novo:vNovo, extrato:vExtrato, equipe:vEquipe, consolidado:vConsol, importar:vImport, admin:vAdmin })[B.tab]();
  return `${tabsBar()}${msgBox()}${body}<p class="bh-muted" style="margin-top:18px">Última atualização: ${esc(fDT(B.loadedAt))} · <button type="button" class="btn link" data-bh-a="reload">Atualizar</button></p>`;
}

function kpis(list){
  const pos=list.filter(l=>!l.anulado&&l.tipo==="positivo").reduce((s,l)=>s+l.minutos,0);
  const neg=list.filter(l=>!l.anulado&&l.tipo==="negativo").reduce((s,l)=>s+l.minutos,0);
  const sal=pos-neg;
  return `<div class="bh-kpis">
    <div class="bh-kpi ${sal>=0?"pos":"neg"}"><span>Saldo atual</span><strong>${sinal(sal)}</strong></div>
    <div class="bh-kpi pos"><span>Total positivo</span><strong>+${hhmm(pos)}</strong></div>
    <div class="bh-kpi neg"><span>Total negativo</span><strong>-${hhmm(neg)}</strong></div>
    <div class="bh-kpi"><span>Lançamentos</span><strong>${list.filter(l=>!l.anulado).length}</strong></div></div>`;
}
function bars(list, ano){
  const by=Array(12).fill(0); list.filter(l=>l.data.slice(0,4)===String(ano)).forEach(l=>{ by[Number(l.data.slice(5,7))-1]+=val(l); });
  const max=Math.max(60,...by.map(Math.abs));
  return `<div class="bh-bars" role="img" aria-label="Saldo líquido por mês em ${ano}">${by.map((v,i)=>`<div class="bh-bar" title="${MESES[i]}: ${sinal(v)}"><i class="${v<0?"neg":""}" style="height:${Math.round(Math.abs(v)/max*100)}%"></i><small>${MESES[i].slice(0,3)}</small></div>`).join("")}</div>
    <p class="bh-muted">Saldo líquido de cada mês de ${ano}. Barras vermelhas indicam mês com mais horas negativas.</p>`;
}
function vInicio(){
  const mine=B.me ? B.lancs.filter(l=>l.funcionario_id===B.me.id) : [];
  const ult=mine.slice(0,5);
  return `${periodBanner()}
    ${B.me?`${kpis(mine)}
    <div class="formfoot" style="justify-content:flex-start;margin:0 0 20px"><button type="button" class="btn primary" data-bh-tab="novo" ${aberto()||isAdmin()?"":"disabled"}>Novo lançamento</button><button type="button" class="btn" data-bh-tab="extrato">Ver meu extrato</button></div>
    <h3>Evolução em ${new Date().getFullYear()}</h3>${bars(mine,new Date().getFullYear())}
    <h3>Últimos lançamentos</h3>${ult.length?tblLanc(ult,false):`<div class="empty">Você ainda não tem lançamentos.</div>`}`
    :`<div class="notice">Você acessa o banco de horas como ${isAdmin()?"RH":"Diretoria"}, sem lançamentos próprios. Para lançar as suas horas, cadastre-se como funcionário em Administração › Funcionários.</div>`}`;
}

/* --- novo lançamento --- */
function vNovo(){
  const p=aberto(), f=B.form, opts=canLaunchFor(), err=B.ferr, busy=B.busy.lanc?"disabled":"";
  if(!f.func) f.func = B.me ? B.me.id : (opts[0]&&opts[0].id);
  const sel=fById(f.func), self = sel && sel.id===myId();
  const livre = isAdmin() && !self;
  if(!p && !livre) return `${periodBanner()}<div class="empty">Não há mês aberto. Assim que o RH abrir o mês, você poderá lançar suas horas.</div>`;
  const mots=B.motivos.filter(m=>m.ativo);
  if(B.fstep==="confirm"){
    return `${periodBanner()}<div class="bh-confirm" role="region" aria-label="Confirme o lançamento"><h3 style="margin-top:0">Confira antes de confirmar</h3><dl>
      <div><dt>Funcionário</dt><dd>${esc(sel?sel.nome:"")}</dd></div><div><dt>Data</dt><dd>${fD(f.data)}</dd></div>
      <div><dt>Tipo</dt><dd>${f.tipo==="positivo"?"Positivo":"Negativo"}</dd></div><div><dt>Horas</dt><dd class="${f.tipo==="positivo"?"bh-p":"bh-m"}">${f.tipo==="positivo"?"+":"-"}${hhmm(parseHHMM(f.horas))}</dd></div>
      <div><dt>Motivo</dt><dd>${esc(motNome(f.motivo))}</dd></div>${f.obs?`<div><dt>Observação</dt><dd>${esc(f.obs)}</dd></div>`:""}</dl>
      ${err?`<div class="notice err">${esc(err)}</div>`:""}
      <div class="formfoot" style="justify-content:flex-start"><button type="button" class="btn primary" data-bh-a="lanc-ok" ${busy}>${B.busy.lanc?"Gravando…":"Confirmar lançamento"}</button><button type="button" class="btn" data-bh-a="lanc-back" ${busy}>Voltar e corrigir</button></div></div>`;
  }
  return `${periodBanner()}<form class="sheet" id="bh-form-lanc" novalidate><div class="fields">
    ${opts.length>1?`<div class="field wide"><label for="bh-l-func">Funcionário</label><select id="bh-l-func" data-bh-f="func">${opts.map(o=>`<option value="${o.id}" ${o.id===f.func?"selected":""}>${esc(o.nome)}${o.id===myId()?" (você)":""} · ${esc(o.matricula)}</option>`).join("")}</select>
      ${livre?`<span class="hint">Como RH, você pode lançar em qualquer data para outros funcionários. O registro fica identificado com origem RH.</span>`:""}</div>`:""}
    <div class="field"><label for="bh-l-data">Data da ocorrência</label><input type="date" id="bh-l-data" data-bh-f="data" value="${esc(f.data||"")}" ${livre?"":`min="${p.data_inicio}" max="${p.data_fim}"`}></div>
    <div class="field"><span class="lbl" id="bh-l-tipo">Tipo</span><div class="bh-radio" role="radiogroup" aria-labelledby="bh-l-tipo">
      <label><input type="radio" name="bh-tipo" data-bh-f="tipo" value="positivo" ${f.tipo==="positivo"?"checked":""}> Positivo (+)</label>
      <label><input type="radio" name="bh-tipo" data-bh-f="tipo" value="negativo" ${f.tipo==="negativo"?"checked":""}> Negativo (−)</label></div></div>
    <div class="field"><label for="bh-l-horas">Quantidade (HH:MM)</label><input type="text" id="bh-l-horas" data-bh-f="horas" inputmode="numeric" placeholder="06:00" value="${esc(f.horas||"")}"><span class="hint">O sinal vem do campo Tipo.</span></div>
    <div class="field"><label for="bh-l-mot">Motivo</label><select id="bh-l-mot" data-bh-f="motivo"><option value="">Escolha…</option>${mots.map(m=>`<option value="${m.id}" ${m.id===f.motivo?"selected":""}>${esc(m.nome)}</option>`).join("")}</select>${mots.length?"":`<span class="hint">O RH ainda não cadastrou motivos.</span>`}</div>
    <div class="field wide"><label for="bh-l-obs">Observação (opcional)</label><textarea id="bh-l-obs" data-bh-f="obs">${esc(f.obs||"")}</textarea></div></div>
    ${err?`<div class="notice err" style="margin-top:14px">${esc(err)}</div>`:""}
    <div class="formfoot"><button type="submit" class="btn primary">Revisar lançamento</button></div></form>`;
}
function checkLanc(){
  const f=B.form, p=aberto(), sel=fById(f.func), self=sel&&sel.id===myId(), livre=isAdmin()&&!self;
  if(!sel) return "Escolha o funcionário.";
  if(!f.data) return "Informe a data.";
  if(!livre){ if(!p) return "Não há mês aberto."; if(f.data<p.data_inicio||f.data>p.data_fim) return `Data fora do período aberto. ${periodoTxt(p)}.`; }
  if(f.tipo!=="positivo"&&f.tipo!=="negativo") return "Escolha Positivo ou Negativo.";
  const m=parseHHMM(f.horas); if(isNaN(m)) return "Informe as horas no formato HH:MM, por exemplo 02:30."; if(m<=0) return "A quantidade deve ser maior que zero.";
  if(!f.motivo) return "Escolha o motivo.";
  return null;
}

/* --- extrato --- */
function filtered(){
  const x=B.fx;
  return B.lancs.filter(l=>(!x.func || l.funcionario_id===x.func) && (!x.de || l.data>=x.de) && (!x.ate || l.data<=x.ate) && (!x.motivo || l.motivo_id===x.motivo) && (!x.tipo || l.tipo===x.tipo));
}
function tblLanc(list, actions){
  return `<div class="tablewrap"><table class="bh-tbl"><thead><tr><th>Data</th>${actions&&!B.fx.func?"<th>Funcionário</th>":""}<th>Tipo</th><th class="n">Horas</th><th>Motivo</th><th>Observação</th><th>Origem</th>${actions?"<th></th>":""}</tr></thead><tbody>
  ${list.map(l=>{ const f=fById(l.funcionario_id), aj=B.adj[l.id], hs=B.hist[l.id];
    return `<tr class="${l.anulado?"anul":""}"><td>${fD(l.data)}</td>${actions&&!B.fx.func?`<td>${esc(f?f.nome:"")}</td>`:""}<td>${l.tipo==="positivo"?"Positivo":"Negativo"}</td>
      <td class="n ${l.tipo==="positivo"?"bh-p":"bh-m"}">${l.tipo==="positivo"?"+":"-"}${hhmm(l.minutos)}</td><td>${esc(motNome(l.motivo_id))}</td><td>${esc(l.observacao||"")}</td>
      <td>${esc(ORIGEM[l.origem]||l.origem)}${l.anulado?` <span class="badge keep" style="color:var(--ink-3)">Anulado</span>`:""}${l.atualizado_em&&l.atualizado_em.slice(0,19)!==l.criado_em.slice(0,19)?` <span class="bh-muted">ajustado</span>`:""}</td>
      ${actions?`<td class="keep" style="white-space:nowrap">${canAdjust(l)?`<button type="button" class="btn link" data-bh-adj="${l.id}">Ajustar</button> `:""}<button type="button" class="btn link" data-bh-hist="${l.id}">Histórico</button></td>`:""}</tr>
      ${aj?`<tr><td colspan="8" class="keep">${adjForm(l,aj)}</td></tr>`:""}${hs?`<tr><td colspan="8" class="keep">${histView(l,hs)}</td></tr>`:""}`; }).join("")}
  </tbody></table></div>`;
}
function adjForm(l, a){
  const b=B.busy["a"+l.id]?"disabled":"";
  const novo=parseHHMM(a.horas);
  if(a.step==="confirm") return `<div class="bh-confirm"><strong>Confira o ajuste</strong><dl>
      <div><dt>Valor anterior</dt><dd>${l.anulado?"Anulado":(l.tipo==="positivo"?"+":"-")+hhmm(l.minutos)}</dd></div>
      <div><dt>Novo valor</dt><dd>${novo===0?"Anulado (não conta no saldo)":(a.tipo==="positivo"?"+":"-")+hhmm(novo)}</dd></div>
      <div><dt>Justificativa</dt><dd>${esc(a.just)}</dd></div></dl>${a.err?`<div class="notice err">${esc(a.err)}</div>`:""}
    <div class="btns"><button type="button" class="btn primary" data-bh-adjok="${l.id}" ${b}>${B.busy["a"+l.id]?"Gravando…":"Confirmar ajuste"}</button><button type="button" class="btn" data-bh-adjback="${l.id}" ${b}>Voltar</button></div></div>`;
  return `<div class="bh-confirm"><strong>Ajustar lançamento de ${fD(l.data)}</strong><div class="fields" style="margin-top:10px">
    <div class="field"><label for="bh-aj-t-${l.id}">Novo tipo</label><select id="bh-aj-t-${l.id}" data-bh-aj="${l.id}" data-k="tipo"><option value="positivo" ${a.tipo==="positivo"?"selected":""}>Positivo</option><option value="negativo" ${a.tipo==="negativo"?"selected":""}>Negativo</option></select></div>
    <div class="field"><label for="bh-aj-h-${l.id}">Nova quantidade (HH:MM)</label><input type="text" id="bh-aj-h-${l.id}" data-bh-aj="${l.id}" data-k="horas" value="${esc(a.horas)}"><span class="hint">Use 00:00 para anular o lançamento.</span></div>
    <div class="field wide"><label for="bh-aj-j-${l.id}">Justificativa do ajuste</label><textarea id="bh-aj-j-${l.id}" data-bh-aj="${l.id}" data-k="just">${esc(a.just)}</textarea></div></div>
    ${a.err?`<div class="notice err">${esc(a.err)}</div>`:""}
    <div class="btns"><button type="button" class="btn primary" data-bh-adjrev="${l.id}">Revisar ajuste</button><button type="button" class="btn" data-bh-adjno="${l.id}">Cancelar</button></div></div>`;
}
function histView(l, hs){
  if(hs==="loading") return `<span class="bh-muted">Carregando histórico…</span>`;
  return `<div class="bh-confirm" style="background:#fff"><strong>Histórico do lançamento</strong><ol class="timeline" style="margin-top:10px">
    <li><span class="when">${fDT(l.criado_em)}</span>, ${esc(l.criado_por_nome||"")}: lançou (${esc(ORIGEM[l.origem]||l.origem)})</li>
    ${hs.map(h=>`<li><span class="when">${fDT(h.criado_em)}</span>, ${esc(h.usuario_nome||"")}: ajustou de ${h.anulado_anterior?"anulado":(h.tipo_anterior==="positivo"?"+":"-")+hhmm(h.minutos_anterior)} para ${h.anulado_novo?"anulado":(h.tipo_novo==="positivo"?"+":"-")+hhmm(h.minutos_novo)}<span class="cmt">“${esc(h.justificativa)}”</span></li>`).join("")}
  </ol>${hs.length?"":`<p class="bh-muted">Nenhum ajuste.</p>`}<button type="button" class="btn link" data-bh-histx="${l.id}">Fechar</button></div>`;
}
function vExtrato(){
  const x=B.fx, list=filtered();
  const people = isAdmin() ? B.funcs.filter(f=>!f.excluido) : [B.me, ...team()].filter(Boolean);
  return `<div class="bh-filters">
    ${people.length>1?`<div class="field"><label for="bh-x-func">Funcionário</label><select id="bh-x-func" data-bh-x="func"><option value="">Todos que posso ver</option>${people.map(p=>`<option value="${p.id}" ${x.func===p.id?"selected":""}>${esc(p.nome)}${p.id===myId()?" (você)":""}</option>`).join("")}</select></div>`:""}
    <div class="field"><label for="bh-x-de">De</label><input type="date" id="bh-x-de" data-bh-x="de" value="${esc(x.de)}"></div>
    <div class="field"><label for="bh-x-ate">Até</label><input type="date" id="bh-x-ate" data-bh-x="ate" value="${esc(x.ate)}"></div>
    <div class="field"><label for="bh-x-mot">Motivo</label><select id="bh-x-mot" data-bh-x="motivo"><option value="">Todos</option>${B.motivos.map(m=>`<option value="${m.id}" ${x.motivo===m.id?"selected":""}>${esc(m.nome)}</option>`).join("")}</select></div>
    <div class="field"><label for="bh-x-tipo">Tipo</label><select id="bh-x-tipo" data-bh-x="tipo"><option value="">Todos</option><option value="positivo" ${x.tipo==="positivo"?"selected":""}>Positivo</option><option value="negativo" ${x.tipo==="negativo"?"selected":""}>Negativo</option></select></div>
    <button type="button" class="btn" data-bh-a="fx-clear">Limpar filtros</button></div>
    ${kpis(list)}
    <div class="btns" style="margin:0 0 12px"><button type="button" class="btn" data-bh-exp="csv">Exportar CSV</button><button type="button" class="btn" data-bh-exp="xlsx">Exportar Excel</button><button type="button" class="btn" data-bh-exp="pdf">Exportar PDF</button></div>
    ${list.length?tblLanc(list,true):`<div class="empty">Nenhum lançamento com esses filtros.</div>`}`;
}

/* --- equipe / funcionários --- */
function saldoDe(fid){ return B.lancs.filter(l=>l.funcionario_id===fid).reduce((a,l)=>{ if(!l.anulado){ if(l.tipo==="positivo") a.p+=l.minutos; else a.n+=l.minutos; } return a; },{p:0,n:0}); }
function vEquipe(){
  const p=aberto();
  let people = isAdmin() ? B.funcs.filter(f=>!f.excluido && f.ativo) : team();
  if(B.eqArea) people=people.filter(f=>f.area_id===B.eqArea);
  const rows=people.map(f=>{ const s=saldoDe(f.id); const noPer=p?B.lancs.filter(l=>l.funcionario_id===f.id && l.data>=p.data_inicio && l.data<=p.data_fim && !l.anulado).length:0; return {f,s,noPer}; });
  const tot=rows.reduce((a,r)=>({p:a.p+r.s.p,n:a.n+r.s.n}),{p:0,n:0});
  const byArea={}; if(isAdmin()) rows.forEach(r=>{ const k=areaNome(r.f.area_id)||"Sem área"; byArea[k]=(byArea[k]||0)+(r.s.p-r.s.n); });
  const preench = p ? rows.filter(r=>r.noPer>0).length : null;
  return `${isAdmin()?`<div class="bh-filters"><div class="field"><label for="bh-eq-area">Área</label><select id="bh-eq-area" data-bh-eq="area"><option value="">Todas</option>${B.areas.map(a=>`<option value="${a.id}" ${B.eqArea===a.id?"selected":""}>${esc(a.nome)}</option>`).join("")}</select></div></div>`:""}
    <div class="bh-kpis"><div class="bh-kpi ${tot.p-tot.n>=0?"pos":"neg"}"><span>Saldo ${isAdmin()?"geral":"da equipe"}</span><strong>${sinal(tot.p-tot.n)}</strong></div>
      <div class="bh-kpi pos"><span>Positivos</span><strong>+${hhmm(tot.p)}</strong></div><div class="bh-kpi neg"><span>Negativos</span><strong>-${hhmm(tot.n)}</strong></div>
      ${preench!=null?`<div class="bh-kpi"><span>Lançaram em ${MESES[p.mes-1]}</span><strong>${preench} de ${rows.length}</strong></div>`:""}</div>
    ${isAdmin()&&Object.keys(byArea).length?`<h3>Saldo por área</h3><div class="tablewrap"><table class="bh-tbl" style="min-width:320px"><thead><tr><th>Área</th><th class="n">Saldo</th></tr></thead><tbody>${Object.entries(byArea).map(([a,v])=>`<tr><td>${esc(a)}</td><td class="n ${v<0?"bh-m":"bh-p"}">${sinal(v)}</td></tr>`).join("")}</tbody></table></div>`:""}
    <h3>${isAdmin()?"Saldo por funcionário":"Minha equipe"}</h3>
    ${rows.length?`<div class="tablewrap"><table class="bh-tbl"><thead><tr><th>Funcionário</th><th>Matrícula</th><th>Área</th><th class="n">Positivos</th><th class="n">Negativos</th><th class="n">Saldo</th>${p?`<th class="n">No mês aberto</th>`:""}<th></th></tr></thead><tbody>
      ${rows.map(r=>`<tr><td>${esc(r.f.nome)}</td><td>${esc(r.f.matricula)}</td><td>${esc(areaNome(r.f.area_id))}</td><td class="n bh-p">+${hhmm(r.s.p)}</td><td class="n bh-m">-${hhmm(r.s.n)}</td><td class="n ${r.s.p-r.s.n<0?"bh-m":"bh-p"}">${sinal(r.s.p-r.s.n)}</td>${p?`<td class="n">${r.noPer?r.noPer+" lanç.":"Nenhum"}</td>`:""}<td><button type="button" class="btn link" data-bh-verext="${r.f.id}">Ver extrato</button></td></tr>`).join("")}
    </tbody></table></div>`:`<div class="empty">${isAdmin()?"Nenhum funcionário cadastrado.":"Nenhum funcionário vinculado à sua gestão."}</div>`}`;
}

/* --- visão consolidada --- */
function vConsol(){
  const d=B.dir;
  if(!d || d.ano!==B.dirAno){ loadDir(); return `<div class="empty">Carregando a visão consolidada…</div>`; }
  if(d.loading) return `<div class="empty">Carregando a visão consolidada…</div>`;
  if(d.err) return `<div class="notice err">${esc(d.err)}</div>`;
  const tot=d.areas.reduce((a,r)=>({p:a.p+Number(r.positivos),n:a.n+Number(r.negativos),f:a.f+Number(r.funcionarios)}),{p:0,n:0,f:0});
  const max=Math.max(60,...d.mensal.map(m=>Math.abs(Number(m.saldo))));
  const by=Array(12).fill(0); d.mensal.forEach(m=>{ by[m.mes-1]=Number(m.saldo); });
  return `<p class="bh-muted" style="margin-top:0">Dados consolidados, sem informações individuais.</p>
    <div class="bh-kpis"><div class="bh-kpi ${tot.p-tot.n>=0?"pos":"neg"}"><span>Saldo geral</span><strong>${sinal(tot.p-tot.n)}</strong></div><div class="bh-kpi pos"><span>Positivos</span><strong>+${hhmm(tot.p)}</strong></div><div class="bh-kpi neg"><span>Negativos</span><strong>-${hhmm(tot.n)}</strong></div><div class="bh-kpi"><span>Funcionários ativos</span><strong>${tot.f}</strong></div></div>
    <h3>Por área</h3>${d.areas.length?`<div class="tablewrap"><table class="bh-tbl" style="min-width:480px"><thead><tr><th>Área</th><th class="n">Funcionários</th><th class="n">Positivos</th><th class="n">Negativos</th><th class="n">Saldo</th></tr></thead><tbody>${d.areas.map(a=>`<tr><td>${esc(a.area)}</td><td class="n">${a.funcionarios}</td><td class="n bh-p">+${hhmm(a.positivos)}</td><td class="n bh-m">-${hhmm(a.negativos)}</td><td class="n ${a.saldo<0?"bh-m":"bh-p"}">${sinal(Number(a.saldo))}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">Sem dados.</div>`}
    <h3 style="display:flex;gap:12px;align-items:center">Evolução mensal <span class="bh-radio" style="padding:0"><button type="button" class="btn" data-bh-dirano="-1" aria-label="Ano anterior">‹</button> ${B.dirAno} <button type="button" class="btn" data-bh-dirano="1" aria-label="Próximo ano">›</button></span></h3>
    <div class="bh-bars" role="img" aria-label="Saldo líquido por mês em ${B.dirAno}">${by.map((v,i)=>`<div class="bh-bar" title="${MESES[i]}: ${sinal(v)}"><i class="${v<0?"neg":""}" style="height:${Math.round(Math.abs(v)/max*100)}%"></i><small>${MESES[i].slice(0,3)}</small></div>`).join("")}</div>`;
}
async function loadDir(){
  const ano=B.dirAno; B.dir={ano, areas:[], mensal:[], loading:true};
  const [a,m]=await Promise.all([B.sb.rpc("bh_resumo_areas"), B.sb.rpc("bh_resumo_mensal",{p_ano:ano})]);
  B.dir={ano, areas:a.data||[], mensal:m.data||[], err:(a.error||m.error)?dbErr(a.error||m.error):null};
  draw();
}

/* --- importação --- */
const COLS = { matricula:["matricula","matrícula","id","identificador"], nome:["nome"], email:["email","e-mail"], data:["data"], tipo:["tipo"], horas:["horas","hora","quantidade"], motivo:["motivo"], observacao:["observacao","observação","obs"] };
function cellDate(v){
  if(v instanceof Date && !isNaN(v)) return isoD(v);
  if(typeof v==="number" && window.XLSX){ const d=XLSX.SSF.parse_date_code(v); if(d) return `${d.y}-${pad(d.m)}-${pad(d.d)}`; }
  const s=String(v||"").trim(); let m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if(m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  m=s.match(/^(\d{4})-(\d{2})-(\d{2})/); if(m) return `${m[1]}-${m[2]}-${m[3]}`;
  return s||null;
}
function cellMin(v){
  if(v instanceof Date && !isNaN(v)) return v.getHours()*60+v.getMinutes();
  if(typeof v==="number") return Math.round(v<1 ? v*1440 : v*60);
  const m=parseHHMM(v); return isNaN(m)?null:m;
}
function cellTipo(v){ const s=norm(v); if(["positivo","p","+","credito","crédito"].includes(s)) return "positivo"; if(["negativo","n","-","debito","débito"].includes(s)) return "negativo"; return s; }
async function readFile(file){
  if(!/\.(csv|xlsx|xls)$/i.test(file.name)) throw new Error("Envie um arquivo .csv, .xlsx ou .xls.");
  if(file.size>5*1048576) throw new Error("O arquivo passa de 5 MB.");
  if(!window.XLSX) throw new Error("A biblioteca de planilhas não carregou. Recarregue a página.");
  const buf=await file.arrayBuffer();
  const wb=XLSX.read(buf,{type:"array", cellDates:true, raw:/\.csv$/i.test(file.name), codepage:65001});
  const ws=wb.Sheets[wb.SheetNames[0]];
  const rows=XLSX.utils.sheet_to_json(ws,{header:1, raw:true, defval:""});
  if(rows.length<2) throw new Error("A planilha não tem linhas de dados.");
  const head=rows[0].map(norm), idx={};
  for(const [k,alts] of Object.entries(COLS)){ const i=head.findIndex(hh=>alts.map(norm).includes(hh)); if(i>=0) idx[k]=i; }
  const faltam=["data","tipo","horas","motivo"].filter(k=>idx[k]==null);
  if(idx.matricula==null && idx.email==null) faltam.unshift("Matrícula ou E-mail");
  if(faltam.length) throw new Error("Colunas obrigatórias ausentes: "+faltam.map(k=>k.length>12?k:k[0].toUpperCase()+k.slice(1)).join(", ")+".");
  const out=[];
  rows.slice(1).forEach((r,i)=>{
    if(r.every(c=>String(c).trim()==="")) return;
    const g=k=>idx[k]==null?"":r[idx[k]];
    out.push({ linha:i+2, matricula:String(g("matricula")).trim(), nome:String(g("nome")).trim(), email:String(g("email")).trim(),
      data:cellDate(g("data")), tipo:cellTipo(g("tipo")), minutos:cellMin(g("horas")), motivo:String(g("motivo")).trim(), observacao:String(g("observacao")).trim() });
  });
  if(out.length>5000) throw new Error("O limite é de 5.000 linhas por arquivo.");
  return out;
}
function modelo(){
  const ws=XLSX.utils.aoa_to_sheet([["Matrícula","Nome","E-mail","Data","Tipo","Horas","Motivo","Observação"],["0001","Nome do Funcionário","email@pronegocios.com.br","03/09/2026","Positivo","06:00","Horas extras",""]]);
  ws["!cols"]=[12,28,30,12,10,8,24,30].map(w=>({wch:w}));
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Lançamentos"); XLSX.writeFile(wb,"modelo-banco-de-horas.xlsx");
}
function vImport(){
  const s=B.imp, b=B.busy.imp?"disabled":"";
  const rep=s.rep||s.done;
  return `<div class="panel"><h3 style="margin-top:0">Importar planilha</h3>
    <p class="bh-muted" style="margin-top:0">Colunas: Matrícula, Nome, E-mail, Data, Tipo, Horas, Motivo, Observação. Data, Tipo, Horas e Motivo são obrigatórias, mais a Matrícula ou o E-mail para identificar o funcionário. Se as duas vierem, vale a matrícula e o e-mail serve de conferência. Arquivo .csv, .xlsx ou .xls de até 5 MB.</p>
    <div class="bh-filters"><div class="field"><label for="bh-imp-file">Arquivo</label><input type="file" id="bh-imp-file" accept=".csv,.xlsx,.xls" data-bh-file="1" ${b}></div><button type="button" class="btn" data-bh-a="modelo">Baixar modelo</button></div>
    ${s.err?`<div class="notice err">${esc(s.err)}</div>`:""}
    ${B.busy.imp?`<p class="progress">Processando…</p>`:""}
    ${s.rep&&!s.done?`<div class="bh-confirm"><strong>Prévia da importação de “${esc(s.file&&s.file.name)}”</strong><p>${s.rep.total} linhas: <span class="bh-ok">${s.rep.sucesso} válidas</span>, <span class="bh-er">${s.rep.erro} com erro</span>. Só as válidas serão gravadas.</p>
      <div class="btns"><button type="button" class="btn primary" data-bh-a="imp-ok" ${s.rep.sucesso?"":"disabled"} ${b}>Confirmar importação de ${s.rep.sucesso} ${s.rep.sucesso===1?"linha":"linhas"}</button><button type="button" class="btn" data-bh-a="imp-x" ${b}>Cancelar</button></div></div>`:""}
    ${s.done?`<div class="notice ok">Importação concluída: ${s.done.sucesso} ${s.done.sucesso===1?"linha gravada":"linhas gravadas"}, ${s.done.erro} ${s.done.erro===1?"rejeitada":"rejeitadas"}. <button type="button" class="btn link" data-bh-a="imp-x">Nova importação</button></div>`:""}
    ${rep?`<div class="tablewrap" style="margin-top:12px"><table class="bh-tbl"><thead><tr><th>Linha</th><th>Matrícula</th><th>Resultado</th><th>Detalhe</th></tr></thead><tbody>${rep.relatorio.map(r=>`<tr><td>${r.linha}</td><td>${esc(r.matricula||"")}</td><td>${r.status==="ok"?`<span class="bh-ok">✓ Válida</span>`:`<span class="bh-er">✗ Rejeitada</span>`}</td><td>${r.status==="ok"?esc((r.funcionario||"")+(r.aviso?" · "+r.aviso:"")):esc((r.erros||[]).join("; "))}</td></tr>`).join("")}</tbody></table></div>
      <div class="btns" style="margin-top:8px"><button type="button" class="btn" data-bh-a="imp-rel">Baixar relatório (CSV)</button></div>`:""}
  </div>
  <h3>Histórico de importações</h3>
  ${B.imps.length?`<div class="tablewrap"><table class="bh-tbl"><thead><tr><th>Data</th><th>Arquivo</th><th>Usuário</th><th>Situação</th><th class="n">Linhas</th><th class="n">Gravadas</th><th class="n">Rejeitadas</th></tr></thead><tbody>${B.imps.map(i=>`<tr><td>${fDT(i.criado_em)}</td><td>${esc(i.arquivo)}</td><td>${esc(i.usuario_nome||"")}</td><td>${esc({concluida:"Concluída",parcial:"Parcial",falhou:"Falhou",processando:"Processando"}[i.status]||i.status)}</td><td class="n">${i.total}</td><td class="n">${i.sucesso}</td><td class="n">${i.erro}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">Nenhuma importação ainda.</div>`}`;
}

/* --- administração --- */
const ATABS=[["periodos","Períodos"],["funcionarios","Funcionários"],["areas","Áreas"],["motivos","Motivos"],["importacao","Importação"],["notificacoes","Notificações"],["auditoria","Auditoria"],["config","Configurações"]];
function vAdmin(){
  const sub=`<nav class="bh-tabs" aria-label="Administração">${ATABS.map(([k,l])=>`<button type="button" data-bh-atab="${k}" ${B.atab===k?'aria-current="page"':""} style="border-radius:4px">${l}</button>`).join("")}</nav>`;
  const body=({ periodos:aPer, funcionarios:aFunc, areas:aAreas, motivos:aMot, importacao:vImport, notificacoes:aNot, auditoria:aAud, config:aCfg })[B.atab]();
  return sub+body;
}
function aPer(){
  const p=aberto(), b=B.busy.per?"disabled":"";
  const ini=`${B.perAno}-${pad(B.perMes)}-01`, fim=isoD(new Date(B.perAno, B.perMes, 0));
  return `${periodBanner()}
    ${p?`<div class="panel"><p style="margin-top:0">Ao fechar ${MESES[p.mes-1]}/${p.ano}, os funcionários não poderão mais lançar nesse mês. O RH continua podendo lançar e ajustar.</p><button type="button" class="btn bad" data-bh-a="per-close" ${b}>Fechar ${MESES[p.mes-1]}/${p.ano}</button></div>`
      :`<div class="panel"><h3 style="margin-top:0">Abrir mês para lançamentos</h3><div class="bh-filters">
        <div class="field"><label for="bh-per-mes">Mês</label><select id="bh-per-mes" data-bh-per="mes">${MESES.map((m,i)=>`<option value="${i+1}" ${B.perMes===i+1?"selected":""}>${m}</option>`).join("")}</select></div>
        <div class="field"><label for="bh-per-ano">Ano</label><input type="number" id="bh-per-ano" data-bh-per="ano" value="${B.perAno}" min="2020" max="2100" style="width:110px"></div></div>
        <p>Período: <strong>${fD(ini)} a ${fD(fim)}</strong>. Os funcionários ativos entram na fila de e-mails de aviso.</p>
        <button type="button" class="btn primary" data-bh-a="per-open" ${b}>Abrir ${MESES[B.perMes-1]}/${B.perAno}</button></div>`}
    <h3>Histórico de períodos</h3>${B.periodos.length?`<div class="tablewrap"><table class="bh-tbl"><thead><tr><th>Mês</th><th>Período</th><th>Situação</th><th>Aberto por</th><th>Fechado por</th></tr></thead><tbody>${B.periodos.map(x=>`<tr><td>${MESES[x.mes-1]}/${x.ano}</td><td>${fD(x.data_inicio)} a ${fD(x.data_fim)}</td><td>${x.status==="aberto"?`<span class="bh-ok">Aberto</span>`:"Fechado"}</td><td>${esc(x.aberto_por||"")}<br><span class="bh-muted">${fDT(x.aberto_em)}</span></td><td>${esc(x.fechado_por||"")}<br><span class="bh-muted">${fDT(x.fechado_em)}</span></td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">Nenhum período aberto até agora.</div>`}`;
}
function aFunc(){
  const e=B.fEdit, q=norm(B.fq);
  const list=B.funcs.filter(f=>!f.excluido && (!q || norm(f.nome+" "+f.matricula+" "+f.email).includes(q)));
  const gestores=B.funcs.filter(f=>!f.excluido && f.ativo && (!e || f.id!==e.id));
  const form = e ? `<div class="panel"><h3 style="margin-top:0">${e.id?"Editar funcionário":"Novo funcionário"}</h3><div class="fields">
      <div class="field"><label for="bh-fe-mat">Matrícula (opcional)</label><input type="text" id="bh-fe-mat" data-bh-fe="matricula" value="${esc(e.matricula||"")}"></div>
      <div class="field"><span class="lbl">Nome e e-mail</span><span>${esc(e.nome||"")}<br><span class="bh-muted">${esc(e.email||"")} · vêm do cadastro de usuários</span></span></div>
      <div class="field"><label for="bh-fe-cargo">Cargo</label><input type="text" id="bh-fe-cargo" data-bh-fe="cargo" value="${esc(e.cargo||"")}"></div>
      <div class="field"><label for="bh-fe-area">Área</label><select id="bh-fe-area" data-bh-fe="area_id"><option value="">Sem área</option>${B.areas.filter(a=>a.ativo||a.id===e.area_id).map(a=>`<option value="${a.id}" ${a.id===e.area_id?"selected":""}>${esc(a.nome)}</option>`).join("")}</select></div>
      <div class="field"><label for="bh-fe-gestor">Gestor imediato</label><select id="bh-fe-gestor" data-bh-fe="gestor_id"><option value="">Sem gestor</option>${gestores.map(g=>`<option value="${g.id}" ${g.id===e.gestor_id?"selected":""}>${esc(g.nome)} · ${esc(g.matricula)}</option>`).join("")}</select></div>
      <div class="field"><label for="bh-fe-ativo">Situação</label><select id="bh-fe-ativo" data-bh-fe="ativo"><option value="true" ${e.ativo!==false?"selected":""}>Ativo</option><option value="false" ${e.ativo===false?"selected":""}>Inativo</option></select></div>
      <div class="field"><label for="bh-fe-dir">Acesso da Diretoria</label><select id="bh-fe-dir" data-bh-fe="diretoria"><option value="false" ${!e.diretoria?"selected":""}>Não</option><option value="true" ${e.diretoria?"selected":""}>Sim (visão consolidada)</option></select></div>
    </div>${e.err?`<div class="notice err" style="margin-top:12px">${esc(e.err)}</div>`:""}
    <div class="formfoot"><button type="button" class="btn" data-bh-a="fe-x">Cancelar</button><button type="button" class="btn primary" data-bh-a="fe-save" ${B.busy.fe?"disabled":""}>Salvar</button></div></div>`
    : `<div class="notice" style="border-left-color:var(--brand-2)">Os funcionários do banco de horas são os usuários aprovados do portal e entram aqui automaticamente. A área também pode ser definida em Administração › Usuários. Aqui você completa matrícula, cargo, gestor imediato e acesso da Diretoria.</div>
      <div class="bh-filters"><div class="field" style="flex:1"><label for="bh-fq">Buscar</label><input type="text" id="bh-fq" data-bh-fq="1" placeholder="Nome, matrícula ou e-mail" value="${esc(B.fq)}"></div></div>`;
  return form + (list.length?`<div class="tablewrap"><table class="bh-tbl"><thead><tr><th>Matrícula</th><th>Nome</th><th>Área</th><th>Cargo</th><th>Gestor</th><th>Situação</th><th></th></tr></thead><tbody>
    ${list.map(f=>`<tr><td>${esc(f.matricula||"—")}</td><td>${esc(f.nome)}<br><span class="bh-muted">${esc(f.email)}${f.user_id?" · acesso vinculado":" · aguardando primeiro acesso"}${f.diretoria?" · Diretoria":""}</span></td><td>${esc(areaNome(f.area_id))}</td><td>${esc(f.cargo||"")}</td><td>${esc((fById(f.gestor_id)||{}).nome||"")}</td><td>${f.ativo?"Ativo":"Inativo"}</td>
      <td style="white-space:nowrap"><button type="button" class="btn link" data-bh-fed="${f.id}">Editar</button> <button type="button" class="btn link" data-bh-fdel="${f.id}">Excluir</button></td></tr>`).join("")}
  </tbody></table></div>`:`<div class="empty">Nenhum funcionário encontrado.</div>`);
}
function simpleList(kind, items, extra){
  const nv = kind==="area" ? B.arNew : B.moNew;
  return `<div class="panel"><div class="bh-filters"><div class="field" style="flex:1"><label for="bh-new-${kind}">${kind==="area"?"Nova área":"Novo motivo"}</label><input type="text" id="bh-new-${kind}" data-bh-new="${kind}" value="${esc(nv)}"></div><button type="button" class="btn primary" data-bh-add="${kind}">Adicionar</button></div>${extra||""}</div>
    ${items.length?`<div class="tablewrap"><table class="bh-tbl" style="min-width:420px"><thead><tr><th>Nome</th><th>Situação</th><th></th></tr></thead><tbody>${items.map(i=>`<tr><td>${esc(i.nome)}${i.descricao?`<br><span class="bh-muted">${esc(i.descricao)}</span>`:""}</td><td>${i.ativo?"Ativo":"Inativo"}</td><td style="white-space:nowrap"><button type="button" class="btn link" data-bh-ren="${kind}:${i.id}">Renomear</button> <button type="button" class="btn link" data-bh-tog="${kind}:${i.id}">${i.ativo?"Inativar":"Ativar"}</button></td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">Nada cadastrado.</div>`}`;
}
const aAreas = () => simpleList("area", B.areas);
const aMot = () => simpleList("motivo", B.motivos, `<p class="bh-muted" style="margin:0">Motivos não são apagados, para preservar o histórico. Só os ativos aparecem nos novos lançamentos.</p>`);
function aNot(){
  const list=B.notifs.filter(n=>!B.notf || n.status===B.notf);
  return `<div class="notice">O envio automático de e-mails depende da escolha do provedor de e-mail, que ainda está pendente. Enquanto isso, cada aviso fica registrado aqui. Você pode abrir no seu e-mail e marcar como enviado.</div>
    <div class="bh-filters"><div class="field"><label for="bh-nf">Situação</label><select id="bh-nf" data-bh-nf="1"><option value="pendente" ${B.notf==="pendente"?"selected":""}>Pendentes</option><option value="enviado" ${B.notf==="enviado"?"selected":""}>Enviados</option><option value="" ${!B.notf?"selected":""}>Todos</option></select></div></div>
    ${list.length?`<div class="tablewrap"><table class="bh-tbl"><thead><tr><th>Data</th><th>Evento</th><th>Destinatário</th><th>Assunto</th><th>Situação</th><th></th></tr></thead><tbody>${list.map(n=>`<tr><td>${fDT(n.criado_em)}</td><td>${esc(NOTIF_TIPO[n.tipo]||n.tipo)}</td><td>${esc(n.destinatario_nome||"")}<br><span class="bh-muted">${esc(n.destinatario_email)}</span></td><td>${esc(n.assunto)}</td><td>${n.status==="enviado"?`Enviado ${fDT(n.enviado_em)}`:n.status==="erro"?`<span class="bh-er">Erro</span>`:"Pendente"}</td>
      <td style="white-space:nowrap"><a class="btn link" href="mailto:${encodeURIComponent(n.destinatario_email)}?subject=${encodeURIComponent(n.assunto)}&body=${encodeURIComponent(n.corpo)}">Abrir no e-mail</a>${n.status!=="enviado"?` <button type="button" class="btn link" data-bh-nsent="${n.id}">Marcar enviado</button>`:""}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">Nenhum aviso nesta situação.</div>`}`;
}
const EVT = { lancamento:"Lançamento", ajuste:"Ajuste", importacao:"Importação", exportacao:"Exportação", periodo_abertura:"Abertura de mês", periodo_fechamento:"Fechamento de mês",
  bh_funcionarios_insert:"Funcionário cadastrado", bh_funcionarios_update:"Funcionário alterado", bh_areas_insert:"Área criada", bh_areas_update:"Área alterada", bh_motivos_insert:"Motivo criado", bh_motivos_update:"Motivo alterado", bh_config_update:"Configuração alterada" };
function audResumo(a){
  const d=a.detalhes||{};
  if(a.evento==="lancamento" && d.funcionario) return `${d.funcionario}, ${fD(d.data)}, ${d.tipo==="positivo"?"+":"-"}${hhmm(d.minutos)}, ${d.motivo} (${ORIGEM[d.origem]||d.origem})`;
  if(a.evento==="ajuste" && d.anterior) return `de ${d.anterior.anulado?"anulado":(d.anterior.tipo==="positivo"?"+":"-")+hhmm(d.anterior.minutos)} para ${d.novo.anulado?"anulado":(d.novo.tipo==="positivo"?"+":"-")+hhmm(d.novo.minutos)}: ${d.justificativa||""}`;
  if(a.evento==="importacao") return `${d.arquivo||""} · ${d.total??""} linhas, ${d.sucesso??""} gravadas, ${d.erro??""} rejeitadas`;
  if(a.evento==="exportacao") return `${String(d.formato||"").toUpperCase()} · ${d.escopo&&d.escopo.linhas!=null?d.escopo.linhas+" linhas":""}`;
  if(a.evento.startsWith("periodo")) return d.ano?`${pad(d.mes)}/${d.ano}`:"";
  if(d.depois){ const n=d.depois; return n.nome||n.matricula||""; }
  return d.motivo||"";
}
function aAud(){
  const f=B.audf;
  const list=B.aud.filter(a=>(!f.ev||a.evento===f.ev)&&(!f.res||a.resultado===f.res)&&(!f.de||a.criado_em.slice(0,10)>=f.de)&&(!f.ate||a.criado_em.slice(0,10)<=f.ate));
  const evs=[...new Set(B.aud.map(a=>a.evento))];
  return `<div class="bh-filters">
    <div class="field"><label for="bh-af-ev">Evento</label><select id="bh-af-ev" data-bh-af="ev"><option value="">Todos</option>${evs.map(e=>`<option value="${esc(e)}" ${f.ev===e?"selected":""}>${esc(EVT[e]||e)}</option>`).join("")}</select></div>
    <div class="field"><label for="bh-af-res">Resultado</label><select id="bh-af-res" data-bh-af="res"><option value="">Todos</option>${["sucesso","parcial","negado"].map(r=>`<option ${f.res===r?"selected":""}>${r}</option>`).join("")}</select></div>
    <div class="field"><label for="bh-af-de">De</label><input type="date" id="bh-af-de" data-bh-af="de" value="${esc(f.de)}"></div>
    <div class="field"><label for="bh-af-ate">Até</label><input type="date" id="bh-af-ate" data-bh-af="ate" value="${esc(f.ate)}"></div></div>
    <p class="bh-muted">Mostrando os 500 eventos mais recentes. Login e saída são registrados pelo portal, fora deste módulo.</p>
    ${list.length?`<div class="tablewrap"><table class="bh-tbl"><thead><tr><th>Data</th><th>Usuário</th><th>Evento</th><th>Resultado</th><th>Detalhe</th></tr></thead><tbody>${list.map(a=>`<tr><td>${fDT(a.criado_em)}</td><td>${esc(a.usuario_nome||"")}</td><td>${esc(EVT[a.evento]||a.evento)}</td><td>${a.resultado==="negado"?`<span class="bh-er">Negado</span>`:esc(a.resultado)}</td><td>${esc(audResumo(a))}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">Nenhum evento com esses filtros.</div>`}`;
}
function aCfg(){
  const c=B.cfg, chk=(k,l)=>`<label style="font-weight:400;display:flex;gap:8px;align-items:center;padding:6px 0"><input type="checkbox" data-bh-cfg="${k}" ${c[k]?"checked":""}> ${l}</label>`;
  return `<div class="panel"><h3 style="margin-top:0">Permissões dos gestores</h3>${chk("gestor_pode_lancar","Gestor pode lançar horas para a própria equipe")}${chk("gestor_pode_importar","Gestor pode importar planilhas da própria equipe")}
    <h3>Avisos por e-mail (fila)</h3>${chk("notificar_gestor","Novo lançamento: avisar o gestor imediato")}${chk("notificar_rh","Novo lançamento: avisar o RH")}${chk("notificar_ajuste","Ajuste: avisar o funcionário")}${chk("notificar_abertura","Abertura de mês: avisar funcionários e gestores")}
    <p class="bh-muted">Cada mudança é salva na hora e registrada na auditoria.</p></div>`;
}

/* ---------- exportação ---------- */
function expRows(){
  return filtered().map(l=>{ const f=fById(l.funcionario_id)||{};
    return { "Matrícula":f.matricula||"", "Funcionário":f.nome||"", "Área":areaNome(f.area_id), "Data":fD(l.data), "Tipo":l.tipo==="positivo"?"Positivo":"Negativo",
      "Horas":(l.tipo==="positivo"?"+":"-")+hhmm(l.minutos), "Minutos no saldo":val(l), "Motivo":motNome(l.motivo_id), "Observação":l.observacao||"",
      "Origem":ORIGEM[l.origem]||l.origem, "Situação":l.anulado?"Anulado":"Válido", "Lançado em":fDT(l.criado_em) }; });
}
function escopo(){ const x=B.fx; return { funcionario:x.func?((fById(x.func)||{}).nome||x.func):"todos autorizados", de:x.de||null, ate:x.ate||null, motivo:x.motivo?motNome(x.motivo):null, tipo:x.tipo||null }; }
async function exportar(fmt){
  const rows=expRows(), ger=new Date().toLocaleString("pt-BR"), esc0=escopo();
  B.sb.rpc("bh_registrar_exportacao",{p_formato:fmt, p_escopo:{...esc0, linhas:rows.length}}).then(()=>{});
  const nome=`banco-de-horas-${hoje()}`;
  if(fmt==="csv"){
    const cols=Object.keys(rows[0]||{"Data":""});
    const q=v=>`"${String(v).replace(/"/g,'""')}"`;
    const txt="\ufeff"+[`Gerado em;${ger}`,`Escopo;${esc0.funcionario}`,"",cols.join(";"),...rows.map(r=>cols.map(c=>q(r[c])).join(";"))].join("\r\n");
    const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([txt],{type:"text/csv;charset=utf-8"})); a.download=nome+".csv"; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  } else if(fmt==="xlsx"){
    const ws=XLSX.utils.json_to_sheet(rows.length?rows:[{"Data":""}]); XLSX.utils.sheet_add_aoa(ws,[[`Gerado em ${ger}`]],{origin:{r:rows.length+2,c:0}});
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Extrato"); XLSX.writeFile(wb,nome+".xlsx");
  } else {
    const sal=rows.reduce((s,r)=>s+r["Minutos no saldo"],0);
    const w=window.open("","_blank"); if(!w){ B.msg={ok:false,text:"O navegador bloqueou a janela do PDF. Permita pop-ups para este site."}; draw(); return; }
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${nome}</title><style>body{font-family:Arial,sans-serif;font-size:12px;margin:24px}h1{font-size:18px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}th{background:#eef}</style></head><body>
      <h1>Banco de Horas — Extrato</h1><p>Escopo: ${esc(esc0.funcionario)}${esc0.de?` · de ${fD(esc0.de)}`:""}${esc0.ate?` até ${fD(esc0.ate)}`:""}<br>Saldo do filtro: <strong>${sinal(sal)}</strong><br>Gerado em ${esc(ger)}</p>
      <table><thead><tr>${["Data","Funcionário","Tipo","Horas","Motivo","Observação","Origem","Situação"].map(c=>`<th>${c}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${["Data","Funcionário","Tipo","Horas","Motivo","Observação","Origem","Situação"].map(c=>`<td>${esc(r[c])}</td>`).join("")}</tr>`).join("")}</tbody></table>
      <script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  }
}

/* ---------- ações ---------- */
async function rpc(name, args){ const { data, error } = await B.sb.rpc(name, args); if(error) return { ok:false, erro:dbErr(error) }; return data||{ok:true}; }
async function onClick(ev){
  const t=ev.target.closest("button,a"); if(!t || !B.el.contains(t)) return;
  const d=t.dataset;
  if(d.bhTab){ B.tab=d.bhTab; B.msg=null; if(B.tab==="novo"){ B.fstep=null; B.ferr=null; } if(B.tab==="importar"||B.tab==="admin") await loadAdmin(); draw(); B.el.scrollIntoView({block:"start"}); return; }
  if(d.bhAtab){ B.atab=d.bhAtab; B.msg=null; await loadAdmin(); draw(); return; }
  if(d.bhVerext){ B.fx={func:d.bhVerext,de:"",ate:"",motivo:"",tipo:""}; B.tab="extrato"; draw(); return; }
  if(d.bhAdj){ const l=B.lancs.find(x=>x.id===d.bhAdj); B.adj[l.id]={tipo:l.tipo, horas:l.anulado?"00:00":hhmm(l.minutos), just:"", step:null}; delete B.hist[l.id]; draw(); const x=document.getElementById("bh-aj-h-"+l.id); if(x) x.focus(); return; }
  if(d.bhAdjno){ delete B.adj[d.bhAdjno]; draw(); return; }
  if(d.bhAdjback){ B.adj[d.bhAdjback].step=null; draw(); return; }
  if(d.bhAdjrev){ const a=B.adj[d.bhAdjrev], m=parseHHMM(a.horas); a.err=null;
    if(isNaN(m)) a.err="Informe as horas no formato HH:MM."; else if((a.just||"").trim().length<5) a.err="Escreva a justificativa do ajuste.";
    if(!a.err) a.step="confirm"; draw(); return; }
  if(d.bhAdjok){ const id=d.bhAdjok, a=B.adj[id]; B.busy["a"+id]=true; draw();
    const r=await rpc("bh_ajustar",{p_lancamento:id, p_tipo:a.tipo, p_minutos:parseHHMM(a.horas), p_justificativa:a.just});
    B.busy["a"+id]=false; if(!r.ok){ a.err=r.erro; draw(); return; }
    delete B.adj[id]; await reload("Ajuste gravado. O histórico anterior foi preservado."); return; }
  if(d.bhHist){ const id=d.bhHist; B.hist[id]="loading"; delete B.adj[id]; draw();
    const { data } = await B.sb.from("bh_ajustes").select("*").eq("lancamento_id",id).order("criado_em"); B.hist[id]=data||[]; draw(); return; }
  if(d.bhHistx){ delete B.hist[d.bhHistx]; draw(); return; }
  if(d.bhExp){ exportar(d.bhExp); return; }
  if(d.bhDirano){ B.dirAno+=Number(d.bhDirano); draw(); return; }
  if(d.bhFed){ B.fEdit={...fById(d.bhFed)}; draw(); B.el.scrollIntoView({block:"start"}); return; }
  if(d.bhFdel){ const f=fById(d.bhFdel); if(!confirm(`Excluir ${f.nome} do banco de horas? Os lançamentos e o histórico são preservados; a pessoa deixa de aparecer nas listas e de lançar. O usuário continua ativo no portal.`)) return;
    const { error } = await B.sb.from("bh_funcionarios").update({excluido:true, ativo:false, updated_at:new Date().toISOString()}).eq("id",f.id);
    if(error){ B.msg={ok:false,text:dbErr(error)}; draw(); } else await reload("Funcionário excluído (exclusão lógica)."); return; }
  if(d.bhAdd){ const k=d.bhAdd, nome=(k==="area"?B.arNew:B.moNew).trim(); if(!nome) return;
    const { error } = await B.sb.from(k==="area"?"bh_areas":"bh_motivos").insert({nome});
    if(error){ B.msg={ok:false,text:/duplicate|unique/i.test(error.message)?"Já existe um item com esse nome.":dbErr(error)}; draw(); return; }
    if(k==="area") B.arNew=""; else B.moNew=""; await reload(k==="area"?"Área criada.":"Motivo criado."); return; }
  if(d.bhRen){ const [k,id]=d.bhRen.split(":"), it=(k==="area"?B.areas:B.motivos).find(x=>x.id===id); const nome=prompt("Novo nome:", it.nome); if(!nome||!nome.trim()||nome.trim()===it.nome) return;
    const { error } = await B.sb.from(k==="area"?"bh_areas":"bh_motivos").update({nome:nome.trim()}).eq("id",id);
    if(error){ B.msg={ok:false,text:dbErr(error)}; draw(); } else await reload("Nome alterado."); return; }
  if(d.bhTog){ const [k,id]=d.bhTog.split(":"), it=(k==="area"?B.areas:B.motivos).find(x=>x.id===id);
    const { error } = await B.sb.from(k==="area"?"bh_areas":"bh_motivos").update({ativo:!it.ativo}).eq("id",id);
    if(error){ B.msg={ok:false,text:dbErr(error)}; draw(); } else await reload(it.ativo?"Inativado.":"Ativado."); return; }
  if(d.bhNsent){ await B.sb.from("bh_notificacoes").update({status:"enviado", enviado_em:new Date().toISOString()}).eq("id",d.bhNsent); await loadAdmin(); draw(); return; }
  const a=d.bhA; if(!a) return;
  if(a==="msg-x"){ B.msg=null; draw(); }
  else if(a==="reload"){ B.loaded=false; draw(); await reload(); }
  else if(a==="fx-clear"){ B.fx={func:B.me?B.me.id:"",de:"",ate:"",motivo:"",tipo:""}; draw(); }
  else if(a==="lanc-back"){ B.fstep=null; draw(); }
  else if(a==="lanc-ok"){
    const f=B.form; B.busy.lanc=true; B.ferr=null; draw();
    const r=await rpc("bh_lancar",{p_funcionario:f.func, p_data:f.data, p_tipo:f.tipo, p_minutos:parseHHMM(f.horas), p_motivo:f.motivo, p_obs:f.obs||""});
    B.busy.lanc=false;
    if(!r.ok){ B.ferr=r.erro; draw(); return; }
    const who=fById(f.func); B.form={func:f.func}; B.fstep=null; B.tab="inicio";
    await reload(`Lançamento de ${f.tipo==="positivo"?"+":"-"}${hhmm(parseHHMM(f.horas))} gravado${who&&who.id!==myId()?" para "+who.nome:""}. O saldo já foi atualizado.`);
  }
  else if(a==="modelo"){ modelo(); }
  else if(a==="imp-x"){ B.imp={file:null,linhas:null,rep:null,done:null,err:null}; draw(); }
  else if(a==="imp-ok"){
    const s=B.imp; B.busy.imp=true; draw();
    const r=await rpc("bh_importar",{p_arquivo:s.file.name, p_linhas:s.linhas, p_confirmar:true});
    B.busy.imp=false; if(!r.ok){ s.err=r.erro; draw(); return; }
    s.done=r; await reload();
  }
  else if(a==="imp-rel"){
    const rep=(B.imp.done||B.imp.rep).relatorio;
    const txt="\ufeffLinha;Matrícula;Resultado;Detalhe\r\n"+rep.map(r=>[r.linha, r.matricula||"", r.status==="ok"?"Válida":"Rejeitada", r.status==="ok"?(r.funcionario||"")+(r.aviso?" · "+r.aviso:""):(r.erros||[]).join("; ")].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(";")).join("\r\n");
    const el=document.createElement("a"); el.href=URL.createObjectURL(new Blob([txt],{type:"text/csv;charset=utf-8"})); el.download="relatorio-importacao.csv"; el.click();
  }
  else if(a==="per-open"){
    if(!confirm(`Abrir ${MESES[B.perMes-1]}/${B.perAno} para lançamentos? Os funcionários serão avisados.`)) return;
    B.busy.per=true; draw(); const r=await rpc("bh_periodo_abrir",{p_ano:Number(B.perAno), p_mes:Number(B.perMes)}); B.busy.per=false;
    if(!r.ok){ B.msg={ok:false,text:r.erro}; draw(); } else await reload(`${MESES[B.perMes-1]}/${B.perAno} aberto para lançamentos.`);
  }
  else if(a==="per-close"){
    const p=aberto(); if(!p || !confirm(`Fechar ${MESES[p.mes-1]}/${p.ano}? Os funcionários não poderão mais lançar nesse mês.`)) return;
    B.busy.per=true; draw(); const r=await rpc("bh_periodo_fechar",{p_id:p.id}); B.busy.per=false;
    if(!r.ok){ B.msg={ok:false,text:r.erro}; draw(); } else await reload(`${MESES[p.mes-1]}/${p.ano} fechado.`);
  }
  else if(a==="fe-new"){ B.fEdit={ativo:true, diretoria:false}; draw(); const x=document.getElementById("bh-fe-mat"); if(x) x.focus(); }
  else if(a==="fe-x"){ B.fEdit=null; draw(); }
  else if(a==="fe-save"){
    const e=B.fEdit; e.err=null;
    const row={ matricula:(e.matricula||"").trim()||null, cargo:(e.cargo||"").trim()||null,
      area_id:e.area_id||null, gestor_id:e.gestor_id||null, ativo:String(e.ativo)!=="false", diretoria:String(e.diretoria)==="true", updated_at:new Date().toISOString() };

    if(e.id && row.gestor_id){ let g=fById(row.gestor_id), guard=0; while(g && guard++<50){ if(g.id===e.id){ e.err="Esse gestor está abaixo deste funcionário na hierarquia."; draw(); return; } g=fById(g.gestor_id); } }
    B.busy.fe=true; draw();
    const res = await B.sb.from("bh_funcionarios").update(row).eq("id",e.id);
    B.busy.fe=false;
    if(res.error){ e.err=/duplicate|unique/i.test(res.error.message)?"Já existe outro funcionário com essa matrícula.":dbErr(res.error); draw(); return; }
    B.fEdit=null; await reload("Funcionário salvo.");
  }
}
function onInput(ev){
  const t=ev.target; if(!B.el.contains(t)) return; const d=t.dataset;
  if(d.bhF){ if(t.type==="radio" && !t.checked) return; B.form[d.bhF]=t.value; B.ferr=null; if(d.bhF==="func"){ B.form.data=""; draw(); } return; }
  if(d.bhX){ B.fx[d.bhX]=t.value; if(t.tagName!=="SELECT") return; draw(); return; }
  if(d.bhAj){ B.adj[d.bhAj][d.k]=t.value; return; }
  if(d.bhFe){ B.fEdit[d.bhFe]=t.value; return; }
  if(d.bhFq){ B.fq=t.value; draw(); return; }
  if(d.bhNew){ if(d.bhNew==="area") B.arNew=t.value; else B.moNew=t.value; return; }
  if(d.bhPer){ if(d.bhPer==="mes") B.perMes=Number(t.value); else B.perAno=Number(t.value)||B.perAno; draw(); return; }
  if(d.bhAf){ B.audf[d.bhAf]=t.value; if(t.tagName==="SELECT") draw(); return; }
  if(d.bhEq){ B.eqArea=t.value; draw(); return; }
  if(d.bhNf){ B.notf=t.value; draw(); return; }
}
async function onChange(ev){
  const t=ev.target; if(!B.el.contains(t)) return; const d=t.dataset;
  if(d.bhX && t.tagName==="INPUT"){ draw(); return; }
  if(d.bhAf && t.tagName==="INPUT"){ draw(); return; }
  if(d.bhCfg){ const k=d.bhCfg, v=t.checked; const { error } = await B.sb.from("bh_config").update({[k]:v, atualizado_em:new Date().toISOString()}).eq("id",1);
    if(error){ B.msg={ok:false,text:dbErr(error)}; t.checked=!v; } else { B.cfg[k]=v; B.msg={ok:true,text:"Configuração salva."}; } draw(); return; }
  if(d.bhFile){ const f=t.files&&t.files[0]; B.imp={file:f,linhas:null,rep:null,done:null,err:null}; if(!f){ draw(); return; }
    B.busy.imp=true; draw();
    try{ const linhas=await readFile(f); B.imp.linhas=linhas;
      const r=await rpc("bh_importar",{p_arquivo:f.name, p_linhas:linhas, p_confirmar:false});
      if(!r.ok) B.imp.err=r.erro; else B.imp.rep=r;
    }catch(e){ B.imp.err=e.message||String(e); }
    B.busy.imp=false; draw(); return; }
}
function onSubmit(ev){
  if(!B.el.contains(ev.target)) return; ev.preventDefault();
  if(ev.target.id==="bh-form-lanc"){ const e=checkLanc(); B.ferr=e; B.fstep=e?null:"confirm"; draw(); }
}

/* ---------- ponto de integração com o Portal do Colaborador ---------- */
window.RH_BANCO_HORAS = {
  /* Resumo para a página inicial: { cadastrado, saldo (minutos), periodo } */
  async resumo(sb, userId){
    try{
      await sb.rpc("bh_vincular");
      const f=await sb.from("bh_funcionarios").select("id").eq("user_id",userId).maybeSingle();
      const p=await sb.from("bh_periodos").select("*").eq("status","aberto").maybeSingle();
      if(f.error) return { ativo:false };
      if(!f.data) return { ativo:true, cadastrado:false, periodo:p.data||null };
      const ls=await fetchAll(()=>sb.from("bh_lancamentos").select("tipo,minutos,anulado").eq("funcionario_id",f.data.id));
      return { ativo:true, cadastrado:true, saldo:ls.reduce((s,l)=>s+val(l),0), periodo:p.data||null };
    }catch(e){ return { ativo:false }; }
  },
  formatar: sinal,
  periodoTexto: periodoTxt,
  /* Abre uma aba interna (inicio, novo, extrato, admin...) */
  setTab(t){ B.tab=t; B.msg=null; if(t==="novo"){ B.fstep=null; B.ferr=null; }
    if(B.el && document.body.contains(B.el)){ (t==="admin"?loadAdmin():Promise.resolve()).then(draw); } },
  render(el, ctx){
    B.el=el; B.sb=ctx.supabase; B.ctx=ctx;
    if(!el.dataset.bhBound){ el.dataset.bhBound="1"; el.addEventListener("click", onClick); el.addEventListener("input", onInput); el.addEventListener("change", onChange); el.addEventListener("submit", onSubmit); }
    B.loaded=false; draw();
    load().then(draw);
  }
};
})();
