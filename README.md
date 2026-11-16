# FrotaGesta

Sistema web de gestão de frota, estoque e custos financeiros com React, Node.js/Express e PostgreSQL.

O servidor e o banco de dados podem ficar em um computador da empresa, enquanto os demais computadores acessam o sistema pelo navegador na mesma rede. A versão compilada do React pode ser servida pela própria API na porta 5000.

## Recursos

- Gestão de usuários, veículos e estoque
- Exclusão administrativa de veículos com preservação do histórico de viagens e despesas
- Viagens com KM inicial automático a partir do último odômetro, KM final e gasto real de combustível
- Comprovante obrigatório para cada nova despesa paga em PDF, JPG, PNG ou WEBP, com limite de 5 MB
- Comprovantes visíveis somente a administradores
- Controle de despesas por veículo e categoria, com totais pagos e pendentes
- Atualização das despesas entre computadores via eventos do servidor
- Parcelas automáticas pendentes de financiamentos e locações, confirmadas mediante comprovante
- Relatórios semanal, mensal, anual e histórico por veículo, exclusivos do administrador

## Permissões

- **Administrador:** pode gerar, visualizar, exportar e imprimir relatórios; gerencia usuários e consulta comprovantes.
- **Operador:** pode trabalhar com as funcionalidades operacionais permitidas, mas não vê o menu Relatórios nem acessa `/relatorios` pela API (resposta HTTP 403).
- A restrição é validada pelo backend, não apenas escondida no React.

## Implantação

Consulte `docs/INSTALACAO_REDE_LOCAL.md` antes de instalar. Faça backup do banco de dados e de `backend/uploads` antes de executar novas migrações.

A primeira configuração exige um arquivo `backend/.env` criado a partir de `backend/.env.example`, com os dados do seu PostgreSQL. Não publique arquivos `.env` no GitHub.

No computador servidor, se a pasta `frontend/build` já estiver presente, o backend serve diretamente a interface:

```powershell
cd backend
npm ci
npm run setup
npm start
```

Nesta versão, a interface foi alterada. Antes de iniciar o servidor, gere novamente o React:

```powershell
cd frontend
npm ci
npm run build
```

No Windows, após a instalação inicial, dê dois cliques em `Iniciar_FrotaGesta.cmd` na pasta principal. Ele inicia o backend e abre o navegador. Para os outros computadores, execute `Criar_Atalho_Cliente.cmd`, informe o IP do servidor e coloque o atalho gerado na área de trabalho.

Com o backend ligado, acesse `http://localhost:5000` no servidor ou `http://IP_DO_SERVIDOR:5000` em outro computador da mesma rede.

## Testes automatizados

```powershell
cd backend
npm ci
npm run test:integration
```

```powershell
cd frontend
npm ci
$env:CI="true"
npm test -- --watch=false --runInBand
npm run build
```

Os documentos de testes e o manual-base do usuário estão em `docs/`.

## Observações financeiras

O valor informado na finalização da viagem é um gasto real e gera um único lançamento financeiro. As estimativas de km/l ou preço por litro não fazem parte do fluxo novo. Viagens antigas podem não ter o valor pago registrado.

Os totais de despesas pagas incluem lançamentos anteriores à implantação, mesmo que estes não possuam comprovante. Registros operacionais de manutenção e valores declarados de aquisição são exibidos separadamente para evitar dupla contagem. Mensalidades pendentes são previsão, não gasto realizado.

O servidor local atende à demonstração em rede confiável. Para operar com dados sensíveis em uma empresa, configure HTTPS, backups regulares, monitoramento, política de contas e controle do acesso à rede.

## Complementos desta versão

- Cadastro de produtos: código, categoria e fornecedor (registros antigos recebem código LEGADO-ID e devem ser revisados).
- Manutenções: associação de múltiplas peças por serviço, baixa do estoque e custo de peças congelado na data do registro. Os serviços/mão de obra são informados separadamente. Registros anteriores mantêm a semântica do custo declarado.
- Veículos: estados Ativo, Inativo e Indisponível e revisão preventiva agendada por data ou odômetro, com alertas no painel. Veículos inativos não podem iniciar viagem.
- Usuários: busca por nome, login e e-mail no painel de administração.
- Para banco existente: faça backup de PostgreSQL e comprovantes, execute `npm run setup` novamente (aplica `modulo8.sql`).
- Frontend pré-compilado antigo foi removido do pacote para não mostrar uma versão desatualizada; execute `npm ci` e `npm run build` na pasta frontend após extrair.
- Execução de testes automatizados depende de instalar as dependências no computador local; verifique também o comportamento manualmente antes de apresentar o TCC.
