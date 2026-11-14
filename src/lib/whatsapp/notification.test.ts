import { describe, expect, it } from "vitest";
import {
  buildTemplateMessage,
  buildTemplateParams,
  missingWhatsAppConfig,
  normalizeBrazilPhone,
  serviceNames,
  uniqueRecipients,
} from "./notification";

describe("normalizeBrazilPhone", () => {
  it("adds the 55 country code to a masked mobile number", () => {
    expect(normalizeBrazilPhone("(82) 99999-1234")).toBe("5582999991234");
  });
  it("keeps a number that already has 55", () => {
    expect(normalizeBrazilPhone("+55 82 99999-1234")).toBe("5582999991234");
  });
  it("adds 55 to a local number whose area code is 55", () => {
    expect(normalizeBrazilPhone("(55) 99999-1234")).toBe("5555999991234");
  });
  it("rejects numbers that are too short", () => {
    expect(normalizeBrazilPhone("99999-1234")).toBeNull();
    expect(normalizeBrazilPhone("")).toBeNull();
    expect(normalizeBrazilPhone(null)).toBeNull();
  });
});

describe("uniqueRecipients", () => {
  it("sends only once to the same number and skips empty barber/admin numbers", () => {
    expect(uniqueRecipients(["(82) 99999-1234", "5582999991234", null, undefined, "(82) 98888-0000"])).toEqual([
      "5582999991234",
      "5582988880000",
    ]);
  });
});

describe("buildTemplateParams", () => {
  it("fills the six variables with date and time in America/Maceio", () => {
    const params = buildTemplateParams({
      client_name: "João Silva",
      barber_name: "Genario",
      appointment_at: "2026-11-20T17:30:00Z", // 14:30 in Maceió (-03:00)
      service_names: ["Corte", "Barba"],
      total_price: 65,
    });
    expect(params).toEqual(["João Silva", "Genario", "20/11/2026", "14:30", "Corte, Barba", "R$ 65,00"]);
  });
  it("never sends an empty variable or a line break", () => {
    const params = buildTemplateParams({
      client_name: "Ana\nPaula",
      barber_name: "",
      appointment_at: "2026-11-20T11:00:00Z",
      service_names: [],
      total_price: 0,
    });
    expect(params[0]).toBe("Ana Paula");
    expect(params[1]).toBe("-");
    expect(params[4]).toBe("-");
  });
});

describe("template message", () => {
  it("uses the pt_BR template with the parameters in order", () => {
    const msg = buildTemplateMessage("5582999991234", "agendamento_confirmado", ["a", "b"]);
    expect(msg.template.language.code).toBe("pt_BR");
    expect(msg.template.components[0]?.parameters.map((p) => p.text)).toEqual(["a", "b"]);
  });
  it("reads service names from the stored services", () => {
    expect(serviceNames([{ name: "Corte" }, { name: "Barba" }])).toEqual(["Corte", "Barba"]);
    expect(serviceNames(null)).toEqual([]);
  });
});

describe("missingWhatsAppConfig", () => {
  it("lists the missing token and phone number id", () => {
    expect(missingWhatsAppConfig({})).toEqual(["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"]);
    expect(missingWhatsAppConfig({ token: "x", phoneNumberId: "y" })).toEqual([]);
  });
});
