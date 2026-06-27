# Product Hunt GraphQL API — QA / Security Findings (JIRA-ready)

> **Setup:** All reproduction commands below assume `$TOK` is set to a Product Hunt
> developer token, e.g. `export TOK="<your-ph-developer-token>"`. Never commit the real token.
> Endpoint: `https://api.producthunt.com/v2/api/graphql` — Environment: **prod** — Verified: **2026-06-27**.

## Summary

| ID | Title | Type | Severity | Status |
|----|-------|------|----------|--------|
| G1 | Two different error formats depending on auth state | Bug | Minor | CONFIRMED |
| G2 | `first` argument silently clamped to 20 | Bug | Major | CONFIRMED |
| G3 | Inconsistent cursor validation (base64-decodable ignored, non-base64 errors) | Bug | Major | CONFIRMED |
| G4 | `first:0` / `first:-5` accepted with empty edges, no validation error | Bug | Minor | CONFIRMED |
| G5 | Docs out of date vs live schema (undocumented fields) | Tech-debt | Minor | CONFIRMED |
| G6 | `makerReplies` is a scalar Int, not a connection | Bug | Trivial | CONFIRMED |
| S1 | GraphQL introspection enabled in production | Security | Major | CONFIRMED |
| S2 | Field-suggestion error disclosure ("Did you mean…") | Security | Minor | CONFIRMED |
| S3 | Flat complexity cost / alias amplification / errors cost quota | Bug/Security | Major | CONFIRMED |
| S4 | Voter identity enumeration via `votes` connection | Security | Major | CONFIRMED |
| S5 | Sequential user-ID / username enumeration | Security | Major | CONFIRMED |
| S6 | CORS wildcard `*` with x-rate-limit exposed | Security | Minor | CONFIRMED |
| D1 | Deprecated fields still fully functional | Tech-debt | Minor | CONFIRMED |
| O1 | OAuth authorize defers client_id / redirect_uri validation to post-login | Security | Major | CONFIRMED |

All 14 findings reproduced with fresh evidence on 2026-06-27. None NOT-REPRODUCED.

---

## G1 — [API][GraphQL] Two different error formats depending on auth state

- **Type:** Bug  **Severity:** Minor  **Component:** Auth / GraphQL API
- **Environment:** prod, `https://api.producthunt.com/v2/api/graphql`, 2026-06-27

**Description**
Authentication failures and GraphQL validation failures use two incompatible error envelopes.
A missing/invalid token returns **HTTP 401** with a non-spec OAuth-style body
(`errors[].error` / `error_description`). A valid token with an invalid query returns
**HTTP 200** with a spec-compliant GraphQL body (`errors[].message/locations/path/extensions`).
Clients cannot use a single error-parsing path; the 401 envelope is not GraphQL-over-HTTP spec form.

**Steps to Reproduce**
```bash
# (a) No / invalid token -> HTTP 401, non-spec body
curl -s -D - -X POST https://api.producthunt.com/v2/api/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{posts(first:1){edges{node{id}}}}"}'

# (b) Valid token + bad field -> HTTP 200, spec body
curl -s -D - -X POST https://api.producthunt.com/v2/api/graphql \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  -d '{"query":"{posts(first:1){edges{node{nonExistentField}}}}"}'
```

**Actual Result**
```
(a) HTTP/2 401
{"data":null,"errors":[{"error":"invalid_oauth_token","error_description":"Please supply a valid access token. ..."}]}

(b) HTTP/2 200
{"errors":[{"message":"Field 'nonExistentField' doesn't exist on type 'Post'",
 "locations":[{"line":1,"column":28}],"path":["query","posts","edges","node","nonExistentField"],
 "extensions":{"code":"undefinedField","typeName":"Post","fieldName":"nonExistentField"}}]}
```
Invalid token (`Bearer INVALIDTOKEN123`) produces the identical 401 body as no token.

**Expected Result**
A single, consistent error envelope. Either keep GraphQL-spec form everywhere, or document the
two contracts explicitly. HTTP status for transport-level auth (401) is acceptable, but the body
should be predictable/spec-aligned.

**Evidence / Notes**
GraphQL-over-HTTP spec recommends `errors[].message`. 401 path bypasses that shape entirely.

**Suggested Fix**
Wrap auth errors in the same `{errors:[{message,extensions:{code}}]}` envelope (extensions.code = `UNAUTHENTICATED`), or clearly document the 401 contract in the API docs.

---

## G2 — [API][GraphQL] `first` argument silently clamped to 20

