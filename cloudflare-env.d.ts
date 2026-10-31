declare namespace Cloudflare {
  interface Env {
    RESEARCH_PROVIDER_URL?: string;
    RESEARCH_PROVIDER_TOKEN?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
