# Anexo – Testes de software do FrotaGesta

## Ambiente de teste automatizado

- Backend: Node.js, Express, supertest e PostgreSQL embarcado PGlite (isolado, sem alterar a base da empresa)
- Frontend: React, React Testing Library e Jest
- Data de revisão: novembro de 2026

## Resultados automatizados verificados neste pacote

| Conjunto | Verificações | Resultado |
|---|---:|---|
| Fluxo original: autenticação, cadastros, estoque e manutenção | 37 | Aprovadas |
| Módulo financeiro: recorrência, pagamento e locação | 13 | Aprovadas |
| Atualização do Módulo 7: viagens, comprovantes, filtros, permissão e exclusão | 29 | Aprovadas |
| Interface React: login, estoque, despesas, viagens e relatórios | 10 | Aprovadas |
| Build de produção React | 1 | Compilado com sucesso |

Comandos para reprodução:

```powershell
cd backend
npm ci
npm run test:integration
```

```powershell
cd frontend
npm ci
$env:CI='true'
npm test -- --watch=false --runInBand
npm run build
```

Os resultados acima dizem respeito às verificações executadas com dependências locais e um banco de teste, **não** constituem validação no computador do usuário, em uma instalação PostgreSQL real ou entre vários computadores da rede.

## Casos manuais para a banca/entrega

| ID | Caso de teste | Resultado esperado | Execução real |
|---|---|---|---|
| TS01 | Acessar com login correto | Tela inicial exibida | Pendente |
| TS02 | Acessar com senha incorreta | Acesso negado | Pendente |
| TS03 | Cadastrar, alterar e excluir veículo | Cadastro atualizado; exclusão preserva histórico | Pendente |
| TS04 | Iniciar viagem e registrar retorno | KM inicial automático; KM final maior ou igual ao inicial | Pendente |
| TS05 | Finalizar viagem com gasto real e comprovante | Gasto lançado uma vez em Despesas | Pendente |
| TS06 | Tentar salvar gasto pago sem comprovante | Operação rejeitada | Pendente |
| TS07 | Registrar gastos de Manutenção e Peças | Categorias e valores exibidos no painel | Pendente |
| TS08 | Filtrar somente Combustível de um veículo | Somente gastos da combinação são exibidos | Pendente |
| TS09 | Logar como operador e tentar abrir comprovante | Resposta 403 / acesso negado | Pendente |
| TS10 | Gerar relatório semanal, mensal e anual | Totais coincidem com os pagamentos registrados | Pendente |
| TS11 | Acessar a mesma base em dois PCs da rede | Alteração do PC 1 aparece no PC 2 | Pendente |
| TS12 | Pagar parcela prevista com comprovante | Despesa muda de pendente para paga | Pendente |
| TS13 | Conferir exclusão de veículo com histórico | Veículo não aparece nas operações, histórico permanece | Pendente |
| TS14 | Testar Chrome, Edge e Firefox | Páginas e recursos funcionam nos três navegadores | Pendente |

Anexe na entrega capturas reais, data do teste, ambiente, resultado obtido, eventuais defeitos encontrados e correções. Não marque como "aprovado" sem executar o caso no ambiente real.