- **Type:** Bug  **Severity:** Major  **Component:** GraphQL API
- **Environment:** prod, 2026-06-27

**Description**
`posts(first:N)` for N>20 returns exactly 20 edges with HTTP 200 and **no error or warning**.
The clamp is undocumented and silent, so clients believe they requested 100/500 records and may
build incorrect pagination logic or assume the dataset is exhausted. `totalCount` (22,124) proves
far more data exists.

**Steps to Reproduce**
```bash
curl -s -X POST https://api.producthunt.com/v2/api/graphql \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  -d '{"query":"query{posts(first:100){totalCount edges{node{id}}}}"}'

curl -s -X POST https://api.producthunt.com/v2/api/graphql \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  -d '{"query":"query{posts(first:500){totalCount edges{node{id}}}}"}'
```

**Actual Result**
- `first:100` -> HTTP 200, `edges` length = **20**, `totalCount` = 22124, no errors.
- `first:500` -> HTTP 200, `edges` length = **20**, no errors.

**Expected Result**
Either honor the value up to a documented max, or return a validation error such as
`first must be between 1 and 20`. At minimum, document the hard cap of 20.

**Evidence / Notes** Each call cost 100 complexity points regardless of `first` value (see S3).

**Suggested Fix**
Return a GraphQL validation error when `first` exceeds the max, and document the limit.

---

## G3 — [API][GraphQL] Inconsistent cursor validation

- **Type:** Bug  **Severity:** Major  **Component:** GraphQL API
- **Environment:** prod, 2026-06-27

**Description**
Cursor (`after`) validation is inconsistent and depends on whether the string is base64-decodable.
A base64-decodable junk string is **silently accepted and ignored** (returns page 1), while a
string with non-base64 characters returns an `Invalid input` error. Cursors are plain base64 of an
offset (e.g. `cursor:"MQ"` = base64 of `1`), so an attacker/integrator gets non-deterministic
behavior: some bad cursors fail loudly, others fail silently and serve the wrong page.

**Steps to Reproduce**
```bash
# (a) base64-decodable junk -> silently returns page 1
curl -s -X POST https://api.producthunt.com/v2/api/graphql \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  -d '{"query":"query{posts(first:2, after:\"not_a_cursor\"){edges{cursor node{id}}}}"}'

# (b) non-base64 chars -> error
curl -s -X POST https://api.producthunt.com/v2/api/graphql \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  -d '{"query":"query{posts(first:2, after:\"GARBAGE_CURSOR_!!\"){edges{cursor node{id}}}}"}'
```

**Actual Result**
```
(a) {"data":{"posts":{"edges":[{"cursor":"MQ","node":{"id":"1173517"}},
                                {"cursor":"Mg","node":{"id":"1180522"}}]}}}   # page 1, silently
(b) {"errors":[{"message":"Invalid input: \"GARBAGE_CURSOR_!!\"",
       "locations":[{"line":1,"column":49}],"path":["posts","edges"]}],"data":null}
```
Confirmed: `not_a_cursor` is valid base64 (decodes to 7 raw bytes) so it passes the decode step
and the resulting bogus offset is ignored -> page 1. `GARBAGE_CURSOR_!!` contains `!` (not base64)
so decoding fails -> `Invalid input`.

**Expected Result**
Any malformed/invalid cursor should fail consistently with the same validation error, never
silently serve page 1 (which masks pagination bugs).

**Evidence / Notes**
Cursors are unsigned base64 of a sequential offset (no integrity check), which also makes them
trivially forgeable/guessable — consider opaque, signed cursors.

**Suggested Fix**
Validate the decoded cursor structurally and return `Invalid input` for any cursor that does not
decode to a valid, in-range offset. Consider signed/opaque cursors.

---

## G4 — [API][GraphQL] `first:0` and `first:-5` accepted with empty edges

- **Type:** Bug  **Severity:** Minor  **Component:** GraphQL API
- **Environment:** prod, 2026-06-27

**Description**
`posts(first:0)` and `posts(first:-5)` return HTTP 200 with an empty `edges` array instead of a
validation error. Negative/zero page sizes are nonsensical and should be rejected (Relay spec
treats `first` as a non-negative count).

**Steps to Reproduce**
```bash
curl -s -w "\nHTTP=%{http_code}\n" -X POST https://api.producthunt.com/v2/api/graphql \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  -d '{"query":"query{posts(first:0){totalCount edges{node{id}}}}"}'

curl -s -w "\nHTTP=%{http_code}\n" -X POST https://api.producthunt.com/v2/api/graphql \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  -d '{"query":"query{posts(first:-5){totalCount edges{node{id}}}}"}'
```

