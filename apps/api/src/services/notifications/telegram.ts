type TelegramApiResponse = {
  ok: boolean;
  description?: string;
};

export async function sendTelegramMessage(params: {
  botToken: string;
  chatId: string;
  text: string;
  disableNotification?: boolean;
}): Promise<void> {
  const url = new URL(`https://api.telegram.org/bot${params.botToken}/sendMessage`);

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: params.chatId,
      text: params.text,
      disable_web_page_preview: true,
      disable_notification: Boolean(params.disableNotification)
    })
  });

  const body = (await res.json().catch(() => null)) as TelegramApiResponse | null;
  if (!res.ok || !body?.ok) {
    const message = body?.description ?? `Telegram request failed (${res.status})`;
    throw new Error(message);
  }
}

