import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import App from './App';
import { api } from './services/api';
jest.mock('./services/api', () => ({ api: { listar: jest.fn(), salvar: jest.fn(), excluir: jest.fn() } }));
beforeEach(() => { jest.resetAllMocks(); api.listar.mockResolvedValue([]); });
test('mostra estado vazio com dados reais da API', async () => {
  render(<App />);
  expect(await screen.findByText('Sua frota começa aqui')).toBeInTheDocument();
  expect(screen.getByText('Veículos cadastrados')).toBeInTheDocument();
});
test('formulário impede cadastro incompleto', async () => {
  render(<App />);
  await screen.findByText('Sua frota começa aqui');
  fireEvent.click(screen.getByRole('button', { name: 'Novo veículo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cadastrar veículo' }));
  expect(screen.getByText('Use uma placa como ABC1234 ou ABC1D23.')).toBeInTheDocument();
  expect(api.salvar).not.toHaveBeenCalled();
});
test('envia dados normalizados e confirma o cadastro', async () => {
  api.salvar.mockResolvedValue({ id: 1 });
  render(<App />); await screen.findByText('Sua frota começa aqui');
  fireEvent.click(screen.getByRole('button', { name: 'Novo veículo' }));
  for (const [id, value] of Object.entries({ placa: 'abc1d23', marca: ' Chevrolet ', modelo: 'Onix', ano: '2022', quilometragem: '30000' })) {
    fireEvent.change(document.getElementById(id), { target: { value } });
  }
  fireEvent.click(screen.getByRole('button', { name: 'Cadastrar veículo' }));
  await waitFor(() => expect(api.salvar).toHaveBeenCalledWith({ placa: 'ABC1D23', marca: 'Chevrolet', modelo: 'Onix', ano: 2022, quilometragem: 30000 }, undefined));
  expect(await screen.findByText('Veículo cadastrado com sucesso.')).toBeInTheDocument();
});
test('mostra erro quando API está indisponível', async () => {
  api.listar.mockRejectedValue(new Error('API indisponível'));
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('API indisponível');
  expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
});
const registro = { id: 1, placa: 'ABC1D23', marca: 'Chevrolet', modelo: 'Onix', ano: 2022, quilometragem: '30000.00' };
test('edita quilometragem de veículo existente', async () => {
  api.listar.mockResolvedValue([registro]); api.salvar.mockResolvedValue({ ...registro, quilometragem: 32000 });
  render(<App />); await screen.findByText('Onix');
  fireEvent.click(screen.getByRole('button', { name: 'Editar ABC1D23' }));
  fireEvent.change(document.getElementById('quilometragem'), { target: { value: '32000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
  await waitFor(() => expect(api.salvar).toHaveBeenCalledWith({ placa: 'ABC1D23', marca: 'Chevrolet', modelo: 'Onix', ano: 2022, quilometragem: 32000 }, 1));
  expect(await screen.findByText('Veículo atualizado com sucesso.')).toBeInTheDocument();
});
test('erro de placa duplicada mantém os dados no formulário', async () => {
  api.listar.mockResolvedValue([registro]);
  api.salvar.mockRejectedValue(Object.assign(new Error('Placa duplicada.'), { campos: { placa: 'Essa placa já está cadastrada.' } }));
  render(<App />); await screen.findByText('Onix');
  fireEvent.click(screen.getByRole('button', { name: 'Editar ABC1D23' }));
  fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
  expect(await screen.findByText('Essa placa já está cadastrada.')).toBeInTheDocument();
  expect(document.getElementById('modelo')).toHaveValue('Onix');
});
test('busca por placa e mostra resultado vazio', async () => {
  api.listar.mockResolvedValue([registro]);
  render(<App />); await screen.findByText('Onix');
  fireEvent.click(screen.getByRole('button', { name: 'Veículos', exact: true }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Buscar veículos' }), { target: { value: 'xyz' } });
  expect(screen.getByText('Nenhum resultado encontrado')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'Buscar veículos' }), { target: { value: 'abc1d23' } });
  expect(screen.getByText('Onix')).toBeInTheDocument();
});
test('exclusão exige confirmação e atualiza a lista', async () => {
  api.listar.mockResolvedValue([registro]); api.excluir.mockResolvedValue(null);
  const confirmar = jest.spyOn(window, 'confirm').mockReturnValue(false);
  render(<App />); await screen.findByText('Onix');
  fireEvent.click(screen.getByRole('button', { name: 'Excluir ABC1D23' }));
  expect(api.excluir).not.toHaveBeenCalled();
  confirmar.mockReturnValue(true); api.listar.mockResolvedValue([]);
  fireEvent.click(screen.getByRole('button', { name: 'Excluir ABC1D23' }));
  expect(await screen.findByText('Veículo excluído com sucesso.')).toBeInTheDocument();
  expect(await screen.findByText('Sua frota começa aqui')).toBeInTheDocument();
  expect(api.excluir).toHaveBeenCalledWith(1); confirmar.mockRestore();
});
