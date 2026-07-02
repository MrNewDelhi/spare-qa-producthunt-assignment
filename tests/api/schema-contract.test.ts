import { describe, expect } from "bun:test";
import { z } from "zod";
import { gql } from "../../src/lib/graphql-client";
import { tokenTest } from "./helpers";

// Runtime schema-contract validation.
//
// The rest of the API suite asserts individual fields by hand. Here we validate
// the ENTIRE node shape against a Zod schema in one shot. That catches type and
// nullability drift the moment the API deviates from its documented contract
// (e.g. a field marked `String!` coming back `null`, or a number turning into a
// string) — the kind of regression per-field `expect`s quietly miss.

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, "ISO-8601 datetime");
const httpUrl = z.string().regex(/^https?:\/\//, "http(s) URL");

const PostNode = z.object({
  id: z.string().regex(/^\d+$/),
  name: z.string().min(1),
  tagline: z.string(), // documented non-null; may legitimately be "" for some records
  slug: z.string().min(1),
  url: httpUrl,
  website: httpUrl.nullable(),
  votesCount: z.number().int().nonnegative(),
  commentsCount: z.number().int().nonnegative(),
  createdAt: iso,
  featuredAt: iso.nullable(),
  user: z.object({
    id: z.string().regex(/^\d+$/),
    name: z.string().min(1),
    username: z.string().min(1)
  })
});

type PostsResponse = { posts: { edges: Array<{ node: z.infer<typeof PostNode> }> } };

describe("Product Hunt GraphQL schema contract (runtime validation)", () => {
  tokenTest("post nodes match the typed Zod schema exactly", async () => {
    const res = await gql<PostsResponse>(`
      query {
        posts(first: 5, order: VOTES) {
          edges {
            node {
              id name tagline slug url website
              votesCount commentsCount createdAt featuredAt
              user { id name username }
            }
          }
        }
      }
    `);

    expect(res.status).toBe(200);
    expect(res.errors).toBeUndefined();

    const nodes = res.data?.posts.edges.map((edge) => edge.node) ?? [];
    expect(nodes.length).toBeGreaterThan(0);

    for (const node of nodes) {
      const result = PostNode.safeParse(node);
      expect(result.success, `schema mismatch for post ${node.id}: ${JSON.stringify(result.error?.issues)}`).toBe(true);
    }
  });
});
