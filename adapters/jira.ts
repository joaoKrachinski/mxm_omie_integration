import { createLogger } from "@shared/logger";

const logger = createLogger("jira-adapter");

export type JiraIssue = {
  jira_id: string;
  summary: string;
  status: string;
  fields: Record<string, unknown>;
};

export type JiraCampoUpdate = {
  jira_id: string;
  campo: string;
  valor: unknown;
};

export type JiraStatusUpdate = {
  jira_id: string;
  status_alvo: string;
};

function getJiraConfig() {
  const baseUrl = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;

  if (!baseUrl || !email || !apiToken) {
    throw new Error(
      "Variáveis JIRA_BASE_URL, JIRA_EMAIL e JIRA_API_TOKEN são obrigatórias",
    );
  }

  return {
    baseUrl,
    email,
    apiToken,
  };
}

export async function getJiraCredentials(email: String, apiToken: String): Promise<string> {
  const token = Buffer.from(`${email}:${apiToken}`).toString(
    "base64",
  );

  return `Basic ${token}`;
}

export async function buscarIssueJira(jiraId: string): Promise<JiraIssue | null> {
  logger.info('Iniciando busca de issue no Jira', { jiraId });

  const { email, apiToken, baseUrl } = getJiraConfig();

  const authHeader = await getJiraCredentials(email, apiToken);
  const url = `${baseUrl}/rest/api/3/issue/${jiraId}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });

    if (response.status === 404) {
      logger.warn('Issue não encontrada no Jira', { jiraId });
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Erro ao buscar issue no Jira', { jiraId, status: response.status, error: errorText });
      throw new Error(`Erro ao buscar issue no Jira: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    logger.info('Issue encontrada no Jira', { jiraId, summary: data.fields.summary, status: data.fields.status.name });

    return {
      jira_id: data.id,
      summary: data.fields.summary,
      status: data.fields.status.name,
      fields: data.fields,
    };
  } catch (error) {
    logger.error('Exceção ao buscar issue no Jira', { jiraId, error: String(error) });
    throw error;
  }
}

export async function atualizarCampoJira(input: JiraCampoUpdate): Promise<void> {
  logger.info("Iniciando atualização de campo no Jira", {
    jiraId: input.jira_id,
    campo: input.campo,
  });

  const { email, apiToken, baseUrl } = getJiraConfig();

  const authHeader = await getJiraCredentials(email, apiToken);

  const url = `${baseUrl}/rest/api/3/issue/${encodeURIComponent(input.jira_id)}`;

  const body = {
    fields: {
      [input.campo]: input.valor,
    },
  };

  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (response.status === 404) {
      logger.warn("Issue não encontrada ao tentar atualizar campo no Jira", {
        jiraId: input.jira_id,
        campo: input.campo,
      });

      throw new Error(`Issue não encontrada no Jira: ${input.jira_id}`);
    }

    if (!response.ok) {
      const errorText = await response.text();

      logger.error("Erro ao atualizar campo no Jira", {
        jiraId: input.jira_id,
        campo: input.campo,
        valor: input.valor,
        status: response.status,
        error: errorText,
      });

      throw new Error(
        `Erro ao atualizar campo no Jira: ${response.status} - ${errorText}`,
      );
    }

    logger.info("Campo atualizado com sucesso no Jira", {
      jiraId: input.jira_id,
      campo: input.campo,
    });
  } catch (error) {
    logger.error("Exceção ao atualizar campo no Jira", {
      jiraId: input.jira_id,
      campo: input.campo,
      error: String(error),
    });

    throw error;
  }
}

