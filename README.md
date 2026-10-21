# Portal de Processos

Portal web com login e senha, aprovação de cadastro pela administradora e dois processos: **Reembolso de despesas** e **Chamados de TI**.

- **Página:** `index.html`, hospedada no GitHub Pages.
- **Login, banco de dados e comprovantes:** Supabase.

## Tela inicial (portal)

Depois de entrar, todo usuário cai na tela inicial do **Portal de Processos**. Ela mostra um cartão para cada processo disponível: **Reembolso de despesas** e **Chamados de TI**. O cartão mostra as pendências de quem está logado. Por exemplo, solicitações devolvidas para ajuste, ou, para o financeiro, quantas estão para analisar.

A administradora vê ainda uma área **Administração**, com o cartão **Usuários**, onde aprova os cadastros. Os usuários valem para o portal inteiro, então quem foi aprovado uma vez acessa todos os processos.

Para personalizar ou crescer:

- **Nome do portal:** no topo do código, edite `PORTAL_NAME` e `PORTAL_TAGLINE`.
- **Novo processo:** acrescente um item na lista `PROCESSES` e crie a tela dele em `renderView()`. Se quiser, peça ao Claude que faça isso.
- **Links diretos:** o endereço com `#reembolsos` no final abre direto o processo de reembolso, com `#ti` abre os chamados de TI, e o endereço sem nada no final abre a tela inicial.

## Como funcionam os chamados de TI

1. **Abertura.** O colaborador informa título, tipo de demanda, urgência, data desejada e a descrição. Também diz se precisa de uma reunião para explicar a demanda e, se precisar, a disponibilidade dele. Pode anexar arquivos e colar links.
2. **Verificação do TI.** Na aba **Fila do TI**, o chamado aparece em "Para analisar". O TI escolhe **Tenho tudo, dar previsão** ou **Falta material**. Se foi pedida reunião, registra a data e o link.
3. **Previsão.** Com tudo em mãos, o TI define a data de entrega e o chamado passa para "Em andamento", organizado por prazo. Os atrasados ficam destacados.
4. **Material pendente.** A qualquer momento o TI pode pedir mais material e revisar o prazo junto, ou só revisar o prazo informando o motivo. O colaborador vê o aviso e responde em **Enviar material pendente**, e o chamado volta para a verificação do TI. O sistema guarda o prazo original e conta quantas vezes ele foi revisado.
5. **Congelar.** O TI congela o que não será priorizado agora, com o motivo e, se quiser, uma data para revisitar. Os congelados ficam na aba **Congelados**. Quando a data chega, ou depois de 30 dias sem data, eles sobem para o topo e aparece um aviso na Fila. **Retomar chamado** devolve o chamado à etapa em que estava.

**Quem é do TI:** na aba **Usuários**, a administradora clica em **Incluir no TI** ao lado de cada pessoa da equipe. A administradora também enxerga a Fila do TI.

Cada colaborador vê só os próprios chamados. A equipe de TI vê todos. O banco de dados impede o colaborador de mudar prazo, status ou dados do TI. Ele só pode enviar material, comentar ou cancelar. O histórico de cada chamado não pode ser apagado.

## Como funciona o reembolso

1. **Cadastro.** O colaborador cria a conta com nome, e-mail e senha e confirma o e-mail pelo link que recebe.
2. **Aprovação do acesso.** A conta fica **aguardando aprovação**. A administradora libera o acesso na aba **Usuários**.
3. **Solicitação.** Já aprovado, o colaborador envia uma solicitação com uma ou mais despesas. Cada despesa tem o seu comprovante, e o total é somado automaticamente.
4. **Análise.** O financeiro aprova, devolve para ajuste (com a explicação do que corrigir) ou recusa. Depois registra o pagamento.

Cada colaborador vê só as próprias solicitações. O financeiro e a administradora veem todas. Essa regra é aplicada pelo próprio banco de dados, e não só pela tela.

Regras que o sistema aplica, inclusive no servidor:

- **Prazo:** as despesas de cada mês podem ser enviadas até o dia 5 do mês seguinte.
- **Km:** o colaborador informa os km rodados e o sistema calcula o valor a R$ 1,10 por km. O valor é ajustável em Configurações.
- **Comprovante:** obrigatório em todas as categorias, exceto Km.
- **Total:** a soma das despesas é calculada pelo servidor.

Já entram aprovados ao se cadastrar:

| E-mail | Perfil |
|---|---|
| leticia@pronegocios.com.br | administradora |
| regiane@pronegocios.com.br | financeiro |
| aline.oliveira@pronegocios.com.br | financeiro |
| christian@pronegocios.com.br | financeiro |

