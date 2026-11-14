/**
 * Pure helpers for the WhatsApp booking notification (no secrets, no I/O),
 * shared by the server function and its tests.
 */

export const SHOP_TIME_ZONE = "America/Maceio";
export const DEFAULT_TEMPLATE_NAME = "agendamento_confirmado";
export const DEFAULT_API_VERSION = "v23.0";

/** Brazilian phone -> digits with country code 55, or null when it cannot be a valid number. */
export function normalizeBrazilPhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return null;
}

/** Normalized, de-duplicated recipients; invalid or empty numbers are dropped. */
export function uniqueRecipients(phones: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const p of phones) {
    const n = normalizeBrazilPhone(p);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

/** Meta rejects template parameters with line breaks, tabs, runs of spaces or empty text. */
export function cleanParam(value: string | null | undefined): string {
  const text = (value ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
  return text || "-";
}

export function formatShopDate(iso: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: SHOP_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("day")}/${get("month")}/${get("year")}`, time: `${get("hour")}:${get("minute")}` };
}

export function formatBRL(value: number): string {
  return Number(value)
    .toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    .replace(/\u00a0/g, " ");
}

export interface NotificationAppointment {
  client_name: string;
  barber_name: string;
  appointment_at: string;
  service_names: string[];
  total_price: number;
}

/** Six template variables, in order: cliente, barbeiro, data, hora, serviços, preço. */
export function buildTemplateParams(a: NotificationAppointment): string[] {
  const { date, time } = formatShopDate(a.appointment_at);
  return [a.client_name, a.barber_name, date, time, a.service_names.join(", "), formatBRL(a.total_price)].map(
    cleanParam,
  );
}

/** Service names from the appointment's stored `selected_services` JSON. */
export function serviceNames(selected: unknown): string[] {
  if (!Array.isArray(selected)) return [];
  return selected
    .map((s) => (s && typeof s === "object" && "name" in s ? String((s as { name: unknown }).name) : ""))
    .filter(Boolean);
}

export function buildTemplateMessage(to: string, templateName: string, params: string[]) {
  return {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: "pt_BR" },
      components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }],
    },
  };
}

/** Names of the required WhatsApp settings that are still missing. */
export function missingWhatsAppConfig(env: { token?: string | undefined; phoneNumberId?: string | undefined }): string[] {
  return [!env.token && "WHATSAPP_ACCESS_TOKEN", !env.phoneNumberId && "WHATSAPP_PHONE_NUMBER_ID"].filter(
    (x): x is string => Boolean(x),
  );
}
