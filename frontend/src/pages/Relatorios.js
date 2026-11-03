import { useState } from 'react';
import { api, abrirComprovante } from '../services/api';
import { useData } from '../components/useData';
import { Field, Notice, Table, moeda, numero, dia, horario, Icon } from '../components/UI';
function exportar(headers,rows){
  const celula=v=>{let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  const csv='\uFEFF'+[headers,...rows].map(r=>r.map(celula).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  const a=document.createElement('a');a.href=url;a.download='frotagesta-relatorio.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const hoje=()=>new Date().toLocaleDateString('sv-SE');
export default function Relatorios(){
  const veiculos=useData('/veiculos');
  const [form,setForm]=useState({tipo:'frota',de:hoje().slice(0,4)+'-01-01',ate:hoje(),veiculo_id:''}),
    [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const change=(k,v)=>{setForm(s=>({...s,[k]:v}));setData(null);};
  async function gerar(e){e.preventDefault();if(busy)return;setBusy(true);setError('');setData(null);
    try{setData(await api('/relatorios?'+new URLSearchParams(form)));}catch(e){setError(e.message);}finally{setBusy(false);}}
  const tipo=data?.tipo||'',itens=data?.linhas||[];
  let headers=[],linhas=[];
  if(tipo==='custos'){
    headers=['Data','Placa','Tipo','Serviço','Custo','Status'];
    linhas=(data.detalhes||[]).map(m=>[dia(m.data),m.placa,m.tipo,m.servico,moeda(m.custo),m.status]);
  }else if(tipo==='estoque'){
    headers=['Item','Modelo','Quantidade','Mínimo','Valor unitário','Valor total'];
    linhas=itens.map(p=>[p.nome,p.modelo,p.quantidade,p.estoque_minimo,moeda(p.valor_unitario),moeda(p.valor_total)]);
  }else if(tipo==='movimentacoes'){
    headers=['Data/Hora','Tipo','Produto','Modelo','Quantidade','Saldo','Motivo','Usuário'];
    linhas=itens.map(m=>[horario(m.created_at),m.tipo,m.nome,m.modelo,m.quantidade,m.saldo_posterior,m.motivo,m.usuario]);
  }else if(tipo==='frota'){
    headers=['Placa','Modelo','Aquisição','Compra registrada','Km percorridos','Manutenções','Combustível pago','Financiamento pago','Aluguel pago','Outras despesas','Financiamento pendente','Aluguel pendente','Compra / Entrada no período','Total realizado','Total pendente','Custo/km','Combustível estimado','Saldo futuro estimado'];
    linhas=itens.map(v=>[v.placa,`${v.marca} ${v.modelo}`,v.situacao_aquisicao,moeda(v.valor_compra),`${numero(v.km_percorridos)} km`,moeda(v.manutencoes),moeda(v.combustivel),moeda(v.financiamento),moeda(v.aluguel),moeda(v.outras_despesas),moeda(v.financiamento_pendente),moeda(v.aluguel_pendente),moeda(v.investimento_inicial),moeda(v.custo_total),moeda(v.custo_previsto),v.custo_por_km==null?'—':`${moeda(v.custo_por_km)}/km`,moeda(v.combustivel_estimado),moeda(v.saldo_financiamento_previsto)]);
  }else if(tipo==='viagens'){
    headers=['Saída','Retorno','Placa','Motorista','Destino','Finalidade','Km início','Km fim','Distância','Média km/l','Preço por litro','Combustível estimado'];
    linhas=itens.map(t=>[horario(t.saida_em),horario(t.chegada_em),t.placa,t.motorista,t.destino,t.finalidade,numero(t.km_saida),numero(t.km_chegada),`${numero(t.km_percorridos)} km`,t.consumo_medio??'—',t.preco_litro==null?'—':moeda(t.preco_litro),t.custo_estimado==null?'Sem estimativa':moeda(t.custo_estimado)]);
  }else if(tipo==='despesas'||tipo==='contratos'){
    headers=['Vencimento','Pagamento','Placa','Modelo','Categoria','Valor','Status','Litros','Viagem','Descrição','Comprovante','Arquivo','Link do comprovante'];
    linhas=itens.map(d=>[dia(d.vencimento),dia(d.data_pagamento),d.placa,d.modelo,d.categoria,moeda(d.valor),d.situacao_pagamento,d.litros??'—',d.viagem_id||'—',d.descricao,d.tem_comprovante?'Sim':'Não',d.comprovante_nome||'—',d.tem_comprovante?`${window.location.origin}/despesas/${d.id}/comprovante`:'']);
  }
  const somar=(campo)=>itens.reduce((s,r)=>s+Number(r[campo]||0),0);
  const max=Math.max(1,...itens.map(v=>Number(v.total)||0));
  const totalGeral=tipo==='frota'?somar('custo_total'):['despesas','contratos'].includes(tipo)?itens.filter(v=>v.situacao_pagamento==='Pago').reduce((s,v)=>s+Number(v.valor),0):
    tipo==='estoque'?somar('valor_total'):tipo==='custos'?somar('total'):null;
  return <>
    <div className="page-title"><div><h1>Central de Relatórios Gerenciais</h1><p>Analise os custos reais da frota e as estimativas de viagens sem somar gastos duas vezes.</p></div></div>
    <Notice error={error}/>
    <section className="panel no-print"><form onSubmit={gerar}><fieldset disabled={busy}><div className="report-filters">
      <Field label="Tipo de relatório" name="tipo" value={form.tipo} onChange={change}
        options={[{value:'frota',label:'Custos completos por veículo'},{value:'viagens',label:'Viagens e estimativas de combustível'},
          {value:'despesas',label:'Despesas e comprovantes'},{value:'contratos',label:'Financiamentos e locações'},{value:'custos',label:'Custos de manutenção por período'},
          {value:'estoque',label:'Inventário atual de peças'},{value:'movimentacoes',label:'Movimentações do estoque'}]}/>
      {form.tipo!=='estoque'&&<>
        <Field label="De:" name="de" value={form.de} onChange={change} type="date" min="1900-01-01" max={form.ate} required/>
        <Field label="Até:" name="ate" value={form.ate} onChange={change} type="date" min={form.de} max="2100-12-31" required/>
      </>}
      {!['estoque','movimentacoes'].includes(form.tipo)&&<Field label="Veículo no relatório" name="veiculo_id" value={form.veiculo_id} onChange={change}
        options={[{value:'',label:'Todos os veículos'},...(veiculos.data||[]).map(v=>({value:String(v.id),label:`${v.placa} · ${v.modelo}`}))]}/>}
      <button className="button blue"><Icon name="chart"/>{busy?'Gerando…':'Gerar relatório'}</button>
    </div></fieldset></form></section>
    <section className="panel report"><div className="panel-heading"><h2>Pré-visualização do relatório</h2>
      {data&&<div className="actions no-print"><button className="button secondary" onClick={()=>exportar(headers,linhas)}>Exportar CSV</button>
        <button className="button secondary" onClick={()=>window.print()}>Imprimir / PDF</button></div>}
    </div>
    {!data?<p className="empty">Selecione o tipo e clique em Gerar relatório.</p>:<>
      <p className="report-period">{tipo==='estoque'?'Inventário atual do estoque':`${dia(data.de)} a ${dia(data.ate)}`} · {form.veiculo_id && !['estoque','movimentacoes'].includes(tipo) ? `Veículo: ${(veiculos.data||[]).find(v=>String(v.id)===form.veiculo_id)?.placa||form.veiculo_id}`:'Toda a frota'}</p>
      {tipo==='custos'&&<><h3 className="chart-title">Custos de manutenção (R$)</h3>
        {itens.length?<div className="chart" aria-label="Gráfico de custos mensais">{itens.map(m=><div className="chart-column" key={m.mes}>
          <strong>{moeda(m.total)}</strong><div className="chart-bar" style={{height:`${Math.max(2,Number(m.total)/max*190)}px`}}/><span>{m.mes.split('-').reverse().join('/')}</span>
        </div>)}</div>:<p className="empty">Nenhuma manutenção no período.</p>}</>}
      {tipo==='frota'&&<>
        <div className="financial-summary">
          <div><span>Total realizado</span><strong>{moeda(somar('custo_total'))}</strong></div>
          <div><span>Distância concluída</span><strong>{numero(somar('km_percorridos'))} km</strong></div>
          <div><span>Combustível pago</span><strong>{moeda(somar('combustivel'))}</strong></div>
          <div><span>Combustível estimado</span><strong>{moeda(somar('combustivel_estimado'))}</strong></div>
          <div><span>Financiamento pago</span><strong>{moeda(somar('financiamento'))}</strong></div>
          <div><span>Aluguel pago</span><strong>{moeda(somar('aluguel'))}</strong></div>
          <div><span>Mensalidades pendentes</span><strong>{moeda(somar('custo_previsto'))}</strong></div>
        </div>
        <p className="helper">{data.observacao} O saldo futuro do financiamento não é incluído no total realizado. O custo/km divide os gastos do período pelos quilômetros das viagens concluídas no mesmo período; não é o consumo médio do veículo.</p>
      </>}
      {tipo==='viagens'&&<p className="report-total">Quilometragem concluída: <strong>{numero(somar('km_percorridos'))} km</strong> · Combustível estimado: <strong>{moeda(somar('custo_estimado'))}</strong></p>}
      {totalGeral!==null&&<p className="report-total">{tipo==='estoque'?'Valor total do estoque':'Total no período'}: <strong>{moeda(totalGeral)}</strong></p>}
      {['despesas','contratos'].includes(tipo)&&<p className="helper">Pagamentos realizados: {moeda(itens.filter(v=>v.situacao_pagamento==='Pago').reduce((s,v)=>s+Number(v.valor),0))}. Pendentes: {moeda(itens.filter(v=>v.situacao_pagamento==='Pendente').reduce((s,v)=>s+Number(v.valor),0))}. Comprovantes podem ser abertos na coluna ao lado; o CSV inclui a indicação e o endereço do documento autenticado.</p>}
      <Table headers={headers} rows={linhas} empty="Nenhum registro encontrado." render={(r,i)=><tr key={i}>{r.map((v,j)=><td key={j} className="wrap">{['despesas','contratos'].includes(tipo)&&j===10&&itens[i]?.tem_comprovante?
        <button className="small-button" onClick={async()=>{try{await abrirComprovante(itens[i].id);}catch(e){setError(e.message);}}}>Ver comprovante</button>:v}</td>)}</tr>}/>
    </>}
    </section>
  </>;
}