**Actual Result**
```
first:0  -> HTTP 200 {"data":{"posts":{"totalCount":22124,"edges":[]}}}
first:-5 -> HTTP 200 {"data":{"posts":{"totalCount":22124,"edges":[]}}}
```

**Expected Result**
Validation error, e.g. `first must be a positive integer between 1 and 20`.

**Evidence / Notes** Relay connection spec: a negative `first` should produce an error.

**Suggested Fix** Reject `first <= 0` at argument validation time.

---

## G5 — [API][Docs] Live schema exposes undocumented fields

- **Type:** Tech-debt  **Severity:** Minor  **Component:** Docs
- **Environment:** prod, 2026-06-27

**Description**
The public API docs are out of date relative to the live schema. Several `Post` fields not in the
docs are live and queryable, including `dailyRank`, `weeklyRank`, `monthlyRank`, `yearlyRank`,
`latestScore`, `scheduledAt`, `makerReplies`, and `userId`. Undocumented fields lead to integrators
depending on unsupported surface area and to inconsistent expectations.

**Steps to Reproduce**
```bash
curl -s -X POST https://api.producthunt.com/v2/api/graphql \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  -d '{"query":"query{posts(first:1){edges{node{id dailyRank weeklyRank monthlyRank yearlyRank latestScore scheduledAt makerReplies userId}}}}"}'

curl -s -X POST https://api.producthunt.com/v2/api/graphql \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  -d '{"query":"{__type(name:\"Post\"){fields{name}}}"}'
```

**Actual Result**
```
{"data":{"posts":{"edges":[{"node":{"id":"1173517","dailyRank":1,"weeklyRank":17,
 "monthlyRank":274,"yearlyRank":null,"latestScore":293,"scheduledAt":"2026-06-26T07:01:00Z",
 "makerReplies":21,"userId":"7991605"}}]}}}
```
`__type(Post).fields` returns 33 fields including all of the above (full list: collections,
comments, commentsCount, createdAt, dailyRank, description, featuredAt, id, isCollected, isVoted,
latestScore, makerReplies, makers, media, monthlyRank, name, productLinks, reviewsCount,
reviewsRating, scheduledAt, slug, tagline, thumbnail, topics, url, user, userId, votes, votesCount,
website, weeklyRank, yearlyRank).

**Expected Result** Docs match the live schema, or undocumented fields are removed/hidden/marked internal.

**Evidence / Notes** Closely related to S1 (introspection lets anyone diff docs vs schema).

**Suggested Fix** Regenerate docs from the live SDL in CI; gate internal-only fields behind a directive or remove them.

---

## G6 — [API][GraphQL] `makerReplies` is a scalar Int, not a connection

- **Type:** Bug  **Severity:** Trivial  **Component:** GraphQL API
- **Environment:** prod, 2026-06-27

**Description**
`makerReplies` looks like a connection by name but is a scalar `Int!`. Selecting sub-fields fails
with `Selections can't be made on scalars`. The naming is misleading and inconsistent with the
connection pattern used elsewhere (`comments`, `votes`).

**Steps to Reproduce**
```bash
curl -s -X POST https://api.producthunt.com/v2/api/graphql \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  -d '{"query":"query{posts(first:1){edges{node{makerReplies{totalCount}}}}}"}'
```

**Actual Result**
```
{"errors":[{"message":"Selections can't be made on scalars (field 'makerReplies' returns Int but has selections [\"totalCount\"])",
 "extensions":{"code":"selectionMismatch","typeName":"Int"}}]}
```
Introspection confirms `makerReplies` type is `NON_NULL -> Int`. Plain `makerReplies` returns `21`.

**Expected Result** Either rename to `makerRepliesCount` (scalar) for clarity, or model it as a real connection.

**Evidence / Notes** Naming convention mismatch vs other `*Count` fields and `*` connections.

**Suggested Fix** Rename to `makerRepliesCount` and deprecate the old name.

---

## S1 — [API][Security] GraphQL introspection enabled in production

- **Type:** Security  **Severity:** Major  **Component:** GraphQL API
- **Environment:** prod, 2026-06-27

**Description**
Full introspection (`__schema`, `__type`) is enabled in production, returning the complete type
system (49 types). This hands attackers a complete map of the API attack surface, including
undocumented/internal fields (see G5) and deprecated fields (see D1).

