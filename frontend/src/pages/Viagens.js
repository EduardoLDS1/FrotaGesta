import { useState } from 'react';
import { api } from '../services/api';
import { useData } from '../components/useData';
import { Field, Notice, Table, moeda, numero, horario, Badge, Icon } from '../components/UI';
const vazio = {veiculo_id:'',motorista:'',destino:'',finalidade:'',km_saida:''};
export default function Viagens() {
  const veiculos=useData('/veiculos'), viagens=useData('/viagens');
  const [form,setForm]=useState(vazio),[km,setKm]=useState({}),[notas,setNotas]=useState({}),[medias,setMedias]=useState({}),[precos,setPrecos]=useState({});
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
  const change=(k,v)=>setForm(s=>({...s,[k]:v}));
  const selecionado=(veiculos.data||[]).find(v=>String(v.id)===form.veiculo_id);
  function selecionar(id) {
    const v=(veiculos.data||[]).find(v=>String(v.id)===id);
    setForm(s=>({...s,veiculo_id:id,km_saida:v ? String(v.quilometragem) : ''}));
  }
  async function executar(acao,sucesso) {
    if(busy)return;
    setBusy(true);setError('');setSuccess('');
    try {await acao();setSuccess(sucesso);await Promise.all([viagens.reload(),veiculos.reload()]);}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  const iniciar=(e)=>{e.preventDefault(); executar(async()=>{
    await api('/viagens',{method:'POST',body:{...form,veiculo_id:Number(form.veiculo_id),km_saida:Number(form.km_saida)}});
    setForm(vazio);
  },'Viagem iniciada e odômetro atualizado.');};
  const finalizar=(v)=>executar(async()=>{
    await api(`/viagens/${v.id}/finalizar`,{method:'PUT',body:{km_chegada:Number(km[v.id]),observacoes:notas[v.id]||'',consumo_medio:medias[v.id]==null||medias[v.id]===''?null:Number(medias[v.id]),preco_litro:precos[v.id]==null||precos[v.id]===''?null:Number(precos[v.id])}});
    setKm(s=>({...s,[v.id]:''}));setMedias(s=>({...s,[v.id]:''}));setPrecos(s=>({...s,[v.id]:''}));
  },'Retorno registrado. Distância e estimativa calculadas.');
  const abertas=(viagens.data||[]).filter(v=>!v.chegada_em);
  return <>
    <div className="page-title"><div><h1>Controle de Viagens</h1><p>Registre cada saída e retorno da empresa, com controle de odômetro; informe consumo e preço do combustível somente no retorno.</p></div></div>
    <Notice error={error||viagens.error||veiculos.error} success={success}/>
    <section className="panel no-print"><h2>Iniciar viagem / saída</h2>
      <form onSubmit={iniciar}><fieldset disabled={busy}><div className="form-grid three">
        <Field label="Veículo" name="veiculo_id" value={form.veiculo_id} onChange={(_,v)=>selecionar(v)} required
          options={[{value:'',label:'Selecione o veículo'},...(veiculos.data||[]).map(v=>({value:String(v.id),label:`${v.placa} · ${v.modelo} (${v.status})`}))]}/>
        <Field label="Motorista / responsável" name="motorista" value={form.motorista} onChange={change} required maxLength={120}/>
        <Field label="Destino" name="destino" value={form.destino} onChange={change} required maxLength={180}/>
        <Field label="Finalidade" name="finalidade" value={form.finalidade} onChange={change} maxLength={300}/>
        <Field label="Quilometragem de saída" name="km_saida" value={form.km_saida} onChange={change} type="number" min={selecionado ? Number(selecionado.quilometragem) : 0} step="0.01" required/>
      </div><p className="helper">Na saída, preencha apenas os dados da viagem. A média km/l e o preço real de referência são preenchidos na finalização.</p>
      <div className="form-end"><button className="button primary"><Icon name="plus"/> {busy?'Salvando…':'Iniciar viagem'}</button></div></fieldset></form>
    </section>
    <section className="panel"><h2>Viagens em andamento ({abertas.length})</h2>
      <Table headers={['Placa','Motorista','Destino','Saída','Odômetro início','Odômetro retorno (km)','Média km/l','Preço R$/litro','Observação','Ação']} rows={abertas}
      empty="Nenhum veículo em viagem." render={v=><tr key={v.id}>
        <td><strong>{v.placa}</strong></td><td>{v.motorista}</td><td className="wrap">{v.destino}</td><td>{horario(v.saida_em)}</td>
        <td>{numero(v.km_saida)} km</td><td><input aria-label={`Odômetro retorno ${v.placa}`} type="number" min={Number(v.km_saida)} step="0.01" placeholder="Km atual" value={km[v.id]??''} onChange={e=>setKm(s=>({...s,[v.id]:e.target.value}))}/></td>
        <td><input aria-label={`Média km/l ${v.placa}`} type="number" min="0.001" step="0.001" placeholder="Ex.: 12.5" value={medias[v.id]??''} onChange={e=>setMedias(s=>({...s,[v.id]:e.target.value}))}/></td>
        <td><input aria-label={`Preço por litro ${v.placa}`} type="number" min="0.01" step="0.01" placeholder="Ex.: 6.00" value={precos[v.id]??''} onChange={e=>setPrecos(s=>({...s,[v.id]:e.target.value}))}/></td>
        <td><input aria-label={`Observação ${v.placa}`} maxLength={500} placeholder="Opcional" value={notas[v.id]??''} onChange={e=>setNotas(s=>({...s,[v.id]:e.target.value}))}/></td>
        <td><button className="small-button" disabled={busy||!km[v.id]||Number(km[v.id])<Number(v.km_saida)||((veiculos.data||[]).find(c=>c.id===v.veiculo_id)?.combustivel!=='Elétrico'&&(!medias[v.id]||!precos[v.id]))} onClick={()=>finalizar(v)}>Finalizar</button></td>
      </tr>}/>
    </section>
    <section className="panel"><h2>Histórico de viagens (últimas 500)</h2>
      <Table headers={['Veículo','Motorista / Destino','Saída','Retorno','Distância','Média km/l','R$/litro','Combustível estimado','Situação']}
      rows={viagens.data||[]} empty="Nenhuma viagem registrada."
      render={v=><tr key={v.id}><td>{v.placa}</td><td className="wrap">{v.motorista}<small>{v.destino}</small></td>
        <td>{horario(v.saida_em)}</td><td>{v.chegada_em?horario(v.chegada_em):'—'}</td>
        <td>{v.km_percorridos == null?'—':`${numero(v.km_percorridos)} km`}</td>
        <td>{v.consumo_medio??'—'}</td><td>{v.preco_litro==null?'—':moeda(v.preco_litro)}</td>
        <td>{v.custo_estimado == null?'Sem média/preço':moeda(v.custo_estimado)}</td>
        <td><Badge tone={v.chegada_em?'green':'yellow'}>{v.chegada_em?'Concluída':'Em andamento'}</Badge></td></tr>}/>
    </section>
  </>;
}
