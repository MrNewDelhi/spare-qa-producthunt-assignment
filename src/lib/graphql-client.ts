import type { GraphQLResponse } from "./types";

export const apiUrl =
  process.env.PH_API_URL ?? "https://api.producthunt.com/v2/api/graphql";

export function hasToken(): boolean {
  return Boolean(process.env.PH_API_TOKEN?.trim());
}

export async function gql<T>(
  query: string,
  variables?: Record<string, unknown>,
  token = process.env.PH_API_TOKEN
): Promise<GraphQLResponse<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables })
  });

  const body = (await response.json().catch(() => ({ data: null }))) as {
    data?: T | null;
    errors?: GraphQLResponse<T>["errors"];
  };

  const result: GraphQLResponse<T> = {
    status: response.status,
    data: body.data ?? null,
    headers: response.headers
  };

  if (body.errors) {
    result.errors = body.errors;
  }

  return result;
}

export async function rawGraphqlRequest(init: RequestInit): Promise<Response> {
  return fetch(apiUrl, init);
}
