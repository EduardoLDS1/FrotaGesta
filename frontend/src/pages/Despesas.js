import { useEffect, useState } from 'react';
import { api, enviarComArquivo, anexarComprovante, abrirComprovante, urlEventos } from '../services/api';
import { useData } from '../components/useData';
import { Field, Notice, Table, moeda, dia, Icon, Badge } from '../components/UI';
const categorias=['Combustível','Manutenção','Peças','Pedágio','Estacionamento','Seguro','IPVA','Licenciamento','Financiamento','Lavagem','Multa','Aluguel','Outros'];
const hoje=()=>new Date().toLocaleDateString('sv-SE');
const vazio=()=>({veiculo_id:'',categoria:'Combustível',data:hoje(),valor:'',litros:'',descricao:'',viagem_id:''});
export default function Despesas({usuario}){
  const veiculos=useData('/veiculos'),viagens=useData('/viagens');
  const [filtroVeiculo,setFiltroVeiculo]=useState(''),[filtroCategoria,setFiltroCategoria]=useState('');
  const consulta=new URLSearchParams();
  if(filtroVeiculo)consulta.set('veiculo_id',filtroVeiculo);
  if(filtroCategoria)consulta.set('categoria',filtroCategoria);
  const parametros=consulta.toString();
  const despesas=useData('/despesas'+(parametros?'?'+parametros:''));
  const [form,setForm]=useState(vazio),[arquivo,setArquivo]=useState(null),[key,setKey]=useState(0),
    [error,setError]=useState(''),[success,setSuccess]=useState(''),[busy,setBusy]=useState(false),
    [confirmacoes,setConfirmacoes]=useState({});
  const admin=usuario?.perfil==='Administrador';
  const recarregarDespesas=despesas.reload;
  useEffect(()=>{
    const eventos=new EventSource(urlEventos(),{withCredentials:true});
    const atualizar=()=>recarregarDespesas();
    eventos.addEventListener('atualizado',atualizar);
    return ()=>{eventos.removeEventListener('atualizado',atualizar);eventos.close();};
  },[recarregarDespesas]);
  const change=(k,v)=>setForm(s=>({...s,[k]:v,...(k==='categoria'&&v!=='Combustível'?{litros:''}:{}),
    ...(k==='veiculo_id'?{viagem_id:''}:{})}));
  async function executar(acao,mensagem){
    if(busy)return;
    setBusy(true);setError('');setSuccess('');
    try{await acao();await Promise.all([despesas.reload(),veiculos.reload()]);setSuccess(mensagem);}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  function salvar(e){e.preventDefault();executar(async()=>{
    await enviarComArquivo('/despesas',{...form,veiculo_id:Number(form.veiculo_id),
      viagem_id:form.viagem_id?Number(form.viagem_id):null,
      valor:Number(form.valor),litros:form.litros?Number(form.litros):null},arquivo);
    setForm(vazio());setArquivo(null);setKey(n=>n+1);
  },'Despesa paga e comprovante registrados.');}
  function confirmar(d){
    const p=confirmacoes[d.id]||{};
    executar(async()=>{
      await enviarComArquivo(`/despesas/${d.id}/pagar`,{
        valor:Number(p.valor??d.valor),data_pagamento:p.data||hoje()},p.arquivo,'PUT');
      setConfirmacoes(s=>({...s,[d.id]:{}}));
    },'Pagamento confirmado com comprovante.');
  }
  function apagar(d){
    if(!window.confirm(`Excluir despesa ${d.categoria} de ${moeda(d.valor)}?`))return;
    executar(()=>api(`/despesas/${d.id}`,{method:'DELETE'}),'Despesa excluída.');
  }
  function adicionar(d,file){if(file)executar(()=>anexarComprovante(d.id,file),'Comprovante atualizado.');}
  function abrir(d){executar(()=>abrirComprovante(d.id),'Comprovante aberto.');}
  const linhas=despesas.data||[];
  const pagas=linhas.filter(d=>d.situacao_pagamento==='Pago'),pendentes=linhas.filter(d=>d.situacao_pagamento==='Pendente');
  const totais=categorias.map(c=>({categoria:c,total:pagas.filter(d=>d.categoria===c).reduce((n,d)=>n+Number(d.valor),0)})).filter(x=>x.total>0);
  return <>
    <div className="page-title"><div><h1>Despesas da frota</h1><p>Pagamentos reais, comprovantes obrigatórios e controle por veículo e categoria.</p></div></div>
    <Notice error={error||despesas.error||veiculos.error} success={success}/>
    <section className="panel no-print"><h2>Novo gasto pago</h2><form onSubmit={salvar}><fieldset disabled={busy}><div className="form-grid three">
      <Field label="Veículo" name="veiculo_id" value={form.veiculo_id} onChange={change} required
        options={[{value:'',label:'Selecione'},...(veiculos.data||[]).map(v=>({value:String(v.id),label:`${v.placa} · ${v.modelo}`}))]}/>
      <Field label="Categoria" name="categoria" value={form.categoria} onChange={change}
        options={categorias.map(c=>({value:c,label:c}))}/>
      <Field label="Data do pagamento" name="data" type="date" value={form.data} onChange={change} required/>
      <Field label="Valor real (R$)" name="valor" value={form.valor} type="number" min="0.01" step="0.01" onChange={change} required/>
      {form.categoria==='Combustível'&&<Field label="Litros (opcional)" name="litros" value={form.litros} type="number" min="0.001" step="0.001" onChange={change}/>}
      <Field label="Viagem relacionada (opcional)" name="viagem_id" value={form.viagem_id} onChange={change}
        options={[{value:'',label:'Sem vínculo'},...(viagens.data||[]).filter(v=>String(v.veiculo_id)===form.veiculo_id).map(v=>({value:String(v.id),label:`#${v.id} · ${v.destino}`}))]}/>
      <Field label="Descrição" name="descricao" value={form.descricao} onChange={change} maxLength={500}/>
      <label className="field"><span>Comprovante obrigatório (PDF / imagem, até 5 MB) *</span>
        <input key={key} aria-label="Comprovante obrigatório" type="file" required accept=".pdf,.png,.jpg,.jpeg,.webp"
          onChange={e=>setArquivo(e.target.files?.[0]||null)}/></label>
    </div><p className="helper">Mensalidades de financiamento e locação são criadas como pendentes. Para torná-las pagas, anexe o comprovante ao confirmar.</p>
      <div className="form-end"><button className="button primary" disabled={!arquivo}><Icon name="plus"/> {busy?'Salvando…':'Registrar despesa'}</button></div></fieldset></form></section>
    <section className="panel"><div className="panel-heading"><h2>Painel financeiro</h2><div className="actions no-print">
      <select aria-label="Filtrar por veículo" value={filtroVeiculo} onChange={e=>setFiltroVeiculo(e.target.value)}>
        <option value="">Todos os veículos</option>{(veiculos.data||[]).map(v=><option key={v.id} value={v.id}>{v.placa}</option>)}
      </select>
      <select aria-label="Filtrar por categoria" value={filtroCategoria} onChange={e=>setFiltroCategoria(e.target.value)}>
        <option value="">Todas as categorias</option>{categorias.map(c=><option key={c} value={c}>{c}</option>)}
      </select>
    </div></div>
    <div className="financial-summary">
      {totais.map(x=><div key={x.categoria}><span>{x.categoria}</span><strong>{moeda(x.total)}</strong></div>)}
      <div><span>Total geral pago</span><strong>{moeda(pagas.reduce((n,d)=>n+Number(d.valor),0))}</strong></div>
      <div><span>Total pendente</span><strong>{moeda(pendentes.reduce((n,d)=>n+Number(d.valor),0))}</strong></div>
    </div>
    <p className="helper">Atualização automática entre computadores conectados ao mesmo servidor. Os totais respeitam os filtros selecionados.</p>
    <Table headers={['Data','Veículo','Categoria','Valor','Situação','Comprovante','Descrição','Ação']} rows={linhas}
      empty="Nenhuma despesa encontrada." render={d=><tr key={d.id}>
      <td>{dia(d.data)}{d.data_pagamento&&<small>Pago: {dia(d.data_pagamento)}</small>}</td>
      <td>{d.placa}</td><td>{d.categoria}{d.gerada_automaticamente&&<small>Mensalidade automática</small>}</td>
      <td>{moeda(d.valor)}</td><td><Badge tone={d.situacao_pagamento==='Pago'?'green':'yellow'}>{d.situacao_pagamento}</Badge></td>
      <td className="wrap">{admin?<>{d.comprovante_nome?<button className="small-button" disabled={busy} onClick={()=>abrir(d)}>Ver comprovante</button>:'Sem comprovante'}
        <label className="field no-print"><span>Anexar / substituir</span><input type="file" disabled={busy}
          accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={e=>{adicionar(d,e.target.files?.[0]);e.target.value='';}}/></label></>:
        'Restrito ao administrador'}</td>
      <td className="wrap">{d.descricao||'—'}</td>
      <td>{d.situacao_pagamento==='Pendente'?<div className="actions no-print" style={{flexDirection:'column',alignItems:'stretch'}}>
        <input aria-label={`Valor pagamento ${d.id}`} type="number" min="0.01" step="0.01" disabled={busy}
          value={confirmacoes[d.id]?.valor??String(d.valor)} onChange={e=>setConfirmacoes(s=>({...s,[d.id]:{...s[d.id],valor:e.target.value}}))}/>
        <input aria-label={`Data pagamento ${d.id}`} type="date" disabled={busy}
          value={confirmacoes[d.id]?.data??hoje()} onChange={e=>setConfirmacoes(s=>({...s,[d.id]:{...s[d.id],data:e.target.value}}))}/>
        <label className="field"><span>Comprovante obrigatório</span><input type="file" disabled={busy}
          accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={e=>setConfirmacoes(s=>({...s,[d.id]:{...s[d.id],arquivo:e.target.files?.[0]||null}}))}/></label>
        <button className="small-button" disabled={busy||!confirmacoes[d.id]?.arquivo||Number(confirmacoes[d.id]?.valor??d.valor)<=0}
          onClick={()=>confirmar(d)}>Confirmar pagamento</button>
      </div>:admin?<button className="small-button no-print" disabled={busy||d.gerada_automaticamente||d.origem_viagem}
        onClick={()=>apagar(d)}>Excluir</button>:'—'}</td>
    </tr>}/>
    </section>
  </>;
}
