/**
 * Esquema de Postgres. Las cuatro primeras tablas son las que espera Better Auth
 * (usuario, sesión, cuenta y verificación); el resto es de planes y pagos.
 *
 * Cambios: editar este archivo y correr `pnpm --filter @pdf-editor/web db:generate`
 * para crear la migración en apps/web/drizzle. Las migraciones se aplican solas al
 * arrancar el servidor (instrumentation.ts).
 */
import { boolean, date, index, integer, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ---------- Better Auth ----------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// ---------- Planes y pagos ----------

/**
 * Plan pago vigente de cada usuario (una fila por usuario). Wompi no tiene
 * suscripciones nativas: cada pago aprobado extiende `currentPeriodEnd`.
 * Sin fila, o con la vigencia vencida, el usuario está en el plan gratis.
 */
export const subscription = pgTable("subscription", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  /** Último plan comprado: weekly | pro_monthly | pro_yearly. */
  plan: text("plan").notNull(),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
  /** Fin de vigencia para el que ya se envió el aviso de vencimiento (evita repetirlo). */
  reminderSentFor: timestamp("reminder_sent_for", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Intento de pago con Wompi. Se crea al abrir el checkout y lo actualizan los eventos. */
export const payment = pgTable(
  "payment",
  {
    /** Referencia única que se envía a Wompi. */
    reference: text("reference").primaryKey(),
    /** Si el usuario borra su cuenta, el registro del pago se conserva sin dueño. */
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    plan: text("plan").notNull(),
    amountInCents: integer("amount_in_cents").notNull(),
    currency: text("currency").notNull().default("COP"),
    /** PENDING | APPROVED | DECLINED | VOIDED | ERROR (estados de Wompi). */
    status: text("status").notNull().default("PENDING"),
    wompiTransactionId: text("wompi_transaction_id").unique(),
    /** Momento en que el pago extendió el plan. Solo se aplica una vez (idempotencia). */
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("payment_user_id_idx").on(t.userId)],
);

/** Registro de eventos de Wompi recibidos con firma válida (auditoría y deduplicación). */
export const paymentEvent = pgTable("payment_event", {
  /** Checksum del evento: Wompi reenvía el mismo evento con el mismo checksum. */
  checksum: text("checksum").primaryKey(),
  event: text("event").notNull(),
  reference: text("reference"),
  transactionId: text("transaction_id"),
  status: text("status"),
  payload: jsonb("payload").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Uso diario (hora de Colombia) por sujeto: `u:<id de usuario>` o `ip:<hash>`
 * para visitantes sin sesión. Se cuenta en el servidor antes de cada descarga.
 */
export const dailyUsage = pgTable(
  "daily_usage",
  {
    subject: text("subject").notNull(),
    day: date("day").notNull(),
    downloads: integer("downloads").notNull().default(0),
    pages: integer("pages").notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.subject, t.day] }), index("daily_usage_day_idx").on(t.day)],
);

export const schema = { user, session, account, verification, subscription, payment, paymentEvent, dailyUsage };