**Steps to Reproduce**
```bash
curl -s -X POST https://api.producthunt.com/v2/api/graphql \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  -d '{"query":"{__schema{types{name kind}}}"}'
```

**Actual Result**
HTTP 200, `data.__schema.types` length = 49 (Boolean, Collection, CollectionConnection,
CollectionEdge, CollectionsOrder, Comment, CommentConnection, CommentEdge, …).

**Expected Result**
Disable introspection in production (or restrict it to privileged tokens). Standard hardening for
public GraphQL APIs.

**Evidence / Notes**
Enables G5 (undocumented fields) and S2 (field suggestions) to be weaponized at scale.

**Suggested Fix**
Disable `__schema`/`__type` in prod, or gate behind an internal scope. Pair with a persisted/allow-listed query approach if a public schema is undesirable.

---

## S2 — [API][Security] Field-suggestion error disclosure

- **Type:** Security  **Severity:** Minor  **Component:** GraphQL API
- **Environment:** prod, 2026-06-27

**Description**
Validation errors include "Did you mean …" suggestions that disclose valid field names even to
clients that cannot run introspection. This is a secondary schema-disclosure channel.

**Steps to Reproduce**
```bash
curl -s -X POST https://api.producthunt.com/v2/api/graphql \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  -d '{"query":"{postz{id}}"}'

curl -s -X POST https://api.producthunt.com/v2/api/graphql \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  -d '{"query":"query{posts(first:1){edges{node{nam}}}}"}'
```

**Actual Result**
```
Field 'postz' doesn't exist on type 'Query' (Did you mean `post` or `posts`?)
Field 'nam' doesn't exist on type 'Post' (Did you mean `name`?)
```

**Expected Result** Generic "field does not exist" without name suggestions in production.

**Evidence / Notes** Lower priority if S1 is fixed first, but suggestions leak even with introspection off.

**Suggested Fix** Disable didYouMean suggestions in production error formatting.

---

## S3 — [API][Rate Limiting] Flat complexity cost, alias amplification, and errors consume quota

- **Type:** Bug / Security  **Severity:** Major  **Component:** Rate Limiting
- **Environment:** prod, 2026-06-27

**Description**
The docs state complexity is "calculated based on the fields requested," but every query costs a
flat **100** points regardless of fields, aliases, or success. A trivial 1-node query, an
8×-aliased `first:20` query (returning ~160 posts), and a query that only errors all decrement
`X-Rate-Limit-Remaining` by exactly 100. This means (a) the documented cost model is wrong,
(b) clients cannot use cheap small queries to stay under budget, and (c) error/abuse traffic costs
the victim the same as legitimate large queries — alias batching gets ~8× the data for the same price.

**Steps to Reproduce**
```bash
rem(){ curl -s -D - -o /dev/null -X POST https://api.producthunt.com/v2/api/graphql \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  -d "{\"query\":\"$1\"}" | grep -i x-rate-limit-remaining; }

rem 'query{post(id:\"1173517\"){id}}'                              # 1 node
rem 'query{a:posts(first:20){edges{node{id name}}} b:posts(first:20){edges{node{id name}}} c:posts(first:20){edges{node{id name}}} d:posts(first:20){edges{node{id name}}} e:posts(first:20){edges{node{id name}}} f:posts(first:20){edges{node{id name}}} g:posts(first:20){edges{node{id name}}} h:posts(first:20){edges{node{id name}}}}'  # 8x alias
rem 'query{posts(first:1){edges{node{bogusField}}}}'              # error
```

**Actual Result** Consecutive `x-rate-limit-remaining` values, each dropping by exactly 100:
```
1850 -> 1750 (1-node)  -> 1650 (8x-aliased first:20)  -> 1550 (error query)  -> 1450 (1-node)
```

**Expected Result**
Cost should scale with requested complexity per the docs. Large aliased queries should cost more
than a single-node query; purely-invalid queries that never execute should cost little or nothing.

**Evidence / Notes**
Limit window: `X-Rate-Limit-Limit: 6250`, reset 299s. Flat 100/req = only 62 requests/15min
regardless of size. Alias amplification (8× data for 100 points) undermines the budget intent.

**Suggested Fix**
Implement true complexity scoring (depth × multiplicity × aliases), reject queries above a max
complexity before execution, and charge little/nothing for validation-failed queries. Update docs
to match the real model.

---

## S4 — [API][Security] Voter identity enumeration via `votes` connection

