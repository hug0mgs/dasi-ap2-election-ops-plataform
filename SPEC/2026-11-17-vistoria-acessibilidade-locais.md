# SPEC — Vistoria e acessibilidade dos locais

**Data:** 2026-11-17
**Status:** `proposed`
**SPEC Gate:** `NEW_SPEC`

## Objetivo

Disponibilizar um domínio operacional para planejar, executar, revisar e acompanhar vistorias dos locais de votação, registrando de forma estruturada as condições de acesso, energia, conectividade, sinalização e infraestrutura. Cada vistoria deve preservar responsáveis, evidências, histórico e pendências impeditivas para permitir decisão verificável sobre a aptidão operacional do local.

## Ownership e fronteiras

- Criar o plugin autônomo `plugins/operations/polling-place-inspections`, package `@eops/plugin-polling-place-inspections`, rotas web sob `/polling-place-inspections` e API sob `/polling-place-inspections`.
- O novo plugin é proprietário das vistorias, respostas, achados, pendências e revisões. `polling-places` continua proprietário do cadastro do local; `documents-evidence` continua proprietário dos arquivos e sua integridade; `tasks` continua proprietário de tarefas operacionais.
- Integrações cross-domain usam IDs persistidos, leitura Prisma somente-leitura com `select` explícito, endpoints públicos, contratos compartilhados ou Event Bus. Nenhum plugin importa `src/` de outro workspace nem escreve diretamente em tabelas alheias.
- Evidência é associada por vínculo opaco ao agregado ou ao achado. O plugin pode registrar metadados de referência necessários à vistoria, mas não duplica binário, checksum, versionamento ou storage do domínio de evidências.
- Uma pendência pode manter referência opcional a uma tarefa criada explicitamente pelo operador; a criação automática de tarefas não faz parte desta versão.

## Vocabulário e modelo operacional

- **vistoria:** avaliação versionada de um local em um pleito, executada por responsáveis designados.
- **dimensão:** grupo normativo `ACCESS`, `ENERGY`, `CONNECTIVITY`, `SIGNAGE` ou `INFRASTRUCTURE`.
- **item:** verificação objetiva dentro de uma dimensão, com resposta, observação, severidade e evidências.
- **achado:** condição identificada que exige registro próprio, tratamento ou justificativa.
- **pendência impeditiva:** achado que impede considerar o local apto enquanto permanecer aberto ou sem aceite formal.
- **aptidão:** resultado derivado `NOT_ASSESSED`, `FIT`, `FIT_WITH_RESTRICTIONS` ou `UNFIT`; não pode contradizer pendência impeditiva aberta.
- **snapshot de formulário:** cópia dos itens aplicáveis no início da execução; alterações futuras no catálogo não reescrevem vistorias existentes.

## Ciclo de vida

Estados persistidos:

```text
DRAFT → SCHEDULED → IN_PROGRESS → SUBMITTED → APPROVED
                                      └──────→ CHANGES_REQUESTED → IN_PROGRESS

DRAFT | SCHEDULED | IN_PROGRESS | CHANGES_REQUESTED → CANCELLED
APPROVED → REOPENED → IN_PROGRESS
```

Regras:

1. Apenas uma vistoria não cancelada pode representar a rodada ativa de um mesmo local, pleito e tipo de vistoria; revisitas usam número de rodada crescente e vínculo com a vistoria anterior.
2. `SCHEDULED` exige data planejada e ao menos um responsável ativo.
3. `IN_PROGRESS` registra início e executor; respostas podem ser salvas incrementalmente.
4. `SUBMITTED` exige todos os itens obrigatórios respondidos, justificativa para respostas não aplicáveis e evidências obrigatórias anexadas.
5. `APPROVED` exige revisão por usuário diferente do último executor, ausência de pendência impeditiva aberta e decisão explícita de aptidão.
6. `CHANGES_REQUESTED` exige justificativa do revisor e preserva as respostas anteriores no histórico.
7. Reabertura de vistoria aprovada exige motivo e cria novo ciclo auditável, sem apagar a aprovação anterior.
8. Cancelamento exige motivo e não exclui fisicamente respostas, achados ou evidências.

## Dimensões e conteúdo mínimo

### Acesso e acessibilidade

- rota acessível desde a via pública;
- condição de calçada, piso, desnível, degrau, rampa e corrimão;
- largura e circulação de portas, corredores e áreas de votação;
- acesso para cadeira de rodas e mobilidade reduzida;
- sanitário acessível, quando aplicável;
- embarque, desembarque, estacionamento e acesso de veículos operacionais;
- barreiras temporárias ou permanentes e alternativa operacional documentada.

### Energia

- fornecimento ativo e estabilidade observada;
- quadro, tomadas, aterramento e extensões necessárias;
- capacidade para equipamentos previstos;
- iluminação das áreas críticas;
- contingência, gerador, nobreak ou procedimento alternativo;
- riscos elétricos, exposição e necessidade de intervenção técnica.

