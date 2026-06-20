# 129 eBay Platform API Adapter Pass

## Scope

- Added eBay Fulfillment API order pull support in `platformGateway`.
- Normalizes eBay orders into the shared platform order import model.
- Detects cancelled/canceled eBay orders and passes them into the existing platform cancellation review flow.
- Added eBay shipping fulfillment callback support for tracking number upload.
- Updated platform credential validation so live API sync can use platform default environment variables, not only `credentialRef`.
- Updated ops platform setup copy with Shopify and eBay environment examples.

## Environment

- Single eBay shop:
  - `EBAY_ACCESS_TOKEN` or `EBAY_API_TOKEN`
  - Optional `EBAY_API_BASE_URL=https://api.ebay.com`
- Multi-shop:
  - Add `credentialRef=EBAY_STORE_A` in the platform connection note.
  - Configure `EBAY_STORE_A_ACCESS_TOKEN` and optional `EBAY_STORE_A_API_BASE_URL`.

## Verification

- Passed `npm run lint`.
- Passed `npm run build`.
- Passed conflict marker check.
- Passed `git diff --check` with only existing CRLF normalization warnings.
