const request = require('supertest');

process.env.NODE_ENV = 'test';

const app = require('./server');

test('GET /veiculos', async () => {
    const response = await request(app).get('/veiculos');

    expect(response.statusCode).toBe(200);
});