Para mudar essa lista, edite a função `handle_new_user` no `setup.sql` antes de rodar, ou altere os perfis depois na aba Usuários.

---

## Instalação

### 1. Criar o projeto no Supabase

1. Em https://supabase.com, crie um projeto novo, de preferência na região **South America (São Paulo)**.
2. Abra **SQL Editor**, clique em **New query**, cole todo o conteúdo de `setup.sql` e clique em **Run**. A mensagem esperada é "Success. No rows returned".
3. Abra outra **New query**, cole todo o conteúdo de `chamados-ti.sql` e clique em **Run**. Ele cria os chamados de TI e não mexe nos dados de reembolso. Se o projeto já estava funcionando, rode só este.

### 2. Configurar o login

Os nomes das telas são os do painel do Supabase e podem mudar com o tempo.

1. **Authentication → Sign In / Providers → Email:** deixe o login por e-mail ativado e **Confirm email** ligado.
2. **Authentication → URL Configuration:**
   - Em **Site URL**, coloque o endereço do GitHub Pages, que você terá no passo 4. Exemplo: `https://seu-usuario.github.io/reembolsos/`
   - Em **Redirect URLs**, adicione o mesmo endereço.
3. **Importante: configure o envio de e-mails.** O envio padrão do Supabase serve só para testes. Ele manda poucos e-mails por hora, o que bloqueia as confirmações de cadastro e a recuperação de senha quando várias pessoas se cadastram ao mesmo tempo.
   - Antes de liberar para a equipe, configure um SMTP próprio em **Authentication → Emails → SMTP Settings**.
   - Pode ser o SMTP do Microsoft 365 ou um serviço de envio. A equipe de TI costuma ter esses dados.
   - Em **Authentication → Emails → Templates** você pode traduzir para o português os e-mails de confirmação e de nova senha.

### 3. Ligar a página ao projeto

1. No Supabase, abra **Project Settings → API**. Copie a **Project URL** e a chave **anon public**.
2. Abra `index.html` num editor de texto. No começo do código, substitua:
   ```js
   const SUPABASE_URL = "COLE_AQUI_A_URL_DO_PROJETO";
   const SUPABASE_ANON_KEY = "COLE_AQUI_A_CHAVE_ANON_PUBLIC";
   ```
   pela URL e pela chave copiadas.

A chave **anon public** pode ficar visível na página. Ela só dá acesso ao que as regras de segurança do banco permitem. **Nunca** coloque na página a chave **service_role**.

### 4. Publicar no GitHub Pages

1. No GitHub, crie um repositório, por exemplo `reembolsos`, e envie o arquivo `index.html` para ele.
2. No repositório, abra **Settings → Pages**. Em **Source**, escolha **Deploy from a branch**, depois a branch `main` e a pasta `/ (root)`, e clique em **Save**.
3. Em um ou dois minutos o endereço aparece no topo da página. Ele tem o formato `https://seu-usuario.github.io/reembolsos/`.
4. Volte ao passo 2.2 e coloque esse endereço no Supabase.

No plano gratuito do GitHub, o GitHub Pages exige repositório público. Não há problema: o código não contém senhas nem dados.

### 5. Primeiro acesso

1. Abra o endereço, clique em **Criar conta** e cadastre-se com `leticia@pronegocios.com.br`.
2. Confirme o e-mail e entre. Você já entra como administradora.
3. Peça ao financeiro que faça o mesmo. Eles entram já aprovados.
4. Divulgue o endereço para os colaboradores. Os novos cadastros aparecem na aba **Usuários** para você aprovar.

### 6. Colocar na página do SharePoint

1. Edite a página do SharePoint e adicione a web part **Botão** ou **Links rápidos**.
2. Use o texto "Solicitar reembolso" e cole o endereço do GitHub Pages.
3. Republique a página.

---

## O que ainda não está incluído

- **Avisos por e-mail.** O financeiro e o TI veem as pendências na própria plataforma, com contadores nas abas e no cartão da tela inicial. O colaborador vê o status na lista dele, inclusive quando o TI está esperando material. Para mandar e-mails automáticos, um próximo passo é ligar um *Database Webhook* do Supabase a um serviço de envio.
- **Agenda da reunião.** O TI registra a data e o link da reunião no chamado, mas o convite no calendário continua sendo enviado pelo Outlook.
- **Dados do app antigo.** As solicitações do app que estava no Claude não são migradas. Lá havia só a solicitação de teste.
