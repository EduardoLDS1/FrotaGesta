import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './services/api';
import { prepararVeiculo, validarVeiculo } from './utils/validacao';
import './App.css';

const vazio = { placa: '', marca: '', modelo: '', ano: '', quilometragem: '' };
const numero = valor => Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
function Icone({ nome, ...props }) {
  const caminhos = {
    painel: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    carro: 'M5 17H3v-6l2-6h14l2 6v6h-2 M5 17h14 M5 17v3 M19 17v3 M3 11h18 M6 14h2 M16 14h2',
    mais: 'M12 5v14 M5 12h14',
    seta: 'M19 12H5 M11 6l-6 6 6 6',
    busca: 'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    rota: 'M5 20V7a4 4 0 0 1 8 0v10a3 3 0 0 0 6 0V4 M2 17l3 3 3-3',
    marca: 'M3 21V7l9-4 9 4v14H3 M8 10h1 M15 10h1 M8 14h1 M15 14h1 M10 21v-4h4v4',
  };
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={caminhos[nome] || caminhos.carro}/></svg>;
}
function Formulario({ veiculo, aoCancelar, aoSalvar }) {
  const [dados, setDados] = useState(veiculo ? Object.fromEntries(Object.keys(vazio).map(c => [c, String(veiculo[c] ?? '')])) : vazio);
  const [erros, setErros] = useState({});
  const [falha, setFalha] = useState('');
  const [salvando, setSalvando] = useState(false);
  const trava = useRef(false);
  const form = useRef();
  async function enviar(evento) {
    evento.preventDefault();
    if (trava.current) return;
    const validacao = validarVeiculo(dados);
    setErros(validacao); setFalha('');
    if (Object.keys(validacao).length) {
      form.current.elements[Object.keys(validacao)[0]].focus(); return;
    }
    trava.current = true; setSalvando(true);
    try { await api.salvar(prepararVeiculo(dados), veiculo?.id); aoSalvar(); }
    catch (erro) { setFalha(erro.message); setErros(erro.campos || {}); }
    finally { trava.current = false; setSalvando(false); }
  }
  const campos = [
    ['placa', 'Placa', 'ABC1D23', 'text'], ['marca', 'Marca', 'Ex.: Chevrolet', 'text'],
    ['modelo', 'Modelo', 'Ex.: Onix', 'text'], ['ano', 'Ano (opcional)', 'Ex.: 2022', 'number'],
    ['quilometragem', 'Quilometragem (km)', 'Ex.: 30000', 'number'],
  ];
  return <section className="form-layout">
    <form className="panel vehicle-form" onSubmit={enviar} noValidate ref={form} aria-busy={salvando}>
      <div className="panel-heading"><h2>Informações do veículo</h2><p>Preencha os dados para manter sua frota organizada.</p></div>
      {falha && <div className="notice error" role="alert">{falha}</div>}
      <div className="form-grid">{campos.map(([campo, label, placeholder, tipo]) => <div className={'field field-' + campo} key={campo}>
        <label htmlFor={campo}>{label}{campo !== 'ano' && <span aria-hidden="true"> *</span>}</label>
        <input id={campo} name={campo} type={tipo} placeholder={placeholder} value={dados[campo]} disabled={salvando}
          required={campo !== 'ano'} maxLength={campo === 'placa' ? 7 : 100}
          min={campo === 'ano' ? 1900 : campo === 'quilometragem' ? 0 : undefined}
          max={campo === 'ano' ? 2100 : campo === 'quilometragem' ? 9999999999.99 : undefined}
          step={campo === 'quilometragem' ? '0.01' : tipo === 'number' ? '1' : undefined}
          aria-invalid={!!erros[campo]} aria-describedby={erros[campo] ? `${campo}-erro` : campo === 'placa' ? 'placa-ajuda' : undefined}
          onChange={e => { const valor = campo === 'placa' ? e.target.value.toUpperCase() : e.target.value; setDados(d => ({ ...d, [campo]: valor })); setErros(v => ({ ...v, [campo]: undefined })); }} />
        {erros[campo] ? <small id={`${campo}-erro`} className="field-error">{erros[campo]}</small> : campo === 'placa' && <small id="placa-ajuda">Padrão antigo ou Mercosul, sem hífen.</small>}
      </div>)}</div>
      <div className="form-actions"><span>* Campos obrigatórios</span><button type="button" className="button secondary" onClick={aoCancelar} disabled={salvando}>Cancelar</button><button className="button primary" disabled={salvando}>{salvando ? 'Salvando…' : veiculo ? 'Salvar alterações' : 'Cadastrar veículo'}</button></div>
    </form>
    <aside className="form-tip"><span className="icon-box"><Icone nome="carro" /></span><h3>Uma frota bem cadastrada</h3><p>A placa identifica cada veículo e não pode se repetir.</p><p>Informe a quilometragem atual. Esses dados ajudam a acompanhar a utilização da frota.</p></aside>
  </section>;
}
export default function App() {
  const [pagina, setPagina] = useState('dashboard');
  const [veiculos, setVeiculos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [busca, setBusca] = useState('');
  const [marca, setMarca] = useState('');
  const [editando, setEditando] = useState(null);
  const [excluindo, setExcluindo] = useState(null);
  const sequencia = useRef(0);
  const travaExclusao = useRef(false);
  const titulo = useRef();
  const carregar = useCallback(async () => {
    const atual = ++sequencia.current;
    setCarregando(true); setErro('');
    try { const lista = await api.listar(); if (atual === sequencia.current) setVeiculos(lista); }
    catch (e) { if (atual === sequencia.current) { setErro(e.message); setVeiculos([]); } }
    finally { if (atual === sequencia.current) setCarregando(false); }
  }, []);
  useEffect(() => { const controle = sequencia; carregar(); return () => { controle.current++; }; }, [carregar]);
  useEffect(() => { titulo.current?.focus(); }, [pagina]);
  const marcas = [...new Set(veiculos.map(v => v.marca))].sort((a,b) => a.localeCompare(b));
  const filtrados = veiculos.filter(v => `${v.placa} ${v.marca} ${v.modelo}`.toLowerCase().includes(busca.toLowerCase().trim()) && (!marca || v.marca === marca));
  const totalKm = veiculos.reduce((s,v) => s + Number(v.quilometragem || 0), 0);
  function abrirFormulario(v = null) { setEditando(v); setSucesso(''); setPagina('formulario'); }
  async function excluir(v) {
    if (travaExclusao.current || !window.confirm(`Excluir o veículo ${v.placa} (${v.modelo})? Essa ação não pode ser desfeita.`)) return;
    travaExclusao.current = true; setExcluindo(v.id); setSucesso(''); setErro('');
    try { await api.excluir(v.id); setSucesso('Veículo excluído com sucesso.'); await carregar(); }
    catch(e) { setErro(e.message); }
    finally { travaExclusao.current = false; setExcluindo(null); }
  }
  function tabela(lista) { return <div className="table-scroll"><table><thead><tr><th>Veículo</th><th>Placa</th><th>Ano</th><th>Quilometragem</th><th className="align-right">Ações</th></tr></thead><tbody>{lista.map(v => <tr key={v.id}>
    <td><div className="vehicle-cell"><span className="vehicle-icon"><Icone nome="carro" /></span><span><strong>{v.modelo}</strong><small>{v.marca}</small></span></div></td>
    <td><span className="plate">{v.placa}</span></td><td>{v.ano || '—'}</td><td>{numero(v.quilometragem)} <span className="muted">km</span></td>
    <td><div className="row-actions"><button disabled={excluindo !== null} onClick={() => abrirFormulario(v)} aria-label={`Editar ${v.placa}`}>Editar</button><button className="delete" disabled={excluindo !== null} onClick={() => excluir(v)} aria-label={`Excluir ${v.placa}`}>{excluindo === v.id ? 'Excluindo…' : 'Excluir'}</button></div></td>
  </tr>)}</tbody></table></div>; }
  const dashboard = pagina === 'dashboard';
  return <div className="app-shell">
    <aside className="sidebar"><a className="brand" href="#inicio" onClick={e => { e.preventDefault(); setPagina('dashboard'); }}><span className="brand-icon"><Icone nome="carro" /></span><span>Frota<span className="brand-accent">Gesta</span></span></a><p className="brand-caption">GESTÃO DE FROTA</p>
      <div className="nav-caption">PRINCIPAL</div><nav aria-label="Menu principal">
        <button aria-current={dashboard ? 'page' : undefined} className={dashboard ? 'active' : ''} onClick={() => { setPagina('dashboard'); setSucesso(''); }}><Icone nome="painel"/>Dashboard</button>
        <button aria-current={!dashboard ? 'page' : undefined} className={!dashboard ? 'active' : ''} onClick={() => { setPagina('veiculos'); setSucesso(''); }}><Icone nome="carro"/>Veículos</button>
      </nav><div className="sidebar-footer"><span className="footer-symbol">FG</span><div>FrotaGesta<small>Controle em cada trajeto.</small></div></div>
    </aside>
    <div className="workspace"><header className="topbar"><span>Gestão de frota <span className="breadcrumb">/ {dashboard ? 'Visão geral' : 'Veículos'}</span></span><span className="module-label">Módulo de veículos</span></header>
      <main id="inicio"><div className="page-heading"><div><span className="eyebrow">{dashboard ? 'VISÃO GERAL' : 'SUA FROTA'}</span><h1 tabIndex={-1} ref={titulo}>{dashboard ? 'Dashboard' : pagina === 'formulario' ? (editando ? 'Editar veículo' : 'Novo veículo') : 'Veículos'}</h1><p>{dashboard ? 'Acompanhe os dados da sua frota em um só lugar.' : pagina === 'formulario' ? 'Mantenha as informações do seu veículo atualizadas.' : 'Consulte e gerencie os veículos cadastrados.'}</p></div>
        {pagina !== 'formulario' && <button className="button primary" onClick={() => abrirFormulario()}><Icone nome="mais"/>Novo veículo</button>}
      </div>
      {sucesso && <div className="notice success" role="status">{sucesso}<button aria-label="Fechar mensagem" onClick={() => setSucesso('')}>×</button></div>}
      {pagina === 'formulario' ? <><button className="back-button" onClick={() => setPagina('veiculos')}><Icone nome="seta"/>Voltar para veículos</button><Formulario key={editando?.id || 'novo'} veiculo={editando} aoCancelar={() => setPagina('veiculos')} aoSalvar={() => { setSucesso(editando ? 'Veículo atualizado com sucesso.' : 'Veículo cadastrado com sucesso.'); setPagina('veiculos'); carregar(); }}/></> : <>
        {erro && <div className="notice error" role="alert"><span>{erro}</span><button onClick={carregar} disabled={carregando}>Tentar novamente</button></div>}
        {dashboard && <div className="stats-grid">{[
          ['Veículos cadastrados', veiculos.length, 'Total da frota', 'carro'],
          ['Quilometragem total', numero(totalKm), 'Soma dos odômetros, em km', 'rota'],
          ['Marcas na frota', marcas.length, 'Diversidade de fabricantes', 'marca'],
        ].map(([label,valor,legenda,icone]) => <article className="stat-card" key={label}><div><span>{label}</span><span className="icon-box"><Icone nome={icone}/></span></div><strong>{carregando || erro ? '—' : valor}</strong><small>{legenda}</small></article>)}</div>}
        <section className="panel"><div className="panel-heading list-heading"><div><h2>{dashboard ? 'Últimos veículos cadastrados' : 'Lista de veículos'}</h2><p>{dashboard ? 'Acesso rápido aos cadastros mais recentes.' : 'Busque por placa, marca ou modelo.'}</p></div><button className="button secondary" disabled={carregando || excluindo !== null} onClick={carregar}>{carregando ? 'Carregando…' : 'Atualizar'}</button></div>
          {!dashboard && <div className="filters"><div className="search-input"><Icone nome="busca"/><input aria-label="Buscar veículos" placeholder="Buscar por placa, marca ou modelo…" value={busca} onChange={e => setBusca(e.target.value)} /></div><select aria-label="Filtrar por marca" value={marca} onChange={e => setMarca(e.target.value)}><option value="">Todas as marcas</option>{marcas.map(m => <option key={m}>{m}</option>)}</select></div>}
          {carregando ? <div className="empty-state" role="status"><span className="spinner"/>Carregando veículos…</div> : erro && veiculos.length === 0 ? <div className="empty-state"><h3>Dados indisponíveis</h3><p>Tente atualizar a lista após verificar a conexão.</p></div> : (dashboard ? veiculos : filtrados).length ? tabela(dashboard ? veiculos.slice(0,5) : filtrados) : <div className="empty-state"><Icone nome="carro" width="38" height="38"/><h3>{veiculos.length ? 'Nenhum resultado encontrado' : 'Sua frota começa aqui'}</h3><p>{veiculos.length ? 'Tente outra busca ou remova o filtro de marca.' : 'Cadastre seu primeiro veículo para acompanhar a frota.'}</p>{!veiculos.length && <button className="button primary" onClick={() => abrirFormulario()}>Cadastrar primeiro veículo</button>}</div>}
          {!carregando && !erro && <div className="table-footer"><span>{dashboard ? Math.min(veiculos.length,5) : filtrados.length} de {veiculos.length} veículo(s)</span>{dashboard && <button onClick={() => setPagina('veiculos')}>Ver todos os veículos →</button>}</div>}
        </section>
        {dashboard && <div className="dashboard-note"><span className="icon-box"><Icone nome="rota"/></span><div><strong>Dados que acompanham sua operação</strong><p>Cadastre e atualize os veículos para manter esta visão geral sempre em dia.</p></div></div>}
      </>}
      <footer className="main-footer">FrotaGesta <span>Gestão de frota com controle de estoque integrado</span></footer></main>
    </div>
  </div>;
}
