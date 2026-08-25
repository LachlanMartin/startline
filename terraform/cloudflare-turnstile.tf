# Cloudflare Turnstile — bot detection for public forms. One widget shared by
# both environments. The site key is public (NEXT_PUBLIC_*); the secret key is
# sensitive and lands only in the per-env app secrets.
resource "cloudflare_turnstile_widget" "spam_bot_protection" {
  account_id = var.cloudflare_account_id
  name       = "startline-web-app"

  domains = ["startlineau.com", "www.startlineau.com", "staging.startlineau.com", "localhost"]

  mode = "invisible"
}
