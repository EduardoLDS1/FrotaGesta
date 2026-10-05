# FrotaGesta — Módulo 3

Frontend React com Dashboard, listagem, cadastro e edição de veículos, conectado à API Express e preparado para PostgreSQL.

## O que mudou

O ZIP recebido continha o frontend padrão do React e uma rota GET /veiculos que retornava somente uma mensagem. Por isso, além das telas, foram implementadas as operações da API necessárias à integração.

- Dashboard com total de veículos, soma das quilometragens e quantidade de marcas.
- Lista com busca por placa/marca/modelo e filtro por marca.
- Cadastro, edição e exclusão com confirmação.
- Validação de placa antiga ou Mercosul, campos obrigatórios, ano e quilometragem.
- Tratamento de placa duplicada, carregamento, lista vazia e falhas de conexão.
- Layout com regras para computador e celular, labels e navegação por teclado.
- API com consultas SQL parametrizadas e validação também no servidor.

O escopo funcional desta entrega é **veículos**. Estoque, manutenções, usuários e autenticação ainda não estão implementados. A quilometragem total é a soma dos odômetros cadastrados, não a distância percorrida em um período. Não há dados de demonstração inseridos automaticamente.

## 1. Preparar o banco

É necessário Node.js 22 ou superior e PostgreSQL instalado e iniciado.

No pgAdmin:
1. Use o banco `frotagesta` existente, ou crie um banco com esse nome.
2. Abra o Query Tool conectado a esse banco.
3. Abra e execute `backend/database/schema.sql`.

O script cria a tabela quando ela não existe e acrescenta os timestamps se faltarem. Ele não apaga os veículos. A tabela existente deve possuir `id`, `placa`, `marca`, `modelo`, `ano` e `quilometragem`, com os tipos e restrições definidos no script. Caso sua tabela seja de outra versão, confira a estrutura antes de executar; o script não converte automaticamente colunas antigas como `km_atual`.

## 2. Iniciar o backend

Abra um terminal na pasta `FrotaGesta/backend`:

```bash
npm install
```

Faça uma cópia de `.env.example` com o nome `.env`, na mesma pasta. No Windows, confirme que não virou `.env.txt`. Troque `PGPASSWORD=coloque_sua_senha` pela senha do seu PostgreSQL. Confira também usuário, porta e nome do banco.

```bash
npm start
```

A API ficará em `http://localhost:5000/veiculos`. Ao abrir esse endereço, deve aparecer uma lista JSON, que pode estar vazia (`[]`). Mantenha esse terminal aberto.

## 3. Iniciar o frontend

Em outro terminal, na pasta `FrotaGesta/frontend`:

```bash
npm install
npm start
```

Abra `http://localhost:3000`. O frontend encaminha as chamadas `/veiculos` para a porta 5000 usando o proxy configurado no `package.json`.

Caso o React proponha outra porta, prefira liberar a 3000; se usar outra, atualize `FRONTEND_URL` no `.env` do backend e reinicie a API.

## 4. Conferir no seu computador

1. Cadastre uma placa ainda não utilizada, como `XYZ1A23`, com marca, modelo, ano e quilometragem.
2. Confira o veículo na lista e no Dashboard.
3. Atualize a quilometragem e confira a alteração.
4. Pesquise pela placa e filtre pela marca.
5. Tente cadastrar a mesma placa: o sistema deve informar a duplicidade.
6. Tente enviar campos vazios ou quilometragem negativa: deve haver validação.
7. Cancele uma exclusão e confirme que o registro continua na lista.
8. Exclua apenas um registro de teste e confirme a atualização.
9. Pare o backend e clique em Atualizar: deve aparecer uma mensagem de erro.
10. Reinicie a API e clique em Tentar novamente.

## Testes e compilação

No backend:

```bash
npm test
```

No frontend:

```bash
npm test -- --watchAll=false
npm run build
```

Foram verificados 24 testes de rotas/validação do backend e 14 testes do frontend. A compilação de produção do React também passou. Os testes usam simulações do banco e da API: não comprovam uma conexão com o seu PostgreSQL. As dependências do ZIP foram geradas no Windows; para testar as rotas neste ambiente Linux foi usado o Jest 27 já presente no frontend, pois o Jest 30 do backend estava sem o componente nativo para Linux. No seu PC, `npm install` prepara as dependências da plataforma.

A revisão visual em navegador não foi concluída neste ambiente porque o navegador de testes não estava disponível; confira também o layout no seu computador e celular.

## Estrutura principal

- `frontend/src/App.js`: navegação, Dashboard, tabela e formulário.
- `frontend/src/App.css` e `index.css`: estilo e responsividade.
- `frontend/src/services/api.js`: requisições HTTP e tratamento de erros.
- `frontend/src/utils/validacao.js`: validações e conversão dos dados.
- `backend/routes/veiculos.js`: operações GET, POST, PUT e DELETE.
- `backend/config/db.js`: conexão PostgreSQL por variáveis de ambiente.
- `backend/database/schema.sql`: estrutura da tabela de veículos.

## Observações

O ZIP não inclui `node_modules`, `.git` ou senhas. Instale as dependências nas duas pastas. Guarde seu projeto anterior antes de substituir arquivos. Para atualizar seu repositório existente, copie os arquivos deste projeto para ele preservando a pasta `.git` local.

A API ainda não tem autenticação; esta entrega é para execução e demonstração local. O proxy funciona no servidor de desenvolvimento. Para hospedagem futura, defina `REACT_APP_API_URL` no frontend antes de compilar e configure `FRONTEND_URL` no backend para a origem real.
