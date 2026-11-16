# Conferência da entrega final do TCC – FrotaGesta

## Itens exigidos

| Entregável | Situação desta revisão | Ação restante |
|---|---|---|
| Software funcionando | Código atualizado e testes automatizados concluídos | Validar login, banco real, comprovantes e rede em dois computadores |
| Anexo: testes de software | Documento de casos e resultados automatizados incluído | Executar e registrar testes manuais; adicionar prints e evidências |
| Anexo: testes de usabilidade | Questionário modelo incluído | Aplicar a usuários reais e tabular os resultados; confirmar modelo institucional |
| TCC completo em PDF | Documento DOCX anterior disponível, mas não foi convertido nesta revisão | Atualizar requisitos, diagramas, módulos, conclusão, testes e referências; exportar PDF |
| Conclusão | Rascunho abaixo | Revisar com base nos resultados reais e orientação do professor |
| Manual do usuário como apêndice | Manual-base em `MANUAL_DO_USUARIO.md` | Incorporar ao TCC como Apêndice B, incluir capturas reais e formatar |

## Texto-base para a conclusão

O desenvolvimento do FrotaGesta teve como objetivo criar um sistema web integrado para a gestão de veículos, viagens, estoque e despesas de uma frota. A implementação utilizou React na interface, Node.js e Express no servidor, e PostgreSQL no armazenamento dos dados. O desenvolvimento foi dividido em módulos, permitindo evolução incremental e testes de diferentes funcionalidades.

A versão desenvolvida inclui controle de veículos, manutenções, movimentações de estoque, viagens com acompanhamento da quilometragem e lançamentos financeiros vinculados aos veículos. Os gastos de combustível passam a ser registrados pelo valor efetivamente informado no término da viagem, em vez de estimativas. O módulo financeiro permite anexar comprovantes e consultar despesas por categoria, por veículo e por intervalos semanais, mensais ou anuais.

Durante o desenvolvimento, destacaram-se desafios relacionados à integração entre interface, servidor e banco de dados, à compatibilidade de estruturas de versões anteriores e ao controle de acesso por perfil. Para avaliar as funcionalidades, foram executados testes automatizados de backend e de interface em ambiente isolado. A implantação em rede interna e a avaliação de usabilidade com usuários reais precisam ser documentadas como parte da validação final, caso ainda não tenham sido realizadas.

Como possibilidades de trabalhos futuros, destacam-se o agendamento de manutenções preventivas, a automação de cópias de segurança, o aprimoramento da segurança da implantação em rede e a criação de visualizações gerenciais adicionais.

## Pontos a atualizar no TCC

- Entrevista: consultar o responsável sobre comprovantes obrigatórios, despesas reais por viagem, acesso em rede e relatório individual/por categoria.
- Requisitos funcionais: exclusão lógica, KM automático, custo real, upload obrigatório, permissões admin, filtros combinados e consolidação semanal/mensal/anual.
- Requisitos não funcionais: rede interna, autenticação, backups, limite e segurança dos uploads, atualização multiusuário e integridade financeira.
- Diagrama de classes/DER: `veiculos`, `viagens`, `despesas_veiculos`, comprovantes e relacionamentos.
- Casos de uso e mockups: adicionar telas de viagens, despesas e relatórios novos.
- Resultados: inserir evidências de testes e validação no ambiente da empresa.
- Apêndice A: testes de usabilidade com resultados reais.
- Apêndice B: manual do usuário com capturas da versão final.
- Conclusão: revisar o texto-base após os testes e com o orientador.

**Importante:** não confundir conclusão de teste automatizado com comprovação de implantação em vários PCs. O PDF final só deve declarar funcionalidades validadas no ambiente real quando houver evidências.
