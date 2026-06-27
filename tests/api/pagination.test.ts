import { describe, expect } from "bun:test";
import { gql } from "../../src/lib/graphql-client";
import { POSTS } from "../../src/lib/queries";
import type { Connection, Post } from "../../src/lib/types";
import { requirePosts, tokenTest } from "./helpers";

describe("Product Hunt GraphQL pagination", () => {
  tokenTest("cursor pagination returns distinct pages", async () => {
    const firstPage = await requirePosts(5);
    const secondPage = await gql<{ posts: Connection<Post> }>(POSTS, {
      first: 5,
      after: firstPage.pageInfo.endCursor
    });

    expect(secondPage.status).toBe(200);
    expect(secondPage.errors).toBeUndefined();

    const pageOneIds = new Set(firstPage.edges.map((edge) => edge.node.id));
    const pageTwoIds = secondPage.data?.posts.edges.map((edge) => edge.node.id) ?? [];

    expect(pageTwoIds.length).toBe(5);
    for (const id of pageTwoIds) {
      expect(pageOneIds.has(id)).toBe(false);
    }
  });

  tokenTest("documents invalid cursor behavior", async () => {
    const response = await gql<{ posts: Connection<Post> }>(POSTS, {
      first: 2,
      after: "not_a_cursor"
    });

    expect(response.status).toBe(200);
    expect(response.errors).toBeUndefined();
    expect(response.data?.posts.edges.length).toBe(2);
    expect(response.data?.posts.edges[0]?.cursor).toBe("MQ");
  });
});
