const request = require('supertest');
jest.mock('./config/db', () => ({ query: jest.fn() }));
const pool = require('./config/db');
const app = require('./server');
const veiculo = { placa: 'ABC1D23', marca: 'Chevrolet', modelo: 'Onix', ano: 2022, quilometragem: 30000 };
beforeEach(() => jest.resetAllMocks());
test('lista veículos retornados pelo banco', async () => {
  pool.query.mockResolvedValue({ rows: [{ id: 1, ...veiculo }] });
  const res = await request(app).get('/veiculos');
  expect(res.status).toBe(200); expect(res.body[0].placa).toBe(veiculo.placa);
});
test('consulta veículo por ID', async () => {
  pool.query.mockResolvedValue({ rows: [{ id: 1, ...veiculo }] });
  expect((await request(app).get('/veiculos/1')).body.id).toBe(1);
});
test('cadastro normaliza a placa e retorna 201', async () => {
  pool.query.mockResolvedValue({ rows: [{ id: 2, ...veiculo }] });
  const res = await request(app).post('/veiculos').send({ ...veiculo, placa: 'abc1d23' });
  expect(res.status).toBe(201); expect(pool.query.mock.calls[0][1][0]).toBe('ABC1D23');
});
test.each([
  { placa: 'errada' }, { marca: '' }, { modelo: '   ' }, { ano: 1800 },
  { ano: 2022.5 }, { quilometragem: -1 }, { quilometragem: '12' },
  { quilometragem: 1.234 }, { marca: { trim: 'inválido' } },
])('rejeita dados inválidos: %j', async (invalido) => {
  expect((await request(app).post('/veiculos').send({ ...veiculo, ...invalido })).status).toBe(400);
  expect(pool.query).not.toHaveBeenCalled();
});
test('permite ano vazio representado por null', async () => {
  pool.query.mockResolvedValue({ rows: [{ id: 2, ...veiculo, ano: null }] });
  expect((await request(app).post('/veiculos').send({ ...veiculo, ano: null })).status).toBe(201);
});
test('placa duplicada retorna conflito e erro de campo', async () => {
  pool.query.mockRejectedValue({ code: '23505' });
  const res = await request(app).post('/veiculos').send(veiculo);
  expect(res.status).toBe(409); expect(res.body.campos.placa).toBeTruthy();
});
test('edita com parâmetros SQL', async () => {
  pool.query.mockResolvedValue({ rows: [{ id: 1, ...veiculo }] });
  expect((await request(app).put('/veiculos/1').send(veiculo)).status).toBe(200);
  expect(pool.query.mock.calls[0][1]).toEqual([...Object.values(veiculo), '1']);
});
test.each(['get', 'put', 'delete'])('%s em veículo inexistente retorna 404', async metodo => {
  pool.query.mockResolvedValue({ rows: [], rowCount: 0 });
  expect((await request(app)[metodo]('/veiculos/999').send(veiculo)).status).toBe(404);
});
test('exclui veículo', async () => {
  pool.query.mockResolvedValue({ rowCount: 1 });
  expect((await request(app).delete('/veiculos/1')).status).toBe(204);
});
test('impede exclusão com vínculos', async () => {
  pool.query.mockRejectedValue({ code: '23503' });
  expect((await request(app).delete('/veiculos/1')).status).toBe(409);
});
test('rejeita ID inválido', async () => {
  expect((await request(app).get('/veiculos/abc')).status).toBe(400);
  expect(pool.query).not.toHaveBeenCalled();
});
test('falha de conexão retorna erro legível sem expor detalhes', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  pool.query.mockRejectedValue(new Error('detalhe interno'));
  const res = await request(app).get('/veiculos');
  expect(res.status).toBe(500); expect(res.body.erro).not.toContain('detalhe interno'); log.mockRestore();
});
