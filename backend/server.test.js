const request = require('supertest');

jest.mock('./config/db', () => ({
    query: jest.fn()
}));

process.env.NODE_ENV = 'test';

const pool = require('./config/db');
const app = require('./server');

describe('API FrotaGesta - Veiculos', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('GET / retorna status da API', async () => {
        const response = await request(app).get('/');

        expect(response.statusCode).toBe(200);
        expect(response.body.mensagem).toBe('API FrotaGesta funcionando');
    });

    test('GET /veiculos lista veiculos', async () => {
        pool.query.mockResolvedValueOnce({
            rows: [
                {
                    id: 1,
                    placa: 'ABC1D23',
                    marca: 'Toyota',
                    modelo: 'Hilux'
                }
            ]
        });

        const response = await request(app).get('/veiculos');

        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(pool.query).toHaveBeenCalledWith(
            'SELECT * FROM veiculos ORDER BY id ASC'
        );
    });

    test('GET /veiculos/:id busca um veiculo', async () => {
        pool.query.mockResolvedValueOnce({
            rows: [
                {
                    id: 1,
                    placa: 'ABC1D23',
                    marca: 'Toyota',
                    modelo: 'Hilux'
                }
            ]
        });

        const response = await request(app).get('/veiculos/1');

        expect(response.statusCode).toBe(200);
        expect(response.body.id).toBe(1);
    });

    test('POST /veiculos cadastra um veiculo', async () => {
        pool.query.mockResolvedValueOnce({
            rows: [
                {
                    id: 1,
                    placa: 'ABC1D23',
                    marca: 'Toyota',
                    modelo: 'Hilux',
                    ano: 2024,
                    quilometragem: 1000,
                    status: 'Ativo'
                }
            ]
        });

        const response = await request(app)
            .post('/veiculos')
            .send({
                placa: 'ABC1D23',
                marca: 'Toyota',
                modelo: 'Hilux',
                ano: 2024,
                quilometragem: 1000,
                status: 'Ativo'
            });

        expect(response.statusCode).toBe(201);
        expect(response.body.mensagem).toBe('Veiculo cadastrado com sucesso');
        expect(response.body.veiculo.placa).toBe('ABC1D23');
    });

    test('POST /veiculos rejeita placa invalida', async () => {
        const response = await request(app)
            .post('/veiculos')
            .send({
                placa: '123',
                marca: 'Toyota',
                modelo: 'Hilux'
            });

        expect(response.statusCode).toBe(400);
        expect(response.body.mensagem).toBe('Placa invalida');
        expect(pool.query).not.toHaveBeenCalled();
    });

    test('PUT /veiculos/:id atualiza um veiculo', async () => {
        pool.query.mockResolvedValueOnce({
            rows: [
                {
                    id: 1,
                    placa: 'ABC1D23',
                    marca: 'Toyota',
                    modelo: 'Hilux SRX',
                    ano: 2024,
                    quilometragem: 2000,
                    status: 'Manutencao'
                }
            ]
        });

        const response = await request(app)
            .put('/veiculos/1')
            .send({
                placa: 'ABC1D23',
                marca: 'Toyota',
                modelo: 'Hilux SRX',
                ano: 2024,
                quilometragem: 2000,
                status: 'Manutencao'
            });

        expect(response.statusCode).toBe(200);
        expect(response.body.mensagem).toBe('Veiculo atualizado com sucesso');
    });

    test('DELETE /veiculos/:id exclui um veiculo', async () => {
        pool.query.mockResolvedValueOnce({
            rows: [{ id: 1 }]
        });

        const response = await request(app).delete('/veiculos/1');

        expect(response.statusCode).toBe(200);
        expect(response.body.mensagem).toBe('Veiculo excluido com sucesso');
    });

    test('GET /veiculos/:id retorna 404 quando nao encontra', async () => {
        pool.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app).get('/veiculos/999');

        expect(response.statusCode).toBe(404);
        expect(response.body.mensagem).toBe('Veiculo nao encontrado');
    });
});
