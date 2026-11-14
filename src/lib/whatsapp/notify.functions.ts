/**
 * Sends the "agendamento confirmado" WhatsApp template after a successful booking.
 * Called by the public booking page; it never changes or blocks the appointment.
 * Each appointment is notified at most once (whatsapp_notification_logs); only a
 * failed attempt may be retried. Credentials come from server secrets only.
 */
import { createServerFn } from "@tanstack/react-start";
import {
  DEFAULT_API_VERSION,
  DEFAULT_TEMPLATE_NAME,
  buildTemplateMessage,
  buildTemplateParams,
  missingWhatsAppConfig,
  serviceNames,
  uniqueRecipients,
} from "./notification";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type NotifyResult =
  | { ok: true; sent: number }
  | { ok: false; reason: "not_found" | "cancelled" | "already_handled" | "config_pending" | "no_recipients" | "send_failed" | "error" };

export const notifyBookingWhatsApp = createServerFn({ method: "POST" })
  .validator((data: { appointment_id: string }) => {
    if (!data || typeof data.appointment_id !== "string" || !UUID.test(data.appointment_id)) {
      throw new Error("invalid_appointment_id");
    }
    return { appointment_id: data.appointment_id };
  })
  .handler(async ({ data }): Promise<NotifyResult> => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const appointmentId = data.appointment_id;

    const { data: appt, error: apptError } = await db
      .from("appointments")
      .select("id, client_name, client_phone, selected_services, appointment_at, total_price, status, barbers(name, whatsapp_phone)")
      .eq("id", appointmentId)
      .maybeSingle();
    if (apptError) {
      console.error("[whatsapp] appointment lookup failed:", apptError.message);
      return { ok: false, reason: "error" };
    }
    if (!appt) return { ok: false, reason: "not_found" };
    if (appt.status === "cancelled") return { ok: false, reason: "cancelled" };

    // Claim: a new log row, or a retry of a failed one. Anything else was already handled.
    const { error: insertError } = await db
      .from("whatsapp_notification_logs")
      .insert({ appointment_id: appointmentId, status: "processing" });
    if (insertError) {
      if (insertError.code !== "23505") {
        console.error("[whatsapp] log insert failed:", insertError.message);
        return { ok: false, reason: "error" };
      }
      const { data: retried, error: retryError } = await db
        .from("whatsapp_notification_logs")
        .update({ status: "processing", error_message: null })
        .eq("appointment_id", appointmentId)
        .eq("status", "failed")
        .select("appointment_id");
      if (retryError) {
        console.error("[whatsapp] log retry failed:", retryError.message);
        return { ok: false, reason: "error" };
      }
      if (!retried?.length) return { ok: false, reason: "already_handled" };
    }

    const finish = async (status: "sent" | "failed", errorMessage: string | null) => {
      const { error } = await db
        .from("whatsapp_notification_logs")
        .update({ status, error_message: errorMessage ? errorMessage.slice(0, 2000) : null })
        .eq("appointment_id", appointmentId);
      if (error) console.error("[whatsapp] log update failed:", error.message);
    };

    try {
      const token = process.env['WHATSAPP_ACCESS_TOKEN'];
      const phoneNumberId = process.env['WHATSAPP_PHONE_NUMBER_ID'];
      const missing = missingWhatsAppConfig({ token, phoneNumberId });
      if (missing.length) {
        await finish("failed", `CONFIG_PENDING: faltam os segredos ${missing.join(", ")}`);
        return { ok: false, reason: "config_pending" };
      }

      const templateName = process.env['WHATSAPP_TEMPLATE_NAME'] || DEFAULT_TEMPLATE_NAME;
      const apiVersion = process.env['WHATSAPP_API_VERSION'] || DEFAULT_API_VERSION;
      const barber = appt.barbers;

      const recipients = uniqueRecipients([appt.client_phone, barber?.whatsapp_phone, process.env['WHATSAPP_ADMIN_PHONE']]);
      if (!recipients.length) {
        await finish("failed", "NO_RECIPIENTS: nenhum telefone válido");
        return { ok: false, reason: "no_recipients" };
      }

      const params = buildTemplateParams({
        client_name: appt.client_name,
        barber_name: barber?.name ?? "",
        appointment_at: appt.appointment_at,
        service_names: serviceNames(appt.selected_services),
        total_price: Number(appt.total_price),
      });

      const errors: string[] = [];
      let sent = 0;
      for (const to of recipients) {
        const res = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(buildTemplateMessage(to, templateName, params)),
        });
        const body = await res.text();
        if (res.ok) sent++;
        else errors.push(`[${res.status}] ****${to.slice(-4)}: ${body.slice(0, 500)}`);
      }

      if (errors.length) {
        console.error("[whatsapp] send failed:", errors.join(" | "));
        await finish("failed", errors.join(" | "));
        return { ok: false, reason: "send_failed" };
      }
      await finish("sent", null);
      return { ok: true, sent };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("[whatsapp] notification failed:", message);
      await finish("failed", `ERROR: ${message}`);
      return { ok: false, reason: "error" };
    }
  });
