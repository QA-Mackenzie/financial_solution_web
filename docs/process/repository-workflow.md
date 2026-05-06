# Workflow do Repositorio

## Definition of Done local

- backlog da sprint implementado e validado
- npm run check passando na raiz
- documentacao da sprint atualizada
- nenhum desenvolvimento novo dentro de Solucao_Financeira
- branch da sprint pronta para push e revisao

## Fluxo de branch

- main protegida como linha base
- cada sprint ou slice relevante trabalha em branch propria iniciada a partir de main
- commits seguem politica de mensagem clara; conventional commits sao recomendados
- concluir uma sprint exige atualizar o roadmap, commitar e fazer push da branch

## Fluxo de release inicial

- desenvolvimento continuo nas branches de sprint
- integracao validada via CI de lint, typecheck, testes e build
- merge para main apenas apos sprint fechada e validada
