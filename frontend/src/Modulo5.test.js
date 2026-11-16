import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Viagens from './pages/Viagens';
import Despesas from './pages/Despesas';
import Relatorios from './pages/Relatorios';
import { api, enviarComArquivo } from './services/api';
jest.mock('./services/api', () => ({api:jest.fn(),enviarComArquivo:jest.fn(),
  anexarComprovante:jest.fn(),abrirComprovante:jest.fn(),urlEventos:()=>'/despesas/eventos'}));
const carro={id:1,placa:'FRT1A23',marca:'Fiat',modelo:'Uno',status:'Disponível',quilometragem:'1000.00',
  situacao_aquisicao:'Financiado'};
class EventoMock {addEventListener(){}removeEventListener(){}close(){}}
beforeEach(()=>{
  jest.resetAllMocks();
  global.EventSource=EventoMock;
  api.mockImplementation(async p=>p.startsWith('/veiculos')?[carro]:[]);
  enviarComArquivo.mockResolvedValue({id:1});
});
test('início preenche KM automaticamente, sem estimativa de combustível',async()=>{
  render(<Viagens/>);
  await screen.findByRole('option',{name:/FRT1A23/});
  fireEvent.change(screen.getByLabelText(/Veículo \*/i),{target:{value:'1'}});
  expect(screen.getByLabelText('KM inicial *')).toHaveValue(1000);
  expect(screen.queryByText(/consumo médio/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/preço por litro/i)).not.toBeInTheDocument();
});
test('finaliza com combustível real e comprovante',async()=>{
  const viagem={id:7,veiculo_id:1,placa:'FRT1A23',motorista:'Maria',destino:'Campo Grande',km_saida:'1000',
    saida_em:'2026-10-20T13:00:00Z',chegada_em:null};
  api.mockImplementation(async p=>p==='/viagens'?[viagem]:p.startsWith('/veiculos')?[carro]:[]);
  render(<Viagens/>);
  await screen.findByLabelText('KM final FRT1A23');
  fireEvent.change(screen.getByLabelText('KM final FRT1A23'),{target:{value:'1200'}});
  fireEvent.change(screen.getByLabelText('Combustível gasto FRT1A23'),{target:{value:'140'}});
  const arquivo=new File(['%PDF-1.7'], 'recibo.pdf',{type:'application/pdf'});
  fireEvent.change(screen.getByLabelText('Comprovante viagem FRT1A23'),{target:{files:[arquivo]}});
  fireEvent.click(screen.getByRole('button',{name:'Finalizar'}));
  await waitFor(()=>expect(enviarComArquivo).toHaveBeenCalledWith('/viagens/7/finalizar',
    expect.objectContaining({km_chegada:1200,valor_combustivel:140}),arquivo,'PUT'));
});
test('painel combina filtros e soma categorias com gastos pagos',async()=>{
  const despesas=[{id:1,veiculo_id:1,placa:'FRT1A23',categoria:'Peças',valor:'90',
    situacao_pagamento:'Pago',data:'2026-10-05'},
    {id:2,veiculo_id:1,placa:'FRT1A23',categoria:'Manutenção',valor:'200',
      situacao_pagamento:'Pendente',data:'2026-10-05'}];
  api.mockImplementation(async p=>p.startsWith('/veiculos')?[carro]:p.startsWith('/despesas')?despesas:[]);
  render(<Despesas usuario={{perfil:'Administrador'}}/>);
  await screen.findByText('Painel financeiro');
  expect(screen.getByLabelText('Filtrar por veículo')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Filtrar por veículo'),{target:{value:'1'}});
  fireEvent.change(screen.getByLabelText('Filtrar por categoria'),{target:{value:'Peças'}});
  await waitFor(()=>expect(api).toHaveBeenCalledWith(expect.stringContaining('categoria=Pe%')));
  expect(screen.getByText('Total geral pago')).toBeInTheDocument();
});
test('relatório semanal consolida despesas reais sem estimativas',async()=>{
  api.mockImplementation(async p=>p.startsWith('/veiculos')?[carro]:{
    tipo:'consolidado',periodicidade:'semanal',de:'2026-10-01',ate:'2026-10-31',linhas:[{
      periodo_inicio:'2026-10-05',placa:'FRT1A23',modelo:'Uno',categoria:'Combustível',lancamentos:1,total:'140'}]
  });
  render(<Relatorios usuario={{perfil:'Administrador'}}/>);
  await screen.findByRole('option',{name:/FRT1A23/});
  fireEvent.change(screen.getByLabelText('Agrupar por'),{target:{value:'semanal'}});
  fireEvent.click(screen.getByRole('button',{name:/Gerar relatório/}));
  await screen.findByText('FRT1A23');
  expect(screen.getAllByText(/140,00/).length).toBeGreaterThan(0);
  expect(screen.queryByText(/combustível estimado/i)).not.toBeInTheDocument();
  expect(api).toHaveBeenCalledWith(expect.stringContaining('periodicidade=semanal'));
});
