import { useState } from 'react';
import { api, abrirComprovante } from '../services/api';
import { useData } from '../components/useData';
import { Field, Notice, Table, moeda, numero, dia, horario, Icon } from '../components/UI';
const hoje=()=>new Date().toLocaleDateString('sv-SE');
function exportar(headers,rows){
  const campo=v=>{let texto=String(v??'');if(/^[=+\-@\t\r]/.test(texto))texto="'"+texto;return '"'+texto.replace(/"/g,'""')+'"';};
  const csv='\uFEFF'+[headers,...rows].map(r=>r.map(campo).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  const a=document.createElement('a');a.href=url;a.download='frotagesta-relatorio.csv';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function Relatorios({usuario}){
  const veiculos=useData('/veiculos?historico=1');
  const [form,setForm]=useState({tipo:'consolidado',periodicidade:'mensal',de:hoje().slice(0,4)+'-01-01',ate:hoje(),veiculo_id:''}),
    [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const change=(k,v)=>{setForm(s=>({...s,[k]:v}));setData(null);};
  async function gerar(e){e.preventDefault();if(busy)return;setBusy(true);setError('');setData(null);
    try{setData(await api('/relatorios?'+new URLSearchParams(form)));}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  const tipo=data?.tipo||'',itens=data?.linhas||[];
  let headers=[],linhas=[];
  if(tipo==='consolidado'){
    headers=['Início do período','Veículo','Modelo','Categoria','Quantidade de gastos','Total pago'];
    linhas=itens.map(d=>[dia(d.periodo_inicio),d.placa,d.modelo,d.categoria,d.lancamentos,moeda(d.total)]);
  }else if(tipo==='custos'){
    headers=['Data','Placa','Tipo','Serviço','Custo operacional registrado','Status'];
    linhas=(data.detalhes||[]).map(m=>[dia(m.data),m.placa,m.tipo,m.servico,moeda(m.custo),m.status]);
  }else if(tipo==='estoque'){
    headers=['Item','Modelo','Quantidade','Mínimo','Valor unitário','Valor total'];
    linhas=itens.map(p=>[p.nome,p.modelo,p.quantidade,p.estoque_minimo,moeda(p.valor_unitario),moeda(p.valor_total)]);
  }else if(tipo==='movimentacoes'){
    headers=['Data/Hora','Tipo','Produto','Modelo','Quantidade','Saldo','Motivo','Usuário'];
    linhas=itens.map(m=>[horario(m.created_at),m.tipo,m.nome,m.modelo,m.quantidade,m.saldo_posterior,m.motivo,m.usuario]);
  }else if(tipo==='frota'){
    headers=['Placa','Modelo','Aquisição','KM no período','Combustível','Manutenção paga','Peças pagas','Financiamento pago','Aluguel pago','Outras despesas pagas','Total pago','Mensalidades pendentes','Custo pago/km','Custo de manutenção registrado (informativo)','Aquisição declarada (informativo)'];
    linhas=itens.map(v=>[v.placa,`${v.marca} ${v.modelo}`,v.situacao_aquisicao,numero(v.km_percorridos),
      moeda(v.combustivel),moeda(v.manutencao_despesas),moeda(v.pecas),moeda(v.financiamento),moeda(v.aluguel),
      moeda(v.outras_despesas),moeda(v.custo_total),moeda(v.custo_previsto),
      v.custo_por_km==null?'—':`${moeda(v.custo_por_km)}/km`,moeda(v.manutencoes),moeda(v.investimento_inicial)]);
  }else if(tipo==='viagens'){
    headers=['Saída','Retorno','Placa','Motorista','Destino','KM inicial','KM final','Distância','Combustível pago na viagem'];
    linhas=itens.map(v=>[horario(v.saida_em),horario(v.chegada_em),v.placa,v.motorista,v.destino,
      numero(v.km_saida),numero(v.km_chegada),`${numero(v.km_percorridos)} km`,
      v.valor_combustivel==null?'Não registrado':moeda(v.valor_combustivel)]);
  }else if(tipo==='despesas'||tipo==='contratos'){
    headers=['Vencimento','Pagamento','Placa','Modelo','Categoria','Valor','Status','Litros','Viagem','Descrição','Comprovante'];
    linhas=itens.map(d=>[dia(d.vencimento),dia(d.data_pagamento),d.placa,d.modelo,d.categoria,moeda(d.valor),
      d.situacao_pagamento,d.litros??'—',d.viagem_id||'—',d.descricao,
      usuario?.perfil==='Administrador'?(d.tem_comprovante?'Disponível':'Ausente'):'Restrito ao administrador']);
  }
  const somar=campo=>itens.reduce((n,r)=>n+Number(r[campo]||0),0);
  const totalGeral=tipo==='consolidado'?somar('total'):tipo==='frota'?somar('custo_total'):
    ['despesas','contratos'].includes(tipo)?itens.filter(v=>v.situacao_pagamento==='Pago').reduce((s,v)=>s+Number(v.valor),0):
    tipo==='estoque'?somar('valor_total'):tipo==='custos'?somar('total'):null;
  return <>
    <div className="page-title"><div><h1>Relatórios financeiros</h1><p>Gastos reais por semana, mês ou ano, separados por veículo e categoria.</p></div></div>
    <Notice error={error}/>
    <section className="panel no-print"><form onSubmit={gerar}><fieldset disabled={busy}><div className="report-filters">
      <Field label="Tipo de relatório" name="tipo" value={form.tipo} onChange={change}
        options={[{value:'consolidado',label:'Consolidado por período e categoria'},
          {value:'frota',label:'Custos pagos por veículo'},{value:'despesas',label:'Despesas e comprovantes'},
          {value:'contratos',label:'Financiamentos e locações'},{value:'viagens',label:'Histórico de viagens'},
          {value:'custos',label:'Histórico operacional de manutenções'},
          {value:'estoque',label:'Inventário do estoque'},{value:'movimentacoes',label:'Movimentações do estoque'}]}/>
      {form.tipo==='consolidado'&&<Field label="Agrupar por" name="periodicidade" value={form.periodicidade} onChange={change}
        options={[{value:'semanal',label:'Semanal'},{value:'mensal',label:'Mensal'},{value:'anual',label:'Anual'}]}/>}
      {form.tipo!=='estoque'&&<>
        <Field label="Data inicial" name="de" type="date" value={form.de} onChange={change} max={form.ate} required/>
        <Field label="Data final" name="ate" type="date" value={form.ate} onChange={change} min={form.de} required/>
      </>}
      {!['estoque','movimentacoes'].includes(form.tipo)&&<Field label="Veículo" name="veiculo_id" value={form.veiculo_id} onChange={change}
        options={[{value:'',label:'Todos os veículos'},...(veiculos.data||[]).map(v=>({value:String(v.id),label:`${v.placa} · ${v.modelo}${v.excluido?' (arquivado)':''}`}))]}/>}
      <button className="button blue"><Icon name="chart"/>{busy?'Gerando…':'Gerar relatório'}</button>
    </div></fieldset></form></section>
    <section className="panel report"><div className="panel-heading"><h2>Pré-visualização</h2>
      {data&&<div className="actions no-print"><button className="button secondary" onClick={()=>exportar(headers,linhas)}>Exportar CSV</button>
        <button className="button secondary" onClick={()=>window.print()}>Imprimir / salvar PDF</button></div>}
    </div>
    {!data?<p className="empty">Escolha o tipo e clique em Gerar relatório.</p>:<>
      <p className="report-period">{tipo==='estoque'?'Inventário atual':`${dia(data.de)} a ${dia(data.ate)}`}
        {' · '}{form.veiculo_id?`Veículo ${(veiculos.data||[]).find(v=>String(v.id)===form.veiculo_id)?.placa||form.veiculo_id}`:'Todos os veículos'}</p>
      {tipo==='frota'&&<div className="financial-summary">
        <div><span>Total pago</span><strong>{moeda(somar('custo_total'))}</strong></div>
        <div><span>Combustível</span><strong>{moeda(somar('combustivel'))}</strong></div>
        <div><span>Manutenção paga</span><strong>{moeda(somar('manutencao_despesas'))}</strong></div>
        <div><span>Peças</span><strong>{moeda(somar('pecas'))}</strong></div>
        <div><span>Financiamento</span><strong>{moeda(somar('financiamento'))}</strong></div>
        <div><span>Locação</span><strong>{moeda(somar('aluguel'))}</strong></div>
        <div><span>Pendente</span><strong>{moeda(somar('custo_previsto'))}</strong></div>
      </div>}
      {totalGeral!==null&&<p className="report-total">{tipo==='estoque'?'Valor em estoque':'Total no período'}:
        <strong> {moeda(totalGeral)}</strong></p>}
      {data.observacao&&<p className="helper">{data.observacao}</p>}
      {tipo==='consolidado'&&<p className="helper">Somente despesas pagas entram no consolidado. A divisão semanal começa na segunda-feira.</p>}
      <Table headers={headers} rows={linhas} empty="Nenhum registro encontrado." render={(r,i)=><tr key={i}>
        {r.map((v,j)=><td key={j} className="wrap">{['despesas','contratos'].includes(tipo)&&j===10&&itens[i]?.tem_comprovante&&usuario?.perfil==='Administrador'?
          <button className="small-button" onClick={async()=>{try{await abrirComprovante(itens[i].id);}catch(e){setError(e.message);}}}>Ver comprovante</button>:v}</td>)}
      </tr>}/>
    </>}
    </section>
  </>;
}