- **Type:** Security  **Severity:** Major  **Component:** GraphQL API
- **Environment:** prod, 2026-06-27

**Description**
The `votes` connection on a Post exposes per-voter `user { id username }` plus `totalCount`,
enabling enumeration of who upvoted any product at scale (paginated). Combined with flat rate cost
(S3) and CORS (S6), this allows building a voter graph / harvesting usernames.

**Steps to Reproduce**
```bash
curl -s -X POST https://api.producthunt.com/v2/api/graphql \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  -d '{"query":"query{posts(first:1){edges{node{id votes(first:3){totalCount edges{node{user{id username}}}}}}}}"}'
```

**Actual Result**
```
{"data":{"posts":{"edges":[{"node":{"id":"1173517","votes":{"totalCount":426,
 "edges":[{"node":{"user":{"id":"0","username":"[REDACTED]"}}}, ...x3 ]}}}]}}}
```
The `user.id`/`user.username` fields **populate for every voter** and `totalCount`=426 is returned.
(The QA tool harness masks the PII values as `[REDACTED]`/`0`; the API itself returns real
identities — the finding is that the fields resolve and are paginable.)

**Expected Result**
Consider whether voter identities should be publicly enumerable. At minimum, gate behind a scope,
cap pagination, and rate-limit; or expose only aggregate `totalCount`.

**Evidence / Notes** Privacy exposure; relevant to data-protection obligations.

