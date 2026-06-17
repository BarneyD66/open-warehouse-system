# Mock Carrier Adapter Design

This document defines a safe mock carrier adapter scope for Open Warehouse System.

The goal is to let contributors work on rate quoting, label creation, tracking updates, and carrier error handling without using real Royal Mail, DPD, Evri, DHL, UPS, or other production carrier credentials.

## Goals

- Provide a stable interface for carrier-related workflows.
- Support local demos, screenshots, tests, and onboarding with fake logistics data.
- Keep carrier-specific behavior isolated from warehouse, billing, and customer portal code.
- Make future real carrier integrations easier to add and review.
- Avoid exposing production API keys, account numbers, labels, webhooks, or pricing contracts.

## Non-goals

- Do not connect to real carrier APIs.
- Do not store or document real carrier credentials.
- Do not generate legally valid shipping labels.
- Do not claim compliance with any carrier certification process.
- Do not model every country-specific delivery rule in the first version.

## Suggested Interface Shape

A carrier adapter should support four basic operations:

```ts
type CarrierAdapter = {
  quoteRate(input: RateQuoteInput): Promise<RateQuoteResult>;
  createLabel(input: LabelCreateInput): Promise<LabelCreateResult>;
  getTracking(input: TrackingQueryInput): Promise<TrackingResult>;
  cancelLabel(input: CancelLabelInput): Promise<CancelLabelResult>;
};
```

The internal workflow should pass normalized warehouse data into the adapter. The adapter can translate that data into provider-specific payloads later.

## Normalized Data Boundaries

Keep internal fields separate from provider payloads:

| Internal concept | Example internal field | Provider-specific mapping |
| --- | --- | --- |
| Order reference | `outboundOrderId` | carrier shipment reference |
| Customer code | `customerCode` | optional metadata only |
| Service code | `serviceCode` | Royal Mail / DPD / Evri service id |
| Package weight | `weightKg` | provider weight unit |
| Recipient postal code | `recipientPostalCode` | provider address field |
| Tracking number | `trackingNo` | provider tracking id |
| Label URL | `labelUrl` | generated mock URL or real label URL later |

Provider payloads should not leak into customer-facing exports unless they are intentionally exposed fields such as carrier name and tracking number.

## Mock Behavior

The mock adapter should be deterministic:

- Same input produces the same quote category.
- Tracking numbers use fake prefixes such as `MOCK-RM-`, `MOCK-DPD-`, or `MOCK-EVRI-`.
- Label URLs point to local or fake paths, not real carrier systems.
- Tracking events use predictable statuses: `label_created`, `handed_over`, `in_transit`, `out_for_delivery`, `delivered`, `exception`.
- Error cases can be triggered by fake service codes or postal codes.

Suggested fake error triggers:

| Trigger | Mock response |
| --- | --- |
| `serviceCode=mock_label_failed` | label creation failure |
| `recipientPostalCode=INVALID` | address validation failure |
| `weightKg > 30` | overweight parcel |
| `serviceCode=mock_tracking_timeout` | tracking service timeout |

## Safe Demo Data Rules

Use only fake data:

- Fake customer names.
- Fake recipient names.
- Fake addresses.
- Fake SKUs.
- Fake tracking numbers.
- Fake service codes.
- Fake label URLs.
- Fake billing references.

Never commit:

- Carrier API keys.
- Carrier account numbers.
- Production labels.
- Production webhook secrets.
- Real customer shipment data.
- Private carrier pricing sheets.
- `.env.local`.

## Customer-facing Output

Customer-facing pages and exports may show:

- Carrier display name.
- Service display name.
- Fake tracking number.
- Shipment status.
- Estimated carrier fee.
- Delivery exception summary.

For Chinese-mode customer-facing CSV/Excel exports and templates, keep headers and sample rows Chinese-first. English field names can exist as internal aliases or adapter fields, but should not replace Chinese customer-facing examples.

## Future Real Carrier Path

When adding a real carrier integration:

1. Keep the mock adapter as the default local option.
2. Add provider credentials through environment variables or a secret manager.
3. Document required credentials without showing real values.
4. Add provider-specific request and response mapping behind the adapter.
5. Add error handling for label failure, tracking timeout, address validation, and cancellation.
6. Add tests that can run without production credentials.
7. Update `SECURITY.md` if the integration changes credential or webhook handling.

## Related Docs

- `docs/INTERNATIONALIZATION.md`
- `docs/SCREENSHOT_GUIDE.md`
- `docs/STAFF_AUTH.md`
- `SECURITY.md`
