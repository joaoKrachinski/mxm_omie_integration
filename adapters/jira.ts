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
  transition_id: string;
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

export async function atualizarStatusJira(input: JiraStatusUpdate): Promise<void> {
  // TODO: implementar transição de status no Jira
  // POST {JIRA_BASE_URL}/rest/api/3/issue/{jira_id}/transitions
  throw new Error("TODO: atualizarStatusJira não implementado");
}

export async function atualizarJiraComoPago(jiraId: string, dataPagamento: string): Promise<void> {
  // TODO: implementar atualização do Jira refletindo pagamento confirmado no Omie
  throw new Error("TODO: atualizarJiraComoPago não implementado");
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