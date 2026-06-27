import { gql, rawGraphqlRequest } from "../../src/lib/graphql-client";
import { POSTS } from "../../src/lib/queries";
import type { Connection, GraphQLResponse, Post } from "../../src/lib/types";

const simplePostsQuery = "{ posts(first: 1) { edges { node { id name } } } }";

export class ProductHuntApi {
  async queryWithoutToken(): Promise<Response> {
    return rawGraphqlRequest({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: simplePostsQuery })
    });
  }

  async queryWithInvalidToken(): Promise<Response> {
    return rawGraphqlRequest({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer invalid_token_for_contract_test"
      },
      body: JSON.stringify({ query: simplePostsQuery })
    });
  }

  async posts(first: number, after?: string): Promise<GraphQLResponse<{ posts: Connection<Post> }>> {
    return gql<{ posts: Connection<Post> }>(POSTS, { first, after });
  }

  async invalidPostField(): Promise<GraphQLResponse<unknown>> {
    return gql<unknown>("{ posts(first:1){ edges { node { id notARealField } } } }");
  }

  async nonStringQueryPayload(query: unknown): Promise<Response> {
    return rawGraphqlRequest({
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PH_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query })
    });
  }
}
