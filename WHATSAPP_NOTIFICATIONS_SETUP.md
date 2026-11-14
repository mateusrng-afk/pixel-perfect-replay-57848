# Avisos de agendamento por WhatsApp

Depois que um cliente confirma um horário na página pública, o app envia uma
mensagem de WhatsApp (modelo aprovado pela Meta) para:

1. o cliente (telefone informado na reserva);
2. o barbeiro escolhido (campo `whatsapp_phone` da tabela `barbers`, se preenchido);
3. o administrador (segredo `WHATSAPP_ADMIN_PHONE`, opcional).

Números repetidos recebem só uma mensagem. Telefones brasileiros são convertidos
para apenas dígitos com o prefixo 55.

**A reserva nunca depende do WhatsApp.** Se o envio falhar ou não estiver
configurado, o agendamento continua salvo normalmente.

## Como funciona

- O envio roda no servidor do app (função `notifyBookingWhatsApp`), nunca no
  navegador. O token da Meta só existe nos segredos do servidor.
- Cada agendamento é registrado em `whatsapp_notification_logs` com o estado
  `processing`, `sent` ou `failed` e a mensagem de erro. Isso impede envio em
  duplicidade; só uma tentativa com estado `failed` pode ser repetida.
- Essa tabela só é acessível pelo servidor (nem visitantes nem contas da equipe
  conseguem ler).
- Sem os segredos obrigatórios, o registro fica `failed` com
  `CONFIG_PENDING: faltam os segredos ...`.

## 1. Segredos (configure pelo painel seguro, nunca no código nem no chat)

No Lovable: **Project Settings → Secrets**.

| Segredo | Obrigatório | Padrão | O que é |
| --- | --- | --- | --- |
| `WHATSAPP_ACCESS_TOKEN` | sim | — | Token permanente do usuário do sistema da Meta (WhatsApp Cloud API) |
| `WHATSAPP_PHONE_NUMBER_ID` | sim | — | "Phone number ID" do número da barbearia no WhatsApp Manager |
| `WHATSAPP_TEMPLATE_NAME` | não | `agendamento_confirmado` | Nome do modelo aprovado |
| `WHATSAPP_API_VERSION` | não | `v23.0` | Versão da Graph API |
| `WHATSAPP_ADMIN_PHONE` | não | — | Número do administrador, com DDD (ex.: `82999991234`) |

## 2. Modelo de mensagem aprovado pela Meta

Crie no WhatsApp Manager um modelo em **Português (Brasil) – `pt_BR`**, com o
nome igual a `WHATSAPP_TEMPLATE_NAME`, categoria **Utilidade**, com exatamente
6 variáveis no corpo, nesta ordem:

| Variável | Conteúdo | Exemplo |
| --- | --- | --- |
| `{{1}}` | Nome do cliente | João Silva |
| `{{2}}` | Barbeiro | Genario |
| `{{3}}` | Data | 20/11/2026 |
| `{{4}}` | Hora (horário de Maceió) | 14:30 |
| `{{5}}` | Serviços | Corte, Barba |
| `{{6}}` | Valor | R$ 65,00 |

Exemplo de texto:

> Olá, {{1}}! Seu horário na Barbearia Genario Souza está confirmado com {{2}}
> no dia {{3}} às {{4}}. Serviços: {{5}}. Valor: {{6}}. Até breve!

A Meta pode levar até 48 horas para aprovar. Antes da aprovação, os envios
ficam `failed` e a reserva continua funcionando.

## 3. WhatsApp de cada barbeiro

Preencha `barbers.whatsapp_phone` (com DDD) para quem deve receber o aviso. Por
enquanto isso é feito no Supabase: **Table Editor → barbers → coluna
`whatsapp_phone`**. Deixe vazio para o barbeiro não receber. O número não é
mostrado para os visitantes do site.

## 4. Conferir os envios

No Supabase, **Table Editor → whatsapp_notification_logs**: `sent` = enviado à
Meta; `failed` = veja `error_message`.
