import { describe, expect } from "bun:test";
import { gql } from "../../src/lib/graphql-client";
import { POST_BY_ID, POST_BY_SLUG, POSTS_BY_VOTES, TOPICS } from "../../src/lib/queries";
import type { Connection, Post, Topic } from "../../src/lib/types";
import { requirePosts, tokenTest } from "./helpers";

describe("Product Hunt public read contracts", () => {
  tokenTest("posts returns a typed connection", async () => {
    const posts = await requirePosts(5);

    expect(posts.pageInfo.endCursor.length).toBeGreaterThan(0);
    expect(typeof posts.pageInfo.hasNextPage).toBe("boolean");

    for (const edge of posts.edges) {
      expect(edge.node.id).toMatch(/^\d+$/);
      expect(edge.node.name.length).toBeGreaterThan(0);
      expect(typeof edge.node.votesCount).toBe("number");
    }
  });

  tokenTest("post lookup by id and slug returns the same product", async () => {
    const posts = await requirePosts(1);
    const seed = posts.edges[0]?.node;
    expect(seed).toBeDefined();
    if (!seed) {
      throw new Error("expected at least one seed post");
    }

    const byId = await gql<{ post: Post }>(POST_BY_ID, { id: seed.id });
    const bySlug = await gql<{ post: Post }>(POST_BY_SLUG, { slug: seed.slug });

    expect(byId.status).toBe(200);
    expect(bySlug.status).toBe(200);
    expect(byId.data?.post.id).toBe(seed.id);
    expect(bySlug.data?.post.id).toBe(seed.id);
  });

  tokenTest("posts ordered by votes are monotonically non-increasing", async () => {
    const response = await gql<{ posts: Connection<Post> }>(POSTS_BY_VOTES, { first: 10 });
    expect(response.status).toBe(200);
    expect(response.errors).toBeUndefined();

    const votes = response.data?.posts.edges.map((edge) => edge.node.votesCount ?? 0) ?? [];
    expect(votes.length).toBe(10);
    for (let i = 1; i < votes.length; i += 1) {
      const previous = votes[i - 1];
      const current = votes[i];
      expect(previous).toBeDefined();
      expect(current).toBeDefined();
      if (previous === undefined || current === undefined) {
        throw new Error("missing vote count");
      }
      expect(current).toBeLessThanOrEqual(previous);
    }
  });

  tokenTest("topics returns a typed connection", async () => {
    const response = await gql<{ topics: Connection<Topic> }>(TOPICS, { first: 3 });

    expect(response.status).toBe(200);
    expect(response.errors).toBeUndefined();
    expect(response.data?.topics.edges.length).toBe(3);
    expect(response.data?.topics.edges[0]?.node.name.length).toBeGreaterThan(0);
  });
});
