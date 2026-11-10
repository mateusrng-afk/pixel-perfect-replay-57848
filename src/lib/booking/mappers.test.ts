import { describe, expect, it } from "vitest";
import { mapAppointment, mapBusinessHour, shopDayStart, shopNextDayStart } from "./mappers";

describe("conversão dos dados do banco", () => {
  it("mostra o agendamento no horário de Maceió", () => {
    const appt = mapAppointment({
      id: "a1",
      barber_id: "b1",
      client_name: "João",
      client_phone: "(82) 99999-0000",
      selected_services: [{ id: "s1", name: "Corte", price: 30, duration_minutes: 30 }],
      appointment_at: "2026-11-16T12:00:00+00:00",
      total_price: 30,
      total_duration: 30,
      status: "pending",
      created_at: null,
    });
    expect(appt.date).toBe("2026-11-16");
    expect(appt.start_time).toBe("09:00");
    expect(appt.end_time).toBe("09:30");
    expect(appt.service_names).toEqual(["Corte"]);
  });

  it("dia fechado sem horário vira 'fechado'", () => {
    const h = mapBusinessHour({ id: "h", barber_id: "b1", weekday: 0, opening_time: null, closing_time: null, is_closed: true });
    expect(h.is_closed).toBe(true);
    const open = mapBusinessHour({ id: "h", barber_id: "b1", weekday: 1, opening_time: "08:00:00", closing_time: "19:00:00", is_closed: false });
    expect(open).toMatchObject({ day_of_week: 1, open_time: "08:00", close_time: "19:00", is_closed: false });
  });

  it("filtra o dia inteiro no fuso da barbearia", () => {
    expect(shopDayStart("2026-12-31")).toBe("2026-12-31T00:00:00-03:00");
    expect(shopNextDayStart("2026-12-31")).toBe("2027-01-01T00:00:00-03:00");
  });
});
