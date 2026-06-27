# Product Hunt GraphQL API v2 — Reference (compiled from docs + live probing)

Sources: [api.producthunt.com/v2/docs](https://api.producthunt.com/v2/docs) · [rate limits](https://api.producthunt.com/v2/docs/rate_limits/headers) · [GraphQL reference](https://api-v2-docs.producthunt.com/) · live probe 2026-06.

**Endpoint:** `POST https://api.producthunt.com/v2/api/graphql`
**Auth header:** `Authorization: Bearer {token}`

---

## Authentication

| Method | Use | Notes |
|---|---|---|
| **Developer Token** | simple scripts (our tests) | Non-expiring, account-linked; from [dashboard](https://www.producthunt.com/v2/oauth/applications). **This is what `PH_API_TOKEN` holds.** |
| OAuth User | act on behalf of a user | authorize → token exchange. Needed for `viewer` + viewer-context fields. |
| OAuth Client-Only | read-only, no user | `viewer` and `is*` fields won't be meaningful. |

### Scopes
- **public** — default; all apps are read-only.
- **private** — read private endpoints (needs `"private public"`).
- **write** — mutations; requires PH approval.

→ Our suite uses a **public/developer token only**. Mutations are out of scope (ethical + scope).

---

## Rate limits  → drives test API-007

| Endpoint | Quota / 15 min | On exceed |
|---|---|---|
| **GraphQL** (`/v2/api/graphql`) | **6250 complexity points** | HTTP **429** |
| Other `/v2/*` | 450 requests | HTTP 429 |

Complexity is computed from the fields requested. **Every response carries:**
- `X-Rate-Limit-Limit` — quota for the window
- `X-Rate-Limit-Remaining` — remaining quota
- `X-Rate-Limit-Reset` — seconds until reset

**QA implications:** keep `first:` small; assert headers exist; tolerate 429; the 6250 budget is generous for a test run but shared per-application, so CI parallelism must stay modest.

---

## Schema shape

- **8 query ops:** `post`, `posts`, `comment`, `comments`, `collection`, `collections`, `topic`, `topics`, `user`, `viewer`.
- **2 mutations:** `userFollow(UserFollowInput)`, `userFollowUndo(UserFollowUndoInput)` — write scope.
- **~26 object types**; standard Relay **cursor pagination** (`*Connection` → `edges { node, cursor }` + `pageInfo`).
- **Scalars:** `String Int Float Boolean ID DateTime`. `DateTime` is a **custom scalar** (ISO-8601) → assert format.
- **Interfaces:** `VotableInterface`, `TopicableInterface`.
- **Directives:** `@deprecated @skip @include @oneOf`.

### Connection / pagination
```graphql
posts(first: 5) {
  edges { node { id name } cursor }
  pageInfo { startCursor endCursor hasNextPage hasPreviousPage }
}
```

---

## Query root (arguments)

| Query | Args | Returns |
|---|---|---|
| `post` | `id: ID`, `slug: String` (provide one) | `Post` |
| `posts` | `first last after before`, `featured: Boolean`, `order: PostsOrder`, `postedAfter postedBefore: DateTime`, `topic: String`, `twitterUrl: String`, `url: String` | `PostConnection!` |
| `topic` | `id` or `slug` | `Topic` |
| `topics` | `first last after before`, `order: TopicsOrder`, `followedByUserid: ID`, `query: String` | `TopicConnection!` |
| `collection` | `id` | `Collection` |
| `collections` | `first last after before`, `order`, `featured`, `postId`, `userId` | `CollectionConnection!` |
| `comment` | `id` | `Comment` |
| `comments` | `first last after before`, `order: CommentsOrder` | `CommentConnection!` |
| `user` | `id` or `username` | `User` |
| `viewer` | none | `Viewer` (needs user-auth token) |

### Enums
- **PostsOrder:** `FEATURED_AT`, `NEWEST`, `RANKING`, `VOTES`
- `CommentsOrder`, `TopicsOrder`, `CollectionsOrder` also exist (ordering variants).

---

## Object fields (key types)

### Post
`id ID!` · `name String!` · `tagline String!` · `description String` · `slug String!` · `url String!` · `website String!` · `votesCount Int!` · `commentsCount Int!` · `reviewsCount Int!` · `reviewsRating Float!` · `createdAt DateTime!` · `featuredAt DateTime` · `thumbnail Media` · `media [Media!]!` · `topics TopicConnection!` · `makers [User!]!` · `user User!` · `productLinks [ProductLink!]!` · `comments CommentConnection!` · `votes VoteConnection!` · `isCollected Boolean!` · `isVoted Boolean!`

### User
`id ID!` · `name String!` · `username String!` · `headline String` · `profileImage String (size)` · `coverImage String (w/h)` · `twitterUsername String` · `websiteUrl String` · `url String!` · `isMaker Boolean!` · `isFollowing Boolean!` · `isViewer Boolean!` · `createdAt DateTime` · `followersCount Int!` · `followingCount Int!` · `madePosts/votedPosts PostConnection!` · `followers/following UserConnection!` **(@deprecated)**

### Topic
`id ID!` · `name String!` · `slug String!` · `description String!` · `url String!` · `image String (w/h)` · `postsCount Int!` · `followersCount Int!` · `isFollowing Boolean!` · `createdAt DateTime!`

### Comment
`id ID!` · `body String!` · `createdAt DateTime!` · `url String!` · `user User!` · `userId ID!` · `votesCount Int!` · `isVoted Boolean!` · `replies CommentConnection!` · `parent Comment` · `parentId ID` · `votes VoteConnection!` (implements VotableInterface)

### Collection
`id ID!` · `name String!` · `tagline String!` · `description String` · `url String!` · `coverImage String` · `followersCount Int!` · `isFollowing Boolean!` · `createdAt DateTime!` · `featuredAt DateTime` · `user User!` · `userId ID!` · `posts PostConnection!` · `topics TopicConnection!`

---

## QA-relevant observations (feed findings + new test ideas)

1. **Error contract is OAuth-style, not GraphQL-spec** — 401 + `{errors:[{error, error_description}]}` (no `message`). [confirmed live]
2. **Viewer-context fields** (`isVoted`, `isCollected`, `isFollowing`, `isViewer`, `viewer`) are meaningless with a client/dev token → test their behavior (likely `false`/error) to document the contract.
3. **Deprecated fields** (`User.followers`/`following`) → query one and confirm `@deprecated` surfaces; ensures the schema honours deprecation.
4. **`post(id, slug)` both optional** — test passing neither (expect error) and both (precedence?) as edge cases.
5. **`DateTime` custom scalar** — assert ISO-8601 on `createdAt`/`featuredAt`.
6. **Complexity budget shared per app** — keep CI request volume low; a deep nested query is a cheap way to probe complexity scoring.

## New/sharpened test cases to fold into test-cases.md
- **API-009** `posts(order: VOTES, first: 5)` → `votesCount` is non-increasing (ordering correctness).
- **API-010** `post(slug: <known>)` returns same node as `post(id: <id>)` (id/slug parity).
- **API-011** `viewer` / `isVoted` with dev token → documents viewer-context behavior.
- **API-012** Deep/expensive query → inspect `X-Rate-Limit-*` headers decrement (complexity scoring).
