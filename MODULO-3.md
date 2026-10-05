# Entrega — Módulo 3: Desenvolvimento do Front-end

**Projeto:** FrotaGesta — Sistema de Gestão de Frota com Controle de Estoque Integrado.

## Criação das telas

Foram desenvolvidas as telas de Dashboard, listagem, cadastro e edição de veículos em React. A listagem permite pesquisar e filtrar os registros.

## Implementação da interface gráfica

A interface utiliza menu de navegação, indicadores, tabela e formulários, com identidade visual em azul-escuro, verde e branco. Foram criadas regras de layout para diferentes tamanhos de tela, além de mensagens de carregamento, sucesso e erro.

## Integração com API

O frontend utiliza a API Express para consultar, cadastrar, editar e excluir veículos no PostgreSQL. Como o arquivo recebido continha apenas uma rota demonstrativa, também foram implementadas as operações necessárias no backend. Os indicadores do Dashboard são calculados com os dados retornados pela API.

## Validação de dados

O sistema valida campos obrigatórios, placas nos padrões antigo e Mercosul, ano de 1900 a 2100 e quilometragem não negativa. O backend repete as validações e trata placas duplicadas. A exclusão exige confirmação.

## Verificação

Passaram os testes automatizados de frontend e backend com dependências simuladas, além da compilação do React. A conexão com o PostgreSQL local e a revisão visual em navegador devem ser verificadas no computador de apresentação, seguindo o arquivo LEIA-ME.md.

**Limite da entrega:** funcionalidades operacionais de veículos; os módulos de estoque, manutenções e autenticação ficam para continuidade do projeto.
