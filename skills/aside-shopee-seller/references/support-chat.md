# Support chat with Shopee

The seller's own chat with Shopee support, reached from the Seller Centre home: a bot first, then a human agent. Not the buyer chat. The rules in `SKILL.md` apply: confirm the account, and read labels live.

Every message you send reaches Shopee under the store's name, so it needs the user's explicit ask (`SKILL.md`, rule 2). Show the user the text read back from the message box before you send it.

## Open the chat

On the Seller Centre home, click the floating support avatar, found by its container id: `#cs-chat-panel-entry-container`. A panel opens with a bot. The panel's menu has an option to restart the bot.

The chat history lives on Shopee's side. Opening the panel in a new tab shows the ongoing conversation, agent included, so a closed tab loses nothing already sent.

## Reach a human agent

The bot offers topic areas, then questions, then a way to talk to support. Pick the ones that match the user's case from the snapshot. After the support option, the bot may wait before it offers to hand over. Then a queue position shows, and an agent joins with a protocol number. Record the protocol number for the user: the panel's consultation-ID search did not find it.

The agent's yes/no buttons ("did I understand?") do not show as snapshot refs. Click by exact text and take the last match: `page.getByText('Sim', { exact: true }).last().click()`.

## Keep the chat open

While the agent investigates, the chat asks every few minutes whether you are still there, and closes after a countdown. Answer yes the same way as above. From a terminal, a background session (`../aside/references/terminal.md`) can check for the prompt in short steps.

## Send a message

1. Find the message box by its placeholder. It changes between bot and agent, so take today's from the snapshot. The limit is written in the bot's placeholder: keep each message under it, or split it.
2. `fill()` the text. From a terminal, pass it as base64 (`../aside/references/terminal.md`).
3. Read it back with `inputValue()`, and show it to the user.
4. On their ask, press `Enter` in the box. Then read the conversation and check your message is there.

## Send an image

The chat holds hidden file inputs. Use the one whose `accept` lists image types; clicking the image icon did not fire a file chooser.

1. Bring the image into the session folder (`../aside/references/terminal.md`).
2. `setInputFiles('./<file>')` on that input. A preview appears in the composer.
3. In the same call, press `Enter` in the message box. That sends it. The staged preview is lost when the tab closes, so a later call cannot send it.
4. Read the conversation and check the image is there.

## Read the conversation

The snapshot flattens messages into long text nodes, hard to split by speaker. Read the DOM instead: among visible `div`s whose text holds the agent's name, take the one with the longest `innerText`. The shortest match is a single bubble, often your own. The newest message sits at the end of that text.

Scope what you print to this conversation, and relay it to the user in your own words.

## Dated examples (2026-09-25; not rules)

- The avatar's tooltip read "Entre em contato com a Shopee". The panel was titled "Assistente do Vendedor", the bot was "Shopito", and "Falar novamente com o Shopito" restarted it.
- The path to a human: "Conta & Fraude" → "Porque minha conta foi limitada?" → an "Atendimento" chip → after about 30 s, "Falar com o nosso atendimento" → a queue position → an agent "juntou-se à conversa" with a protocol number, then "Eu entendi corretamente?" with "Sim" and "Não".
- The message box read "Digite uma mensagem (limite de 500 caracteres)" with the bot, and "Pode me perguntar o que quiser!" with the agent.
- The inactivity prompt read "Parece que você ficou inativo… O chat será encerrado após 60s", with "Não" and "Sim", every couple of minutes.
- The "Procurar ID da Consulta" search did not find the agent's protocol number.
- The image input's `accept` was "image/png, image/jpeg, image/jpg".