### Conectividade

- disponibilidade de rede fixa, móvel e/ou rádio;
- operadora, tecnologia, intensidade e estabilidade observadas;
- pontos com sombra, restrição de acesso ou necessidade de deslocamento;
- latência e teste operacional quando realizado;
- redundância e alternativa de transmissão/comunicação;
- observação de credenciais sem armazenar senha, token ou segredo.

### Sinalização

- identificação externa do local;
- indicação de entrada, saída, seções, filas, sanitários e acessibilidade;
- sinalização de emergência e rotas de evacuação;
- legibilidade, contraste, fixação e posicionamento;
- necessidade de placas, faixas, mapas ou apoio humano.

### Infraestrutura

- integridade de salas, cobertura, ventilação, iluminação e mobiliário;
- capacidade e layout para seções e fluxo de eleitores;
- água, sanitários, limpeza, segurança física e áreas de apoio;
- acesso a chaves, horários e restrições do imóvel;
- riscos estruturais, alagamento, obra, interdição ou compartilhamento de espaço;
- espaço para armazenamento temporário e proteção de equipamentos.

## Respostas, achados e pendências

- Cada item usa resposta `COMPLIANT`, `PARTIALLY_COMPLIANT`, `NON_COMPLIANT`, `NOT_APPLICABLE` ou `NOT_VERIFIED`.
- `PARTIALLY_COMPLIANT` e `NON_COMPLIANT` exigem observação; `NOT_APPLICABLE` exige justificativa.
- Itens configurados como críticos exigem ao menos uma evidência quando não conformes e geram achado associado.
- Achado possui título, descrição, dimensão, severidade `LOW | MEDIUM | HIGH | CRITICAL`, localização textual, recomendação, responsável, prazo e estado `OPEN | IN_TREATMENT | RESOLVED | ACCEPTED | CANCELLED`.
- Marcar achado como impeditivo exige justificativa objetiva. Achados `CRITICAL` são impeditivos por padrão, salvo decisão formal de aceite de risco por permissão específica.
- Resolver pendência exige descrição da solução, data, responsável e evidência quando configurada como obrigatória.
- Aceitar risco exige permissão, justificativa, responsável pela decisão, validade/revisão e não apaga a classificação original.
- O backend deriva contagens, progresso, dimensões críticas e aptidão; o frontend não mantém cálculo paralelo como fonte de verdade.

## Responsáveis e agenda

- Uma vistoria aceita múltiplos responsáveis com papéis `LEAD`, `INSPECTOR`, `TECHNICAL_SUPPORT` e `REVIEWER`.
- O usuário responsável deve existir e estar ativo no momento da atribuição; remoção posterior preserva nome histórico quando necessário.
- Deve ser possível registrar data planejada, início real, término real, duração, observações de acesso ao imóvel e contato local sem expor informação sensível além do necessário.
- A listagem permite filtrar por pleito, zona, local, responsável, estado, aptidão, dimensão com problema, impeditivo aberto e intervalo de datas.

## Evidências e rastreabilidade

- Evidências podem ser vinculadas à vistoria, resposta, achado ou resolução por IDs opacos e tipo de alvo próprio do domínio.
- A interface oferece deep link para criar/consultar evidência no plugin proprietário, preservando retorno ao contexto da vistoria quando suportado.
- Vínculo removido não exclui o arquivo; registra evento histórico com ator e momento.
- Toda mutação relevante produz histórico imutável contendo tipo de ação, ator, data, estado anterior e posterior e resumo seguro, sem registrar segredo.
- Publicar eventos tipados para criação, agendamento, início, submissão, aprovação, pedido de ajustes, reabertura, cancelamento, achado impeditivo criado/resolvido e mudança de aptidão.

## API mínima

```http
GET    /polling-place-inspections/dashboard
GET    /polling-place-inspections/references
GET    /polling-place-inspections/catalog
GET    /polling-place-inspections
POST   /polling-place-inspections
GET    /polling-place-inspections/:id
PATCH  /polling-place-inspections/:id
POST   /polling-place-inspections/:id/assignees
DELETE /polling-place-inspections/:id/assignees/:assignmentId
POST   /polling-place-inspections/:id/schedule
POST   /polling-place-inspections/:id/start
PUT    /polling-place-inspections/:id/responses/:responseId
POST   /polling-place-inspections/:id/findings
PATCH  /polling-place-inspections/:id/findings/:findingId
POST   /polling-place-inspections/:id/findings/:findingId/resolve
POST   /polling-place-inspections/:id/findings/:findingId/accept-risk
PUT    /polling-place-inspections/:id/evidence-links
POST   /polling-place-inspections/:id/submit
POST   /polling-place-inspections/:id/approve
POST   /polling-place-inspections/:id/request-changes
POST   /polling-place-inspections/:id/reopen
POST   /polling-place-inspections/:id/cancel
GET    /polling-place-inspections/:id/history
```

