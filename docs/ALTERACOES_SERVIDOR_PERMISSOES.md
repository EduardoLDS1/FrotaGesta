# Servidor local e relatórios somente para administrador

## O que mudou

- Backend Express atendendo em `0.0.0.0:5000`, disponibilizando React compilado na mesma porta para a rede local.
- A rota autenticada `GET /relatorios` agora exige o perfil **Administrador**. Um **Operador** recebe **403 (acesso negado)** mesmo que tente usar a API diretamente.
- O menu Relatórios e a montagem da tela de relatórios ficam ocultos para o perfil Operador.
- Gerar, visualizar, exportar CSV e imprimir relatórios são ações exclusivas do administrador.
- O restante da gestão de frota, estoque, viagens e despesas permanece disponível conforme as permissões já existentes.
- Adicionados `Iniciar_FrotaGesta.cmd` e `Criar_Atalho_Cliente.cmd` para facilitar o uso no Windows.

## Preparação (apenas no PC servidor)

1. Faça backup do PostgreSQL e de `backend/uploads` antes de substituir uma instalação existente.
2. Extraia este ZIP na pasta onde deseja hospedar o sistema. **Não copie `node_modules` de outra máquina.**
3. Copie o arquivo `backend/.env` da instalação antiga para a nova, sem publicá-lo no GitHub. Verifique os dados do PostgreSQL e mantenha `PORT=5000`.
4. Abra PowerShell no backend, execute `npm ci` e, se ainda não tiver preparado o banco desta versão, `npm run setup` após o backup.
5. Dê dois cliques em `Iniciar_FrotaGesta.cmd` na pasta principal. Esse arquivo inicia o Node.js e abre o endereço `http://localhost:5000` sem VS Code.
6. O PostgreSQL precisa estar em execução. O servidor deve continuar ligado para os computadores clientes conseguirem usar o FrotaGesta.

## Acesso dos outros computadores

1. No servidor, use `ipconfig` para descobrir o IPv4. Reserve esse IP no roteador (DHCP) para não mudar.
2. No Windows do servidor, configure a rede como Privada. Abra PowerShell como administrador e execute:

```powershell
New-NetFirewallRule -DisplayName "FrotaGesta LAN" -Direction Inbound -Action Allow -Profile Private -Protocol TCP -LocalPort 5000 -RemoteAddress LocalSubnet
```

3. Em cada PC cliente, crie um atalho na área de trabalho para `http://IP_DO_SERVIDOR:5000/`. Você também pode usar `Criar_Atalho_Cliente.cmd` se tiver os arquivos auxiliares junto dele.
4. Não é necessário instalar Node.js, PostgreSQL ou o código no computador cliente.
5. **Não exponha as portas 5000 ou 5432 no roteador para a internet**. Mantenha o PostgreSQL acessível somente pelo PC servidor.

## Testes de aceitação

- Login administrador: deve aparecer a opção Relatórios, que deve gerar relatórios normalmente.
- Login operador: a opção Relatórios não pode aparecer.
- Mesmo tentando pedir `/relatorios?tipo=estoque` pela API com a sessão do operador, deve retornar HTTP **403**.
- De outro PC na mesma rede, o atalho deve abrir a tela de login do FrotaGesta.

## Observações

- O ZIP contém `frontend/build` atualizado e pronto para ser servido. Caso baixe o projeto do GitHub, lembre-se de executar `npm ci` e `npm run build` no frontend porque a pasta `build` está no `.gitignore`.
- Para abrir automaticamente após login no Windows, pressione Win + R, digite `shell:startup` e adicione ali **um atalho** para `Iniciar_FrotaGesta.cmd` (não um novo projeto).
- Um computador que precisa funcionar sem login de usuário deve utilizar uma implantação como serviço do Windows configurada e testada separadamente.
- Para uso empresarial contínuo, faça backups do PostgreSQL e da pasta de comprovantes, configure HTTPS interno e mantenha as dependências atualizadas.
