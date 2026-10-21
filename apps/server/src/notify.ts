// Messages to the owner's phone through a Telegram bot, sent with plain fetch. At most one
// message a minute: anything that arrives in between is batched into the next one, so a burst
// of visitors or a bot cannot flood the phone.

export function telegram(token: string | undefined, chatId: string | undefined, now = () => Date.now()) {
  const queue: string[] = [];
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const send = async () => {
    timer = null;
    if (!queue.length) return;
    last = now();
    const text = queue.splice(0).join("\n");
    if (!token || !chatId) return console.log(`[notify] ${text}`);
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      });
    } catch (e) {
      console.error("[notify] failed", e);
    }
  };

  return (text: string) => {
    queue.push(text);
    if (timer) return;
    const wait = Math.max(0, 60_000 - (now() - last));
    timer = setTimeout(send, wait);
  };
}
