import { useState } from 'react';
import { api, enviarComArquivo } from '../services/api';
import { useData } from '../components/useData';
import { Field, Notice, Table, moeda, numero, horario, Badge, Icon } from '../components/UI';
const vazio={veiculo_id:'',motorista:'',destino:'',finalidade:'',km_saida:''};
export default function Viagens(){
  const veiculos=useData('/veiculos'),viagens=useData('/viagens');
  const [form,setForm]=useState(vazio),[km,setKm]=useState({}),[valores,setValores]=useState({}),
    [arquivos,setArquivos]=useState({}),[busy,setBusy]=useState(false),
    [error,setError]=useState(''),[success,setSuccess]=useState('');
  const change=(k,v)=>setForm(s=>({...s,[k]:v}));
  const selecionado=(veiculos.data||[]).find(v=>String(v.id)===form.veiculo_id);
  function selecionar(chave){
    const v=(veiculos.data||[]).find(v=>String(v.id)===chave);
    setForm(s=>({...s,veiculo_id:chave,km_saida:v?String(v.quilometragem):''}));
  }
  async function executar(acao,mensagem){
    if(busy)return;
    setBusy(true);setError('');setSuccess('');
    try{await acao();await Promise.all([viagens.reload(),veiculos.reload()]);setSuccess(mensagem);}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  function iniciar(e){e.preventDefault();executar(async()=>{
    await api('/viagens',{method:'POST',body:{...form,veiculo_id:Number(form.veiculo_id),km_saida:Number(form.km_saida)}});
    setForm(vazio);
  },'Viagem iniciada.');}
  function finalizar(v){executar(async()=>{
    const valor=Number(valores[v.id]);
    await enviarComArquivo(`/viagens/${v.id}/finalizar`,{
      km_chegada:Number(km[v.id]),valor_combustivel:valor,observacoes:''
    },arquivos[v.id]||null,'PUT');
    setKm(s=>({...s,[v.id]:''}));setValores(s=>({...s,[v.id]:''}));
    setArquivos(s=>({...s,[v.id]:null}));
  },'Viagem finalizada. O gasto real de combustível foi lançado nas despesas.');}
  const abertas=(viagens.data||[]).filter(v=>!v.chegada_em);
  return <>
    <div className="page-title"><div><h1>Controle de viagens</h1><p>Registre a saída pelo odômetro. No retorno, informe somente os quilômetros finais e o valor realmente gasto.</p></div></div>
    <Notice error={error||viagens.error||veiculos.error} success={success}/>
    <section className="panel no-print"><h2>Iniciar viagem</h2>
      <form onSubmit={iniciar}><fieldset disabled={busy}><div className="form-grid three">
        <Field label="Veículo" name="veiculo_id" value={form.veiculo_id} onChange={(_,v)=>selecionar(v)} required
          options={[{value:'',label:'Selecione'},...(veiculos.data||[]).map(v=>({value:String(v.id),label:`${v.placa} · ${v.modelo} (${v.status})`}))]}/>
        <Field label="Motorista / responsável" name="motorista" value={form.motorista} onChange={change} maxLength={120}/>
        <Field label="Destino" name="destino" value={form.destino} onChange={change} maxLength={180}/>
        <Field label="Finalidade" name="finalidade" value={form.finalidade} onChange={change} maxLength={300}/>
        <Field label="KM inicial" name="km_saida" value={form.km_saida} onChange={change} type="number"
          min={selecionado?Number(selecionado.quilometragem):0} step="0.01" required/>
      </div><p className="helper">KM inicial preenchido com o último odômetro do veículo. O servidor confere a última viagem encerrada para impedir retrocessos.</p>
      <div className="form-end"><button className="button primary"><Icon name="plus"/> Iniciar viagem</button></div></fieldset></form>
    </section>
    <section className="panel"><h2>Viagens em andamento ({abertas.length})</h2>
      <Table headers={['Veículo','Motorista / destino','KM inicial','KM final','Combustível gasto (R$)','Comprovante','Ação']}
        rows={abertas} empty="Nenhuma viagem em andamento." render={v=><tr key={v.id}>
          <td><strong>{v.placa}</strong></td><td>{v.motorista}<small>{v.destino}</small></td>
          <td>{numero(v.km_saida)} km</td>
          <td><input aria-label={`KM final ${v.placa}`} type="number" min={Number(v.km_saida)} step="0.01"
            value={km[v.id]??''} onChange={e=>setKm(s=>({...s,[v.id]:e.target.value}))}/></td>
          <td><input aria-label={`Combustível gasto ${v.placa}`} type="number" min="0" step="0.01"
            value={valores[v.id]??''} onChange={e=>setValores(s=>({...s,[v.id]:e.target.value}))}/></td>
          <td><input aria-label={`Comprovante viagem ${v.placa}`} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={e=>setArquivos(s=>({...s,[v.id]:e.target.files?.[0]||null}))}/></td>
          <td><button className="small-button" disabled={busy||!km[v.id]||valores[v.id]==null||valores[v.id]===''||
              Number(km[v.id])<Number(v.km_saida)||Number(valores[v.id])<0||
              (Number(valores[v.id])>0&&!arquivos[v.id])} onClick={()=>finalizar(v)}>Finalizar</button></td>
        </tr>}/>
    </section>
    <section className="panel"><h2>Histórico das viagens</h2>
      <Table headers={['Placa','Motorista / destino','Saída','Retorno','KM inicial','KM final','Distância','Combustível real','Situação']}
        rows={viagens.data||[]} empty="Nenhuma viagem registrada." render={v=><tr key={v.id}>
          <td>{v.placa}</td><td>{v.motorista}<small>{v.destino}</small></td>
          <td>{horario(v.saida_em)}</td><td>{v.chegada_em?horario(v.chegada_em):'—'}</td>
          <td>{numero(v.km_saida)}</td><td>{v.km_chegada==null?'—':numero(v.km_chegada)}</td>
          <td>{v.km_percorridos==null?'—':`${numero(v.km_percorridos)} km`}</td>
          <td>{v.valor_combustivel==null?'Não registrado':moeda(v.valor_combustivel)}</td>
          <td><Badge tone={v.chegada_em?'green':'yellow'}>{v.chegada_em?'Concluída':'Em andamento'}</Badge></td>
        </tr>}/>
    </section>
  </>;
}
