export const POSTS = `
  query Posts($first: Int!, $after: String) {
    posts(first: $first, after: $after) {
      totalCount
      edges {
        cursor
        node {
          id
          name
          slug
          tagline
          votesCount
          createdAt
        }
      }
      pageInfo {
        startCursor
        endCursor
        hasNextPage
        hasPreviousPage
      }
    }
  }
`;

export const POST_BY_ID = `
  query PostById($id: ID!) {
    post(id: $id) {
      id
      name
      slug
      tagline
    }
  }
`;

export const POST_BY_SLUG = `
  query PostBySlug($slug: String!) {
    post(slug: $slug) {
      id
      name
      slug
      tagline
    }
  }
`;

export const POSTS_BY_VOTES = `
  query PostsByVotes($first: Int!) {
    posts(first: $first, order: VOTES) {
      edges {
        node {
          id
          name
          votesCount
        }
      }
    }
  }
`;

export const TOPICS = `
  query Topics($first: Int!) {
    topics(first: $first) {
      edges {
        node {
          id
          name
          slug
        }
      }
    }
  }
`;