function normalizeStr(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export async function atualizarStatusJira(input: JiraStatusUpdate): Promise<void> {
  logger.info("Iniciando transição de status no Jira", {
    jiraId: input.jira_id,
    status_alvo: input.status_alvo,
  });

  const { email, apiToken, baseUrl } = getJiraConfig();
  const authHeader = await getJiraCredentials(email, apiToken);

  const transitionsUrl = `${baseUrl}/rest/api/3/issue/${encodeURIComponent(input.jira_id)}/transitions`;

  const transitionsResponse = await fetch(transitionsUrl, {
    method: "GET",
    headers: { Authorization: authHeader, Accept: "application/json" },
  });

  if (!transitionsResponse.ok) {
    const errorText = await transitionsResponse.text();
    logger.error("Erro ao buscar transições da issue no Jira", {
      jiraId: input.jira_id,
      status: transitionsResponse.status,
      error: errorText,
    });
    if (transitionsResponse.status === 404) {
      throw new Error(
        `Issue ${input.jira_id} não encontrada ou usuário sem permissão de transição no projeto. ` +
        `Verifique se "${process.env.JIRA_EMAIL}" tem permissão "Transicionar Issues" no projeto.`
      );
    }
    throw new Error(`Erro ao buscar transições no Jira: ${transitionsResponse.status} - ${errorText}`);
  }

  const transitionsData = await transitionsResponse.json() as {
    transitions: Array<{ id: string; name: string; to: { name: string } }>;
  };

  const normalized = normalizeStr(input.status_alvo);

  // Busca pela transição cujo status final (to.name) corresponde ao status desejado
  const transition = transitionsData.transitions.find(
    (t) => normalizeStr(t.to?.name ?? "") === normalized
  );

  if (!transition) {
    const available = transitionsData.transitions
      .map((t) => `"${t.to?.name}"`)
      .join(", ");
    logger.error("Status alvo não encontrado nas transições disponíveis", {
      jiraId: input.jira_id,
      status_alvo: input.status_alvo,
      available,
    });
    throw new Error(
      `Status alvo "${input.status_alvo}" não encontrado. Status disponíveis: ${available}`
    );
  }

  logger.info("Transição encontrada — executando", {
    jiraId: input.jira_id,
    transition_id: transition.id,
    transition_name: transition.name,
    status_alvo: transition.to?.name,
  });

  const executeResponse = await fetch(transitionsUrl, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transition: { id: transition.id } }),
  });

  if (!executeResponse.ok) {
    const errorText = await executeResponse.text();
    logger.error("Erro ao executar transição no Jira", {
      jiraId: input.jira_id,
      transition_id: transition.id,
      status: executeResponse.status,
      error: errorText,
    });
    throw new Error(`Erro ao executar transição no Jira: ${executeResponse.status} - ${errorText}`);
  }

  logger.info("Status atualizado com sucesso no Jira", {
    jiraId: input.jira_id,
    status_alvo: transition.to?.name,
  });
}

export async function adicionarComentarioJira(
  jiraId: string,
  texto: string,
  interno = true
): Promise<void> {
  logger.info("Adicionando comentário no Jira", { jiraId, interno });

  const { email, apiToken, baseUrl } = getJiraConfig();
  const authHeader = await getJiraCredentials(email, apiToken);

  const url = `${baseUrl}/rest/api/3/issue/${encodeURIComponent(jiraId)}/comment`;

  const body: Record<string, unknown> = {
    body: {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: texto }],
        },
      ],
    },
  };

  if (interno) {
    body["visibility"] = { type: "role", value: "Service Desk Team" };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error("Erro ao adicionar comentário no Jira", { jiraId, status: response.status, error: errorText });
    throw new Error(`Erro ao adicionar comentário no Jira: ${response.status} - ${errorText}`);
  }

  logger.info("Comentário adicionado com sucesso no Jira", { jiraId, interno });
}

export async function atualizarJiraComoPago(jiraId: string, dataPagamento: string): Promise<void> {
  logger.info("Atualizando Jira como pago", { jiraId, dataPagamento });

  await atualizarStatusJira({ jira_id: jiraId, status_alvo: process.env.JIRA_STATUS_PAGO ?? "Pago" });

  logger.info("Jira atualizado como pago com sucesso", { jiraId });
}

// Busca os usuário do Jira

export type JiraUser = {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  active: boolean;
};

