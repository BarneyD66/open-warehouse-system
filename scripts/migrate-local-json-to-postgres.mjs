import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

const PUBLIC_LEAD_CUSTOMER_CODE = "PUBLIC_LEAD";

function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    const envPath = resolve(process.cwd(), file);
    if (!existsSync(envPath)) continue;

    const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;

      const key = trimmed.slice(0, index).trim();
      let value = trimmed.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

function normalizeSubmission(item) {
  const id = customerFacingId(item.id);
  return {
    ...item,
    id,
    customerCode: item.customerCode,
    events: Array.isArray(item.events) ? item.events.map((event) => ({ ...event, refId: id })) : [],
  };
}

function customerFacingId(id) {
  return String(id).replace(/^INQ-/i, "咨询-").replace(/^询盘-/i, "咨询-").replace(/^ASN-UK-/i, "入库-UK-");
}

function submissionTitle(item) {
  return item.type === "inquiry" ? item.company || "" : item.customer || item.productName || "";
}

function submissionSearchText(item) {
  const fields =
    item.type === "inquiry"
      ? [
          item.id,
          item.customerCode,
          item.company,
          item.contact,
          item.phone,
          item.email,
          item.platform,
          item.volume,
          item.service,
          item.status,
          item.tailDeliveryNeed,
          item.note,
          item.quoteEstimate,
          item.followUpNote,
          item.quoteDraft?.notes,
          item.quoteResponse?.message,
        ]
      : [
          item.id,
          item.customerCode,
          item.customer,
          item.contact,
          item.phone,
          item.platform,
          item.transport,
          item.tracking,
          item.productName,
          item.service,
          item.attribute,
          item.status,
          item.supplementNote,
          item.opsNote,
          item.exceptionNote,
          ...(item.attachmentNames || []),
          ...(item.skuLines || []).flatMap((line) => [line.skuCode, line.productName]),
        ];
  return fields.filter(Boolean).join(" ").toLowerCase();
}

loadLocalEnv();

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Missing POSTGRES_URL or DATABASE_URL. Add it to the environment before running db:migrate:local.");
  process.exit(1);
}

const storePath = resolve(process.cwd(), ".local-data", "submissions.json");

if (!existsSync(storePath)) {
  console.log("No .local-data/submissions.json found. Nothing to migrate.");
  process.exit(0);
}

const schemaPath = resolve(process.cwd(), "db", "schema.sql");
const schema = readFileSync(schemaPath, "utf8");
const raw = JSON.parse(readFileSync(storePath, "utf8"));
const submissions = Array.isArray(raw.submissions) ? raw.submissions.map(normalizeSubmission) : [];
const sql = postgres(connectionString, {
  max: 1,
  idle_timeout: 5,
  connect_timeout: 10,
  prepare: false,
});

try {
  await sql.unsafe(schema);

  for (const item of submissions) {
    await sql`
      insert into warehouse_submissions (
        id,
        type,
        customer_code,
        status,
        title,
        contact,
        phone,
        search_text,
        payload,
        created_at,
        updated_at
      )
      values (
        ${item.id},
        ${item.type},
        ${item.customerCode || PUBLIC_LEAD_CUSTOMER_CODE},
        ${item.status},
        ${submissionTitle(item)},
        ${item.contact || ""},
        ${item.phone || ""},
        ${submissionSearchText(item)},
        ${sql.json(item)},
        ${item.createdAt || new Date().toISOString()},
        ${item.updatedAt || null}
      )
      on conflict (id) do update set
        type = excluded.type,
        customer_code = excluded.customer_code,
        status = excluded.status,
        title = excluded.title,
        contact = excluded.contact,
        phone = excluded.phone,
        search_text = excluded.search_text,
        payload = excluded.payload,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at
    `;
  }

  console.log(`Migrated ${submissions.length} local submission(s) to PostgreSQL.`);
} finally {
  await sql.end({ timeout: 5 });
}
