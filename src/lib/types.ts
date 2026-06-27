export type OAuthError = {
  error: string;
  error_description?: string;
};

export type GraphQLError = {
  message?: string;
  locations?: Array<{ line: number; column: number }>;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
} & Partial<OAuthError>;

export type GraphQLResponse<T> = {
  data: T | null;
  errors?: GraphQLError[];
  status: number;
  headers: Headers;
};

export type PageInfo = {
  startCursor?: string | null;
  endCursor?: string | null;
  hasNextPage: boolean;
  hasPreviousPage?: boolean;
};

export type Edge<T> = {
  node: T;
  cursor?: string;
};

export type Connection<T> = {
  totalCount?: number;
  edges: Array<Edge<T>>;
  pageInfo?: PageInfo;
};

export type Post = {
  id: string;
  name: string;
  slug?: string;
  tagline?: string;
  votesCount?: number;
  commentsCount?: number;
  reviewsCount?: number;
  createdAt?: string;
  isVoted?: boolean;
  isCollected?: boolean;
};

export type Topic = {
  id: string;
  name: string;
  slug?: string;
};