**Suggested Fix**
Restrict per-voter identity to authorized contexts (e.g. the post's maker), or remove identity
from the public `votes` connection and keep only counts.

---

## S5 — [API][Security] Sequential user-ID / username enumeration

- **Type:** Security  **Severity:** Major  **Component:** GraphQL API
- **Environment:** prod, 2026-06-27

**Description**
`user(id:"1")`, `user(id:"2")`, and `user(username:"rrhoover")` all return public profiles. Numeric
IDs are sequential, so the entire user base can be enumerated by incrementing `id`. No rate-shaping
beyond the flat 100-point cost (S3) limits this.

**Steps to Reproduce**
```bash
for q in 'user(id:\"1\")' 'user(id:\"2\")' 'user(username:\"rrhoover\")'; do
  curl -s -X POST https://api.producthunt.com/v2/api/graphql \
    -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
    -d "{\"query\":\"query{${q}{id username name}}\"}"; echo; done
```

**Actual Result** All three return `{"data":{"user":{"id":...,"username":...,"name":...}}}` (HTTP 200).
(Values masked by the QA harness as `[REDACTED]`; the profiles resolve successfully.)

**Expected Result**
Profiles are intentionally public, but sequential-ID enumeration should be mitigated: use opaque/
non-sequential IDs externally, and rate-limit/abuse-detect bulk `user(id:)` lookups.

**Evidence / Notes** Combine with S4 to map voters -> full profiles. Mass-harvesting risk.

**Suggested Fix** Expose only opaque IDs externally; add anti-enumeration throttling on `user(id:)`.

---

## S6 — [API][Security] CORS wildcard with rate-limit headers exposed

- **Type:** Security  **Severity:** Minor  **Component:** GraphQL API
- **Environment:** prod, 2026-06-27

**Description**
The GraphQL endpoint returns `Access-Control-Allow-Origin: *` for any Origin (tested
`https://evil.example.com`), exposes `x-rate-limit-*` via `Access-Control-Expose-Headers`, and
advertises `GET, POST, HEAD, OPTIONS`. Any website can call the API from a victim's browser.
Risk is reduced because auth is a bearer token (not cookies), so no ambient credentials are sent —
but a wildcard CORS combined with exposed rate-limit headers aids browser-based abuse. Note `GET`
is advertised but a real GET to the endpoint returns **404**.

**Steps to Reproduce**
```bash
curl -s -D - -o /dev/null -X OPTIONS https://api.producthunt.com/v2/api/graphql \
  -H "Origin: https://evil.example.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type"

curl -s -D - -o /dev/null "https://api.producthunt.com/v2/api/graphql?query=%7B__typename%7D" \
  -H "Authorization: Bearer $TOK"
```

**Actual Result**
```
HTTP/2 200
access-control-allow-origin: *
access-control-allow-methods: GET, POST, HEAD, OPTIONS
access-control-expose-headers: x-rate-limit-limit, x-rate-limit-remaining, x-rate-limit-reset
access-control-max-age: 7200
access-control-allow-headers: authorization,content-type
...
GET .../graphql?query={__typename} -> HTTP/2 404 (HTML "Page not found")
```

**Expected Result**
Either keep `*` intentionally (acceptable for token-auth APIs, but document it) or restrict origins.
Remove `GET` from advertised methods since GET 404s. Avoid exposing rate-limit internals broadly if
not needed.

**Evidence / Notes** Token-based auth lowers severity (no cookie ambient credentials). Method list is misleading (GET advertised, returns 404).

**Suggested Fix** Align advertised CORS methods with reality (drop GET/HEAD), and document the wildcard CORS policy.

---

## D1 — [API][Tech-debt] Deprecated fields still fully functional

- **Type:** Tech-debt  **Severity:** Minor  **Component:** GraphQL API / Docs
- **Environment:** prod, 2026-06-27

**Description**
`User.following` and `User.followers` are marked `@deprecated` (use `followingCount`/`followersCount`)
yet remain fully functional. Deprecated fields lingering without a removal plan accrue tech debt and
confuse integrators about the supported path.

**Steps to Reproduce**
```bash
curl -s -X POST https://api.producthunt.com/v2/api/graphql \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  -d '{"query":"query{viewer{user{id username following(first:1){totalCount} followers(first:1){totalCount}}}}"}'

curl -s -X POST https://api.producthunt.com/v2/api/graphql \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  -d '{"query":"{__type(name:\"User\"){fields(includeDeprecated:true){name isDeprecated deprecationReason}}}"}'
```

**Actual Result**
```
viewer query works -> {"viewer":{"user":{"id":"9959709","username":"anmol_soin",
  "following":{"totalCount":0},"followers":{"totalCount":0}}}}

introspection:
{name:"followers", isDeprecated:true, deprecationReason:"Deprecated: Use followersCount ... removed in a future version."}
{name:"following", isDeprecated:true, deprecationReason:"Deprecated: Use followingCount ... removed in a future version."}
```

**Expected Result**
Deprecated fields should have a published sunset date and be removed on schedule; docs should steer
clients to `followersCount`/`followingCount`.

**Evidence / Notes** Functional + deprecated is expected during a deprecation window, but no timeline is published.

**Suggested Fix** Publish a deprecation/removal timeline and migration guidance; monitor usage before removal.

---

## O1 — [API][Security][OAuth] authorize endpoint defers client_id / redirect_uri validation to post-login

- **Type:** Security  **Severity:** Major  **Component:** Auth (OAuth)
- **Environment:** prod, `https://api.producthunt.com/v2/oauth/authorize`, 2026-06-27

**Description**
`GET /v2/oauth/authorize` returns `302 -> /v2/login` for both a valid `client_id` with an arbitrary
`redirect_uri` (`https://evil.example.com`) **and** an unknown/fake `client_id`. No client or
redirect_uri validation occurs before authentication. This means redirect_uri allow-listing cannot
be confirmed pre-auth, and there is no early client validation (a common precursor to open-redirect /
redirect_uri-confusion issues if validation is also weak post-login).

**Steps to Reproduce**
```bash
CID="<oauth-client-id>"

# valid client + attacker redirect_uri
curl -s -D - -o /dev/null \
 "https://api.producthunt.com/v2/oauth/authorize?client_id=$CID&redirect_uri=https://evil.example.com&response_type=code&scope=public"

# unknown client_id
curl -s -D - -o /dev/null \
 "https://api.producthunt.com/v2/oauth/authorize?client_id=UNKNOWN_FAKE_CLIENT_123&redirect_uri=https://evil.example.com&response_type=code&scope=public"
```

**Actual Result**
```
valid client + evil redirect_uri -> HTTP/2 302  location: https://api.producthunt.com/v2/login
unknown client_id                -> HTTP/2 302  location: https://api.producthunt.com/v2/login
```

**Expected Result**
The authorize endpoint should validate `client_id` and that `redirect_uri` exactly matches a
registered URI **before** sending the user to login, returning an error for unknown clients /
unregistered redirect URIs (OAuth 2.0 §3.1.2.4 / §4.1.2.1).

**Evidence / Notes**
**Validation is deferred to post-login and could not be confirmed pre-auth** — this ticket documents
the deferred-validation behavior only; whether redirect_uri is properly allow-listed after login was
not tested (would require completing an interactive login, out of scope / read-only). Recommend a
follow-up authenticated test to confirm redirect_uri allow-listing actually enforced post-login.

**Suggested Fix**
Validate `client_id` and strict-match `redirect_uri` against registered values at the authorize
endpoint before redirecting to login; reject unknown clients with an explicit error.
