# Instalação em servidor local centralizado

## Arquitetura

- Um computador Windows da empresa funciona como servidor (Node.js/Express, React compilado e PostgreSQL).
- Outros computadores da **mesma rede interna** acessam pelo navegador, sem instalar Node ou PostgreSQL.
- Toda a frota, os usuários, comprovantes e lançamentos ficam no banco e na pasta de arquivos do servidor.
- A porta necessária aos clientes é apenas **5000/TCP**. **Não publique a porta do PostgreSQL 5432 na rede.**

## Preparação

1. Escolha um computador que ficará ligado enquanto o sistema estiver em uso. Conecte-o preferencialmente por cabo ao roteador/switch da empresa.
2. No computador servidor, instale Node.js compatível (22 ou superior) e PostgreSQL. Confirme que o serviço PostgreSQL está em execução.
3. Faça backup do banco existente usando pgAdmin/pg_dump, e da pasta `backend/uploads`. Copie o `.env` antigo para um local seguro.
4. Extraia o projeto em uma pasta local sem sincronização automática, como `C:\Projetos\FrotaGesta`. Evite colocar o projeto em pastas de fotografias ou unidades de rede.
5. Em `backend`, crie o arquivo `.env` baseado em `.env.example`, preenchendo `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PORT=5000`, `FRONTEND_URL=http://localhost:5000` e `COOKIE_SECURE=false` para a demonstração local em HTTP. Nunca compartilhe a senha do banco ou publique o `.env`. Não altere as configurações do PostgreSQL que já funcionam no seu computador.
6. Se estiver atualizando a versão antiga, use o **mesmo banco** e execute as migrações somente depois do backup. O setup acrescenta o Módulo 7 sem recriar o banco.

## Configuração e execução no servidor

Abra PowerShell na pasta do projeto:

```powershell
cd "C:\Projetos\FrotaGesta\backend"
npm ci
npm run setup
npm start
```

O React já vem compilado em `frontend/build`. Quando alterar o frontend, atualize a compilação:

```powershell
cd "C:\Projetos\FrotaGesta\frontend"
npm ci
npm run build
```

Reinicie o backend se fizer alterações na configuração ou no código do servidor. Não é necessário executar `npm start` do frontend em cada computador: esse comando cria apenas um servidor de desenvolvimento.

### Atalho para iniciar, sem VS Code

Depois da instalação inicial, clique duas vezes em **`Iniciar_FrotaGesta.cmd`** na pasta principal do projeto. O script verifica o Node.js, o `.env`, a interface compilada, verifica se o servidor já está ativo, inicia o processo se necessário e abre `http://localhost:5000`. Ele não instala Node/PostgreSQL e não cria o banco sozinho.

O servidor Node.js deve continuar em execução para os funcionários acessarem o sistema. Se ele for encerrado, o atalho deverá ser executado novamente.

Para abrir automaticamente ao entrar no Windows (opcional), pressione `Win + R`, digite `shell:startup` e coloque nessa pasta um **atalho** para `Iniciar_FrotaGesta.cmd`. Isso funciona depois de um usuário entrar no Windows; não substitui a implantação como serviço para execução sem login.

### Atalho de acesso para cada funcionário

1. No computador servidor, descubra o IPv4 usando `ipconfig`.
2. Copie os arquivos `Criar_Atalho_Cliente.cmd` e `scripts/Criar-Atalho-Cliente.ps1` para a mesma estrutura em outro computador, ou execute o comando em um computador onde a pasta do projeto esteja acessível.
3. Execute `Criar_Atalho_Cliente.cmd` e informe **somente** o IP/nome do servidor. Ele cria `FrotaGesta.url` na área de trabalho.
4. Como alternativa, em qualquer computador: clique com botão direito na área de trabalho > Novo > Atalho, informe `http://IP_DO_SERVIDOR:5000/`, dê o nome `FrotaGesta`. Isso não exige copiar arquivos do projeto para os clientes.

Use um IP reservado no DHCP do roteador para não precisar refazer atalhos. O script de criação de atalho usa a porta 5000.


## Liberar a porta somente na rede interna

No PowerShell do Windows, **Executar como administrador**, no computador servidor:

```powershell
New-NetFirewallRule -DisplayName "FrotaGesta LAN" -Direction Inbound -Action Allow -Profile Private -Protocol TCP -LocalPort 5000 -RemoteAddress LocalSubnet
```

Garanta que a conexão do Windows está configurada como **Rede privada**. Essa regra limita o tráfego de entrada à sub-rede local, mas não substitui a segurança da rede nem a criptografia HTTPS.

## Descobrir e acessar o endereço do servidor

No computador servidor:

```powershell
ipconfig
```

Localize o endereço IPv4 da conexão de rede utilizada (por exemplo, `192.168.1.17`, que é apenas um exemplo). Em **cada outro computador** da mesma rede, abra:

```
http://192.168.1.17:5000
```

Substitua pelo IP real do servidor. Teste a conectividade do computador cliente:

```powershell
Test-NetConnection 192.168.1.17 -Port 5000
```

O resultado esperado é `TcpTestSucceeded : True`. Se não funcionar, verifique se Node está ligado, o firewall, o IP, se o computador está na rede privada e se o Wi-Fi possui isolamento de clientes. É recomendável reservar um endereço IP fixo para o servidor no roteador (reserva DHCP).

## Verificação multiusuário

1. Entre como administrador no PC 1 e cadastre um veículo de teste.
2. Entre com outro usuário no PC 2 e confirme que ele consegue consultar o veículo.
3. Inicie uma viagem no PC 2, registre KM final, valor de combustível e um comprovante.
4. Abra Despesas no PC 1 e confirme que o novo gasto aparece sem precisar recarregar manualmente.
5. Como operador, tente consultar o comprovante: o acesso deve ser negado. Como administrador, ele deve abrir.
6. No PC 2 (Operador), confirme que **Relatórios** não aparece no menu. Acesse diretamente `http://IP_DO_SERVIDOR:5000/relatorios?tipo=estoque` em uma requisição autenticada: o backend deve responder **403** para Operador (a API exige sessão).
7. No PC 1 (Administrador), gere um consolidado mensal por veículo e categoria e confira os números.

Esses passos são testes manuais obrigatórios na rede real; os testes automatizados não os substituem.

## Segurança, continuidade e backup

- HTTP local **não criptografa** os dados transmitidos. Para uso empresarial contínuo com dados sensíveis, configure HTTPS com certificado interno válido e um proxy reverso.
- Não encaminhe a porta 5000 do roteador para a internet. Use a rede interna confiável.
- O backend guarda os comprovantes em `backend/uploads/comprovantes`, com acesso controlado pela API.
- Faça backup regular do PostgreSQL **e** da pasta `backend/uploads`; um backup sem essa pasta não recupera os recibos.
- Mantenha senhas fortes, perfis corretos e atualizações de segurança das dependências.
- O computador servidor precisa permanecer ligado e com Node/PostgreSQL em execução. Para inicialização automática e disponibilidade contínua, configure um serviço do Windows após os testes.