DTOs devem rejeitar campos desconhecidos conforme a configuração global, validar enums, UUIDs, limites de texto, datas e transições. Mutações concorrentes utilizam `expectedUpdatedAt` ou versão equivalente para impedir sobrescrita silenciosa.

## Interface

Rotas:

```text
/polling-place-inspections                  dashboard
/polling-place-inspections/list             listagem e filtros
/polling-place-inspections/new              criação
/polling-place-inspections/:id              execução/detalhe
/polling-place-inspections/:id/findings     pendências e tratamento
/polling-place-inspections/:id/history      histórico
```

Requisitos:

- dashboard com dados reais de cobertura, andamento, locais inaptos, impeditivos e dimensões críticas;
- listagem escaneável com estado, progresso, aptidão, responsável, agenda e alertas;
- formulário guiado por dimensão, navegação por teclado, progresso, salvamento explícito e resumo de validações;
- detalhes com contexto do pleito/local, responsáveis, evidências, achados, decisões e timeline;
- estados de loading, erro, vazio e ausência de permissão explícitos;
- não depender apenas de cor; badges possuem rótulo textual, foco é visível e controles usam semântica adequada;
- CSS específico permanece em CSS Modules do plugin; shell recebe apenas registro do manifest.

## RBAC

Adicionar permissões:

```text
polling-place-inspections.read
polling-place-inspections.create
polling-place-inspections.execute
polling-place-inspections.manage
polling-place-inspections.review
polling-place-inspections.accept-risk
```

Leitura, criação, execução, gestão, revisão e aceite de risco são autorizados também no backend. O runtime decide por permissão, nunca pelo nome do papel.

## Persistência

O schema deve representar no mínimo:

- vistoria e sua rodada/origem;
- catálogo/template versionado e snapshot aplicado;
- respostas por item;
- responsáveis e papéis;
- achados/pendências e resolução/aceite;
- vínculos de evidência;
- decisões de revisão;
- histórico operacional.

Índices devem sustentar filtros por pleito, zona, local, estado, aptidão, responsável, prazo e impeditivos. Constraints impedem duplicidade de atribuição, vínculo de evidência repetido e mais de uma resposta para o mesmo item da vistoria.

## Critérios de aceite

1. Usuário autorizado cria, agenda e executa vistoria para um local e pleito usando formulário com as cinco dimensões.
2. Respostas, observações e evidências obrigatórias são validadas pelo servidor; progresso e aptidão são derivados de dados persistidos.
3. Responsáveis podem ser atribuídos por papel, e listagens/dashboard permitem acompanhamento por responsável e território.
4. Achados podem ser classificados, tratados, resolvidos ou aceitos formalmente; impeditivo aberto bloqueia aprovação e aptidão `FIT`.
5. Submissão, revisão, pedido de ajustes, aprovação, reabertura e cancelamento preservam histórico e respeitam RBAC/transições.
6. Evidências permanecem no domínio proprietário e são vinculadas sem import direto ou duplicação de storage.
7. Concorrência não sobrescreve atualização mais recente silenciosamente.
8. Frontend possui loading, erro, vazio, responsividade e acessibilidade por teclado; backend e UI não dependem de dados hardcoded para indicadores.
9. Fronteiras de workspace permanecem válidas e os plugins de locais, evidências, tarefas e checklists não têm seus contratos alterados silenciosamente.

## Testes e validação

- Unitários junto ao código: transições, respostas obrigatórias, aptidão, progresso, impeditivos, resolução, aceite de risco, concorrência e filtros derivados.
- Integração junto ao código: persistência real do agregado, constraints, RBAC, histórico, eventos e vínculos opacos.
- E2E em `tests/e2e/`: criar, agendar, executar, anexar referência de evidência, registrar impeditivo, bloquear aprovação, resolver, submeter e aprovar.
- Executar `npm run spec:check`, `npm run check:boundaries`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` e `npm run e2e` quando a infraestrutura estiver disponível.
- Ao fim, executar `npm run loc:total` e registrar somente a medição real. É proibido criar código morto, duplicado, gerado artificialmente ou reimplementar bibliotecas genéricas apenas para elevar LOC.

## Fora de escopo

- inspeção predial profissional, laudo de engenharia ou certificação jurídica de acessibilidade;
- telemetria automática de energia/rede, integração com operadoras, mapas externos ou geolocalização obrigatória;
- armazenamento próprio de arquivos, edição de imagem, OCR ou assinatura digital;
- criação automática de incidente, tarefa, pedido de recurso ou despacho;
- execução offline nesta primeira versão;
- alteração do cadastro estrutural do local durante a vistoria;
- substituição das bibliotecas e frameworks já aprovados pelo repositório.
