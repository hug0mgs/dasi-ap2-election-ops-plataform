# SPEC — Operação de campo sem conexão

**Data:** 2026-11-17
**Status:** `proposed`
**SPEC Gate:** `NEW_SPEC`

## Objetivo

Permitir que um usuário autenticado registre ocorrências, atualize o estado de despachos e preencha itens de checklists de preparação quando a API estiver indisponível, com fila visível e sincronização posterior. As regras de autorização e transição continuam pertencendo aos servidores dos respectivos domínios.

## Escopo e fronteiras

- Ocorrência significa criação de incidente no plugin `incidents`; não inclui upload de anexos, criação de categorias nem alterações posteriores do incidente.
- Despacho significa transição de estado de despacho **existente** no plugin `field-teams`; não inclui criação de despacho, mudanças de equipe ou elegibilidade offline garantida.
- Checklist significa atualização de item **existente** no plugin `preparation-checklists`; não inclui criação de checklist, evidências, aprovação ou revogação offline.
- Captura offline é disponibilizada nas interfaces dos três plugins, mantendo seus serviços e regras no domínio proprietário; a fila compartilhada pode viver em um package público de cliente se necessária para visibilidade transversal, sem importar `src/` de outro workspace.
- Não há promessa de navegação offline integral nem cache completo da aplicação: o operador precisa ter carregado a aplicação e as referências necessárias antes da perda de conexão. Sem referências locais suficientes, impedir a ação e informar a limitação.
- Não adicionar biblioteca, service worker ou permissão nova sem evidência de necessidade. Persistência mínima de chave de idempotência no servidor é permitida quando necessária para garantir deduplicação após timeout. O servidor continua sendo a fonte de verdade.

## Contrato da fila

- Cada operação contém ID local estável, tipo, payload estritamente necessário, usuário proprietário, data/hora de captura, estado e histórico mínimo de tentativas/erros. A fila persistida no navegador é isolada por usuário; logout e troca de usuário não podem transmitir operações de outra identidade. Não persistir token, segredo nem anexos.
- A gravação local deve confirmar persistência antes de indicar sucesso; falhas de armazenamento exibem erro e não simulam operação concluída.
- Estados visíveis: pendente, em sincronização, falhou e sincronizada (esta última somente após confirmação do servidor; histórico pode ser removido explicitamente). Mostrar quantidade, tipo, momento e resultado/erro de cada item.
- Sincronizar automaticamente ao recuperar conectividade e permitir repetição manual; serializar envios de uma mesma fila e manter ordem para operações do mesmo recurso. Evitar envio paralelo por abas da mesma identidade.
- Erro de transporte mantém operação pendente para nova tentativa; resposta definitiva de validação, permissão ou conflito marca falha, preserva payload e permite correção ou descarte explícito sem sobrescrever o servidor silenciosamente. Não declarar sucesso antes da resposta HTTP.
- Uma falha em item não deve apagar demais itens; mudanças remotas concorrentes devem ser detectadas ou rejeitadas pelo servidor. Reconsultar o estado real após sincronização bem-sucedida.

## Integridade e segurança

- A fila não concede permissão: cada requisição sincronizada passa pelos guards e validações existentes. Revalidar identidade e permissões no momento do envio; não sincronizar operações de usuário anterior após logout.
- Reenvio após timeout não pode duplicar ocorrência nem repetir efeitos colaterais: adotar chave de idempotência estável por operação e deduplicação persistida no servidor para criação; considerar comportamento idempotente ou rejeição segura nas transições de despacho e atualização de item. Definir os pontos de integração sem enfraquecer contratos existentes.
- Evitar last-write-wins silencioso: guardar versão/estado observado na captura para as mutações sobre recursos existentes e tratar divergência como conflito revisável. Não transformar falha de autorização em retry automático infinito.
- A fila é dado local sensível: mostrar aviso de armazenamento neste dispositivo; nunca incluir credenciais, não compartilhar entre perfis, tratar indisponibilidade de armazenamento privado/quota e limpar dados na saída segundo política explícita documentada.

## Critérios de aceite

1. Usuário com permissão aplicável consegue preparar e enfileirar cada uma das três operações suportadas sem conexão, e vê confirmação de que está **pendente**, não concluída no servidor.
2. A fila persistente mostra todas as operações daquele usuário, suas tentativas/erros e controles de sincronizar e descartar; permanece após recarregar a página no mesmo navegador.
3. Ao voltar a conexão, as operações são submetidas às APIs públicas, confirmadas pelo servidor e refletidas no estado atualizado; uma falha não resulta em perda silenciosa.
4. Reenvio, concorrência entre abas, troca de usuário, perda de permissão, payload inválido e conflito com alteração remota têm comportamento seguro, visível e coberto por testes.
5. Exportações e demais fluxos online dos três plugins permanecem inalterados; fronteiras de workspace, RBAC e auditoria/eventos de domínio existentes continuam íntegros.

## Testes e validação

- Unitários junto ao código: persistência e isolamento da fila, classificação de erros, ordenação, retry, idempotência e conflitos.
- Integração junto ao código: endpoints e serviços reais autorizam/deduplicam mutações e preservam auditoria/eventos; registrar indisponibilidade de banco se ocorrer.
- E2E em `tests/e2e/`: cenário desconectado, recarga, fila visível e retorno da conexão para cada fluxo; executar quando navegador/API/banco estiverem disponíveis.
- Executar `npm run spec:check`, `npm run check:boundaries`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` e, se houver infraestrutura, `npm run e2e`. Registrar comandos não executáveis e razão.

## Fora de escopo

Cache completo de leitura, anexos offline, geolocalização, aprovação de checklist offline, atribuição de equipes offline, sincronização entre dispositivos antes do envio e sincronização em background com a aplicação fechada.