# Apêndice B – Manual do usuário do FrotaGesta

## 1. Objetivo

O FrotaGesta centraliza veículos, viagens, manutenção, estoque e despesas, permitindo controlar os valores efetivamente pagos por cada veículo da frota.

## 2. Acesso

Abra o endereço disponibilizado pela empresa, por exemplo `http://IP-DO-SERVIDOR:5000`. Informe seu login e senha. Perfis de administrador podem gerenciar os usuários e consultar os comprovantes financeiros; operadores utilizam as funcionalidades operacionais autorizadas.

## 3. Cadastro e exclusão de veículos

Entre em **Veículos**, clique em **Novo Veículo**, preencha placa, marca, modelo, ano, quilometragem e dados financeiros. Para financiamento ou locação, informe os valores e o primeiro vencimento. Salve.

Para corrigir um veículo, use **Editar**. O administrador pode usar **Excluir**; a exclusão tira o veículo da lista operacional, mas preserva seu histórico para auditoria. Não é permitida exclusão enquanto houver viagem ou manutenção em andamento.

## 4. Início e fim de viagem

Entre em **Viagens** e selecione o veículo. A KM inicial é preenchida automaticamente com base no último odômetro. Motorista, destino e finalidade podem ser preenchidos. Clique em **Iniciar viagem**.

Na chegada, localize a viagem aberta, informe a **KM final** e o **valor realmente gasto com combustível**. Para valores acima de R$ 0,00, anexe o comprovante correspondente em PDF, JPG, PNG ou WEBP (máximo 5 MB). Clique em **Finalizar**. O sistema atualiza o odômetro e registra o gasto de combustível como despesa paga. Se não houve gasto com combustível, informe R$ 0,00; nesse caso, não há comprovante nem lançamento financeiro de combustível.

## 5. Lançamento de despesas

Na tela **Despesas**, selecione veículo, categoria, data de pagamento, valor e descrição. Para gastos pagos, o comprovante é obrigatório. Categorias incluem **Combustível, Manutenção, Peças**, e outras despesas como financiamento, locação, seguro e pedágio. O total aparece no painel após salvar.

Na mesma tela, utilize os filtros **Veículo** e **Categoria** separadamente ou juntos. O painel exibe totais pagos por categoria, total pago geral e total pendente, de acordo com os filtros.

## 6. Financiamento e locação

No cadastro do veículo, preencha valores de contrato e vencimento. As mensalidades previstas aparecem como **pendentes** quando a tela Despesas ou Relatórios é acessada. Ao pagar uma mensalidade, informe o valor real, a data e o comprovante. Apenas então o pagamento entra no total realizado.

## 7. Consulta de comprovantes

Somente o administrador consegue abrir os comprovantes pela aplicação. Os arquivos ficam protegidos no servidor e não são publicados como links estáticos. Caso um lançamento antigo não tenha comprovante, o administrador poderá anexá-lo para regularização.

## 8. Relatórios

Na tela **Relatórios**, selecione **Consolidado por período e categoria**, escolha **semanal, mensal ou anual**, informe as datas e opcionalmente o veículo. Clique em **Gerar relatório**. Também é possível visualizar custos por veículo, histórico de viagens, financiamentos e locações, estoque e manutenções.

Use **Exportar CSV** ou **Imprimir / salvar PDF** para obter uma cópia. Os relatórios financeiros separam despesas pagas de previsões pendentes; compras de veículos declaradas e custos operacionais de manutenção são informativos para evitar dupla contagem.

## 9. Estoque e manutenções

O módulo Estoque permite cadastrar itens e acompanhar entradas, saídas e saldo. O módulo Manutenções permite registrar serviços por veículo. Os valores de serviços registrados operacionalmente não são automaticamente considerados pagamentos comprovados: quando houver pagamento efetivo, registre a despesa correspondente com comprovante.

## 10. Encerramento e suporte

Ao terminar, clique em **Sair**. Em caso de falha de acesso, verifique a conexão com o servidor e contate o administrador. O responsável técnico deve manter cópias de segurança tanto do PostgreSQL quanto dos comprovantes em disco.

**Observação para o TCC:** este é um manual-base textual. Antes de anexá-lo à versão final em PDF, adicione capturas de tela reais da versão instalada, numere figuras e adeque à formatação exigida pela instituição.


## Permissões de relatórios

A opção **Relatórios** aparece somente para o perfil **Administrador**. Esse perfil pode gerar relatórios por período, veículo e categoria, exportar CSV e imprimir/salvar PDF. O perfil **Operador** não visualiza a opção e recebe acesso negado caso tente consultar diretamente a API de relatórios.

### Acesso pelos computadores da rede

O computador servidor deve permanecer ligado com Node.js e PostgreSQL em execução. Nos outros computadores, abra o atalho `FrotaGesta` que aponta para `http://IP_DO_SERVIDOR:5000/` e entre com as credenciais fornecidas pelo administrador.
