import { useState } from 'react';
import { api, anexarComprovante, abrirComprovante } from '../services/api';
import { useData } from '../components/useData';
import { Field, Notice, Table, moeda, dia, Icon, Badge } from '../components/UI';
const categorias=['Combustível','Pedágio','Estacionamento','Seguro','IPVA','Licenciamento','Financiamento','Lavagem','Multa','Aluguel','Outros'];
const hoje=()=>new Date().toLocaleDateString('sv-SE');
const vazio=()=>({veiculo_id:'',categoria:'Combustível',data:hoje(),valor:'',litros:'',descricao:'',viagem_id:''});
export default function Despesas() {
  const veiculos=useData('/veiculos'), viagens=useData('/viagens'), despesas=useData('/despesas');
  const [form,setForm]=useState(vazio),[arquivo,setArquivo]=useState(null),[arquivoKey,setArquivoKey]=useState(0),[filtro,setFiltro]=useState(''),[error,setError]=useState(''),[success,setSuccess]=useState(''),[busy,setBusy]=useState(false),[confirmacoes,setConfirmacoes]=useState({});
  const change=(k,v)=>setForm(s=>({...s,[k]:v,...(k==='categoria'&&v!=='Combustível'?{litros:''}:{}),...(k==='veiculo_id'?{viagem_id:''}:{})}));
  async function executar(acao,sucesso){if(busy)return;setBusy(true);setError('');setSuccess('');try{await acao();setSuccess(sucesso);await Promise.all([despesas.reload(),veiculos.reload()]);}catch(e){setError(e.message);}finally{setBusy(false);}}
  const salvar=(e)=>{e.preventDefault();executar(async()=>{
    const nova=await api('/despesas',{method:'POST',body:{...form,veiculo_id:Number(form.veiculo_id),viagem_id:form.viagem_id?Number(form.viagem_id):null,valor:Number(form.valor),litros:form.litros===''?null:Number(form.litros)}});
    setForm(vazio());setArquivo(null);setArquivoKey(n=>n+1);
    if(arquivo){try{await anexarComprovante(nova.id,arquivo);}catch(e){throw new Error(`Despesa #${nova.id} salva, mas o comprovante falhou: ${e.message}. Anexe-o no histórico abaixo.`);}}
  },'Despesa e comprovante registrados. O relatório financeiro já está atualizado.');};
  const confirmar=d=>{
    const pagamento=confirmacoes[d.id]||{};
    executar(()=>api(`/despesas/${d.id}/pagar`,{method:'PUT',body:{valor:Number(pagamento.valor??d.valor),data_pagamento:pagamento.data??hoje()}}),
      'Pagamento confirmado e lançado no custo realizado.');
  };
  const apagar=d=>{if(!window.confirm(`Excluir despesa ${d.categoria} de ${moeda(d.valor)}?`))return;executar(()=>api(`/despesas/${d.id}`,{method:'DELETE'}),'Despesa excluída.');};
  const adicionar=(d,arquivo)=>{if(!arquivo)return;executar(()=>anexarComprovante(d.id,arquivo),'Comprovante anexado à despesa e disponível no relatório.');};
  const abrir=d=>executar(()=>abrirComprovante(d.id),'Comprovante aberto.');
  const filtradas=(despesas.data||[]).filter(d=>!filtro||String(d.veiculo_id)===filtro);
  const pagas=filtradas.filter(d=>d.situacao_pagamento==='Pago');
  const pendentes=filtradas.filter(d=>d.situacao_pagamento==='Pendente');
  return <>
    <div className="page-title"><div><h1>Despesas da Frota</h1><p>Controle os pagamentos, cobranças mensais e comprovantes de cada veículo.</p></div></div>
    <Notice error={error||despesas.error||veiculos.error} success={success}/>
    <section className="panel no-print"><h2>Novo lançamento pago</h2><form onSubmit={salvar}><fieldset disabled={busy}><div className="form-grid three">
      <Field label="Veículo" name="veiculo_id" value={form.veiculo_id} onChange={change} required options={[{value:'',label:'Selecione'},...(veiculos.data||[]).map(v=>({value:String(v.id),label:`${v.placa} · ${v.modelo}`}))]}/>
      <Field label="Categoria" name="categoria" value={form.categoria} onChange={change} options={categorias.map(c=>({value:c,label:c}))}/>
      <Field label="Data do pagamento" name="data" value={form.data} onChange={change} type="date" required/>
      <Field label="Valor pago (R$)" name="valor" value={form.valor} onChange={change} type="number" min="0.01" step="0.01" required/>
      {form.categoria==='Combustível' && <Field label="Quantidade de litros (opcional)" name="litros" value={form.litros} onChange={change} type="number" min="0.001" step="0.001" />}
      <Field label="Viagem relacionada (opcional)" name="viagem_id" value={form.viagem_id} onChange={change} options={[{value:'',label:'Sem vínculo'},...(viagens.data||[]).filter(v=>String(v.veiculo_id)===form.veiculo_id).map(v=>({value:String(v.id),label:`Viagem #${v.id} · ${v.destino}`}))]}/>
      <Field label="Descrição" name="descricao" value={form.descricao} onChange={change} maxLength={500}/>
      <label className="field"><span>Comprovante PDF / imagem (opcional, até 5 MB)</span><input key={arquivoKey} aria-label="Comprovante do novo lançamento" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={e=>setArquivo(e.target.files?.[0]||null)}/></label>
    </div><p className="helper">Financiamento e aluguel com vencimento cadastrado surgem automaticamente como pendentes. Confirme o pagamento no histórico abaixo para incluí-lo nos gastos efetivos.</p>
    <div className="form-end"><button className="button primary"><Icon name="plus"/> {busy?'Salvando…':'Registrar despesa'}</button></div></fieldset></form></section>
    <section className="panel"><div className="panel-heading"><h2>Controle financeiro e comprovantes</h2>
      <div className="actions no-print"><select aria-label="Filtrar despesas por veículo" value={filtro} onChange={e=>setFiltro(e.target.value)}>
        <option value="">Todos os veículos</option>{(veiculos.data||[]).map(v=><option key={v.id} value={v.id}>{v.placa}</option>)}
      </select></div></div>
      <p className="report-total">Pagamentos realizados: <strong>{moeda(pagas.reduce((s,d)=>s+Number(d.valor),0))}</strong> · Cobranças pendentes: <strong>{moeda(pendentes.reduce((s,d)=>s+Number(d.valor),0))}</strong></p>
      <Table headers={['Vencimento / data','Veículo','Categoria','Valor','Situação','Comprovante','Descrição','Ação']} rows={filtradas} empty="Nenhuma despesa registrada."
      render={d=><tr key={d.id}><td>{dia(d.data)}{d.data_pagamento && <small>Pago: {dia(d.data_pagamento)}</small>}</td><td>{d.placa}</td><td>{d.categoria}{d.gerada_automaticamente&&<small>Mensal automática</small>}</td><td>{moeda(d.valor)}</td>
      <td><Badge tone={d.situacao_pagamento==='Pago'?'green':'yellow'}>{d.situacao_pagamento}</Badge></td>
      <td className="wrap">{d.comprovante_nome?<button className="small-button" disabled={busy} onClick={()=>abrir(d)}>Ver comprovante</button>:'Sem comprovante'}
        <label className="field no-print"><span>Adicionar / substituir</span><input aria-label={`Anexar comprovante despesa ${d.id}`} type="file" disabled={busy} accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={e=>{adicionar(d,e.target.files?.[0]);e.target.value='';}}/></label></td>
      <td className="wrap">{d.descricao||'—'}</td>
      <td>{d.situacao_pagamento==='Pendente'?<div className="actions no-print" style={{flexDirection:'column',alignItems:'stretch'}}>
        <input aria-label={`Valor do pagamento ${d.id}`} type="number" step="0.01" min="0.01" disabled={busy}
          value={confirmacoes[d.id]?.valor??String(d.valor)} onChange={e=>setConfirmacoes(s=>({...s,[d.id]:{...s[d.id],valor:e.target.value}}))}/>
        <input aria-label={`Data do pagamento ${d.id}`} type="date" disabled={busy}
          value={confirmacoes[d.id]?.data??hoje()} onChange={e=>setConfirmacoes(s=>({...s,[d.id]:{...s[d.id],data:e.target.value}}))}/>
        <button className="small-button" disabled={busy||Number(confirmacoes[d.id]?.valor??d.valor)<=0} onClick={()=>confirmar(d)}>Confirmar pagamento</button></div>:
        <button className="small-button no-print" disabled={busy||d.gerada_automaticamente} onClick={()=>apagar(d)}>Excluir</button>}</td></tr>}/>
    </section>
  </>;
}