export async function buscarUsuarioJiraPorId(
  accountId: string
): Promise<JiraUser | null> {
  logger.info("Iniciando busca de usuário no Jira", { accountId });

  const { email, apiToken, baseUrl } = getJiraConfig();

  const authHeader = await getJiraCredentials(email, apiToken);

  const url = `${baseUrl}/rest/api/3/user?accountId=${encodeURIComponent(
    accountId
  )}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
    });

    if (response.status === 404) {
      logger.warn("Usuário não encontrado no Jira", { accountId });
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text();

      logger.error("Erro ao buscar usuário no Jira", {
        accountId,
        status: response.status,
        error: errorText,
      });

      throw new Error(
        `Erro ao buscar usuário no Jira: ${response.status} - ${errorText}`
      );
    }

    const data = await response.json();

    logger.info("Usuário encontrado no Jira", {
      accountId,
      displayName: data.displayName,
      hasEmail: Boolean(data.emailAddress),
    });

    return {
      accountId: data.accountId,
      displayName: data.displayName,
      emailAddress: data.emailAddress,
      active: data.active,
    };
  } catch (error) {
    logger.error("Exceção ao buscar usuário no Jira", {
      accountId,
      error: String(error),
    });

    throw error;
  }
}

export async function buscarEmailUsuarioJira(
  accountId: string
): Promise<string | null> {
  const usuario = await buscarUsuarioJiraPorId(accountId);

  if (!usuario) {
    return null;
  }

  if (!usuario.emailAddress) {
    logger.warn("Usuário encontrado, mas email não está disponível", {
      accountId,
      displayName: usuario.displayName,
    });

    return null;
  }

  return usuario.emailAddress;
}

export async function buscarAccountIdPorEmail(
  userEmail: string
): Promise<string | null> {
  logger.info("Iniciando busca de accountId no Jira por email", { userEmail });

  const { email: jiraEmail, apiToken, baseUrl } = getJiraConfig();

  const authHeader = await getJiraCredentials(jiraEmail, apiToken);

  const url = `${baseUrl}/rest/api/3/user/search?query=${encodeURIComponent(
    userEmail
  )}&maxResults=10`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();

      logger.error("Erro ao buscar accountId no Jira por email", {
        userEmail,
        status: response.status,
        error: errorText,
      });

      throw new Error(
        `Erro ao buscar accountId no Jira: ${response.status} - ${errorText}`
      );
    }

    const users = (await response.json()) as Array<{
      accountId: string;
      displayName: string;
      emailAddress?: string;
      active: boolean;
    }>;

    if (!users.length) {
      logger.warn("Nenhum usuário encontrado no Jira para o email informado", {
        userEmail,
      });

      return null;
    }

    const normalizedEmail = userEmail.trim().toLowerCase();

    const exactUser = users.find(
      (user) => user.emailAddress?.trim().toLowerCase() === normalizedEmail
    );

    if (exactUser) {
      logger.info("AccountId encontrado por match exato de email", {
        userEmail,
        accountId: exactUser.accountId,
        displayName: exactUser.displayName,
      });

      return exactUser.accountId;
    }

    if (users.length === 1) {
      const [user] = users;

      logger.warn(
        "Usuário encontrado, mas emailAddress não veio disponível para validação exata",
        {
          userEmail,
          accountId: user.accountId,
          displayName: user.displayName,
        }
      );

      return user.accountId;
    }

    logger.warn(
      "Mais de um usuário encontrado para o email informado; não foi possível escolher com segurança",
      {
        userEmail,
        totalUsers: users.length,
        users: users.map((user) => ({
          accountId: user.accountId,
          displayName: user.displayName,
          hasEmail: Boolean(user.emailAddress),
        })),
      }
    );

    return null;
  } catch (error) {
    logger.error("Exceção ao buscar accountId no Jira por email", {
      userEmail,
      error: String(error),
    });

    throw error;
  }
}

export type JiraSearchIssue = {
  key: string;
  fields: Record<string, unknown>;
};

export async function buscarIssuesPorJQL(
  jql: string,
  fields: string[] = []
): Promise<JiraSearchIssue[]> {
  logger.info("Iniciando busca de issues por JQL", { jql });

  const { email, apiToken, baseUrl } = getJiraConfig();
  const authHeader = await getJiraCredentials(email, apiToken);

  const url = `${baseUrl}/rest/api/3/search/jql`;
  const PAGE_SIZE = 100;
  const allIssues: JiraSearchIssue[] = [];
  let nextPageToken: string | undefined;

  do {
    const body: Record<string, unknown> = {
      jql,
      maxResults: PAGE_SIZE,
    };
    if (fields.length) body["fields"] = fields;
    if (nextPageToken) body["nextPageToken"] = nextPageToken;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Erro ao buscar issues por JQL", { status: response.status, error: errorText, jql });
      throw new Error(`Erro ao buscar issues por JQL: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as {
      issues: Array<{ key: string; fields: Record<string, unknown> }>;
      nextPageToken?: string;
    };

    allIssues.push(...data.issues);
    nextPageToken = data.nextPageToken;

    logger.info("Página de issues carregada", {
      jql,
      retornados: data.issues.length,
      total_ate_agora: allIssues.length,
      tem_proxima_pagina: Boolean(nextPageToken),
    });
  } while (nextPageToken);

  logger.info("Busca por JQL concluída", { jql, total: allIssues.length });
  return allIssues;
}