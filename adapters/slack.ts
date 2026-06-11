// packages/adapters/src/slack/slack.adapter.ts

export type SlackAlertInput = {
  type: "user" | "channel";
  message: string;

  /**
   * Quando type = "channel":
   * - use o ID do canal, exemplo: C0123456789
   * - ou o nome do canal, exemplo: #mxm-omie-integration
   *
   * Quando type = "user":
   * - use o ID do usuário Slack, exemplo: U0123456789
   *
   * Caso type = "channel" e id venha vazio, usa SLACK_ALERT_CHANNEL.
   */
  id: string;
};

type SlackPostMessageResponse = {
  ok: boolean;
  channel?: string;
  ts?: string;
  message?: unknown;
  error?: string;
  warning?: string;
  response_metadata?: {
    warnings?: string[];
    messages?: string[];
  };
};

function getSlackConfig() {
  const botToken = process.env.SLACK_BOT_TOKEN;
  const defaultChannel = process.env.SLACK_DEVELOPMENT_CHANNEL;

  if (!botToken) {
    throw new Error("Variável SLACK_BOT_TOKEN é obrigatória");
  }

  return {
    botToken,
    defaultChannel,
  };
}

function resolveSlackTarget(input: SlackAlertInput, defaultChannel?: string): string {
  const targetId = input.id?.trim();

  if (targetId) {
    return targetId;
  }

  if (input.type === "channel" && defaultChannel) {
    return defaultChannel;
  }

  throw new Error(
    "Destino do Slack não informado. Envie input.id ou configure SLACK_ALERT_CHANNEL.",
  );
}

export async function enviarAlertaSlack(input: SlackAlertInput): Promise<void> {
  const { botToken, defaultChannel } = getSlackConfig();

  const channel = input.id;

  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json; charset=utf-8",
      Accept: "application/json",
    },
    body: JSON.stringify({
      channel,
      text: input.message,
      mrkdwn: true,
      unfurl_links: false,
      unfurl_media: false,
    }),
  });

  const responseText = await response.text();

  let responseBody: SlackPostMessageResponse;

  try {
    responseBody = responseText
      ? (JSON.parse(responseText) as SlackPostMessageResponse)
      : { ok: false, error: "empty_response" };
  } catch {
    throw new Error(
      `Erro ao interpretar resposta do Slack. HTTP Status: ${response.status}. Body: ${responseText}`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `Erro HTTP ao enviar alerta Slack. Status: ${response.status}. Slack error: ${
        responseBody.error ?? "unknown_error"
      }`,
    );
  }

  if (!responseBody.ok) {
    throw new Error(
      `Erro ao enviar alerta Slack. Slack error: ${
        responseBody.error ?? "unknown_error"
      }`,
    );
  }
}

type SlackUser = {
  id: string;
  name?: string;
  deleted?: boolean;
  is_bot?: boolean;
  profile?: {
    display_name?: string;
    display_name_normalized?: string;
    real_name?: string;
    email?: string;
  };
};

type SlackUsersListResponse = {
  ok: boolean;
  members?: SlackUser[];
  error?: string;
  response_metadata?: {
    next_cursor?: string;
  };
};

type SlackConversationsOpenResponse = {
  ok: boolean;
  channel?: {
    id: string;
  };
  error?: string;
};

function normalizeSlackUsername(value: string): string {
  return value.trim().replace(/^@/, "").toLowerCase();
}

export function extrairUsernameDoEmail(email: string): string {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail.includes("@")) {
    throw new Error(`Email inválido para extrair username Slack: ${email}`);
  }

  const [username] = normalizedEmail.split("@");

  if (!username) {
    throw new Error(`Não foi possível extrair username do email: ${email}`);
  }

  return normalizeSlackUsername(username);
}

async function parseSlackResponse<T>(
  response: Response,
  contextMessage: string
): Promise<T> {
  const responseText = await response.text();

  let responseBody: T;

  try {
    responseBody = responseText ? (JSON.parse(responseText) as T) : ({} as T);
  } catch {
    throw new Error(
      `${contextMessage}. Erro ao interpretar resposta do Slack. HTTP Status: ${response.status}. Body: ${responseText}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `${contextMessage}. Erro HTTP Slack. Status: ${response.status}. Body: ${responseText}`
    );
  }

  return responseBody;
}

export async function buscarSlackUserIdPorUsername(
  username: string
): Promise<string | null> {
  const { botToken } = getSlackConfig();

  const targetUsername = normalizeSlackUsername(username);

  let cursor: string | undefined;

  do {
    const params = new URLSearchParams({
      limit: "200",
    });

    if (cursor) {
      params.set("cursor", cursor);
    }

    const response = await fetch(
      `https://slack.com/api/users.list?${params.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${botToken}`,
          Accept: "application/json",
        },
      }
    );

    const responseBody = await parseSlackResponse<SlackUsersListResponse>(
      response,
      "Erro ao listar usuários do Slack"
    );

    if (!responseBody.ok) {
      throw new Error(
        `Erro ao listar usuários do Slack. Slack error: ${
          responseBody.error ?? "unknown_error"
        }`
      );
    }

    const members = responseBody.members ?? [];

    const user = members.find((member) => {
      if (member.deleted || member.is_bot) {
        return false;
      }

      const possibleUsernames = [
        member.name,
        member.profile?.display_name,
        member.profile?.display_name_normalized,
      ]
        .filter(Boolean)
        .map((value) => normalizeSlackUsername(String(value)));

      return possibleUsernames.includes(targetUsername);
    });

    if (user) {
      return user.id;
    }

    cursor = responseBody.response_metadata?.next_cursor || undefined;
  } while (cursor);

  return null;
}

export async function abrirDmComUsuarioSlack(
  slackUserId: string
): Promise<string> {
  const { botToken } = getSlackConfig();

  const response = await fetch("https://slack.com/api/conversations.open", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json; charset=utf-8",
      Accept: "application/json",
    },
    body: JSON.stringify({
      users: slackUserId,
      return_im: false,
    }),
  });

  const responseBody = await parseSlackResponse<SlackConversationsOpenResponse>(
    response,
    "Erro ao abrir DM no Slack"
  );

  if (!responseBody.ok) {
    throw new Error(
      `Erro ao abrir DM no Slack. Slack error: ${
        responseBody.error ?? "unknown_error"
      }`
    );
  }

  if (!responseBody.channel?.id) {
    throw new Error("Slack não retornou channel.id ao abrir DM");
  }

  return responseBody.channel.id;
}

export async function enviarMensagemSlackParaUsername(input: {
  username: string;
  message: string;
}): Promise<void> {
  const slackUserId = await buscarSlackUserIdPorUsername(input.username);

  if (!slackUserId) {
    throw new Error(
      `Usuário Slack não encontrado para username: ${input.username}`
    );
  }

  const dmChannelId = await abrirDmComUsuarioSlack(slackUserId);

  await enviarAlertaSlack({
    type: "channel",
    id: dmChannelId,
    message: input.message,
  });
}

export async function enviarMensagemSlackParaUsuarioPorEmail(input: {
  email: string;
  message: string;
}): Promise<void> {
  const username = extrairUsernameDoEmail(input.email);

  await enviarMensagemSlackParaUsername({
    username,
    message: input.message,
  });
}