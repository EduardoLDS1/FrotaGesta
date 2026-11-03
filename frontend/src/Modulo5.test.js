import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Viagens from './pages/Viagens';
import Despesas from './pages/Despesas';
import Relatorios from './pages/Relatorios';
import { api } from './services/api';
jest.mock('./services/api', () => ({api:jest.fn(),anexarComprovante:jest.fn(),abrirComprovante:jest.fn()}));
const veiculo={id:1,placa:'FRT1A23',marca:'Fiat',modelo:'Uno',status:'Disponível',quilometragem:'1000.00',situacao_aquisicao:'Financiado'};
beforeEach(()=>jest.resetAllMocks());
test('Saída da viagem pede odômetro, não pede média ou preço',async()=>{
  api.mockImplementation(async p=>p==='/veiculos'?[veiculo]:[]);
  render(<Viagens/>);
  await screen.findByRole('option',{name:/FRT1A23/});
  fireEvent.change(screen.getByLabelText(/Veículo \*/i),{target:{value:'1'}});
  expect(screen.getByLabelText('Quilometragem de saída *')).toHaveValue(1000);
  expect(screen.queryByText('Preço estimado por litro (R$)')).not.toBeInTheDocument();
});
test('Finalização exige quilometragem, km/l e preço por litro',async()=>{
  const viagem={id:7,veiculo_id:1,placa:'FRT1A23',motorista:'Maria',destino:'Campo Grande',km_saida:'1000',saida_em:'2026-10-20T13:00:00Z',chegada_em:null};
  api.mockImplementation(async p=>p==='/veiculos'?[veiculo]:p==='/viagens'?[viagem]:[]);
  render(<Viagens/>);
  await screen.findByLabelText('Odômetro retorno FRT1A23');
  fireEvent.change(screen.getByLabelText('Odômetro retorno FRT1A23'),{target:{value:'1200'}});
  fireEvent.change(screen.getByLabelText('Média km/l FRT1A23'),{target:{value:'10'}});
  fireEvent.change(screen.getByLabelText('Preço por litro FRT1A23'),{target:{value:'6'}});
  fireEvent.click(screen.getByRole('button',{name:'Finalizar'}));
  await waitFor(()=>expect(api).toHaveBeenCalledWith('/viagens/7/finalizar',expect.objectContaining({
    method:'PUT',body:expect.objectContaining({km_chegada:1200,consumo_medio:10,preco_litro:6})
  })));
});
test('Despesas permite lançar combustível pago com litros',async()=>{
  api.mockImplementation(async p=>p==='/veiculos'?[veiculo]:[]);
  render(<Despesas/>);
  await screen.findAllByRole('option',{name:/FRT1A23/});
  fireEvent.change(screen.getByLabelText('Veículo *'),{target:{value:'1'}});
  fireEvent.change(screen.getByLabelText(/Valor pago/),{target:{value:'110'}});
  fireEvent.change(screen.getByLabelText(/Quantidade de litros/),{target:{value:'20'}});
  fireEvent.click(screen.getByRole('button',{name:/Registrar despesa/}));
  await waitFor(()=>expect(api).toHaveBeenCalledWith('/despesas',expect.objectContaining({method:'POST',body:expect.objectContaining({valor:110,litros:20,veiculo_id:1})})));
});
test('Relatório consolidado exibe financiamento e aluguel separados',async()=>{
  api.mockImplementation(async p=>p==='/veiculos'?[veiculo]:{
    tipo:'frota',de:'2026-10-01',ate:'2026-10-20',observacao:'Estimativa separada.',linhas:[{
      placa:'FRT1A23',marca:'Fiat',modelo:'Uno',situacao_aquisicao:'Financiado',valor_compra:'30000',km_percorridos:'200',manutencoes:'0',combustivel:'110',financiamento:'800',aluguel:'0',financiamento_pendente:'500',aluguel_pendente:'0',outras_despesas:'0',investimento_inicial:'5000',custo_total:'5910',custo_por_km:'29.55',combustivel_estimado:'120',saldo_financiamento_previsto:'26400'
    }]});
  render(<Relatorios/>);
  await screen.findByRole('option',{name:/FRT1A23/});
  fireEvent.change(screen.getByLabelText('Veículo no relatório'),{target:{value:'1'}});
  fireEvent.click(screen.getByRole('button',{name:/Gerar relatório/}));
  expect(await screen.findByText('FRT1A23')).toBeInTheDocument();
  expect(screen.getByText(/Estimativa separada\./)).toBeInTheDocument();
  expect(screen.getAllByText(/5\.910,00/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/120,00/).length).toBeGreaterThan(0);
  expect(api).toHaveBeenCalledWith(expect.stringContaining('veiculo_id=1'));
});
