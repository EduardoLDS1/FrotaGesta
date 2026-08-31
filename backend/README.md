# FrotaGesta - Modulo 2 (Back-end)

Back-end desenvolvido com Node.js, Express e PostgreSQL.

## Preparar o banco

1. Abra o banco `frotagesta` no pgAdmin.
2. Execute o arquivo `database/schema.sql` no Query Tool.
3. Confira o arquivo `.env` local com os dados da sua instalacao do PostgreSQL.

## Executar

```bash
npm install
npm start
```

A API fica disponivel em `http://localhost:5000`.

## Rotas de veiculos

- `GET /veiculos` - listar veiculos
- `GET /veiculos/:id` - buscar veiculo
- `POST /veiculos` - cadastrar veiculo
- `PUT /veiculos/:id` - atualizar veiculo
- `DELETE /veiculos/:id` - excluir veiculo

Exemplo para cadastro:

```json
{
  "placa": "ABC1D23",
  "marca": "Toyota",
  "modelo": "Hilux",
  "ano": 2024,
  "quilometragem": 1000,
  "status": "Ativo"
}
```

## Testes

```bash
npm test
```
